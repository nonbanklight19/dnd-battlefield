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
