import { useState, useEffect } from "react";
import type { Socket } from "socket.io-client";

export interface TurnEvent {
  name: string;
  round: number;
  tokenId: string | null;
}

export function useActiveTurn(socket: Socket | null) {
  const [turn, setTurn] = useState<TurnEvent | null>(null);

  useEffect(() => {
    if (!socket) return;
    const onTurn = (data: TurnEvent) => {
      setTurn(data);
    };
    socket.on("initiative:turn", onTurn);
    return () => { socket.off("initiative:turn", onTurn); };
  }, [socket]);

  // Auto-clear tokenId highlight after 5 s so the ring stops
  useEffect(() => {
    if (!turn?.tokenId) return;
    const t = setTimeout(() => setTurn((prev) => prev ? { ...prev, tokenId: null } : null), 5000);
    return () => clearTimeout(t);
  }, [turn]);

  return turn;
}
