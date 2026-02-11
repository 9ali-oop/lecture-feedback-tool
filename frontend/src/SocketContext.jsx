/**
 * SocketContext.jsx — Provides a single Socket.io client instance to the
 * entire React component tree via React Context.
 *
 * Usage in any component:
 *   const socket = useSocket();
 *   socket.emit("feedback", { code, level: "confused" });
 *
 * IMPORTANT: The socket is created as a module-level singleton outside of
 * React's render cycle. This avoids a React StrictMode bug where:
 *   1. useRef initializes the socket on first mount
 *   2. StrictMode unmounts → useEffect cleanup disconnects it
 *   3. StrictMode re-mounts → useRef.current is still set (truthy)
 *      so no new socket is created, but the old one is disconnected
 * By creating the socket at module scope, it's immune to mount/unmount cycles.
 */

import { createContext, useContext, useEffect } from "react";
import { io } from "socket.io-client";

// ── Module-level singleton ───────────────────────────────────────────────────
// In production both frontend and backend share the same origin, so io() with
// no URL works. In development Vite runs on :5173 while the backend runs on
// :5000, so we connect directly to the backend URL.
const SOCKET_URL =
  import.meta.env.MODE === "production" ? "" : "http://localhost:5000";

const socket = io(SOCKET_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
});

// ── Context ──────────────────────────────────────────────────────────────────
const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  // We intentionally do NOT disconnect on unmount — the singleton lives
  // for the lifetime of the page. This is correct because:
  //   - React StrictMode double-mounts in dev won't break the connection
  //   - The socket auto-reconnects if the server restarts
  //   - On page unload the browser closes the connection automatically

  useEffect(() => {
    // Optional: log connection status for debugging
    function onConnect() {
      console.log("[socket] connected:", socket.id);
    }
    function onDisconnect(reason) {
      console.log("[socket] disconnected:", reason);
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
}

export function useSocket() {
  const s = useContext(SocketContext);
  if (!s) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return s;
}
