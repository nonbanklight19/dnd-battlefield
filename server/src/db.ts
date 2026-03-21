import BetterSqlite3 from "better-sqlite3";
import type { Session, Token, MapData } from "./types.js";

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
        name TEXT NOT NULL,
        color TEXT NOT NULL,
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
        `INSERT INTO tokens (id, sessionId, name, color, x, y, size) VALUES (?, ?, ?, ?, ?, ?, ?)`
      );
      for (const t of session.tokens) {
        insertToken.run(t.id, t.sessionId, t.name, t.color, t.x, t.y, t.size);
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
      .all(id) as Token[];

    return {
      id: row.id,
      gridMode: row.gridMode as Session["gridMode"],
      gridSize: row.gridSize,
      createdAt: row.createdAt,
      map: mapRow ?? null,
      tokens: tokenRows,
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
