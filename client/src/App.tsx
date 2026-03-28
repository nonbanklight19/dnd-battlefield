import { useState, useCallback, useRef, useEffect } from "react";
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
import { useInitiative } from "./hooks/useInitiative.js";
import { InitiativeOverlay } from "./components/InitiativeOverlay.js";
import { AoePanel } from "./components/AoePanel.js";
import type { GridMode, Role, AoeEffect, AoeType, AoeColor } from "./types.js";

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
  const [rulerActive, setRulerActive] = useState(false);
  const [aoeOpen, setAoeOpen] = useState(false);
  const [aoeMode, setAoeMode] = useState<{ type: AoeType; feet: number; color: AoeColor; originSize: 1 | 2 | 3 } | null>(null);
  const [aoeEffects, setAoeEffects] = useState<AoeEffect[]>([]);
  const [selectedAoeId, setSelectedAoeId] = useState<string | null>(null);
  const aoeIdRef = useRef(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (rulerActive) setRulerActive(false);
        if (aoeMode) setAoeMode(null);
        if (selectedAoeId) setSelectedAoeId(null);
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedAoeId) {
        e.preventDefault();
        setAoeEffects((prev) => prev.filter((ef) => ef.id !== selectedAoeId));
        setSelectedAoeId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [rulerActive, aoeMode, selectedAoeId]);

  const handleStartPlaceAoe = useCallback((type: AoeType, feet: number, color: AoeColor, originSize: 1 | 2 | 3) => {
    setAoeMode({ type, feet, color, originSize });
  }, []);

  const handlePlaceAoe = useCallback((x: number, y: number) => {
    setAoeMode((mode) => {
      if (!mode) return null;
      const id = `aoe_${++aoeIdRef.current}`;
      setAoeEffects((prev) => [...prev, { id, ...mode, x, y, rotation: 0 }]);
      return null; // exit placement mode after first placement
    });
  }, []);

  const handleMoveAoe = useCallback((id: string, x: number, y: number) => {
    setAoeEffects((prev) => prev.map((e) => (e.id === id ? { ...e, x, y } : e)));
  }, []);

  const handleRotateAoe = useCallback((id: string, rotation: number) => {
    setAoeEffects((prev) => prev.map((e) => (e.id === id ? { ...e, rotation } : e)));
  }, []);

  const handleDeleteAoe = useCallback((id: string) => {
    setAoeEffects((prev) => prev.filter((e) => e.id !== id));
    setSelectedAoeId((prev) => (prev === id ? null : prev));
  }, []);

  const handleClearAoe = useCallback(() => {
    setAoeEffects([]);
    setSelectedAoeId(null);
  }, []);
  const getViewCenterRef = useRef<() => { x: number; y: number }>(() => ({ x: 400, y: 300 }));
  const getSpawnPosRef = useRef<(tokenSize?: number) => { x: number; y: number }>(() => ({ x: 400, y: 300 }));

  const { session, connected, error, saveStatus, addHero, addEnemy, moveToken, removeToken, updateGrid, saveSession, setTokenStatus } =
    useSession(socket, sessionId);

  const activeTurn = useActiveTurn(socket);
  const { state: initiativeState } = useInitiative(socket, sessionId);

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
        rulerActive={rulerActive}
        onToggleRuler={() => setRulerActive((v) => !v)}
        aoeOpen={aoeOpen}
        onToggleAoe={() => {
          if (aoeOpen) { setAoeOpen(false); setAoeMode(null); }
          else setAoeOpen(true);
        }}
      />
      {!role && <RoleSelection onSelect={handleRoleSelect} />}
      <AoePanel
        open={aoeOpen}
        onClose={() => setAoeOpen(false)}
        effects={aoeEffects}
        placing={!!aoeMode}
        onStartPlace={handleStartPlaceAoe}
        onCancelPlace={() => setAoeMode(null)}
        onDeleteEffect={handleDeleteAoe}
        onClearAll={handleClearAoe}
      />
      <div className="flex flex-1 overflow-hidden relative">
        <BattleMap
          session={session}
          heroImages={heroImages}
          onMoveToken={moveToken}
          getViewCenterRef={getViewCenterRef}
          getSpawnPosRef={getSpawnPosRef}
          activeTurnTokenId={activeTurn?.tokenId ?? null}
          rulerActive={rulerActive}
          aoeEffects={aoeEffects}
          aoeMode={aoeMode}
          onPlaceAoe={handlePlaceAoe}
          onMoveAoe={handleMoveAoe}
          onRotateAoe={handleRotateAoe}
          selectedAoeId={selectedAoeId}
          onSelectAoe={setSelectedAoeId}
          onDeselectAoe={() => setSelectedAoeId(null)}
        />
        <InitiativeOverlay initiative={initiativeState} />
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
