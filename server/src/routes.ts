import { Router, static as serveStatic } from "express";
import multer from "multer";
import path from "path";
import { nanoid } from "nanoid";
import type { StateManager } from "./state.js";
import type { Server } from "socket.io";
import { storageGuard, sessionLimitGuard } from "./guards.js";

export interface GuardConfig {
  maxStorageMb: number;
  maxSessions: number;
}

export function createRoutes(state: StateManager, uploadDir: string, io?: Server, guardConfig?: GuardConfig, iconsDir?: string): Router {
  const router = Router();

  const storage = multer.diskStorage({
    destination: uploadDir,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${nanoid(12)}${ext}`);
    },
  });
  const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

  router.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  router.post(
    "/api/sessions",
    ...(guardConfig ? [sessionLimitGuard(() => state.sessionCount, guardConfig.maxSessions)] : []),
    (_req, res) => {
      const session = state.createSession();
      res.status(201).json(session);
    }
  );

  router.get("/api/sessions/:id", (req, res) => {
    const session = state.getSession(req.params.id);
    if (!session) return res.status(404).json({ error: "Session not found" });
    res.json(session);
  });

  router.post(
    "/api/sessions/:id/map",
    ...(guardConfig ? [storageGuard(uploadDir, guardConfig.maxStorageMb)] : []),
    upload.single("map"),
    (req, res) => {
      const session = state.getSession(req.params.id);
      if (!session) return res.status(404).json({ error: "Session not found" });
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      const imageUrl = `/uploads/${req.file.filename}`;
      state.setMap(session.id, {
        imageUrl,
        width: Number(req.body.width) || 0,
        height: Number(req.body.height) || 0,
      });

      // Broadcast map update to all clients in the session
      if (io) {
        io.to(session.id).emit("map:updated", session.map);
      }

      res.json(session.map);
    }
  );

  router.post(
    "/api/sessions/:id/enemy-icon",
    ...(guardConfig ? [storageGuard(uploadDir, guardConfig.maxStorageMb)] : []),
    upload.single("icon"),
    (req, res) => {
      const session = state.getSession(req.params.id);
      if (!session) return res.status(404).json({ error: "Session not found" });
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const imageUrl = `/uploads/${req.file.filename}`;
      res.json({ imageUrl });
    }
  );

  router.use("/uploads", serveStatic(uploadDir));

  if (iconsDir) {
    router.use("/icons", serveStatic(iconsDir, { maxAge: "30d", immutable: true }));
  }

  return router;
}
