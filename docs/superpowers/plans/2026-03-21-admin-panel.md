# Admin Panel & Resource Guards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a server-side rendered admin panel with session/file management and resource guards to stay within Fly.io free plan limits.

**Architecture:** New `admin.ts` file handles all admin routes with SSR HTML templates. Resource guards are middleware added to existing routes. Auth uses an env-var password with an in-memory session token stored in a cookie.

**Tech Stack:** Express, better-sqlite3, Node `crypto` and `fs` (no new dependencies)

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `server/src/admin.ts` | Create | Admin routes, auth middleware, HTML templates, orphan detection |
| `server/src/guards.ts` | Create | `storageGuard` and `sessionLimitGuard` middleware + `getDirSize` helper |
| `server/src/state.ts` | Modify | Add `sessionCount` getter, `listSessions()`, `clearMap()` |
| `server/src/routes.ts` | Modify | Wire in resource guard middleware |
| `server/src/index.ts` | Modify | Mount admin routes before catch-all, fix auto-cleanup to delete map files |
| `client/src/App.tsx` | Modify | Error handling for 507 responses |
| `server/__tests__/guards.test.ts` | Create | Unit tests for resource guards |
| `server/__tests__/admin.test.ts` | Create | Integration tests for admin auth and CRUD |

---

### Task 1: Resource Guard Utilities

**Files:**
- Create: `server/src/guards.ts`
- Create: `server/__tests__/guards.test.ts`

- [ ] **Step 1: Write failing test for getDirSize**

```typescript
// server/__tests__/guards.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { getDirSize } from "../src/guards.js";

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run __tests__/guards.test.ts`
Expected: FAIL — `getDirSize` not found

- [ ] **Step 3: Implement getDirSize**

```typescript
// server/src/guards.ts
import fs from "fs";
import path from "path";
import type { Request, Response, NextFunction } from "express";

export function getDirSize(dir: string): number {
  try {
    const files = fs.readdirSync(dir);
    return files.reduce((total, file) => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      return total + (stat.isFile() ? stat.size : 0);
    }, 0);
  } catch {
    return 0;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run __tests__/guards.test.ts`
Expected: PASS

- [ ] **Step 5: Write failing test for storageGuard**

Add to `server/__tests__/guards.test.ts`:

```typescript
import express from "express";
import request from "supertest";
import { getDirSize, storageGuard } from "../src/guards.js";

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
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd server && npx vitest run __tests__/guards.test.ts`
Expected: FAIL — `storageGuard` not found

- [ ] **Step 7: Implement storageGuard**

Add to `server/src/guards.ts`:

```typescript
export function storageGuard(uploadDir: string, maxStorageMb: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const currentSize = getDirSize(uploadDir);
    const contentLength = parseInt(req.headers["content-length"] || "0", 10);
    const maxBytes = maxStorageMb * 1024 * 1024;
    if (currentSize + contentLength > maxBytes) {
      return res.status(507).json({ error: "Storage limit reached" });
    }
    next();
  };
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd server && npx vitest run __tests__/guards.test.ts`
Expected: PASS

- [ ] **Step 9: Write failing test for sessionLimitGuard**

Add to `server/__tests__/guards.test.ts`:

```typescript
import { sessionLimitGuard } from "../src/guards.js";

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
```

- [ ] **Step 10: Run test to verify it fails**

Run: `cd server && npx vitest run __tests__/guards.test.ts`
Expected: FAIL — `sessionLimitGuard` not found

- [ ] **Step 11: Implement sessionLimitGuard**

Add to `server/src/guards.ts`:

```typescript
export function sessionLimitGuard(getSessionCount: () => number, maxSessions: number) {
  return (_req: Request, res: Response, next: NextFunction) => {
    if (getSessionCount() >= maxSessions) {
      return res.status(507).json({ error: "Session limit reached" });
    }
    next();
  };
}
```

- [ ] **Step 12: Run all tests to verify everything passes**

Run: `cd server && npx vitest run`
Expected: All PASS

- [ ] **Step 13: Commit**

```bash
git add server/src/guards.ts server/__tests__/guards.test.ts
git commit -m "feat: add resource guard utilities (storage + session limit)"
```

