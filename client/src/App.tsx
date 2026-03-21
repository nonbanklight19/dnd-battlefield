import { useState, useCallback } from "react";
import { useSocket } from "./hooks/useSocket.js";
import { useSession } from "./hooks/useSession.js";
import { HomePage } from "./components/HomePage.js";
import { BattleMap } from "./components/BattleMap.js";
import { TopBar } from "./components/TopBar.js";
import { SidePanel } from "./components/SidePanel.js";
import type { GridMode } from "./types.js";

export function App() {
  const socket = useSocket();
  const [sessionId, setSessionId] = useState<string | null>(() => {
    const path = window.location.pathname.slice(1);
    return path.length === 4 ? path : null;
  });
  const [sidePanelVisible, setSidePanelVisible] = useState(true);

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

  const handleUploadMap = useCallback(
    async (file: File) => {
      if (!sessionId) return;
      const formData = new FormData();
      formData.append("map", file);

      const img = new window.Image();
      const url = URL.createObjectURL(file);
      img.src = url;
      await new Promise((resolve) => { img.onload = resolve; });
      formData.append("width", String(img.width));
      formData.append("height", String(img.height));
      URL.revokeObjectURL(url);

      await fetch(`/api/sessions/${sessionId}/map`, {
        method: "POST",
        body: formData,
      });
    },
    [sessionId]
  );

  const handleGridModeChange = useCallback(
    (mode: GridMode) => {
      if (session) updateGrid(mode, session.gridSize);
    },
    [session, updateGrid]
  );

  const handleGridSizeChange = useCallback(
    (size: number) => {
      if (session) updateGrid(session.gridMode, size);
    },
    [session, updateGrid]
  );

  if (!sessionId) {
    return <HomePage onCreateSession={handleCreate} onJoinSession={handleJoin} />;
  }

  if (!session || !connected) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-text-secondary font-body">Connecting to session {sessionId}...</p>
      </div>
    );
  }

  return (
    <>
      <TopBar
        sessionId={session.id}
        onSave={saveSession}
        onToggleSidePanel={() => setSidePanelVisible((v) => !v)}
      />
      <div className="flex flex-1 overflow-hidden">
        <BattleMap session={session} onMoveToken={moveToken} />
        <SidePanel
          tokens={session.tokens}
          gridMode={session.gridMode}
          gridSize={session.gridSize}
          onAddToken={addToken}
          onRemoveToken={removeToken}
          onUploadMap={handleUploadMap}
          onGridModeChange={handleGridModeChange}
          onGridSizeChange={handleGridSizeChange}
          visible={sidePanelVisible}
        />
      </div>
    </>
  );
}
