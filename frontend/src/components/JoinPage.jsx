/**
 * JoinPage.jsx — Landing page where users choose to start a session
 * (as instructor) or join an existing one (as student) by entering
 * a 6-character session code.
 */

import { useState } from "react";

export default function JoinPage({ onStart, onJoin, error }) {
  const [code, setCode] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    if (code.trim().length === 0) return;
    onJoin(code);
  }

  return (
    <div className="join-page">
      <section className="join-section">
        <h2>I'm an Instructor</h2>
        <p>Start a new feedback session for your class.</p>
        <button className="btn btn-primary" onClick={onStart}>
          Start Session
        </button>
      </section>

      <div className="divider">
        <span>or</span>
      </div>

      <section className="join-section">
        <h2>I'm a Student</h2>
        <p>Enter the session code shared by your instructor.</p>
        <form onSubmit={handleSubmit} className="join-form">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. ABC123"
            maxLength={6}
            className="code-input"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" className="btn btn-secondary">
            Join Session
          </button>
        </form>
        {error && <p className="error-message">{error}</p>}
      </section>
    </div>
  );
}
