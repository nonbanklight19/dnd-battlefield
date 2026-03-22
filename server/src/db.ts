import BetterSqlite3 from "better-sqlite3";
import type { Session, Token, HeroType, InitiativeRow, InitiativeState, HeroConfig } from "./types.js";

export class Database {
  private db: BetterSqlite3.Database;

  constructor(path: string) {
    this.db = new BetterSqlite3(path);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.migrate();
  }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        gridMode TEXT NOT NULL DEFAULT 'none',
        gridSize INTEGER NOT NULL DEFAULT 50,
        createdAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS maps (
        sessionId TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
        imageUrl TEXT NOT NULL,
        width INTEGER NOT NULL,
        height INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS tokens (
        id TEXT PRIMARY KEY,
        sessionId TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        kind TEXT NOT NULL DEFAULT 'enemy',
        heroType TEXT,
        name TEXT,
        color TEXT,
        icon TEXT,
        customImage TEXT,
        x REAL NOT NULL,
        y REAL NOT NULL,
        size INTEGER NOT NULL DEFAULT 1,
        statuses TEXT NOT NULL DEFAULT '[]'
      );
      CREATE TABLE IF NOT EXISTS initiative_meta (
        sessionId TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
        activeIndex INTEGER NOT NULL DEFAULT 0,
        round INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE IF NOT EXISTS initiative_rows (
        id TEXT PRIMARY KEY,
        sessionId TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        tokenId TEXT,
        initiative REAL,
        name TEXT NOT NULL DEFAULT '',
        hp REAL,
        ac REAL,
        position INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS hero_configs (
        sessionId TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        heroType TEXT NOT NULL,
        hp REAL,
        ac REAL,
        PRIMARY KEY (sessionId, heroType)
      );
    `);
    // Add statuses column to existing DBs that predate this migration
    try {
      this.db.exec(`ALTER TABLE tokens ADD COLUMN statuses TEXT NOT NULL DEFAULT '[]'`);
    } catch {
      // Column already exists — ignore
    }
  }

  saveSession(session: Session) {
    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT OR REPLACE INTO sessions (id, gridMode, gridSize, createdAt) VALUES (?, ?, ?, ?)`
        )
        .run(session.id, session.gridMode, session.gridSize, session.createdAt);

      this.db.prepare(`DELETE FROM maps WHERE sessionId = ?`).run(session.id);
      this.db.prepare(`DELETE FROM tokens WHERE sessionId = ?`).run(session.id);

      if (session.map) {
        this.db
          .prepare(
            `INSERT INTO maps (sessionId, imageUrl, width, height) VALUES (?, ?, ?, ?)`
          )
          .run(session.map.sessionId, session.map.imageUrl, session.map.width, session.map.height);
      }

      const insertToken = this.db.prepare(
        `INSERT INTO tokens (id, sessionId, kind, heroType, name, color, icon, customImage, x, y, size, statuses)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const t of session.tokens) {
        const statuses = JSON.stringify(t.statuses ?? []);
        if (t.kind === "hero") {
          insertToken.run(t.id, t.sessionId, "hero", t.heroType, null, null, null, null, t.x, t.y, t.size, statuses);
        } else {
          insertToken.run(t.id, t.sessionId, "enemy", null, t.name, t.color, t.icon, t.customImage ?? null, t.x, t.y, t.size, statuses);
        }
      }
    });
    tx();
  }

  loadSession(id: string): Session | null {
    const row = this.db
      .prepare(`SELECT * FROM sessions WHERE id = ?`)
      .get(id) as { id: string; gridMode: string; gridSize: number; createdAt: string } | undefined;

    if (!row) return null;

    const mapRow = this.db
      .prepare(`SELECT * FROM maps WHERE sessionId = ?`)
      .get(id) as { sessionId: string; imageUrl: string; width: number; height: number } | undefined;

    const tokenRows = this.db
      .prepare(`SELECT * FROM tokens WHERE sessionId = ?`)
      .all(id) as Array<{
        id: string; sessionId: string; kind: string; heroType: string | null;
        name: string | null; color: string | null; icon: string | null;
        customImage: string | null; x: number; y: number; size: number; statuses: string;
      }>;

    const tokens: Token[] = tokenRows.map((row) => {
      const statuses = JSON.parse(row.statuses ?? "[]");
      if (row.kind === "hero") {
        return {
          id: row.id, sessionId: row.sessionId, kind: "hero" as const,
          heroType: row.heroType as HeroType, x: row.x, y: row.y, size: row.size, statuses,
        };
      }
      return {
        id: row.id, sessionId: row.sessionId, kind: "enemy" as const,
        name: row.name!, color: row.color!, icon: row.icon!,
        ...(row.customImage ? { customImage: row.customImage } : {}),
        x: row.x, y: row.y, size: row.size, statuses,
      };
    });

    return {
      id: row.id,
      gridMode: row.gridMode as Session["gridMode"],
      gridSize: row.gridSize,
      createdAt: row.createdAt,
      map: mapRow ?? null,
      tokens,
    };
  }

  saveInitiative(sessionId: string, state: InitiativeState) {
    const tx = this.db.transaction(() => {
      this.db.prepare(`INSERT OR REPLACE INTO initiative_meta (sessionId, activeIndex, round) VALUES (?, ?, ?)`)
        .run(sessionId, state.activeIndex, state.round);
      this.db.prepare(`DELETE FROM initiative_rows WHERE sessionId = ?`).run(sessionId);
      const insert = this.db.prepare(
        `INSERT INTO initiative_rows (id, sessionId, tokenId, initiative, name, hp, ac, position)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      );
      state.rows.forEach((row, idx) => {
        insert.run(row.id, sessionId, row.tokenId ?? null, row.initiative ?? null, row.name, row.hp ?? null, row.ac ?? null, idx);
      });
    });
    tx();
  }

  loadInitiative(sessionId: string): InitiativeState | null {
    const meta = this.db.prepare(`SELECT * FROM initiative_meta WHERE sessionId = ?`)
      .get(sessionId) as { activeIndex: number; round: number } | undefined;

    const rowRecords = this.db.prepare(`SELECT * FROM initiative_rows WHERE sessionId = ? ORDER BY position ASC`)
      .all(sessionId) as Array<{
        id: string; tokenId: string | null; initiative: number | null;
        name: string; hp: number | null; ac: number | null;
      }>;

    if (!meta && rowRecords.length === 0) return null;

    const rows: InitiativeRow[] = rowRecords.map((r) => ({
      id: r.id,
      ...(r.tokenId ? { tokenId: r.tokenId } : {}),
      initiative: r.initiative,
      name: r.name,
      hp: r.hp,
      ac: r.ac,
    }));

    return {
      rows,
      activeIndex: meta?.activeIndex ?? 0,
      round: meta?.round ?? 1,
    };
  }

  saveHeroConfigs(sessionId: string, configs: HeroConfig[]) {
    const tx = this.db.transaction(() => {
      const upsert = this.db.prepare(
        `INSERT OR REPLACE INTO hero_configs (sessionId, heroType, hp, ac) VALUES (?, ?, ?, ?)`
      );
      for (const c of configs) {
        upsert.run(sessionId, c.heroType, c.hp ?? null, c.ac ?? null);
      }
    });
    tx();
  }

  loadHeroConfigs(sessionId: string): HeroConfig[] {
    const rows = this.db
      .prepare(`SELECT heroType, hp, ac FROM hero_configs WHERE sessionId = ?`)
      .all(sessionId) as Array<{ heroType: string; hp: number | null; ac: number | null }>;
    return rows.map((r) => ({
      heroType: r.heroType as HeroType,
      hp: r.hp,
      ac: r.ac,
    }));
  }

  listSessionIds(): string[] {
    const rows = this.db.prepare(`SELECT id FROM sessions`).all() as { id: string }[];
    return rows.map((r) => r.id);
  }

  deleteSession(id: string) {
    this.db.prepare(`DELETE FROM sessions WHERE id = ?`).run(id);
  }

  deleteSessionsOlderThan(days: number): string[] {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const rows = this.db
      .prepare(`SELECT id FROM sessions WHERE createdAt < ?`)
      .all(cutoff) as { id: string }[];
    const ids = rows.map((r) => r.id);
    if (ids.length > 0) {
      this.db.prepare(`DELETE FROM sessions WHERE createdAt < ?`).run(cutoff);
    }
    return ids;
  }

  close() {
    this.db.close();
  }
}
