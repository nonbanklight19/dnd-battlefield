import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import { createAdminRoutes } from "../src/admin.js";
import { StateManager } from "../src/state.js";
import { Database } from "../src/db.js";
import fs from "fs";
import path from "path";
import os from "os";

describe("Admin Auth", () => {
  let app: express.Express;
  let db: Database;
  let state: StateManager;
  let uploadDir: string;

  beforeEach(() => {
    db = new Database(":memory:");
    state = new StateManager(db);
    uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), "admin-test-"));
    app = express();
    app.use(express.urlencoded({ extended: false }));
    app.use(createAdminRoutes({
      state,
      uploadDir,
      password: "testpass",
      maxStorageMb: 1000,
      maxSessions: 50,
    }));
  });

  afterEach(() => {
    state.stopAutoSave();
    db.close();
    fs.rmSync(uploadDir, { recursive: true, force: true });
  });

  it("GET /admin shows login page", async () => {
    const res = await request(app).get("/admin");
    expect(res.status).toBe(200);
    expect(res.text).toContain("password");
  });

  it("POST /admin/login with wrong password stays on login", async () => {
    const res = await request(app)
      .post("/admin/login")
      .send("password=wrongpass");
    expect(res.status).toBe(200);
    expect(res.text).toContain("Invalid password");
  });

  it("POST /admin/login with correct password redirects to dashboard", async () => {
    const res = await request(app)
      .post("/admin/login")
      .send("password=testpass");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/admin/dashboard");
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  it("GET /admin/dashboard without auth redirects to login", async () => {
    const res = await request(app).get("/admin/dashboard");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/admin");
  });

  it("GET /admin/dashboard with valid cookie returns 200", async () => {
    const loginRes = await request(app)
      .post("/admin/login")
      .send("password=testpass");
    const cookie = loginRes.headers["set-cookie"];
    const res = await request(app)
      .get("/admin/dashboard")
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.text).toContain("Dashboard");
  });

  it("POST /admin/logout clears cookie and redirects", async () => {
    const loginRes = await request(app)
      .post("/admin/login")
      .send("password=testpass");
    const cookie = loginRes.headers["set-cookie"];
    const res = await request(app)
      .post("/admin/logout")
      .set("Cookie", cookie);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/admin");
  });
});

describe("Admin Session Management", () => {
  let app: express.Express;
  let db: Database;
  let state: StateManager;
  let uploadDir: string;
  let cookie: string;

  beforeEach(async () => {
    db = new Database(":memory:");
    state = new StateManager(db);
    uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), "admin-test-"));
    app = express();
    app.use(express.urlencoded({ extended: false }));
    app.use(createAdminRoutes({
      state,
      uploadDir,
      password: "testpass",
      maxStorageMb: 1000,
      maxSessions: 50,
    }));
    const loginRes = await request(app).post("/admin/login").send("password=testpass");
    cookie = loginRes.headers["set-cookie"];
  });

  afterEach(() => {
    state.stopAutoSave();
    db.close();
    fs.rmSync(uploadDir, { recursive: true, force: true });
  });

  it("GET /admin/sessions lists all sessions", async () => {
    state.createSession();
    state.createSession();
    const res = await request(app).get("/admin/sessions").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.text).toContain("Sessions");
  });

  it("POST /admin/sessions/:id/delete removes a session", async () => {
    const session = state.createSession();
    const res = await request(app)
      .post(`/admin/sessions/${session.id}/delete`)
      .set("Cookie", cookie);
    expect(res.status).toBe(302);
    expect(state.getSession(session.id)).toBeUndefined();
  });

  it("deleting a session removes its map file", async () => {
    const session = state.createSession();
    fs.writeFileSync(path.join(uploadDir, "map.png"), "fake");
    state.setMap(session.id, { imageUrl: "/uploads/map.png", width: 100, height: 100 });

    await request(app)
      .post(`/admin/sessions/${session.id}/delete`)
      .set("Cookie", cookie);

    expect(fs.existsSync(path.join(uploadDir, "map.png"))).toBe(false);
  });

  it("POST /admin/sessions/cleanup deletes old sessions", async () => {
    const session = state.createSession();
    const s = state.getSession(session.id)!;
    s.createdAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    state.saveSession(session.id);

    const fresh = state.createSession();

    const res = await request(app)
      .post("/admin/sessions/cleanup")
      .set("Cookie", cookie)
      .send("days=7");
    expect(res.status).toBe(302);
    expect(state.getSession(session.id)).toBeUndefined();
    expect(state.getSession(fresh.id)).toBeDefined();
  });
});

