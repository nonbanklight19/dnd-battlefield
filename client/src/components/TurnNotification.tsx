import { useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import type { TurnEvent } from "../hooks/useActiveTurn.js";

interface DeathEvent {
  name: string;
}

interface Props {
  turn: TurnEvent | null;
  socket: Socket | null;
}

export function TurnNotification({ turn, socket }: Props) {
  const [visible, setVisible] = useState(false);
  const [displayed, setDisplayed] = useState<TurnEvent | null>(null);

  const [deathVisible, setDeathVisible] = useState(false);
  const [deathName, setDeathName] = useState<string | null>(null);

  // Turn notification
  useEffect(() => {
    if (!turn) return;
    setDisplayed(turn);
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(t);
  }, [turn]);

  // Death notification
  useEffect(() => {
    if (!socket) return;
    const onDied = (data: DeathEvent) => {
      setDeathName(data.name);
      setDeathVisible(true);
      setTimeout(() => setDeathVisible(false), 4000);
    };
    socket.on("token:died", onDied);
    return () => { socket.off("token:died", onDied); };
  }, [socket]);

  return (
    <>
      {/* Turn notification */}
      {displayed && (
        <div
          className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 transition-all duration-1000 ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
          }`}
        >
          <div className="bg-bg-elevated border border-gold-muted rounded-xl px-6 py-4 shadow-2xl flex flex-col items-center gap-1 min-w-52 text-center">
            <span className="text-[10px] uppercase tracking-widest text-text-muted font-body">
              Round {displayed.round} · Now acting
            </span>
            <span className="text-xl font-display font-semibold text-gold-bright capitalize">
              {displayed.name || "—"}
            </span>
          </div>
        </div>
      )}

      {/* Death notification */}
      {deathName && (
        <div
          className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 transition-all duration-1000 ${
            deathVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
          }`}
        >
          <div className="bg-bg-elevated border border-red-700 rounded-xl px-6 py-4 shadow-2xl flex flex-col items-center gap-1 min-w-48 text-center">
            <span className="text-lg">💀</span>
            <span className="text-[10px] uppercase tracking-widest text-red-400 font-body">
              Slain
            </span>
            <span className="text-xl font-display font-semibold text-red-300 capitalize">
              {deathName}
            </span>
          </div>
        </div>
      )}
    </>
  );
}
