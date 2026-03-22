import { useState, useEffect, useCallback } from "react";
import type { Socket } from "socket.io-client";
import type { InitiativeState, InitiativeRow } from "../types.js";

export function useInitiative(socket: Socket | null, sessionId: string | null) {
  const [state, setState] = useState<InitiativeState>({ rows: [], activeIndex: 0, round: 1 });

  useEffect(() => {
    if (!socket || !sessionId) return;

    socket.emit("initiative:join", sessionId);

    const onState = (data: InitiativeState) => setState(data);
    const onReconnect = () => socket.emit("initiative:join", sessionId);

    socket.on("initiative:state", onState);
    socket.io.on("reconnect", onReconnect);

    return () => {
      socket.off("initiative:state", onState);
      socket.io.off("reconnect", onReconnect);
    };
  }, [socket, sessionId]);

  const addRow = useCallback(() => {
    socket?.emit("initiative:add-row");
  }, [socket]);

  const updateRow = useCallback(
    (id: string, patch: Partial<Omit<InitiativeRow, "id">>) => {
      // Optimistic update
      setState((prev) => ({
        ...prev,
        rows: prev.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      }));
      socket?.emit("initiative:update-row", { id, ...patch });
    },
    [socket]
  );

  const removeRow = useCallback(
    (id: string) => {
      setState((prev) => ({
        ...prev,
        rows: prev.rows.filter((r) => r.id !== id),
      }));
      socket?.emit("initiative:remove-row", { id });
    },
    [socket]
  );

  const sort = useCallback(() => {
    socket?.emit("initiative:sort");
  }, [socket]);

  const next = useCallback(() => {
    socket?.emit("initiative:next");
  }, [socket]);

  const clear = useCallback(() => {
    socket?.emit("initiative:clear");
  }, [socket]);

  const reorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      setState((prev) => {
        if (fromIndex === toIndex) return prev;
        const rows = [...prev.rows];
        const activeId = rows[prev.activeIndex]?.id;
        const [moved] = rows.splice(fromIndex, 1);
        rows.splice(toIndex, 0, moved);
        const newActive = rows.findIndex((r) => r.id === activeId);
        return { ...prev, rows, activeIndex: newActive >= 0 ? newActive : 0 };
      });
      socket?.emit("initiative:reorder", { fromIndex, toIndex });
    },
    [socket]
  );

  const importRows = useCallback(
    (rows: Omit<InitiativeRow, "id">[]) => {
      socket?.emit("initiative:import", { rows });
    },
    [socket]
  );

  return { state, addRow, updateRow, removeRow, sort, next, clear, reorder, importRows };
}