describe("Admin File Management", () => {
  let app: express.Express;
  let db: Database;
  let state: StateManager;
  let uploadDir: string;
  let cookie: string;

  beforeEach(async () => {
    db = new Database(":memory:");
    state = new StateManager(db);
    uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), "admin-test-"));
    app = express();
    app.use(express.urlencoded({ extended: false }));
    app.use(createAdminRoutes({
      state,
      uploadDir,
      password: "testpass",
      maxStorageMb: 1000,
      maxSessions: 50,
    }));
    const loginRes = await request(app).post("/admin/login").send("password=testpass");
    cookie = loginRes.headers["set-cookie"];
  });

  afterEach(() => {
    state.stopAutoSave();
    db.close();
    fs.rmSync(uploadDir, { recursive: true, force: true });
  });

  it("GET /admin/files lists uploaded files", async () => {
    fs.writeFileSync(path.join(uploadDir, "map1.png"), "fake");
    const res = await request(app).get("/admin/files").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.text).toContain("map1.png");
  });

  it("marks orphaned files", async () => {
    fs.writeFileSync(path.join(uploadDir, "orphan.png"), "fake");
    const res = await request(app).get("/admin/files").set("Cookie", cookie);
    expect(res.text).toContain("Orphaned");
  });

  it("POST /admin/files/:filename/delete removes a file", async () => {
    fs.writeFileSync(path.join(uploadDir, "todelete.png"), "fake");
    const res = await request(app)
      .post("/admin/files/todelete.png/delete")
      .set("Cookie", cookie);
    expect(res.status).toBe(302);
    expect(fs.existsSync(path.join(uploadDir, "todelete.png"))).toBe(false);
  });

  it("deleting an active file clears session map reference", async () => {
    const session = state.createSession();
    fs.writeFileSync(path.join(uploadDir, "active.png"), "fake");
    state.setMap(session.id, { imageUrl: "/uploads/active.png", width: 100, height: 100 });

    await request(app)
      .post("/admin/files/active.png/delete")
      .set("Cookie", cookie);

    expect(state.getSession(session.id)!.map).toBeNull();
  });

  it("POST /admin/files/orphaned/delete removes all orphaned files", async () => {
    fs.writeFileSync(path.join(uploadDir, "orphan.png"), "fake");
    const session = state.createSession();
    fs.writeFileSync(path.join(uploadDir, "active.png"), "fake");
    state.setMap(session.id, { imageUrl: "/uploads/active.png", width: 100, height: 100 });

    const res = await request(app)
      .post("/admin/files/orphaned/delete")
      .set("Cookie", cookie);
    expect(res.status).toBe(302);
    expect(fs.existsSync(path.join(uploadDir, "orphan.png"))).toBe(false);
    expect(fs.existsSync(path.join(uploadDir, "active.png"))).toBe(true);
  });
});

describe("Admin Dashboard", () => {
  let app: express.Express;
  let db: Database;
  let state: StateManager;
  let uploadDir: string;
  let cookie: string;

  beforeEach(async () => {
    db = new Database(":memory:");
    state = new StateManager(db);
    uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), "admin-test-"));
    app = express();
    app.use(express.urlencoded({ extended: false }));
    app.use(createAdminRoutes({
      state,
      uploadDir,
      password: "testpass",
      maxStorageMb: 1000,
      maxSessions: 50,
    }));
    const loginRes = await request(app).post("/admin/login").send("password=testpass");
    cookie = loginRes.headers["set-cookie"];
  });

  afterEach(() => {
    state.stopAutoSave();
    db.close();
    fs.rmSync(uploadDir, { recursive: true, force: true });
  });

  it("shows disk usage, session count, and file count", async () => {
    const session = state.createSession();
    state.setMap(session.id, { imageUrl: "/uploads/test.png", width: 100, height: 100 });
    fs.writeFileSync(path.join(uploadDir, "test.png"), "x".repeat(500));

    const res = await request(app).get("/admin/dashboard").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.text).toContain("Disk Usage");
    expect(res.text).toContain("Sessions");
    expect(res.text).toContain("1"); // 1 session
  });
});
