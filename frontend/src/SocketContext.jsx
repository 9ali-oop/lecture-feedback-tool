/**
 * SocketContext.jsx — Provides a single Socket.io client instance to the
 * entire React component tree via React Context.
 *
 * Usage in any component:
 *   const socket = useSocket();
 *   socket.emit("feedback", { code, level: "confused" });
 *
 * The socket connects once on mount and disconnects on unmount.
 * In development the Vite proxy forwards /socket.io to the backend.
 * In production both are served from the same origin.
 */

import { createContext, useContext, useEffect, useRef } from "react";
import { io } from "socket.io-client";

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const socketRef = useRef(null);

  if (!socketRef.current) {
    // Connect to same origin (works in prod). In dev, Vite proxy handles it.
    socketRef.current = io({
      // No explicit URL — defaults to window.location origin
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
  }

  useEffect(() => {
    const socket = socketRef.current;
    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={socketRef.current}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const socket = useContext(SocketContext);
  if (!socket) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return socket;
}
