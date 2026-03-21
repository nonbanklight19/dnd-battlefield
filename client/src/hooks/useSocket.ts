import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

export function useSocket(): Socket | null {
  const socketRef = useRef<Socket | null>(null);

  if (!socketRef.current) {
    socketRef.current = io({ transports: ["websocket", "polling"] });
  }

  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  return socketRef.current;
}