---

### Task 2: StateManager Extensions

**Files:**
- Modify: `server/src/state.ts:1-137`
- Modify: `server/__tests__/state.test.ts`

- [ ] **Step 1: Write failing tests for new StateManager methods**

Add to end of `server/__tests__/state.test.ts` (inside the existing `describe` block):

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run __tests__/state.test.ts`
Expected: FAIL — `sessionCount`, `listSessions`, `clearMap` not found

- [ ] **Step 3: Implement new methods on StateManager**

Add to `server/src/state.ts` inside the `StateManager` class:

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx vitest run __tests__/state.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/state.ts server/__tests__/state.test.ts
git commit -m "feat: add sessionCount, listSessions, clearMap to StateManager"
```

---

### Task 3: Wire Resource Guards into Existing Routes

**Files:**
- Modify: `server/src/routes.ts:1-58`
- Modify: `server/__tests__/routes.test.ts`

- [ ] **Step 1: Write failing tests for resource guards in routes**

Add to `server/__tests__/routes.test.ts` inside the existing `describe` block:

```typescript
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
```

Update the `beforeEach` in `routes.test.ts` to pass guard config:

```typescript
  beforeEach(() => {
    db = new Database(":memory:");
    state = new StateManager(db);
    uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), "battlefield-test-"));
    app = express();
    app.use(express.json());
    app.use(createRoutes(state, uploadDir, undefined, { maxStorageMb: 1, maxSessions: 2 }));
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run __tests__/routes.test.ts`
Expected: FAIL — `createRoutes` doesn't accept config parameter yet

- [ ] **Step 3: Update createRoutes to accept guard config and wire in middleware**

Modify `server/src/routes.ts`:
- Add a `GuardConfig` interface: `{ maxStorageMb: number; maxSessions: number }`
- Add optional 4th parameter `guardConfig?: GuardConfig` to `createRoutes`
- Import `storageGuard` and `sessionLimitGuard` from `./guards.js`
- Add `sessionLimitGuard(() => state.sessionCount, guardConfig.maxSessions)` before `POST /api/sessions` handler
- Add `storageGuard(uploadDir, guardConfig.maxStorageMb)` before `POST /api/sessions/:id/map` handler
- Only apply guards when `guardConfig` is provided

The session creation route becomes:

```typescript
  if (guardConfig) {
    router.post("/api/sessions",
      sessionLimitGuard(() => state.sessionCount, guardConfig.maxSessions),
      (_req, res) => {
        const session = state.createSession();
        res.status(201).json(session);
      }
    );
  } else {
    router.post("/api/sessions", (_req, res) => {
      const session = state.createSession();
      res.status(201).json(session);
    });
  }
```

The map upload route becomes:

```typescript
  const mapHandlers: any[] = [];
  if (guardConfig) {
    mapHandlers.push(storageGuard(uploadDir, guardConfig.maxStorageMb));
  }
  mapHandlers.push(upload.single("map"), (req: any, res: any) => {
    // existing handler body
  });
  router.post("/api/sessions/:id/map", ...mapHandlers);
```

