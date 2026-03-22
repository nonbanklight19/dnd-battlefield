import type { Server, Socket } from "socket.io";
import type { StateManager } from "./state.js";

export function setupSocketHandlers(io: Server, state: StateManager) {
  const clientSessions = new Map<string, string>(); // socketId -> sessionId

  io.on("connection", (socket: Socket) => {
    socket.on("session:join", (rawSessionId: string) => {
      const sessionId = rawSessionId.toUpperCase();
      if (!/^[A-Z0-9]{4}$/.test(sessionId)) {
        socket.emit("session:error", { message: "Invalid session code" });
        return;
      }
      const session = state.getSession(sessionId);
      if (!session) {
        socket.emit("session:error", { message: "Session not found" });
        return;
      }
      clientSessions.set(socket.id, sessionId);
      socket.join(sessionId);
      socket.emit("session:state", session);
    });

    socket.on("token:add-hero", (data: { heroType: string; x: number; y: number }) => {
      const sessionId = clientSessions.get(socket.id);
      if (!sessionId) return;
      const validTypes = ["warrior", "wizard", "rogue", "dwarf", "triton"];
      if (!validTypes.includes(data.heroType)) return;
      const token = state.addHero(sessionId, {
        heroType: data.heroType as any,
        x: data.x,
        y: data.y,
      });
      if (token) {
        socket.to(sessionId).emit("token:added", token);
        socket.emit("token:added", token);
      }
    });

    socket.on("token:add-enemy", (data: { name: string; color: string; icon: string; customImage?: string; x: number; y: number }) => {
      const sessionId = clientSessions.get(socket.id);
      if (!sessionId) return;
      const token = state.addEnemy(sessionId, data);
      if (token) {
        socket.to(sessionId).emit("token:added", token);
        socket.emit("token:added", token);
      }
    });

    socket.on("token:move", (data: { id: string; x: number; y: number }) => {
      const sessionId = clientSessions.get(socket.id);
      if (!sessionId) return;
      if (state.moveToken(sessionId, data.id, data.x, data.y)) {
        socket.to(sessionId).emit("token:moved", data);
      }
    });

    socket.on("token:remove", (data: { id: string }) => {
      const sessionId = clientSessions.get(socket.id);
      if (!sessionId) return;
      if (state.removeToken(sessionId, data.id)) {
        socket.to(sessionId).emit("token:removed", data);
        socket.emit("token:removed", data);
      }
    });

    socket.on("grid:update", (data: { gridMode: string; gridSize: number }) => {
      const sessionId = clientSessions.get(socket.id);
      if (!sessionId) return;
      if (state.updateGrid(sessionId, data.gridMode as any, data.gridSize)) {
        socket.to(sessionId).emit("grid:updated", data);
      }
    });

    socket.on("session:save", () => {
      const sessionId = clientSessions.get(socket.id);
      if (!sessionId) return;
      state.saveSession(sessionId);
      socket.emit("session:saved", { success: true });
    });

    socket.on("disconnect", () => {
      const sessionId = clientSessions.get(socket.id);
      if (sessionId) {
        clientSessions.delete(socket.id);
        // Save on last disconnect
        const room = io.sockets.adapter.rooms.get(sessionId);
        if (!room || room.size === 0) {
          state.saveSession(sessionId);
        }
      }
    });
  });
}
