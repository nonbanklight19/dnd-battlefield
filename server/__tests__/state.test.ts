import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { StateManager } from "../src/state.js";
import { Database } from "../src/db.js";

describe("StateManager", () => {
  let db: Database;
  let state: StateManager;

  beforeEach(() => {
    db = new Database(":memory:");
    state = new StateManager(db);
  });

  afterEach(() => {
    state.stopAutoSave();
    db.close();
  });

  it("creates a new session with a 4-char ID", () => {
    const session = state.createSession();
    expect(session.id).toHaveLength(4);
    expect(session.gridMode).toBe("none");
    expect(session.gridSize).toBe(50);
    expect(session.tokens).toEqual([]);
    expect(session.map).toBeNull();
  });

  it("gets a session by ID", () => {
    const created = state.createSession();
    const fetched = state.getSession(created.id);
    expect(fetched).toEqual(created);
  });

  it("returns undefined for unknown session", () => {
    expect(state.getSession("NOPE")).toBeUndefined();
  });

  it("adds a token to a session", () => {
    const session = state.createSession();
    const token = state.addEnemy(session.id, { name: "Fighter", color: "#ff0000", icon: "👹", x: 100, y: 200 });
    expect(token).toBeDefined();
    expect(token!.name).toBe("Fighter");
    expect(state.getSession(session.id)!.tokens).toHaveLength(1);
  });

  it("adds a hero token to a session", () => {
    const session = state.createSession();
    const token = state.addHero(session.id, { heroType: "warrior", x: 100, y: 200 });
    expect(token).toBeDefined();
    expect(token!.kind).toBe("hero");
    if (token!.kind === "hero") {
      expect(token!.heroType).toBe("warrior");
    }
    expect(state.getSession(session.id)!.tokens).toHaveLength(1);
  });

  it("prevents duplicate hero types", () => {
    const session = state.createSession();
    state.addHero(session.id, { heroType: "warrior", x: 100, y: 200 });
    const dupe = state.addHero(session.id, { heroType: "warrior", x: 300, y: 400 });
    expect(dupe).toBeUndefined();
    expect(state.getSession(session.id)!.tokens).toHaveLength(1);
  });

  it("moves a token", () => {
    const session = state.createSession();
    const token = state.addEnemy(session.id, { name: "Rogue", color: "#00ff00", icon: "👹", x: 0, y: 0 });
    state.moveToken(session.id, token!.id, 500, 600);
    const updated = state.getSession(session.id)!.tokens[0];
    expect(updated.x).toBe(500);
    expect(updated.y).toBe(600);
  });

  it("removes a token", () => {
    const session = state.createSession();
    const token = state.addEnemy(session.id, { name: "Wizard", color: "#0000ff", icon: "👹", x: 0, y: 0 });
    state.removeToken(session.id, token!.id);
    expect(state.getSession(session.id)!.tokens).toHaveLength(0);
  });

  it("updates grid settings", () => {
    const session = state.createSession();
    state.updateGrid(session.id, "hex", 60);
    const updated = state.getSession(session.id)!;
    expect(updated.gridMode).toBe("hex");
    expect(updated.gridSize).toBe(60);
  });

  it("sets map data", () => {
    const session = state.createSession();
    state.setMap(session.id, { imageUrl: "/uploads/map.png", width: 1920, height: 1080 });
    const updated = state.getSession(session.id)!;
    expect(updated.map).toEqual({
      sessionId: session.id,
      imageUrl: "/uploads/map.png",
      width: 1920,
      height: 1080,
    });
  });

  it("saves a session to the database", () => {
    const session = state.createSession();
    state.addEnemy(session.id, { name: "Paladin", color: "#ffff00", icon: "👹", x: 50, y: 50 });
    state.saveSession(session.id);
    const loaded = db.loadSession(session.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.tokens).toHaveLength(1);
  });

  it("loads sessions from database on init", () => {
    const session = state.createSession();
    state.addEnemy(session.id, { name: "Bard", color: "#ff00ff", icon: "👹", x: 10, y: 20 });
    state.saveSession(session.id);

    // Create new state manager — should load from DB
    const state2 = new StateManager(db);
    const loaded = state2.getSession(session.id);
    expect(loaded).toBeDefined();
    expect(loaded!.tokens).toHaveLength(1);
    expect(loaded!.tokens[0].kind).toBe("enemy");
    if (loaded!.tokens[0].kind === "enemy") {
      expect(loaded!.tokens[0].name).toBe("Bard");
    }
    state2.stopAutoSave();
  });

  it("returns session count", () => {
    state.createSession();
    state.createSession();
    expect(state.sessionCount).toBe(2);
  });

  it("lists all sessions", () => {
    const s1 = state.createSession();
    const s2 = state.createSession();
    const list = state.listSessions();
    expect(list).toHaveLength(2);
    expect(list.map((s) => s.id).sort()).toEqual([s1.id, s2.id].sort());
  });

  it("clears map from a session", () => {
    const session = state.createSession();
    state.setMap(session.id, { imageUrl: "/uploads/map.png", width: 100, height: 100 });
    expect(state.getSession(session.id)!.map).not.toBeNull();
    state.clearMap(session.id);
    expect(state.getSession(session.id)!.map).toBeNull();
  });
});