Also update the `StateManager` type import to use `typeof` or import the class directly (it's already imported).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx vitest run __tests__/routes.test.ts`
Expected: All PASS

- [ ] **Step 5: Run full test suite**

Run: `cd server && npx vitest run`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add server/src/routes.ts server/__tests__/routes.test.ts
git commit -m "feat: wire resource guards into session creation and map upload routes"
```

---

### Task 4: Admin Authentication

**Files:**
- Create: `server/src/admin.ts`
- Create: `server/__tests__/admin.test.ts`

- [ ] **Step 1: Write failing tests for admin auth**

```typescript
// server/__tests__/admin.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run __tests__/admin.test.ts`
Expected: FAIL — `createAdminRoutes` not found

- [ ] **Step 3: Implement admin auth**

Create `server/src/admin.ts` with:

```typescript
import { Router, type Request, type Response, type NextFunction } from "express";
import crypto from "crypto";
import type { StateManager } from "./state.js";

interface AdminConfig {
  state: StateManager;
  uploadDir: string;
  password: string;
  maxStorageMb: number;
  maxSessions: number;
}

// In-memory session tokens
const adminTokens = new Set<string>();

function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie || "";
  return Object.fromEntries(
    header.split(";").map((c) => {
      const [key, ...rest] = c.trim().split("=");
      return [key, rest.join("=")];
    })
  );
}

function setAdminCookie(res: Response, token: string) {
  const isProduction = process.env.NODE_ENV === "production";
  const parts = [
    `admin_token=${token}`,
    "HttpOnly",
    "SameSite=Strict",
    "Path=/admin",
  ];
  if (isProduction) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function clearAdminCookie(res: Response) {
  res.setHeader(
    "Set-Cookie",
    "admin_token=; HttpOnly; SameSite=Strict; Path=/admin; Max-Age=0"
  );
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const cookies = parseCookies(req);
  const token = cookies.admin_token;
  if (!token || !adminTokens.has(token)) {
    return res.redirect("/admin");
  }
  next();
}

export function createAdminRoutes(config: AdminConfig): Router {
  const router = Router();
  const { state, uploadDir, password, maxStorageMb, maxSessions } = config;

  // Login page
  router.get("/admin", (req, res) => {
    const cookies = parseCookies(req);
    if (cookies.admin_token && adminTokens.has(cookies.admin_token)) {
      return res.redirect("/admin/dashboard");
    }
    res.send(renderLogin());
  });

  // Login handler
  router.post("/admin/login", (req, res) => {
    const submitted = req.body.password || "";
    const expected = password;

    // Timing-safe comparison
    const submittedBuf = Buffer.from(submitted);
    const expectedBuf = Buffer.from(expected);
    const match =
      submittedBuf.length === expectedBuf.length &&
      crypto.timingSafeEqual(submittedBuf, expectedBuf);

    if (!match) {
      return res.send(renderLogin("Invalid password"));
    }

    const token = crypto.randomBytes(32).toString("hex");
    adminTokens.add(token);
    setAdminCookie(res, token);
    res.redirect("/admin/dashboard");
  });

  // Logout
  router.post("/admin/logout", (_req, res) => {
    const cookies = parseCookies(_req);
    if (cookies.admin_token) {
      adminTokens.delete(cookies.admin_token);
    }
    clearAdminCookie(res);
    res.redirect("/admin");
  });

  // Protected routes — all below require auth
  router.get("/admin/dashboard", requireAuth, (req, res) => {
    res.send(renderLayout("Dashboard", "<p>Dashboard placeholder</p>"));
  });

  router.get("/admin/sessions", requireAuth, (req, res) => {
    res.send(renderLayout("Sessions", "<p>Sessions placeholder</p>"));
  });

  router.get("/admin/files", requireAuth, (req, res) => {
    res.send(renderLayout("Files", "<p>Files placeholder</p>"));
  });

  return router;
}
```

Add minimal `renderLogin` and `renderLayout` functions (just enough for auth tests to pass):

```typescript
function renderLogin(error?: string): string {
  return `<!DOCTYPE html><html><body>
    ${error ? `<p>${error}</p>` : ""}
    <form method="POST" action="/admin/login">
      <input name="password" type="password">
      <button type="submit">Login</button>
    </form>
  </body></html>`;
}

function renderLayout(title: string, content: string): string {
  return `<!DOCTYPE html><html><body>
    <h1>${title}</h1>
    <nav><a href="/admin/dashboard">Dashboard</a> <a href="/admin/sessions">Sessions</a> <a href="/admin/files">Files</a></nav>
    ${content}
  </body></html>`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx vitest run __tests__/admin.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/admin.ts server/__tests__/admin.test.ts
git commit -m "feat: admin authentication with cookie-based sessions"
```

---

### Task 5: Admin Dashboard Page

**Files:**
- Modify: `server/src/admin.ts`
- Modify: `server/__tests__/admin.test.ts`

- [ ] **Step 1: Write failing test for dashboard content**

Add to `server/__tests__/admin.test.ts`:

```typescript
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
    // Create a session with a map
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run __tests__/admin.test.ts`
Expected: FAIL — dashboard shows placeholder, not real data

- [ ] **Step 3: Implement dashboard with real data**

In `server/src/admin.ts`, import `getDirSize` from `./guards.js` and `fs` + `path`. Update the dashboard route handler:

```typescript
  router.get("/admin/dashboard", requireAuth, (_req, res) => {
    const diskUsage = getDirSize(uploadDir);
    const sessionCount = state.sessionCount;
    const files = getUploadedFiles(uploadDir);
    const sessions = state.listSessions();
    const orphanedCount = countOrphans(files, sessions);

    res.send(renderLayout("Dashboard", renderDashboard({
      diskUsage,
      maxStorageMb,
      sessionCount,
      maxSessions,
      fileCount: files.length,
      orphanedCount,
    })));
  });
```

Add helper functions:

```typescript
interface FileInfo {
  name: string;
  size: number;
}

function getUploadedFiles(uploadDir: string): FileInfo[] {
  try {
    return fs.readdirSync(uploadDir).map((name) => {
      const stat = fs.statSync(path.join(uploadDir, name));
      return { name, size: stat.size };
    });
  } catch {
    return [];
  }
}

function countOrphans(files: FileInfo[], sessions: Session[]): number {
  const referencedFiles = new Set(
    sessions.filter((s) => s.map).map((s) => s.map!.imageUrl.replace("/uploads/", ""))
  );
  return files.filter((f) => !referencedFiles.has(f.name)).length;
}
```

Add `renderDashboard` function that generates the HTML with stat cards, progress bars, and quick action forms. Use dark fantasy CSS matching the existing app theme (background `#1a1a2e`, gold `#caa968`, etc.).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx vitest run __tests__/admin.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/admin.ts server/__tests__/admin.test.ts
git commit -m "feat: admin dashboard with disk usage, session count, and file stats"
```

---

### Task 6: Admin Session Management

**Files:**
- Modify: `server/src/admin.ts`
- Modify: `server/__tests__/admin.test.ts`

- [ ] **Step 1: Write failing tests for session management**

Add to `server/__tests__/admin.test.ts`:

```typescript
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
    // Create a session with old createdAt
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run __tests__/admin.test.ts`
Expected: FAIL — delete/cleanup routes not implemented

- [ ] **Step 3: Implement session management routes and HTML**

In `server/src/admin.ts`, add:

**Session delete route:**
```typescript
  router.post("/admin/sessions/:id/delete", requireAuth, (req, res) => {
    const session = state.getSession(req.params.id);
    if (session?.map) {
      const filename = session.map.imageUrl.replace("/uploads/", "");
      const filePath = path.join(uploadDir, filename);
      try { fs.unlinkSync(filePath); } catch {}
    }
    state.deleteSession(req.params.id);
    res.redirect("/admin/sessions");
  });
```

**Bulk cleanup route:**
```typescript
  router.post("/admin/sessions/cleanup", requireAuth, (req, res) => {
    const days = parseInt(req.body.days, 10) || 7;
    // Delete map files for sessions being cleaned up
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    for (const session of state.listSessions()) {
      if (session.createdAt < cutoff && session.map) {
        const filename = session.map.imageUrl.replace("/uploads/", "");
        try { fs.unlinkSync(path.join(uploadDir, filename)); } catch {}
      }
    }
    state.cleanupOldSessions(days);
    res.redirect("/admin/sessions");
  });
```

**Sessions list page:** Update the `GET /admin/sessions` handler to render the session table with relative times, map/token/grid info, delete buttons (as `<form>` with `confirm()` in `onsubmit`), and the bulk cleanup bar.

Add `renderSessions` function that generates the HTML table.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx vitest run __tests__/admin.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/admin.ts server/__tests__/admin.test.ts
git commit -m "feat: admin session management with delete and bulk cleanup"
```

---

### Task 7: Admin File Management

**Files:**
- Modify: `server/src/admin.ts`
- Modify: `server/__tests__/admin.test.ts`

- [ ] **Step 1: Write failing tests for file management**

Add to `server/__tests__/admin.test.ts`:

```typescript
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
    // Orphaned file
    fs.writeFileSync(path.join(uploadDir, "orphan.png"), "fake");
    // Active file
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run __tests__/admin.test.ts`
Expected: FAIL — file routes not implemented

- [ ] **Step 3: Implement file management routes and HTML**

In `server/src/admin.ts`, add:

**Single file delete:**
```typescript
  router.post("/admin/files/:filename/delete", requireAuth, (req, res) => {
    const filename = req.params.filename;

    // Handle "orphaned" as a special case — delete all orphans
    if (filename === "orphaned") {
      const files = getUploadedFiles(uploadDir);
      const sessions = state.listSessions();
      const referencedFiles = new Set(
        sessions.filter((s) => s.map).map((s) => s.map!.imageUrl.replace("/uploads/", ""))
      );
      for (const file of files) {
        if (!referencedFiles.has(file.name)) {
          try { fs.unlinkSync(path.join(uploadDir, file.name)); } catch {}
        }
      }
      return res.redirect("/admin/files");
    }

    // Clear map reference from any session using this file
    for (const session of state.listSessions()) {
      if (session.map && session.map.imageUrl === `/uploads/${filename}`) {
        state.clearMap(session.id);
      }
    }

    try { fs.unlinkSync(path.join(uploadDir, filename)); } catch {}
    res.redirect("/admin/files");
  });
```

**Files list page:** Update the `GET /admin/files` handler to render the file card grid. Each card shows the filename, file size, session association (or "Orphaned"), thumbnail via `<img src="/uploads/...">`, and a delete form.

Add `renderFiles` function. Use `getUploadedFiles` and `countOrphans` helpers from Task 5.

**Security note:** Validate `filename` param against path traversal — ensure it doesn't contain `/` or `..`. Use `path.basename(filename)`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx vitest run __tests__/admin.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/admin.ts server/__tests__/admin.test.ts
git commit -m "feat: admin file management with delete and orphan cleanup"
```

---

### Task 8: Polish Admin HTML Templates

**Files:**
- Modify: `server/src/admin.ts`

No new tests needed — this is visual polish to the already-working HTML templates.

- [ ] **Step 1: Update renderLayout with full dark fantasy theme**

Replace the minimal `renderLayout` with the full page shell including:
- Dark background (`#1a1a2e`), gold accents (`#caa968`)
- Nav bar with links to Dashboard, Sessions, Files, Logout
- Responsive layout
- Inline `<style>` block with all needed CSS classes

- [ ] **Step 2: Update renderLogin with themed login page**

Match the game's home page style — centered card with gold gradient button.

- [ ] **Step 3: Update renderDashboard with stat cards and progress bars**

Three stat cards in a grid showing disk usage, session count, and file count with progress bars and quick action buttons. Match the mockup from brainstorming.

- [ ] **Step 4: Update renderSessions with themed session table**

Styled table with hover states, red-tinted rows for old sessions, and themed delete buttons. Include bulk cleanup bar.

- [ ] **Step 5: Update renderFiles with themed file card grid**

Card grid with thumbnails, red highlight for orphaned files, and delete buttons. Include "Delete all orphaned" button.

- [ ] **Step 6: Verify all tests still pass**

Run: `cd server && npx vitest run`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add server/src/admin.ts
git commit -m "feat: dark fantasy theme for admin panel HTML templates"
```

---

### Task 9: Mount Admin in Server + Fix Auto-Cleanup

**Files:**
- Modify: `server/src/index.ts:1-62`

- [ ] **Step 1: Update index.ts to mount admin routes**

Add to `server/src/index.ts` — after `app.use(createRoutes(...))` but **before** the static file serving block (`app.use(express.static(clientDist))`):

```typescript
import { createAdminRoutes } from "./admin.js";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const MAX_STORAGE_MB = Number(process.env.MAX_STORAGE_MB) || 1000;
const MAX_SESSIONS = Number(process.env.MAX_SESSIONS) || 50;

if (ADMIN_PASSWORD) {
  app.use(express.urlencoded({ extended: false }));
  app.use(createAdminRoutes({
    state,
    uploadDir: UPLOAD_DIR,
    password: ADMIN_PASSWORD,
    maxStorageMb: MAX_STORAGE_MB,
    maxSessions: MAX_SESSIONS,
  }));
} else {
  console.warn("ADMIN_PASSWORD not set — admin panel disabled");
}
```

Also pass guard config to `createRoutes`:

```typescript
app.use(createRoutes(state, UPLOAD_DIR, io, {
  maxStorageMb: MAX_STORAGE_MB,
  maxSessions: MAX_SESSIONS,
}));
```

- [ ] **Step 2: Fix auto-cleanup to delete map files**

Update the session cleanup interval in `index.ts`. Before calling `state.cleanupOldSessions`, iterate sessions that will be deleted and remove their map files:

```typescript
setInterval(() => {
  // Delete map files for sessions about to be cleaned up
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  for (const session of state.listSessions()) {
    if (session.createdAt < cutoff && session.map) {
      const filename = session.map.imageUrl.replace("/uploads/", "");
      try { fs.unlinkSync(path.join(UPLOAD_DIR, filename)); } catch {}
    }
  }
  const deleted = state.cleanupOldSessions(7);
  if (deleted.length > 0) {
    console.log(`Cleaned up ${deleted.length} old sessions`);
  }
}, 24 * 60 * 60 * 1000);
```

- [ ] **Step 3: Run full test suite**

Run: `cd server && npx vitest run`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add server/src/index.ts
git commit -m "feat: mount admin panel, wire resource guards, fix auto-cleanup orphans"
```

---

### Task 10: Client Error Handling for Resource Limits

**Files:**
- Modify: `client/src/App.tsx:22-52`

- [ ] **Step 1: Add error handling to handleCreate**

Update `handleCreate` in `client/src/App.tsx`:

```typescript
  const handleCreate = async () => {
    const res = await fetch("/api/sessions", { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Failed to create session" }));
      alert(data.error);
      return;
    }
    const data = await res.json();
    setSessionId(data.id);
    window.history.pushState(null, "", `/${data.id}`);
  };
```

- [ ] **Step 2: Add error handling to handleUploadMap**

Update `handleUploadMap` in `client/src/App.tsx`:

```typescript
  const handleUploadMap = useCallback(
    async (file: File) => {
      if (!sessionId) return;
      const formData = new FormData();
      formData.append("map", file);

      const img = new window.Image();
      const url = URL.createObjectURL(file);
      img.src = url;
      await new Promise((resolve) => { img.onload = resolve; });
      formData.append("width", String(img.width));
      formData.append("height", String(img.height));
      URL.revokeObjectURL(url);

      const res = await fetch(`/api/sessions/${sessionId}/map`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to upload map" }));
        alert(data.error);
      }
    },
    [sessionId]
  );
```

- [ ] **Step 3: Commit**

```bash
git add client/src/App.tsx
git commit -m "feat: show alert on storage/session limit errors"
```

---

### Task 11: Manual Smoke Test

No test files — this is a manual verification step.

- [ ] **Step 1: Start the server locally with admin enabled**

```bash
cd server && ADMIN_PASSWORD=admin123 MAX_SESSIONS=5 MAX_STORAGE_MB=10 npx tsx src/index.ts
```

- [ ] **Step 2: Verify admin login**

Open `http://localhost:3001/admin`, enter `admin123`, confirm redirect to dashboard.

- [ ] **Step 3: Verify dashboard shows stats**

Check disk usage, session count, and file count are displayed.

- [ ] **Step 4: Verify session management**

Create a few sessions via the API, check they appear in `/admin/sessions`, delete one, confirm it's gone.

- [ ] **Step 5: Verify resource guards**

Create sessions until limit (5), confirm next creation returns 507.

- [ ] **Step 6: Verify admin disabled without password**

Restart server without `ADMIN_PASSWORD`, confirm `/admin` serves the React SPA (catch-all), and "admin panel disabled" warning is logged.

- [ ] **Step 7: Run full test suite one final time**

Run: `cd server && npx vitest run`
Expected: All PASS

- [ ] **Step 8: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: smoke test fixes"
```
