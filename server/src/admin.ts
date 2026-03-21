import crypto from "crypto";
import fs from "fs";
import path from "path";
import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import type { StateManager } from "./state.js";
import { getDirSize } from "./guards.js";
import type { Session } from "./types.js";

export interface AdminConfig {
  state: StateManager;
  uploadDir: string;
  password: string;
  maxStorageMb: number;
  maxSessions: number;
}

// In-memory session tokens — module-level so they persist across requests
export const adminTokens = new Set<string>();

// --- Cookie helpers ---

function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie ?? "";
  const result: Record<string, string> = {};
  for (const part of header.split(";")) {
    const eqIdx = part.indexOf("=");
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx).trim();
    const val = part.slice(eqIdx + 1).trim();
    result[key] = decodeURIComponent(val);
  }
  return result;
}

function setAdminCookie(res: Response, token: string): void {
  const isProduction = process.env.NODE_ENV === "production";
  const parts = [
    `admin_token=${encodeURIComponent(token)}`,
    "HttpOnly",
    "SameSite=Strict",
    "Path=/admin",
  ];
  if (isProduction) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function clearAdminCookie(res: Response): void {
  res.setHeader(
    "Set-Cookie",
    "admin_token=; HttpOnly; SameSite=Strict; Path=/admin; Max-Age=0"
  );
}

// --- Auth middleware ---

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const cookies = parseCookies(req);
  const token = cookies["admin_token"];
  if (token && adminTokens.has(token)) {
    next();
  } else {
    res.redirect("/admin");
  }
}

// --- Minimal HTML templates ---

function renderLogin(error?: string): string {
  const errorHtml = error
    ? `<p style="color:red">${error}</p>`
    : "";
  return renderLayout(
    "Admin Login",
    `<h1>Admin Login</h1>
    ${errorHtml}
    <form method="POST" action="/admin/login">
      <label>
        password: <input type="password" name="password" autofocus />
      </label>
      <button type="submit">Login</button>
    </form>`
  );
}

