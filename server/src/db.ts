import BetterSqlite3 from "better-sqlite3";
import type { Session, Token, MapData, HeroType } from "./types.js";

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
      DROP TABLE IF EXISTS tokens;
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
        size INTEGER NOT NULL DEFAULT 1
      );
    `);
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
        `INSERT INTO tokens (id, sessionId, kind, heroType, name, color, icon, customImage, x, y, size)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const t of session.tokens) {
        if (t.kind === "hero") {
          insertToken.run(t.id, t.sessionId, "hero", t.heroType, null, null, null, null, t.x, t.y, t.size);
        } else {
          insertToken.run(t.id, t.sessionId, "enemy", null, t.name, t.color, t.icon, t.customImage ?? null, t.x, t.y, t.size);
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
        customImage: string | null; x: number; y: number; size: number;
      }>;

    const tokens: Token[] = tokenRows.map((row) => {
      if (row.kind === "hero") {
        return {
          id: row.id, sessionId: row.sessionId, kind: "hero" as const,
          heroType: row.heroType as HeroType, x: row.x, y: row.y, size: row.size,
        };
      }
      return {
        id: row.id, sessionId: row.sessionId, kind: "enemy" as const,
        name: row.name!, color: row.color!, icon: row.icon!,
        ...(row.customImage ? { customImage: row.customImage } : {}),
        x: row.x, y: row.y, size: row.size,
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
