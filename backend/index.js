/**
 * index.js — Express + Socket.io server for real-time lecture feedback
 *
 * Socket events:
 *   Client → Server:
 *     createSession          → generates session code, joins teacher to room
 *     joinSession { code }   → student joins room by code
 *     feedback { code, level } → student sends emoji feedback
 *     endSession { code }    → teacher ends the session
 *
 *   Server → Client:
 *     sessionCreated { code }
 *     joinedSession { code }
 *     joinError { message }
 *     aggregateUpdate { gotit, neutral, confused, lost, total }
 *     sessionEnded
 */

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const sessions = require("./sessions");

const PORT = process.env.PORT || 5000;

const app = express();
const server = http.createServer(app);

// ── Socket.io setup ──────────────────────────────────────────────────────────
// In production, the React build is served from the same origin so no CORS
// issues. For development, allow the Vite dev server origin.
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

// ── Rate limiting state (server-side backup throttle) ────────────────────────
// Tracks last feedback timestamp per socket to ignore rapid-fire updates.
const lastFeedbackTime = new Map();
const THROTTLE_MS = 500; // ignore feedback faster than 500ms apart

// ── Serve static React build in production ───────────────────────────────────
// After running `npm run build` in frontend/, copy the build output to
// ../frontend/dist and Express will serve it.
app.use(express.static(path.join(__dirname, "..", "frontend", "dist")));

// Fallback: serve index.html for any non-API route (SPA client-side routing)
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "dist", "index.html"));
});

// ── Socket event handlers ────────────────────────────────────────────────────

io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // ── Create Session (Teacher) ───────────────────────────────────────────────
  socket.on("createSession", () => {
    const code = sessions.createSession(socket.id);
    socket.join(code);

    socket.emit("sessionCreated", { code });
    console.log(`Session created: ${code} by ${socket.id}`);
  });

  // ── Join Session (Student) ─────────────────────────────────────────────────
  socket.on("joinSession", ({ code }) => {
    const normalizedCode = (code || "").toUpperCase().trim();

    if (!sessions.sessionExists(normalizedCode)) {
      socket.emit("joinError", { message: "Invalid session code." });
      return;
    }

    const added = sessions.addStudent(normalizedCode, socket.id);
    if (!added) {
      socket.emit("joinError", { message: "Could not join session." });
      return;
    }

    socket.join(normalizedCode);
    socket.emit("joinedSession", { code: normalizedCode });

    // Push updated aggregate to the teacher (and room)
    const aggregate = sessions.getAggregate(normalizedCode);
    io.in(normalizedCode).emit("aggregateUpdate", aggregate);

    console.log(`Student ${socket.id} joined session ${normalizedCode}`);
  });

  // ── Student Feedback ───────────────────────────────────────────────────────
  socket.on("feedback", ({ code, level }) => {
    // Server-side rate limiting
    const now = Date.now();
    const last = lastFeedbackTime.get(socket.id) || 0;
    if (now - last < THROTTLE_MS) return; // silently ignore
    lastFeedbackTime.set(socket.id, now);

    const normalizedCode = (code || "").toUpperCase().trim();
    const updated = sessions.updateFeedback(normalizedCode, socket.id, level);
    if (!updated) return; // invalid code, level, or socket not in session

    // Broadcast new aggregate to entire room (teacher picks it up)
    const aggregate = sessions.getAggregate(normalizedCode);
    io.in(normalizedCode).emit("aggregateUpdate", aggregate);
  });

  // ── End Session (Teacher) ──────────────────────────────────────────────────
  socket.on("endSession", ({ code }) => {
    const normalizedCode = (code || "").toUpperCase().trim();

    // Notify all participants
    io.in(normalizedCode).emit("sessionEnded");

    // Clean up server state
    sessions.endSession(normalizedCode);

    console.log(`Session ended: ${normalizedCode}`);
  });

  // ── Disconnect cleanup ─────────────────────────────────────────────────────
  socket.on("disconnect", () => {
    lastFeedbackTime.delete(socket.id);

    const info = sessions.removeSocket(socket.id);
    if (info) {
      // If a student left, push updated aggregate to the room
      if (info.role === "student") {
        const aggregate = sessions.getAggregate(info.code);
        if (aggregate) {
          io.in(info.code).emit("aggregateUpdate", aggregate);
        }
      }
      console.log(`Socket ${socket.id} (${info.role}) left session ${info.code}`);
    }
  });
});

// ── Start server ─────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`Lecture feedback server running on http://localhost:${PORT}`);
});
