/**
 * TeacherView.jsx — Instructor dashboard showing:
 *   - Session code (+ QR code for easy sharing)
 *   - Total participant count
 *   - Live pie chart of student understanding levels
 *   - Numeric percentage breakdown
 *   - Alert when confused+lost exceeds a threshold
 *   - End Session button
 *
 * Listens for "aggregateUpdate" socket events with shape:
 *   { gotit, neutral, confused, lost, total }
 */

import { useState, useEffect } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { QRCodeSVG } from "qrcode.react";
import { useSocket } from "../SocketContext.jsx";

// Color palette matching feedback sentiment
const COLORS = {
  gotit: "#4CAF50",    // green
  neutral: "#2196F3",  // blue
  confused: "#FF9800", // orange
  lost: "#F44336",     // red
};

const LABELS = {
  gotit: "\uD83D\uDE0A Got it",
  neutral: "\uD83D\uDE10 Neutral",
  confused: "\uD83D\uDE15 Confused",
  lost: "\uD83D\uDE35 Lost",
};

// Alert if confused + lost exceeds this fraction of total
const ALERT_THRESHOLD = 0.3;

export default function TeacherView({ sessionCode, onEnd }) {
  const socket = useSocket();
  const [aggregate, setAggregate] = useState({
    gotit: 0,
    neutral: 0,
    confused: 0,
    lost: 0,
    total: 0,
  });

  // ── Listen for real-time aggregate updates ─────────────────────────────────
  useEffect(() => {
    function onAggregateUpdate(data) {
      setAggregate(data);
    }

    socket.on("aggregateUpdate", onAggregateUpdate);
    return () => socket.off("aggregateUpdate", onAggregateUpdate);
  }, [socket]);

  // ── Derived data ───────────────────────────────────────────────────────────
  const { total } = aggregate;

  // Build chart data array (exclude categories with 0 for cleaner chart)
  const chartData = ["gotit", "neutral", "confused", "lost"]
    .map((key) => ({
      name: LABELS[key],
      value: aggregate[key],
      color: COLORS[key],
    }))
    .filter((d) => d.value > 0);

  // Percentage helper
  const pct = (val) => (total > 0 ? ((val / total) * 100).toFixed(1) : "0.0");

  // Threshold alert
  const confusedFraction =
    total > 0 ? (aggregate.confused + aggregate.lost) / total : 0;
  const showAlert = total > 0 && confusedFraction > ALERT_THRESHOLD;

  // Build a join URL for the QR code (assumes same origin)
  const joinUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}?code=${sessionCode}`
      : "";

  return (
    <div className="teacher-view">
      {/* Session info header */}
      <div className="session-header">
        <div className="session-code-display">
          <span className="label">Session Code</span>
          <span className="code">{sessionCode}</span>
        </div>

        {/* QR code for easy mobile joining */}
        {joinUrl && (
          <div className="qr-code">
            <QRCodeSVG value={joinUrl} size={100} />
          </div>
        )}

        <div className="participant-count">
          <span className="label">Participants</span>
          <span className="count">{total}</span>
        </div>
      </div>

      {/* Alert banner */}
      {showAlert && (
        <div className="alert-banner">
          &#x26A0; {(confusedFraction * 100).toFixed(0)}% of students are
          Confused or Lost
        </div>
      )}

      {/* Pie chart */}
      <div className="chart-container">
        {total === 0 ? (
          <p className="waiting-message">
            Waiting for students to join and send feedback...
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ name, value }) => `${name}: ${value}`}
              >
                {chartData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [`${value} (${pct(value)}%)`, name]}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Numeric breakdown */}
      {total > 0 && (
        <div className="stats-grid">
          {["gotit", "neutral", "confused", "lost"].map((key) => (
            <div key={key} className="stat-card" style={{ borderColor: COLORS[key] }}>
              <span className="stat-label">{LABELS[key]}</span>
              <span className="stat-value">
                {aggregate[key]}{" "}
                <small>({pct(aggregate[key])}%)</small>
              </span>
            </div>
          ))}
        </div>
      )}

      <button className="btn btn-danger" onClick={onEnd}>
        End Session
      </button>
    </div>
  );
}
