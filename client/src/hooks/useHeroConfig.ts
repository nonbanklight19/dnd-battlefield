import { useState, useEffect, useCallback } from "react";
import type { Socket } from "socket.io-client";
import type { HeroConfig } from "../types.js";

export function useHeroConfig(socket: Socket | null) {
  const [configs, setConfigs] = useState<HeroConfig[]>([]);

  useEffect(() => {
    if (!socket) return;
    const onState = (data: HeroConfig[]) => setConfigs(data);
    socket.on("hero-config:state", onState);
    // Fetch on mount
    socket.emit("hero-config:get");
    return () => { socket.off("hero-config:state", onState); };
  }, [socket]);

  const saveConfigs = useCallback((updated: HeroConfig[]) => {
    socket?.emit("hero-config:save", updated);
  }, [socket]);

  return { configs, saveConfigs };
}