function renderLayout(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>${title}</title></head>
<body>
${content}
</body>
</html>`;
}

// --- Upload file helpers ---

interface FileInfo {
  name: string;
  size: number;
}

export function getUploadedFiles(uploadDir: string): FileInfo[] {
  try {
    return fs.readdirSync(uploadDir).map((name) => {
      const stat = fs.statSync(path.join(uploadDir, name));
      return { name, size: stat.size };
    });
  } catch {
    return [];
  }
}

export function countOrphans(files: FileInfo[], sessions: Session[]): number {
  const referencedFiles = new Set(
    sessions.filter((s) => s.map).map((s) => s.map!.imageUrl.replace("/uploads/", ""))
  );
  return files.filter((f) => !referencedFiles.has(f.name)).length;
}

// --- Sessions template ---

function renderSessions(sessions: Session[]): string {
  const rows = sessions
    .map(
      (s) => `
    <tr>
      <td>${s.id}</td>
      <td>${s.createdAt}</td>
      <td>${s.map ? s.map.imageUrl : "none"}</td>
      <td>${s.tokens.length}</td>
      <td>
        <form method="POST" action="/admin/sessions/${s.id}/delete" style="display:inline">
          <button type="submit">Delete</button>
        </form>
      </td>
    </tr>`
    )
    .join("");
  return `
    <h1>Sessions</h1>
    <nav>
      <a href="/admin/dashboard">Dashboard</a> |
      <a href="/admin/files">Files</a> |
      <form method="POST" action="/admin/logout" style="display:inline">
        <button type="submit">Logout</button>
      </form>
    </nav>
    <section>
      <h2>Cleanup Old Sessions</h2>
      <form method="POST" action="/admin/sessions/cleanup">
        <label>Delete sessions older than <input type="number" name="days" value="7" min="1" /> days</label>
        <button type="submit">Cleanup</button>
      </form>
    </section>
    <section>
      <h2>All Sessions (${sessions.length})</h2>
      <table border="1" cellpadding="4">
        <thead>
          <tr><th>ID</th><th>Created</th><th>Map</th><th>Tokens</th><th>Actions</th></tr>
        </thead>
        <tbody>
          ${rows || "<tr><td colspan='5'>No sessions</td></tr>"}
        </tbody>
      </table>
    </section>
  `;
}

// --- Dashboard template ---

interface DashboardData {
  diskUsage: number;
  maxStorageMb: number;
  sessionCount: number;
  maxSessions: number;
  fileCount: number;
  orphanedCount: number;
}

function renderDashboard(data: DashboardData): string {
  const diskUsageMb = (data.diskUsage / (1024 * 1024)).toFixed(2);
  return `
    <h1>Admin Dashboard</h1>
    <nav>
      <a href="/admin/sessions">Sessions</a> |
      <a href="/admin/files">Files</a> |
      <form method="POST" action="/admin/logout" style="display:inline">
        <button type="submit">Logout</button>
      </form>
    </nav>
    <section>
      <h2>Disk Usage</h2>
      <p>${diskUsageMb} MB / ${data.maxStorageMb} MB</p>
    </section>
    <section>
      <h2>Sessions</h2>
      <p>${data.sessionCount} / ${data.maxSessions}</p>
    </section>
    <section>
      <h2>Files</h2>
      <p>${data.fileCount} files (${data.orphanedCount} orphaned)</p>
    </section>
  `;
}

// --- Files template ---

interface FileData extends FileInfo {
  sessionId: string | null;
  orphaned: boolean;
}

function renderFiles(files: FileData[]): string {
  const rows = files
    .map(
      (f) => `
    <tr>
      <td>${f.name}</td>
      <td>${(f.size / 1024).toFixed(1)} KB</td>
      <td>${f.sessionId ? `<a href="/admin/sessions">${f.sessionId}</a>` : "<em>Orphaned</em>"}</td>
      <td>
        <form method="POST" action="/admin/files/${encodeURIComponent(f.name)}/delete" style="display:inline">
          <button type="submit">Delete</button>
        </form>
      </td>
    </tr>`
    )
    .join("");
  return `
    <h1>Files</h1>
    <nav>
      <a href="/admin/dashboard">Dashboard</a> |
      <a href="/admin/sessions">Sessions</a> |
      <form method="POST" action="/admin/logout" style="display:inline">
        <button type="submit">Logout</button>
      </form>
    </nav>
    <section>
      <form method="POST" action="/admin/files/orphaned/delete">
        <button type="submit">Delete All Orphaned Files</button>
      </form>
    </section>
    <section>
      <h2>Uploaded Files (${files.length})</h2>
      <table border="1" cellpadding="4">
        <thead>
          <tr><th>Name</th><th>Size</th><th>Session</th><th>Actions</th></tr>
        </thead>
        <tbody>
          ${rows || "<tr><td colspan='4'>No files</td></tr>"}
        </tbody>
      </table>
    </section>
  `;
}

// --- Router factory ---

export function createAdminRoutes(config: AdminConfig): Router {
  const router = Router();
  const passwordBuf = Buffer.from(config.password, "utf8");

  // GET /admin — show login page (or redirect if already authed)
  router.get("/admin", (req, res) => {
    const cookies = parseCookies(req);
    const token = cookies["admin_token"];
    if (token && adminTokens.has(token)) {
      res.redirect("/admin/dashboard");
      return;
    }
    res.status(200).send(renderLogin());
  });

  // POST /admin/login — validate password, set cookie
  router.post("/admin/login", (req, res) => {
    const submitted = String(req.body?.password ?? "");
    const submittedBuf = Buffer.from(submitted, "utf8");

    // timingSafeEqual requires equal-length buffers
    let match = false;
    if (submittedBuf.length === passwordBuf.length) {
      match = crypto.timingSafeEqual(submittedBuf, passwordBuf);
    }

    if (!match) {
      res.status(200).send(renderLogin("Invalid password"));
      return;
    }

    const token = crypto.randomBytes(32).toString("hex");
    adminTokens.add(token);
    setAdminCookie(res, token);
    res.redirect("/admin/dashboard");
  });

  // POST /admin/logout — invalidate token, clear cookie
  router.post("/admin/logout", (req, res) => {
    const cookies = parseCookies(req);
    const token = cookies["admin_token"];
    if (token) adminTokens.delete(token);
    clearAdminCookie(res);
    res.redirect("/admin");
  });

  // GET /admin/dashboard — real data, requires auth
  router.get("/admin/dashboard", requireAuth, (_req, res) => {
    const diskUsage = getDirSize(config.uploadDir);
    const sessionCount = config.state.sessionCount;
    const files = getUploadedFiles(config.uploadDir);
    const sessions = config.state.listSessions();
    const orphanedCount = countOrphans(files, sessions);

    res.status(200).send(renderLayout("Admin Dashboard", renderDashboard({
      diskUsage,
      maxStorageMb: config.maxStorageMb,
      sessionCount,
      maxSessions: config.maxSessions,
      fileCount: files.length,
      orphanedCount,
    })));
  });

  // GET /admin/sessions — session list, requires auth
  router.get("/admin/sessions", requireAuth, (_req, res) => {
    const sessions = config.state.listSessions();
    res.status(200).send(renderLayout("Admin Sessions", renderSessions(sessions)));
  });

  // POST /admin/sessions/cleanup — bulk delete old sessions (MUST be before /:id/delete)
  router.post("/admin/sessions/cleanup", requireAuth, (req, res) => {
    const days = parseInt(req.body.days, 10) || 7;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    for (const session of config.state.listSessions()) {
      if (session.createdAt < cutoff && session.map) {
        const filename = session.map.imageUrl.replace("/uploads/", "");
        try { fs.unlinkSync(path.join(config.uploadDir, filename)); } catch {}
      }
    }
    config.state.cleanupOldSessions(days);
    res.redirect("/admin/sessions");
  });

  // POST /admin/sessions/:id/delete — remove a single session
  router.post("/admin/sessions/:id/delete", requireAuth, (req, res) => {
    const session = config.state.getSession(req.params.id);
    if (session?.map) {
      const filename = session.map.imageUrl.replace("/uploads/", "");
      try { fs.unlinkSync(path.join(config.uploadDir, filename)); } catch {}
    }
    config.state.deleteSession(req.params.id);
    res.redirect("/admin/sessions");
  });

  router.get("/admin/files", requireAuth, (_req, res) => {
    const files = getUploadedFiles(config.uploadDir);
    const sessions = config.state.listSessions();
    const referencedFiles = new Set(
      sessions.filter((s) => s.map).map((s) => s.map!.imageUrl.replace("/uploads/", ""))
    );
    const fileData = files.map((f) => ({
      ...f,
      sessionId: sessions.find((s) => s.map?.imageUrl === `/uploads/${f.name}`)?.id || null,
      orphaned: !referencedFiles.has(f.name),
    }));
    res.status(200).send(renderLayout("Admin Files", renderFiles(fileData)));
  });

  router.post("/admin/files/:filename/delete", requireAuth, (req, res) => {
    const filename = path.basename(req.params.filename);

    // "orphaned" = delete all orphans
    if (filename === "orphaned") {
      const files = getUploadedFiles(config.uploadDir);
      const sessions = config.state.listSessions();
      const referencedFiles = new Set(
        sessions.filter((s) => s.map).map((s) => s.map!.imageUrl.replace("/uploads/", ""))
      );
      for (const file of files) {
        if (!referencedFiles.has(file.name)) {
          try { fs.unlinkSync(path.join(config.uploadDir, file.name)); } catch {}
        }
      }
      return res.redirect("/admin/files");
    }

    // Clear map reference from any session using this file
    for (const session of config.state.listSessions()) {
      if (session.map && session.map.imageUrl === `/uploads/${filename}`) {
        config.state.clearMap(session.id);
      }
    }

    try { fs.unlinkSync(path.join(config.uploadDir, filename)); } catch {}
    res.redirect("/admin/files");
  });

  return router;
}
