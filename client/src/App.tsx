import { useState, useCallback, useRef } from "react";
import { useSocket } from "./hooks/useSocket.js";
import { useSession } from "./hooks/useSession.js";
import { useHeroImages } from "./hooks/useHeroImages.js";
import { HomePage } from "./components/HomePage.js";
import { BattleMap } from "./components/BattleMap.js";
import { TopBar } from "./components/TopBar.js";
import { SidePanel } from "./components/SidePanel.js";
import { RoleSelection } from "./components/RoleSelection.js";
import { InitiativeTracker } from "./components/InitiativeTracker.js";
import { TurnNotification } from "./components/TurnNotification.js";
import { useActiveTurn } from "./hooks/useActiveTurn.js";
import type { GridMode, Role } from "./types.js";

// Detect /<CODE>/initiative route
function parseRoute(): { sessionId: string | null; page: "battlefield" | "initiative" } {
  const parts = window.location.pathname.slice(1).split("/");
  const code = parts[0].toUpperCase();
  const isValidCode = /^[A-Z0-9]{4}$/.test(code);
  if (!isValidCode) return { sessionId: null, page: "battlefield" };
  if (parts[1] === "initiative") return { sessionId: code, page: "initiative" };
  return { sessionId: code, page: "battlefield" };
}

export function App() {
  const socket = useSocket();
  const heroImages = useHeroImages();

  const [route, setRoute] = useState(parseRoute);
  const { sessionId, page } = route;

  const [role, setRole] = useState<Role | null>(() => {
    const { sessionId: id } = parseRoute();
    if (!id) return null;
    return (sessionStorage.getItem(`role:${id}`) as Role | null);
  });
  const [sidePanelVisible, setSidePanelVisible] = useState(false);
  const getViewCenterRef = useRef<() => { x: number; y: number }>(() => ({ x: 400, y: 300 }));
  const getSpawnPosRef = useRef<(tokenSize?: number) => { x: number; y: number }>(() => ({ x: 400, y: 300 }));

  const { session, connected, error, saveStatus, addHero, addEnemy, moveToken, removeToken, updateGrid, saveSession, setTokenStatus } =
    useSession(socket, sessionId);

  const activeTurn = useActiveTurn(socket);

  // Render initiative tracker page independently (uses its own socket connection)
  if (page === "initiative" && sessionId) {
    return <InitiativeTracker sessionId={sessionId} />;
  }

  const handleCreate = async () => {
    const res = await fetch("/api/sessions", { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Failed to create session" }));
      alert(data.error);
      return;
    }
    const data = await res.json();
    setRole(null);
    window.history.pushState(null, "", `/${data.id}`);
    setRoute({ sessionId: data.id, page: "battlefield" });
  };

  const handleJoin = (code: string) => {
    setRole((sessionStorage.getItem(`role:${code}`) as Role | null));
    window.history.pushState(null, "", `/${code}`);
    setRoute({ sessionId: code, page: "battlefield" });
  };

  const handleRoleSelect = (selectedRole: Role) => {
    if (!sessionId) return;
    sessionStorage.setItem(`role:${sessionId}`, selectedRole);
    setRole(selectedRole);
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
      setRoute({ sessionId: null, page: "battlefield" });
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
        role={role}
      />
      {!role && <RoleSelection onSelect={handleRoleSelect} />}
      <div className="flex flex-1 overflow-hidden relative">
        <BattleMap session={session} heroImages={heroImages} onMoveToken={moveToken} getViewCenterRef={getViewCenterRef} getSpawnPosRef={getSpawnPosRef} activeTurnTokenId={activeTurn?.tokenId ?? null} />
        <TurnNotification turn={activeTurn} socket={socket} />
        <SidePanel
          tokens={session.tokens}
          gridMode={session.gridMode}
          gridSize={session.gridSize}
          sessionId={session.id}
          role={role}
          onAddHero={addHero}
          onAddEnemy={addEnemy}
          onRemoveToken={removeToken}
          onSetTokenStatus={setTokenStatus}
          onUploadMap={handleUploadMap}
          onGridModeChange={handleGridModeChange}
          onGridSizeChange={handleGridSizeChange}
          visible={sidePanelVisible}
          onClose={() => setSidePanelVisible(false)}
          getViewCenter={(size?: number) => getSpawnPosRef.current(size)}
        />
      </div>
    </>
  );
}
