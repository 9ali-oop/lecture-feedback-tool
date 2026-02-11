/**
 * sessions.js — In-memory session state management
 *
 * Data model:
 *   sessions = Map<sessionCode, {
 *     teacherSocketId: string,
 *     clients: Map<socketId, feedbackLevel>,   // each student's current state
 *     createdAt: number
 *   }>
 *
 *   socketToSession = Map<socketId, { code, role }>  // reverse lookup for disconnect cleanup
 *
 * Feedback levels: "gotit" | "neutral" | "confused" | "lost"
 */

const FEEDBACK_LEVELS = ["gotit", "neutral", "confused", "lost"];

// Primary data stores
const sessions = new Map();
const socketToSession = new Map();

// ── Session code generation ──────────────────────────────────────────────────

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // omit ambiguous 0/O, 1/I
  let code;
  do {
    code = "";
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (sessions.has(code)); // ensure uniqueness
  return code;
}

// ── Session CRUD ─────────────────────────────────────────────────────────────

function createSession(teacherSocketId) {
  const code = generateCode();
  sessions.set(code, {
    teacherSocketId,
    clients: new Map(),
    createdAt: Date.now(),
  });
  socketToSession.set(teacherSocketId, { code, role: "teacher" });
  return code;
}

function sessionExists(code) {
  return sessions.has(code);
}

function addStudent(code, socketId) {
  const session = sessions.get(code);
  if (!session) return false;

  // Default feedback state is "neutral"
  session.clients.set(socketId, "neutral");
  socketToSession.set(socketId, { code, role: "student" });
  return true;
}

function updateFeedback(code, socketId, level) {
  if (!FEEDBACK_LEVELS.includes(level)) return false;

  const session = sessions.get(code);
  if (!session || !session.clients.has(socketId)) return false;

  session.clients.set(socketId, level);
  return true;
}

/**
 * Compute aggregate counts for a session.
 * Returns { gotit, neutral, confused, lost, total }
 */
function getAggregate(code) {
  const session = sessions.get(code);
  if (!session) return null;

  const counts = { gotit: 0, neutral: 0, confused: 0, lost: 0 };
  for (const level of session.clients.values()) {
    counts[level]++;
  }
  counts.total = session.clients.size;
  return counts;
}

function getSession(code) {
  return sessions.get(code);
}

/**
 * Handle a socket disconnecting — remove from session and return
 * { code, role } so caller can broadcast updates if needed.
 */
function removeSocket(socketId) {
  const info = socketToSession.get(socketId);
  if (!info) return null;

  const { code, role } = info;
  const session = sessions.get(code);

  if (session) {
    if (role === "student") {
      session.clients.delete(socketId);
    }
    // If teacher disconnects we keep session alive for now
    // (teacher could reconnect). A cleanup timer could be added here.
    // TODO: Add session expiry / cleanup timer for abandoned sessions
  }

  socketToSession.delete(socketId);
  return { code, role };
}

function endSession(code) {
  const session = sessions.get(code);
  if (!session) return false;

  // Clean up reverse mappings for all participants
  socketToSession.delete(session.teacherSocketId);
  for (const socketId of session.clients.keys()) {
    socketToSession.delete(socketId);
  }

  sessions.delete(code);
  return true;
}

module.exports = {
  FEEDBACK_LEVELS,
  createSession,
  sessionExists,
  addStudent,
  updateFeedback,
  getAggregate,
  getSession,
  removeSocket,
  endSession,
};
