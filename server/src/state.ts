import { nanoid, customAlphabet } from "nanoid";

const sessionIdGen = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 4);
import type { Session, Token, GridMode, MapData } from "./types.js";
import type { Database } from "./db.js";

export class StateManager {
  private sessions = new Map<string, Session>();
  private db: Database;
  private autoSaveInterval: ReturnType<typeof setInterval> | null = null;

  constructor(db: Database) {
    this.db = db;
    this.loadAllFromDb();
  }

  private loadAllFromDb() {
    for (const id of this.db.listSessionIds()) {
      const session = this.db.loadSession(id);
      if (session) this.sessions.set(id, session);
    }
  }

  private generateId(): string {
    return sessionIdGen();
  }

  createSession(): Session {
    let id = this.generateId();
    while (this.sessions.has(id)) {
      id = this.generateId();
    }
    const session: Session = {
      id,
      gridMode: "none",
      gridSize: 50,
      createdAt: new Date().toISOString(),
      map: null,
      tokens: [],
    };
    this.sessions.set(id, session);
    return session;
  }

  getSession(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  addToken(
    sessionId: string,
    data: { name: string; color: string; x: number; y: number }
  ): Token | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;
    const token: Token = {
      id: nanoid(8),
      sessionId,
      name: data.name,
      color: data.color,
      x: data.x,
      y: data.y,
      size: 1,
    };
    session.tokens.push(token);
    return token;
  }

  moveToken(sessionId: string, tokenId: string, x: number, y: number): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    const token = session.tokens.find((t) => t.id === tokenId);
    if (!token) return false;
    token.x = x;
    token.y = y;
    return true;
  }

  removeToken(sessionId: string, tokenId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    const index = session.tokens.findIndex((t) => t.id === tokenId);
    if (index === -1) return false;
    session.tokens.splice(index, 1);
    return true;
  }

  updateGrid(sessionId: string, gridMode: GridMode, gridSize: number): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.gridMode = gridMode;
    session.gridSize = gridSize;
    return true;
  }

  setMap(
    sessionId: string,
    data: { imageUrl: string; width: number; height: number }
  ): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.map = { sessionId, imageUrl: data.imageUrl, width: data.width, height: data.height };
    return true;
  }

  saveSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (session) this.db.saveSession(session);
  }

  saveAllSessions() {
    for (const session of this.sessions.values()) {
      this.db.saveSession(session);
    }
  }

  startAutoSave(intervalMs: number = 30000) {
    this.autoSaveInterval = setInterval(() => this.saveAllSessions(), intervalMs);
  }

  stopAutoSave() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }

  deleteSession(sessionId: string) {
    this.sessions.delete(sessionId);
    this.db.deleteSession(sessionId);
  }

  get sessionCount(): number {
    return this.sessions.size;
  }

  listSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  clearMap(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.map = null;
    return true;
  }

  cleanupOldSessions(days: number): string[] {
    const deleted = this.db.deleteSessionsOlderThan(days);
    for (const id of deleted) {
      this.sessions.delete(id);
    }
    return deleted;
  }
}
