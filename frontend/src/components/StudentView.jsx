/**
 * StudentView.jsx — Shows four emoji buttons for the student to
 * indicate their current understanding level.
 *
 * - Highlights the currently selected emoji.
 * - Implements client-side debounce (1 second) to prevent spam.
 * - Emits "feedback" socket event with { code, level }.
 */

import { useState, useRef, useCallback } from "react";
import { useSocket } from "../SocketContext.jsx";

const FEEDBACK_OPTIONS = [
  { level: "gotit", emoji: "\uD83D\uDE0A", label: "Got it" },
  { level: "neutral", emoji: "\uD83D\uDE10", label: "Neutral" },
  { level: "confused", emoji: "\uD83D\uDE15", label: "Confused" },
  { level: "lost", emoji: "\uD83D\uDE35", label: "Lost" },
];

const DEBOUNCE_MS = 1000;

export default function StudentView({ sessionCode, onLeave }) {
  const socket = useSocket();
  const [selected, setSelected] = useState("neutral"); // default state
  const [disabled, setDisabled] = useState(false);
  const timerRef = useRef(null);

  const handleClick = useCallback(
    (level) => {
      if (disabled) return;

      setSelected(level);
      socket.emit("feedback", { code: sessionCode, level });

      // Client-side debounce: disable buttons for DEBOUNCE_MS
      setDisabled(true);
      timerRef.current = setTimeout(() => setDisabled(false), DEBOUNCE_MS);
    },
    [disabled, sessionCode, socket]
  );

  return (
    <div className="student-view">
      <p className="session-info">
        Session: <strong>{sessionCode}</strong>
      </p>

      <p className="instruction">How well do you understand?</p>

      <div className="emoji-grid">
        {FEEDBACK_OPTIONS.map(({ level, emoji, label }) => (
          <button
            key={level}
            className={`emoji-btn ${selected === level ? "selected" : ""} ${
              disabled ? "cooldown" : ""
            }`}
            onClick={() => handleClick(level)}
            disabled={disabled}
            aria-label={label}
          >
            <span className="emoji" role="img" aria-hidden="true">
              {emoji}
            </span>
            <span className="emoji-label">{label}</span>
          </button>
        ))}
      </div>

      {selected && (
        <p className="current-state">
          Your current status:{" "}
          <strong>
            {FEEDBACK_OPTIONS.find((o) => o.level === selected)?.emoji}{" "}
            {FEEDBACK_OPTIONS.find((o) => o.level === selected)?.label}
          </strong>
        </p>
      )}

      <button className="btn btn-link" onClick={onLeave}>
        Leave Session
      </button>
    </div>
  );
}
