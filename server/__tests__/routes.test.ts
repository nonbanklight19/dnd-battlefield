import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import { createRoutes } from "../src/routes.js";
import { StateManager } from "../src/state.js";
import { Database } from "../src/db.js";
import path from "path";
import fs from "fs";
import os from "os";

describe("REST Routes", () => {
  let app: express.Express;
  let db: Database;
  let state: StateManager;
  let uploadDir: string;

  beforeEach(() => {
    db = new Database(":memory:");
    state = new StateManager(db);
    uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), "battlefield-test-"));
    app = express();
    app.use(express.json());
    app.use(createRoutes(state, uploadDir, undefined, { maxStorageMb: 1, maxSessions: 2 }));
  });

  afterEach(() => {
    state.stopAutoSave();
    db.close();
    fs.rmSync(uploadDir, { recursive: true, force: true });
  });

  it("GET /health returns ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("POST /api/sessions creates a session", async () => {
    const res = await request(app).post("/api/sessions");
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.id).toHaveLength(4);
  });

  it("GET /api/sessions/:id returns a session", async () => {
    const created = (await request(app).post("/api/sessions")).body;
    const res = await request(app).get(`/api/sessions/${created.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.id);
  });

  it("GET /api/sessions/:id returns 404 for unknown session", async () => {
    const res = await request(app).get("/api/sessions/NOPE");
    expect(res.status).toBe(404);
  });

  it("rejects session creation when at session limit", async () => {
    // Create MAX_SESSIONS sessions
    for (let i = 0; i < 2; i++) {
      await request(app).post("/api/sessions");
    }
    const res = await request(app).post("/api/sessions");
    expect(res.status).toBe(507);
    expect(res.body.error).toBe("Session limit reached");
  });

  it("rejects map upload when storage limit exceeded", async () => {
    // Write a large file to fill storage
    fs.writeFileSync(path.join(uploadDir, "existing.bin"), "x".repeat(1024 * 1024));
    const created = (await request(app).post("/api/sessions")).body;
    const res = await request(app)
      .post(`/api/sessions/${created.id}/map`)
      .attach("map", Buffer.from("fake-png"), "map.png");
    expect(res.status).toBe(507);
    expect(res.body.error).toBe("Storage limit reached");
  });

  it("POST /api/sessions/:id/map uploads a map image", async () => {
    const created = (await request(app).post("/api/sessions")).body;
    const res = await request(app)
      .post(`/api/sessions/${created.id}/map`)
      .attach("map", Buffer.from("fake-png"), "map.png");
    expect(res.status).toBe(200);
    expect(res.body.imageUrl).toMatch(/^\/uploads\//);
  });
});
