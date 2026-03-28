import { useState, useEffect, useCallback } from "react";
import type { Socket } from "socket.io-client";
import type { SessionState, Token, GridMode, MapData, TokenStatus } from "../types.js";

export function useSession(socket: Socket | null, sessionId: string | null) {
  const [session, setSession] = useState<SessionState | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    if (!socket || !sessionId) return;

    socket.emit("session:join", sessionId);

    setError(null);

    const onState = (data: SessionState) => {
      setSession(data);
      setConnected(true);
      setError(null);
    };
    const onError = (err: { message: string }) => {
      console.error("Session error:", err.message);
      setConnected(false);
      setError(err.message);
    };
    const onTokenAdded = (token: Token) => {
      setSession((prev) =>
        prev ? { ...prev, tokens: [...prev.tokens, token] } : prev
      );
    };
    const onTokenMoved = (data: { id: string; x: number; y: number }) => {
      setSession((prev) =>
        prev
          ? {
              ...prev,
              tokens: prev.tokens.map((t) =>
                t.id === data.id ? { ...t, x: data.x, y: data.y } : t
              ),
            }
          : prev
      );
    };
    const onTokenRemoved = (data: { id: string }) => {
      setSession((prev) =>
        prev
          ? { ...prev, tokens: prev.tokens.filter((t) => t.id !== data.id) }
          : prev
      );
    };
    const onGridUpdated = (data: { gridMode: GridMode; gridSize: number }) => {
      setSession((prev) =>
        prev ? { ...prev, gridMode: data.gridMode, gridSize: data.gridSize } : prev
      );
    };
    const onMapUpdated = (data: MapData) => {
      setSession((prev) => (prev ? { ...prev, map: data } : prev));
    };
    const onSessionSaved = () => {
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    };
    const onTokenStatusUpdated = (data: { id: string; statuses: TokenStatus[] }) => {
      setSession((prev) =>
        prev
          ? { ...prev, tokens: prev.tokens.map((t) => t.id === data.id ? { ...t, statuses: data.statuses } : t) }
          : prev
      );
    };
    const onReconnect = () => {
      socket.emit("session:join", sessionId);
    };

    socket.on("session:state", onState);
    socket.on("session:error", onError);
    socket.on("token:added", onTokenAdded);
    socket.on("token:moved", onTokenMoved);
    socket.on("token:removed", onTokenRemoved);
    socket.on("grid:updated", onGridUpdated);
    socket.on("map:updated", onMapUpdated);
    socket.on("session:saved", onSessionSaved);
    socket.on("token:status-updated", onTokenStatusUpdated);
    socket.io.on("reconnect", onReconnect);

    return () => {
      socket.off("session:state", onState);
      socket.off("session:error", onError);
      socket.off("token:added", onTokenAdded);
      socket.off("token:moved", onTokenMoved);
      socket.off("token:removed", onTokenRemoved);
      socket.off("grid:updated", onGridUpdated);
      socket.off("map:updated", onMapUpdated);
      socket.off("session:saved", onSessionSaved);
      socket.off("token:status-updated", onTokenStatusUpdated);
      socket.io.off("reconnect", onReconnect);
    };
  }, [socket, sessionId]);

  const addHero = useCallback(
    (data: { heroType: string; x: number; y: number }) => {
      socket?.emit("token:add-hero", data);
    },
    [socket]
  );

  const addEnemy = useCallback(
    (data: { name: string; color: string; icon: string; customImage?: string; size: number; x: number; y: number }) => {
      socket?.emit("token:add-enemy", data);
    },
    [socket]
  );

  const moveToken = useCallback(
    (id: string, x: number, y: number) => {
      // Optimistic update
      setSession((prev) =>
        prev
          ? {
              ...prev,
              tokens: prev.tokens.map((t) =>
                t.id === id ? { ...t, x, y } : t
              ),
            }
          : prev
      );
      socket?.emit("token:move", { id, x, y });
    },
    [socket]
  );

  const removeToken = useCallback(
    (id: string) => {
      socket?.emit("token:remove", { id });
    },
    [socket]
  );

  const updateGrid = useCallback(
    (gridMode: GridMode, gridSize: number) => {
      socket?.emit("grid:update", { gridMode, gridSize });
      // Optimistic update
      setSession((prev) =>
        prev ? { ...prev, gridMode, gridSize } : prev
      );
    },
    [socket]
  );

  const saveSession = useCallback(() => {
    setSaveStatus("saving");
    socket?.emit("session:save");
  }, [socket]);

  const setTokenStatus = useCallback(
    (id: string, status: TokenStatus, active: boolean) => {
      // Optimistic update
      setSession((prev) =>
        prev
          ? {
              ...prev,
              tokens: prev.tokens.map((t) => {
                if (t.id !== id) return t;
                const current = t.statuses ?? [];
                const statuses = active
                  ? current.includes(status) ? current : [...current, status]
                  : current.filter((s) => s !== status);
                return { ...t, statuses };
              }),
            }
          : prev
      );
      socket?.emit("token:set-status", { id, status, active });
    },
    [socket]
  );

  return {
    session,
    connected,
    error,
    saveStatus,
    addHero,
    addEnemy,
    moveToken,
    removeToken,
    updateGrid,
    saveSession,
    setTokenStatus,
  };
}
