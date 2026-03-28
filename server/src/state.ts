import { nanoid, customAlphabet } from "nanoid";

const sessionIdGen = customAlphabet("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 4);
import type { Session, Token, HeroToken, EnemyToken, HeroType, GridMode, MapData, TokenStatus, InitiativeRow, InitiativeState, HeroConfig } from "./types.js";
import type { Database } from "./db.js";

export class StateManager {
  private sessions = new Map<string, Session>();
  private initiatives = new Map<string, InitiativeState>();
  private heroConfigs = new Map<string, Map<HeroType, HeroConfig>>(); // sessionId -> heroType -> config
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
      const initiative = this.db.loadInitiative(id);
      if (initiative) this.initiatives.set(id, initiative);
      const configs = this.db.loadHeroConfigs(id);
      if (configs.length > 0) {
        const map = new Map<HeroType, HeroConfig>();
        for (const c of configs) map.set(c.heroType, c);
        this.heroConfigs.set(id, map);
      }
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

  addHero(
    sessionId: string,
    data: { heroType: HeroType; x: number; y: number }
  ): Token | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;
    // Each hero type can only exist once per session
    if (session.tokens.some((t) => t.kind === "hero" && t.heroType === data.heroType)) {
      return undefined;
    }
    const token: HeroToken = {
      id: nanoid(8),
      sessionId,
      kind: "hero",
      heroType: data.heroType,
      x: data.x,
      y: data.y,
      size: 1,
      statuses: [],
    };
    session.tokens.push(token);
    return token;
  }

  addEnemy(
    sessionId: string,
    data: { name: string; color: string; icon: string; customImage?: string; size?: number; x: number; y: number }
  ): Token | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;
    const token: EnemyToken = {
      id: nanoid(8),
      sessionId,
      kind: "enemy",
      name: data.name,
      color: data.color,
      icon: data.icon,
      customImage: data.customImage,
      x: data.x,
      y: data.y,
      size: data.size ?? 1,
      statuses: [],
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

  setTokenStatus(sessionId: string, tokenId: string, status: TokenStatus, active: boolean): Token | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;
    const token = session.tokens.find((t) => t.id === tokenId);
    if (!token) return undefined;
    if (active) {
      if (!token.statuses.includes(status)) token.statuses.push(status);
    } else {
      token.statuses = token.statuses.filter((s) => s !== status);
    }
    return token;
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
    const initiative = this.initiatives.get(sessionId);
    if (initiative) this.db.saveInitiative(sessionId, initiative);
  }

  saveAllSessions() {
    for (const session of this.sessions.values()) {
      this.db.saveSession(session);
    }
    for (const [sessionId, initiative] of this.initiatives.entries()) {
      this.db.saveInitiative(sessionId, initiative);
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
      this.initiatives.delete(id);
      this.heroConfigs.delete(id);
    }
    return deleted;
  }

  // ── Initiative tracker ──────────────────────────────────────────────────────

  private ensureInitiative(sessionId: string): InitiativeState {
    if (!this.initiatives.has(sessionId)) {
      this.initiatives.set(sessionId, { rows: [], activeIndex: 0, round: 1 });
    }
    return this.initiatives.get(sessionId)!;
  }

  getInitiative(sessionId: string): InitiativeState {
    return this.ensureInitiative(sessionId);
  }

  addInitiativeRow(sessionId: string): InitiativeState {
    const state = this.ensureInitiative(sessionId);
    state.rows.push({ id: nanoid(8), initiative: null, name: "", hp: null, ac: null });
    return state;
  }

  addInitiativeRowForToken(sessionId: string, tokenId: string, name: string, heroType?: HeroType): InitiativeState {
    const state = this.ensureInitiative(sessionId);
    // Don't add a duplicate row for the same token
    if (state.rows.some((r) => r.tokenId === tokenId)) return state;
    // Apply saved hero config if available
    const config = heroType ? this.heroConfigs.get(sessionId)?.get(heroType) : undefined;
    state.rows.push({
      id: nanoid(8),
      tokenId,
      initiative: null,
      name,
      hp: config?.hp ?? null,
      ac: config?.ac ?? null,
    });
    return state;
  }

  // ── Hero configs ────────────────────────────────────────────────────────────

  getHeroConfigs(sessionId: string): HeroConfig[] {
    const map = this.heroConfigs.get(sessionId);
    return map ? Array.from(map.values()) : [];
  }

  upsertHeroConfigs(sessionId: string, configs: HeroConfig[]): HeroConfig[] {
    if (!this.heroConfigs.has(sessionId)) {
      this.heroConfigs.set(sessionId, new Map());
    }
    const map = this.heroConfigs.get(sessionId)!;
    for (const c of configs) {
      map.set(c.heroType, c);
    }
    this.db.saveHeroConfigs(sessionId, configs);
    return Array.from(map.values());
  }

  removeInitiativeRowByTokenId(sessionId: string, tokenId: string): InitiativeState | undefined {
    const state = this.initiatives.get(sessionId);
    if (!state) return undefined;
    const idx = state.rows.findIndex((r) => r.tokenId === tokenId);
    if (idx === -1) return undefined;
    const activeId = state.rows[state.activeIndex]?.id;
    state.rows.splice(idx, 1);
    const newActive = state.rows.findIndex((r) => r.id === activeId);
    state.activeIndex = newActive >= 0 ? newActive : Math.min(state.activeIndex, Math.max(0, state.rows.length - 1));
    return state;
  }

  updateInitiativeRow(sessionId: string, rowId: string, patch: Partial<Omit<InitiativeRow, "id">>): InitiativeState | undefined {
    const state = this.initiatives.get(sessionId);
    if (!state) return undefined;
    const row = state.rows.find((r) => r.id === rowId);
    if (!row) return undefined;
    Object.assign(row, patch);
    return state;
  }

  removeInitiativeRow(sessionId: string, rowId: string): InitiativeState | undefined {
    const state = this.initiatives.get(sessionId);
    if (!state) return undefined;
    const idx = state.rows.findIndex((r) => r.id === rowId);
    if (idx === -1) return undefined;
    state.rows.splice(idx, 1);
    if (state.activeIndex >= state.rows.length && state.rows.length > 0) {
      state.activeIndex = 0;
    }
    return state;
  }

  sortInitiative(sessionId: string): InitiativeState | undefined {
    const state = this.initiatives.get(sessionId);
    if (!state) return undefined;
    const activeId = state.rows[state.activeIndex]?.id;
    state.rows.sort((a, b) => (b.initiative ?? -Infinity) - (a.initiative ?? -Infinity));
    const newIdx = state.rows.findIndex((r) => r.id === activeId);
    state.activeIndex = newIdx >= 0 ? newIdx : 0;
    return state;
  }

  reorderInitiativeRows(sessionId: string, fromIndex: number, toIndex: number): InitiativeState | undefined {
    const state = this.initiatives.get(sessionId);
    if (!state) return undefined;
    const { rows, activeIndex } = state;
    if (fromIndex < 0 || fromIndex >= rows.length || toIndex < 0 || toIndex >= rows.length) return undefined;
    const activeId = rows[activeIndex]?.id;
    const [moved] = rows.splice(fromIndex, 1);
    rows.splice(toIndex, 0, moved);
    const newActive = rows.findIndex((r) => r.id === activeId);
    state.activeIndex = newActive >= 0 ? newActive : 0;
    return state;
  }

  nextInitiative(sessionId: string): InitiativeState | undefined {
    const state = this.initiatives.get(sessionId);
    if (!state || state.rows.length === 0) return undefined;
    if (state.activeIndex >= state.rows.length - 1) {
      state.activeIndex = 0;
      state.round += 1;
    } else {
      state.activeIndex += 1;
    }
    return state;
  }

  clearInitiative(sessionId: string): InitiativeState {
    const state: InitiativeState = { rows: [], activeIndex: 0, round: 1 };
    this.initiatives.set(sessionId, state);
    return state;
  }

  importInitiativeRows(sessionId: string, incoming: Omit<InitiativeRow, "id">[]): InitiativeState {
    const state = this.ensureInitiative(sessionId);
    state.rows = incoming.map((r) => ({ ...r, id: nanoid(8) }));
    state.activeIndex = 0;
    state.round = 1;
    return state;
  }
}
