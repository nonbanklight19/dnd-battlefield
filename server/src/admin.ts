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

// --- Dark fantasy theme helpers ---

function timeAgo(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// --- Themed HTML templates ---

function renderLayout(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — D&amp;D Battlefield Admin</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: system-ui, sans-serif;
    background: #1a1a2e;
    color: #e0d5c1;
    min-height: 100vh;
  }
  nav {
    background: #12121f;
    border-bottom: 1px solid #2a2a3e;
    padding: 0.75rem 1.5rem;
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }
  nav .brand {
    color: #caa968;
    font-weight: 700;
    font-size: 1.1rem;
    letter-spacing: 0.04em;
    text-decoration: none;
    margin-right: auto;
  }
  nav a {
    color: #8a8068;
    text-decoration: none;
    font-size: 0.9rem;
    transition: color 0.15s;
  }
  nav a:hover { color: #caa968; }
  nav form { display: inline; }
  nav .btn-logout {
    background: #8b2020;
    color: #e0d5c1;
    border: none;
    padding: 0.35rem 0.9rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
    font-family: inherit;
    transition: background 0.15s;
  }
  nav .btn-logout:hover { background: #a02828; }
  .page { max-width: 1100px; margin: 0 auto; padding: 2rem 1.5rem; }
  h1 { color: #caa968; font-size: 1.6rem; margin-bottom: 1.5rem; }
  h2 { color: #b8944e; font-size: 1.1rem; margin-bottom: 1rem; }
  .card {
    background: #12121f;
    border: 1px solid #2a2a3e;
    border-radius: 6px;
    padding: 1.25rem 1.5rem;
    margin-bottom: 1.5rem;
  }
  .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
  .stat-card {
    background: #12121f;
    border: 1px solid #2a2a3e;
    border-radius: 6px;
    padding: 1.25rem 1.5rem;
  }
  .stat-label { color: #8a8068; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.06em; }
  .stat-value { color: #caa968; font-size: 2.2rem; font-weight: 700; margin: 0.25rem 0; }
  .stat-sub { color: #8a8068; font-size: 0.85rem; }
  .progress-bar { height: 6px; background: #2a2a3e; border-radius: 3px; overflow: hidden; margin: 0.6rem 0; }
  .progress-fill { height: 100%; background: linear-gradient(90deg, #b8944e, #caa968); border-radius: 3px; }
  table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  th {
    background: #12121f;
    color: #8a8068;
    text-align: left;
    padding: 0.6rem 0.85rem;
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid #2a2a3e;
  }
  td { padding: 0.65rem 0.85rem; border-bottom: 1px solid #1e1e30; vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  tr.old-session { background: rgba(139, 32, 32, 0.12); }
  .mono { font-family: monospace; color: #caa968; }
  .tag-yes { color: #5a9e6f; }
  .tag-no { color: #8a8068; }
  .tag-orphaned { color: #c87830; font-style: italic; }
  .btn {
    display: inline-block;
    padding: 0.4rem 0.9rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
    font-family: inherit;
    transition: background 0.15s;
    text-decoration: none;
  }
  .btn-gold {
    background: linear-gradient(135deg, #b8944e, #caa968);
    color: #12121f;
    font-weight: 700;
    width: 100%;
    padding: 0.7rem;
    font-size: 1rem;
  }
  .btn-gold:hover { background: linear-gradient(135deg, #caa968, #dfc07a); }
  .btn-danger { background: #8b2020; color: #e0d5c1; }
  .btn-danger:hover { background: #a02828; }
  .btn-warn { background: #7a4a10; color: #e0d5c1; }
  .btn-warn:hover { background: #9a5a18; }
  .btn-sm { padding: 0.25rem 0.6rem; font-size: 0.78rem; }
  .actions-bar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
  }
  .actions-bar label { color: #8a8068; font-size: 0.88rem; }
  .actions-bar input[type=number] {
    width: 60px;
    background: #1a1a2e;
    border: 1px solid #2a2a3e;
    color: #e0d5c1;
    padding: 0.35rem 0.5rem;
    border-radius: 4px;
    font-family: inherit;
    font-size: 0.88rem;
  }
  .file-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 1rem; }
  .file-card {
    background: #12121f;
    border: 1px solid #2a2a3e;
    border-radius: 6px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .file-card.orphaned-card { border-color: #8b4040; background: #1a1218; }
  .file-thumb { width: 100%; aspect-ratio: 1; object-fit: cover; background: #0e0e1c; }
  .file-thumb-placeholder { width: 100%; aspect-ratio: 1; background: #0e0e1c; display: flex; align-items: center; justify-content: center; color: #2a2a3e; font-size: 2rem; }
  .file-info { padding: 0.6rem 0.75rem; flex: 1; display: flex; flex-direction: column; gap: 0.3rem; }
  .file-name { font-family: monospace; font-size: 0.75rem; color: #caa968; word-break: break-all; }
  .file-size { color: #8a8068; font-size: 0.75rem; }
  .file-session { font-size: 0.75rem; }
  .file-session a { color: #b8944e; }
  .file-actions { padding: 0 0.75rem 0.75rem; }
  .login-wrap {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #1a1a2e;
  }
  .login-card {
    background: #12121f;
    border: 1px solid #2a2a3e;
    border-radius: 8px;
    padding: 2.5rem 2rem;
    width: 100%;
    max-width: 360px;
  }
  .login-title { color: #caa968; font-size: 1.4rem; font-weight: 700; margin-bottom: 0.25rem; }
  .login-subtitle { color: #8a8068; font-size: 0.85rem; margin-bottom: 1.75rem; }
  .form-group { margin-bottom: 1rem; }
  .form-label { display: block; color: #8a8068; font-size: 0.8rem; margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em; }
  .form-input {
    width: 100%;
    background: #1a1a2e;
    border: 1px solid #2a2a3e;
    color: #e0d5c1;
    padding: 0.6rem 0.75rem;
    border-radius: 4px;
    font-family: inherit;
    font-size: 0.95rem;
    transition: border-color 0.15s;
  }
  .form-input:focus { outline: none; border-color: #caa968; }
  .error-msg { color: #c87830; font-size: 0.88rem; margin-bottom: 1rem; padding: 0.5rem 0.75rem; background: rgba(139,64,64,0.2); border-radius: 4px; border-left: 3px solid #8b4040; }
  .quick-actions { display: flex; gap: 0.75rem; flex-wrap: wrap; }
</style>
</head>
<body>
<nav>
  <a class="brand" href="/admin/dashboard">⚔ D&amp;D Admin</a>
  <a href="/admin/dashboard">Dashboard</a>
  <a href="/admin/sessions">Sessions</a>
  <a href="/admin/files">Files</a>
  <form method="POST" action="/admin/logout">
    <button class="btn-logout" type="submit">Logout</button>
  </form>
</nav>
<div class="page">
${content}
</div>
</body>
</html>`;
}

function renderLogin(error?: string): string {
  const errorHtml = error
    ? `<div class="error-msg">Invalid password</div>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Admin Login — D&amp;D Battlefield</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; background: #1a1a2e; color: #e0d5c1; }
  .login-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; }
  .login-card { background: #12121f; border: 1px solid #2a2a3e; border-radius: 8px; padding: 2.5rem 2rem; width: 100%; max-width: 360px; }
  .login-title { color: #caa968; font-size: 1.4rem; font-weight: 700; margin-bottom: 0.25rem; }
  .login-subtitle { color: #8a8068; font-size: 0.85rem; margin-bottom: 1.75rem; }
  .form-group { margin-bottom: 1rem; }
  .form-label { display: block; color: #8a8068; font-size: 0.8rem; margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em; }
  .form-input { width: 100%; background: #1a1a2e; border: 1px solid #2a2a3e; color: #e0d5c1; padding: 0.6rem 0.75rem; border-radius: 4px; font-family: inherit; font-size: 0.95rem; transition: border-color 0.15s; }
  .form-input:focus { outline: none; border-color: #caa968; }
  .btn-gold { display: block; width: 100%; padding: 0.7rem; background: linear-gradient(135deg, #b8944e, #caa968); color: #12121f; font-weight: 700; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem; font-family: inherit; transition: background 0.15s; }
  .btn-gold:hover { background: linear-gradient(135deg, #caa968, #dfc07a); }
  .error-msg { color: #c87830; font-size: 0.88rem; margin-bottom: 1rem; padding: 0.5rem 0.75rem; background: rgba(139,64,64,0.2); border-radius: 4px; border-left: 3px solid #8b4040; }
</style>
</head>
<body>
<div class="login-wrap">
  <div class="login-card">
    <div class="login-title">D&amp;D Battlefield</div>
    <div class="login-subtitle">Admin password required</div>
    ${errorHtml}
    <form method="POST" action="/admin/login">
      <div class="form-group">
        <label class="form-label" for="pw">password</label>
        <input class="form-input" id="pw" type="password" name="password" autofocus autocomplete="current-password" />
      </div>
      <button class="btn-gold" type="submit">Enter the Realm</button>
    </form>
  </div>
</div>
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
  const cutoff7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const rows = sessions
    .map((s) => {
      const isOld = s.createdAt < cutoff7d;
      const rowClass = isOld ? ' class="old-session"' : "";
      const gridMode = s.gridMode !== "none" ? `${s.gridMode} (${s.gridSize}px)` : "—";
      return `
    <tr${rowClass}>
      <td><span class="mono">${s.id}</span></td>
      <td title="${s.createdAt}">${timeAgo(s.createdAt)}</td>
      <td>${s.map ? '<span class="tag-yes">Yes</span>' : '<span class="tag-no">No</span>'}</td>
      <td>${s.tokens.length}</td>
      <td>${gridMode}</td>
      <td>
        <form method="POST" action="/admin/sessions/${s.id}/delete" style="display:inline"
              onsubmit="return confirm('Are you sure?')">
          <button class="btn btn-danger btn-sm" type="submit">Delete</button>
        </form>
      </td>
    </tr>`;
    })
    .join("");
  return `
    <h1>Sessions</h1>
    <div class="actions-bar card">
      <form method="POST" action="/admin/sessions/cleanup" style="display:flex;align-items:center;gap:0.6rem;flex-wrap:wrap">
        <label>Delete sessions older than
          <input type="number" name="days" value="7" min="1" />
          days
        </label>
        <button class="btn btn-warn" type="submit">Delete sessions older than 7 days</button>
      </form>
    </div>
    <div class="card">
      <h2>All Sessions (${sessions.length})</h2>
      <table>
        <thead>
          <tr>
            <th>Code</th><th>Created</th><th>Map</th><th>Tokens</th><th>Grid</th><th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${rows || "<tr><td colspan='6' style='color:#8a8068;text-align:center;padding:1.5rem'>No sessions</td></tr>"}
        </tbody>
      </table>
    </div>
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
  const diskPct = Math.min(100, Math.round((data.diskUsage / (1024 * 1024)) / data.maxStorageMb * 100));
  const sessionPct = Math.min(100, Math.round(data.sessionCount / data.maxSessions * 100));
  const filePct = data.fileCount > 0 ? Math.min(100, Math.round((data.fileCount - data.orphanedCount) / data.fileCount * 100)) : 0;
  return `
    <h1>Dashboard</h1>
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-label">Disk Usage</div>
        <div class="stat-value">${diskUsageMb}</div>
        <div class="stat-sub">MB of ${data.maxStorageMb} MB</div>
        <div class="progress-bar"><div class="progress-fill" style="width:${diskPct}%"></div></div>
        <div class="stat-sub">${diskPct}% used</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Sessions</div>
        <div class="stat-value">${data.sessionCount}</div>
        <div class="stat-sub">of ${data.maxSessions} max</div>
        <div class="progress-bar"><div class="progress-fill" style="width:${sessionPct}%"></div></div>
        <div class="stat-sub">${sessionPct}% capacity</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Files</div>
        <div class="stat-value">${data.fileCount}</div>
        <div class="stat-sub">${data.orphanedCount} orphaned</div>
        <div class="progress-bar"><div class="progress-fill" style="width:${filePct}%"></div></div>
        <div class="stat-sub">${data.fileCount - data.orphanedCount} referenced</div>
      </div>
    </div>
    <div class="card">
      <h2>Quick Actions</h2>
      <div class="quick-actions">
        <form method="POST" action="/admin/sessions/cleanup">
          <input type="hidden" name="days" value="7" />
          <button class="btn btn-warn" type="submit">Delete sessions older than 7 days</button>
        </form>
        <form method="POST" action="/admin/files/orphaned/delete"
              onsubmit="return confirm('Delete all orphaned files?')">
          <button class="btn btn-danger" type="submit">Delete orphaned files</button>
        </form>
      </div>
    </div>
  `;
}

// --- Files template ---

interface FileData extends FileInfo {
  sessionId: string | null;
  orphaned: boolean;
}

function renderFiles(files: FileData[]): string {
  const cards = files
    .map((f) => {
      const sizeKb = (f.size / 1024).toFixed(1);
      const cardClass = f.orphaned ? "file-card orphaned-card" : "file-card";
      const sessionHtml = f.orphaned
        ? `<span class="tag-orphaned">Orphaned</span>`
        : `<a href="/admin/sessions">${f.sessionId}</a>`;
      return `
    <div class="${cardClass}">
      <img class="file-thumb" src="/uploads/${encodeURIComponent(f.name)}" alt="${f.name}"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
      <div class="file-thumb-placeholder" style="display:none">&#128247;</div>
      <div class="file-info">
        <div class="file-name">${f.name}</div>
        <div class="file-size">${sizeKb} KB</div>
        <div class="file-session">${sessionHtml}</div>
      </div>
      <div class="file-actions">
        <form method="POST" action="/admin/files/${encodeURIComponent(f.name)}/delete"
              onsubmit="return confirm('Are you sure?')">
          <button class="btn btn-danger btn-sm" type="submit" style="width:100%">Delete</button>
        </form>
      </div>
    </div>`;
    })
    .join("");
  const orphanCount = files.filter((f) => f.orphaned).length;
  return `
    <h1>Files</h1>
    <div class="actions-bar card">
      <form method="POST" action="/admin/files/orphaned/delete"
            onsubmit="return confirm('Delete all ${orphanCount} orphaned files?')">
        <button class="btn btn-danger" type="submit">Delete All Orphaned Files (${orphanCount})</button>
      </form>
      <span style="color:#8a8068;font-size:0.88rem">${files.length} total files, ${orphanCount} orphaned</span>
    </div>
    ${files.length
      ? `<div class="file-grid">${cards}</div>`
      : `<div class="card" style="color:#8a8068;text-align:center;padding:2rem">No files uploaded</div>`
    }
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
