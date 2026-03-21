import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import express from "express";
import request from "supertest";
import { getDirSize, storageGuard, sessionLimitGuard } from "../src/guards.js";

describe("getDirSize", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "guards-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns 0 for an empty directory", () => {
    expect(getDirSize(tmpDir)).toBe(0);
  });

  it("returns total size of all files", () => {
    fs.writeFileSync(path.join(tmpDir, "a.txt"), "x".repeat(100));
    fs.writeFileSync(path.join(tmpDir, "b.txt"), "x".repeat(200));
    expect(getDirSize(tmpDir)).toBe(300);
  });

  it("returns 0 for non-existent directory", () => {
    expect(getDirSize("/tmp/nonexistent-dir-xyz")).toBe(0);
  });
});

describe("storageGuard", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "guards-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("allows request when under limit", async () => {
    const app = express();
    app.post("/upload", storageGuard(tmpDir, 1), (_req, res) => res.json({ ok: true }));
    const res = await request(app).post("/upload").set("Content-Length", "100");
    expect(res.status).toBe(200);
  });

  it("rejects request when over limit", async () => {
    fs.writeFileSync(path.join(tmpDir, "big.bin"), "x".repeat(1024 * 1024));
    const app = express();
    app.post("/upload", storageGuard(tmpDir, 1), (_req, res) => res.json({ ok: true }));
    const res = await request(app).post("/upload").set("Content-Length", "100");
    expect(res.status).toBe(507);
    expect(res.body.error).toBe("Storage limit reached");
  });
});

describe("sessionLimitGuard", () => {
  it("allows request when under limit", async () => {
    const app = express();
    const getCount = () => 5;
    app.post("/create", sessionLimitGuard(getCount, 50), (_req, res) => res.json({ ok: true }));
    const res = await request(app).post("/create");
    expect(res.status).toBe(200);
  });

  it("rejects request when at limit", async () => {
    const app = express();
    const getCount = () => 50;
    app.post("/create", sessionLimitGuard(getCount, 50), (_req, res) => res.json({ ok: true }));
    const res = await request(app).post("/create");
    expect(res.status).toBe(507);
    expect(res.body.error).toBe("Session limit reached");
  });
});
