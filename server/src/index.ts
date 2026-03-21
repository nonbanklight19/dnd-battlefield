import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import fs from "fs";
import { Database } from "./db.js";
import { StateManager } from "./state.js";
import { createRoutes } from "./routes.js";
import { setupSocketHandlers } from "./socket.js";
import { createAdminRoutes } from "./admin.js";

const PORT = Number(process.env.PORT) || 3001;
const DATA_DIR = process.env.DATA_DIR || "./data";
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const MAX_STORAGE_MB = Number(process.env.MAX_STORAGE_MB) || 1000;
const MAX_SESSIONS = Number(process.env.MAX_SESSIONS) || 50;

// Ensure directories exist
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Initialize
const db = new Database(path.join(DATA_DIR, "battlefield.db"));
const state = new StateManager(db);
state.startAutoSave(30000);

const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());
app.use(createRoutes(state, UPLOAD_DIR, io, {
  maxStorageMb: MAX_STORAGE_MB,
  maxSessions: MAX_SESSIONS,
}));
setupSocketHandlers(io, state);

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

// Serve client build in production
const __dirname = import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname);
const clientDist = path.join(__dirname, "../../client/dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

// Session cleanup: every 24h, delete sessions older than 7 days
setInterval(() => {
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

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("Shutting down — saving all sessions...");
  state.saveAllSessions();
  state.stopAutoSave();
  db.close();
  server.close();
});
