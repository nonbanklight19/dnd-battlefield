import crypto from "crypto";
import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import type { StateManager } from "./state.js";

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

  // GET /admin/dashboard — placeholder, requires auth
  router.get("/admin/dashboard", requireAuth, (_req, res) => {
    res.status(200).send(
      renderLayout("Admin Dashboard", "<h1>Dashboard</h1><p>Admin dashboard placeholder.</p>")
    );
  });

  // GET /admin/sessions — placeholder, requires auth
  router.get("/admin/sessions", requireAuth, (_req, res) => {
    res.status(200).send(
      renderLayout("Admin Sessions", "<h1>Sessions</h1><p>Sessions placeholder.</p>")
    );
  });

  // GET /admin/files — placeholder, requires auth
  router.get("/admin/files", requireAuth, (_req, res) => {
    res.status(200).send(
      renderLayout("Admin Files", "<h1>Files</h1><p>Files placeholder.</p>")
    );
  });

  return router;
}
