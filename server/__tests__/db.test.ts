import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Database } from "../src/db.js";
import type { Session } from "../src/types.js";

describe("Database", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
  });

  afterEach(() => {
    db.close();
  });

  it("saves and loads a session", () => {
    const session: Session = {
      id: "TEST",
      gridMode: "square",
      gridSize: 50,
      createdAt: new Date().toISOString(),
      map: null,
      tokens: [],
    };
    db.saveSession(session);
    const loaded = db.loadSession("TEST");
    expect(loaded).toEqual(session);
  });

  it("saves and loads a session with map and tokens", () => {
    const session: Session = {
      id: "MAP1",
      gridMode: "hex",
      gridSize: 60,
      createdAt: new Date().toISOString(),
      map: { sessionId: "MAP1", imageUrl: "/uploads/map.png", width: 1920, height: 1080 },
      tokens: [
        { id: "t1", sessionId: "MAP1", name: "Fighter", color: "#ff0000", x: 100, y: 200, size: 1 },
        { id: "t2", sessionId: "MAP1", name: "Wizard", color: "#0000ff", x: 300, y: 400, size: 1 },
      ],
    };
    db.saveSession(session);
    const loaded = db.loadSession("MAP1");
    expect(loaded).toEqual(session);
  });

  it("returns null for nonexistent session", () => {
    expect(db.loadSession("NOPE")).toBeNull();
  });

  it("lists all session IDs", () => {
    const now = new Date().toISOString();
    db.saveSession({ id: "A", gridMode: "none", gridSize: 50, createdAt: now, map: null, tokens: [] });
    db.saveSession({ id: "B", gridMode: "none", gridSize: 50, createdAt: now, map: null, tokens: [] });
    expect(db.listSessionIds()).toEqual(expect.arrayContaining(["A", "B"]));
  });

  it("deletes a session and its tokens and map", () => {
    const session: Session = {
      id: "DEL",
      gridMode: "none",
      gridSize: 50,
      createdAt: new Date().toISOString(),
      map: { sessionId: "DEL", imageUrl: "/uploads/x.png", width: 100, height: 100 },
      tokens: [{ id: "t1", sessionId: "DEL", name: "Rogue", color: "#00ff00", x: 0, y: 0, size: 1 }],
    };
    db.saveSession(session);
    db.deleteSession("DEL");
    expect(db.loadSession("DEL")).toBeNull();
  });

  it("deletes sessions older than a given age", () => {
    const old = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const recent = new Date().toISOString();
    db.saveSession({ id: "OLD", gridMode: "none", gridSize: 50, createdAt: old, map: null, tokens: [] });
    db.saveSession({ id: "NEW", gridMode: "none", gridSize: 50, createdAt: recent, map: null, tokens: [] });
    const deleted = db.deleteSessionsOlderThan(7);
    expect(deleted).toEqual(["OLD"]);
    expect(db.loadSession("OLD")).toBeNull();
    expect(db.loadSession("NEW")).not.toBeNull();
  });
});
