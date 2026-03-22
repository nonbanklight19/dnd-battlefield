import { useState, useCallback } from "react";
import { useSocket } from "./hooks/useSocket.js";
import { useSession } from "./hooks/useSession.js";
import { useHeroImages } from "./hooks/useHeroImages.js";
import { HomePage } from "./components/HomePage.js";
import { BattleMap } from "./components/BattleMap.js";
import { TopBar } from "./components/TopBar.js";
import { SidePanel } from "./components/SidePanel.js";
import type { GridMode } from "./types.js";

export function App() {
  const socket = useSocket();
  const heroImages = useHeroImages();
  const [sessionId, setSessionId] = useState<string | null>(() => {
    const path = window.location.pathname.slice(1).toUpperCase();
    return /^[A-Z0-9]{4}$/.test(path) ? path : null;
  });
  const [sidePanelVisible, setSidePanelVisible] = useState(true);

  const { session, connected, error, saveStatus, addHero, addEnemy, moveToken, removeToken, updateGrid, saveSession } =
    useSession(socket, sessionId);

  const handleCreate = async () => {
    const res = await fetch("/api/sessions", { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Failed to create session" }));
      alert(data.error);
      return;
    }
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

      const res = await fetch(`/api/sessions/${sessionId}/map`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to upload map" }));
        alert(data.error);
      }
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

  if (error) {
    const handleBack = () => {
      setSessionId(null);
      window.history.pushState(null, "", "/");
    };
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-red-400 font-body text-lg">{error}</p>
        <button
          onClick={handleBack}
          className="py-2 px-6 bg-transparent text-gold-bright font-medium border border-border-hover rounded-lg cursor-pointer transition-all duration-150 hover:bg-gold-subtle hover:border-gold-muted"
        >
          Back to Home
        </button>
      </div>
    );
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
        saveStatus={saveStatus}
        onSave={saveSession}
        onToggleSidePanel={() => setSidePanelVisible((v) => !v)}
      />
      <div className="flex flex-1 overflow-hidden">
        <BattleMap session={session} heroImages={heroImages} onMoveToken={moveToken} />
        <SidePanel
          tokens={session.tokens}
          gridMode={session.gridMode}
          gridSize={session.gridSize}
          sessionId={session.id}
          onAddHero={addHero}
          onAddEnemy={addEnemy}
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
