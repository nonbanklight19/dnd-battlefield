import { useState } from "react";
import { useSocket } from "./hooks/useSocket.js";
import { useSession } from "./hooks/useSession.js";
import { HomePage } from "./components/HomePage.js";

export function App() {
  const socket = useSocket();
  const [sessionId, setSessionId] = useState<string | null>(() => {
    const path = window.location.pathname.slice(1);
    return path.length === 4 ? path : null;
  });

  const { session, connected, addToken, moveToken, removeToken, updateGrid, saveSession } =
    useSession(socket, sessionId);

  const handleCreate = async () => {
    const res = await fetch("/api/sessions", { method: "POST" });
    const data = await res.json();
    setSessionId(data.id);
    window.history.pushState(null, "", `/${data.id}`);
  };

  const handleJoin = (code: string) => {
    setSessionId(code);
    window.history.pushState(null, "", `/${code}`);
  };

  if (!sessionId) {
    return <HomePage onCreateSession={handleCreate} onJoinSession={handleJoin} />;
  }

  if (!session || !connected) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
        <p>Connecting to session {sessionId}...</p>
      </div>
    );
  }

  // Placeholder — will be replaced by the full battlefield UI in later tasks
  return (
    <div>
      <p>Session: {session.id} | Tokens: {session.tokens.length} | Grid: {session.gridMode}</p>
    </div>
  );
}
