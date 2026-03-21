import { useState } from "react";

interface Props {
  onCreateSession: () => void;
  onJoinSession: (code: string) => void;
}

export function HomePage({ onCreateSession, onJoinSession }: Props) {
  const [joinCode, setJoinCode] = useState("");

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", height: "100vh", gap: "2rem",
    }}>
      <h1 style={{ fontSize: "2.5rem", color: "#e2b714" }}>DnD Battlefield</h1>

      <button
        onClick={onCreateSession}
        style={{
          padding: "1rem 2rem", fontSize: "1.2rem", background: "#e2b714",
          color: "#1a1a2e", border: "none", borderRadius: "8px", cursor: "pointer",
          fontWeight: "bold",
        }}
      >
        Create New Session
      </button>

      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <input
          type="text"
          placeholder="Enter session code"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          maxLength={4}
          style={{
            padding: "0.75rem 1rem", fontSize: "1.2rem", background: "#16213e",
            color: "#eee", border: "1px solid #e2b714", borderRadius: "8px",
            textAlign: "center", width: "160px", letterSpacing: "0.3em",
          }}
        />
        <button
          onClick={() => joinCode && onJoinSession(joinCode)}
          disabled={!joinCode}
          style={{
            padding: "0.75rem 1.5rem", fontSize: "1.2rem", background: "#16213e",
            color: "#e2b714", border: "1px solid #e2b714", borderRadius: "8px",
            cursor: joinCode ? "pointer" : "not-allowed", opacity: joinCode ? 1 : 0.5,
          }}
        >
          Join
        </button>
      </div>
    </div>
  );
}
