/**
 * App.jsx — Root component. Manages which view to show based on
 * application state: JoinPage → StudentView or TeacherView.
 *
 * State is driven by socket events rather than URL routing, since
 * sessions are ephemeral and don't survive page refresh.
 * TODO: Could add React Router with /session/:code/:role routes
 * and sessionStorage persistence for reconnection support.
 */

import { useState, useEffect, useCallback } from "react";
import { useSocket } from "./SocketContext.jsx";
import JoinPage from "./components/JoinPage.jsx";
import StudentView from "./components/StudentView.jsx";
import TeacherView from "./components/TeacherView.jsx";

export default function App() {
  // "join" | "student" | "teacher"
  const [view, setView] = useState("join");
  const [sessionCode, setSessionCode] = useState("");
  const [error, setError] = useState("");

  const socket = useSocket();

  // ── Socket event listeners ─────────────────────────────────────────────────
  useEffect(() => {
    // Teacher: session created successfully
    function onSessionCreated({ code }) {
      setSessionCode(code);
      setView("teacher");
      setError("");
    }

    // Student: joined session successfully
    function onJoinedSession({ code }) {
      setSessionCode(code);
      setView("student");
      setError("");
    }

    // Student: join failed (bad code, etc.)
    function onJoinError({ message }) {
      setError(message);
    }

    // Session ended by teacher
    function onSessionEnded() {
      setView("join");
      setSessionCode("");
      setError("Session has ended.");
    }

    socket.on("sessionCreated", onSessionCreated);
    socket.on("joinedSession", onJoinedSession);
    socket.on("joinError", onJoinError);
    socket.on("sessionEnded", onSessionEnded);

    return () => {
      socket.off("sessionCreated", onSessionCreated);
      socket.off("joinedSession", onJoinedSession);
      socket.off("joinError", onJoinError);
      socket.off("sessionEnded", onSessionEnded);
    };
  }, [socket]);

  // ── Actions exposed to child components ────────────────────────────────────
  const handleStartSession = useCallback(() => {
    setError("");
    socket.emit("createSession");
  }, [socket]);

  const handleJoinSession = useCallback(
    (code) => {
      setError("");
      socket.emit("joinSession", { code: code.toUpperCase().trim() });
    },
    [socket]
  );

  const handleEndSession = useCallback(() => {
    socket.emit("endSession", { code: sessionCode });
    setView("join");
    setSessionCode("");
  }, [socket, sessionCode]);

  const handleLeave = useCallback(() => {
    // Student leaves — just reset local state. The server handles
    // cleanup via the disconnect event when socket reconnects or
    // we can explicitly leave the room.
    setView("join");
    setSessionCode("");
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="app">
      <header className="app-header">
        <h1>Lecture Feedback</h1>
      </header>

      <main className="app-main">
        {view === "join" && (
          <JoinPage
            onStart={handleStartSession}
            onJoin={handleJoinSession}
            error={error}
          />
        )}

        {view === "student" && (
          <StudentView
            sessionCode={sessionCode}
            onLeave={handleLeave}
          />
        )}

        {view === "teacher" && (
          <TeacherView
            sessionCode={sessionCode}
            onEnd={handleEndSession}
          />
        )}
      </main>
    </div>
  );
}
