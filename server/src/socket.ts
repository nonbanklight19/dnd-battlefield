import type { Server, Socket } from "socket.io";
import type { StateManager } from "./state.js";
import type { TokenStatus, InitiativeRow, HeroConfig } from "./types.js";

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

    // ── Initiative ──────────────────────────────────────────────────────────

    socket.on("initiative:join", (rawSessionId: string) => {
      const sessionId = rawSessionId.toUpperCase();
      if (!/^[A-Z0-9]{4}$/.test(sessionId)) return;
      // Allow joining initiative room without a full session (separate page)
      if (!clientSessions.has(socket.id)) {
        clientSessions.set(socket.id, sessionId);
        socket.join(sessionId);
      }
      socket.emit("initiative:state", state.getInitiative(sessionId));
    });

    socket.on("initiative:add-row", () => {
      const sessionId = clientSessions.get(socket.id);
      if (!sessionId) return;
      const updated = state.addInitiativeRow(sessionId);
      io.to(sessionId).emit("initiative:state", updated);
    });

    socket.on("initiative:update-row", (data: { id: string } & Partial<Omit<InitiativeRow, "id">>) => {
      const sessionId = clientSessions.get(socket.id);
      if (!sessionId) return;
      const { id, ...patch } = data;
      const updated = state.updateInitiativeRow(sessionId, id, patch);
      if (updated) io.to(sessionId).emit("initiative:state", updated);
    });

    socket.on("initiative:remove-row", (data: { id: string }) => {
      const sessionId = clientSessions.get(socket.id);
      if (!sessionId) return;
      const updated = state.removeInitiativeRow(sessionId, data.id);
      if (updated) io.to(sessionId).emit("initiative:state", updated);
    });

    socket.on("initiative:sort", () => {
      const sessionId = clientSessions.get(socket.id);
      if (!sessionId) return;
      const updated = state.sortInitiative(sessionId);
      if (updated) io.to(sessionId).emit("initiative:state", updated);
    });

    socket.on("initiative:next", () => {
      const sessionId = clientSessions.get(socket.id);
      if (!sessionId) return;
      const updated = state.nextInitiative(sessionId);
      if (updated) {
        io.to(sessionId).emit("initiative:state", updated);
        const activeRow = updated.rows[updated.activeIndex];
        io.to(sessionId).emit("initiative:turn", {
          name: activeRow?.name ?? "",
          round: updated.round,
          tokenId: activeRow?.tokenId ?? null,
        });
      }
    });

    socket.on("initiative:clear", () => {
      const sessionId = clientSessions.get(socket.id);
      if (!sessionId) return;
      const updated = state.clearInitiative(sessionId);
      io.to(sessionId).emit("initiative:state", updated);
    });

    socket.on("initiative:import", (data: { rows: Omit<InitiativeRow, "id">[] }) => {
      const sessionId = clientSessions.get(socket.id);
      if (!sessionId) return;
      const updated = state.importInitiativeRows(sessionId, data.rows);
      io.to(sessionId).emit("initiative:state", updated);
    });

    // ── Hero configs ────────────────────────────────────────────────────────

    socket.on("hero-config:get", () => {
      const sessionId = clientSessions.get(socket.id);
      if (!sessionId) return;
      socket.emit("hero-config:state", state.getHeroConfigs(sessionId));
    });

    socket.on("hero-config:save", (configs: HeroConfig[]) => {
      const sessionId = clientSessions.get(socket.id);
      if (!sessionId) return;
      const updated = state.upsertHeroConfigs(sessionId, configs);
      socket.emit("hero-config:state", updated);
    });

    // ── Tokens ──────────────────────────────────────────────────────────────

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
        // Auto-add to initiative tracker with the hero type as name
        const initiative = state.addInitiativeRowForToken(sessionId, token.id, data.heroType, data.heroType as any);
        io.to(sessionId).emit("initiative:state", initiative);
      }
    });

    socket.on("token:add-enemy", (data: { name: string; color: string; icon: string; customImage?: string; size?: number; x: number; y: number }) => {
      const sessionId = clientSessions.get(socket.id);
      if (!sessionId) return;
      const token = state.addEnemy(sessionId, data);
      if (token) {
        socket.to(sessionId).emit("token:added", token);
        socket.emit("token:added", token);
        // Auto-add to initiative tracker
        const initiative = state.addInitiativeRowForToken(sessionId, token.id, data.name);
        io.to(sessionId).emit("initiative:state", initiative);
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
        // Remove from initiative if linked
        const initiative = state.removeInitiativeRowByTokenId(sessionId, data.id);
        if (initiative) io.to(sessionId).emit("initiative:state", initiative);
      }
    });

    socket.on("grid:update", (data: { gridMode: string; gridSize: number }) => {
      const sessionId = clientSessions.get(socket.id);
      if (!sessionId) return;
      if (state.updateGrid(sessionId, data.gridMode as any, data.gridSize)) {
        socket.to(sessionId).emit("grid:updated", data);
      }
    });

    socket.on("token:set-status", (data: { id: string; status: TokenStatus; active: boolean }) => {
      const sessionId = clientSessions.get(socket.id);
      if (!sessionId) return;
      const token = state.setTokenStatus(sessionId, data.id, data.status, data.active);
      if (token) {
        io.to(sessionId).emit("token:status-updated", { id: data.id, statuses: token.statuses });
        // Notify all clients when a token is marked dead
        if (data.status === "dead" && data.active) {
          const name = token.kind === "enemy" ? token.name : token.heroType;
          io.to(sessionId).emit("token:died", { name });
        }
        // Remove from initiative when marked dead; restore when un-marked
        if (data.status === "dead") {
          if (data.active) {
            const initiative = state.removeInitiativeRowByTokenId(sessionId, data.id);
            if (initiative) io.to(sessionId).emit("initiative:state", initiative);
          } else {
            const initiative = state.addInitiativeRowForToken(sessionId, data.id, token.kind === "enemy" ? token.name : token.heroType, token.kind === "hero" ? token.heroType : undefined);
            io.to(sessionId).emit("initiative:state", initiative);
          }
        }
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
