# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Real-time collaborative D&D battle map. No auth — players join via 4-character room code. WebSocket-based sync with in-memory state backed by SQLite.

## Commands

```bash
npm run dev          # Run client + server concurrently
npm run dev:server   # Server only (tsx watch, port 3001)
npm run dev:client   # Client only (Vite, port 5173)
npm run build        # Build client (tsc + vite)
npm start            # Production server
npm test             # Server tests (vitest)
npm run test:watch   # Server tests in watch mode (run from server/)
```

Docker: `docker build -t dnd-battlefield . && docker run -p 3001:3001 -v battlefield_data:/data dnd-battlefield`

## Architecture

Monorepo: `client/` (React + Vite + react-konva + Tailwind v4) and `server/` (Express + Socket.io + better-sqlite3).

**Server layers:**
- `server/src/index.ts` — Entry point, middleware setup, 24h cleanup job
- `server/src/socket.ts` — All WebSocket event handlers (session join, token CRUD, map updates, initiative tracking, hero configs, token statuses)
- `server/src/routes.ts` — REST API (session CRUD, file uploads via multer)
- `server/src/state.ts` — StateManager: in-memory Maps of sessions, initiative state, and hero configs with 30s auto-save to SQLite
- `server/src/db.ts` — SQLite persistence (WAL mode, auto-migration)
- `server/src/admin.ts` — Server-rendered admin panel (not SPA), token-based auth

**Client layers:**
- `client/src/App.tsx` — Routing, session state wiring, role selection (DM/Player)
- `client/src/hooks/useSession.ts` — Socket.io event binding, state sync
- `client/src/hooks/useInitiative.ts` — Initiative tracker socket events and state
- `client/src/hooks/useActiveTurn.ts` — Active turn notification state
- `client/src/hooks/useHeroConfig.ts` — Hero HP/AC configuration state
- `client/src/components/BattleMap.tsx` — Konva canvas with pan/zoom and grid overlay
- `client/src/components/SidePanel.tsx` — Token management UI, spawns tokens at view center
- `client/src/components/InitiativeTracker.tsx` — Initiative order UI (separate page, synced via room code)
- `client/src/components/HeroConfigModal.tsx` — Modal for setting hero HP/AC
- `client/src/components/RoleSelection.tsx` — DM/Player role chooser on session join
- `client/src/components/TurnNotification.tsx` — Active turn toast notification

**Data flow:** Client emits Socket.io events → server updates in-memory state → broadcasts to room → 30s auto-save to SQLite. Optimistic UI updates on the client side.

## Key Patterns

- **Token types:** `HeroToken | EnemyToken` union. Heroes are one-per-type-per-session (warrior, wizard, rogue, dwarf, triton). Enemies have custom name/color/icon and optional uploaded image. Both have a `statuses` array (currently supports `"dead"`).
- **Initiative tracker:** Separate page (`/initiative/:sessionId`) synced via Socket.io. Rows link to battlefield tokens via `tokenId`. Adding/removing tokens auto-updates initiative. Dead tokens are auto-removed from initiative.
- **Hero configs:** Per-session HP/AC defaults for each hero type, stored in `hero_configs` table. Applied when heroes are added to initiative.
- **Roles:** DM or Player, chosen on session join. DM-only controls (grid, map upload) hidden from players.
- **Grid modes:** `"none" | "square" | "hex"` — stored per session, affects snap-to-grid and overlay rendering.
- **Session IDs:** 4-char uppercase alphanumeric, collision-checked at creation.
- **Uploads:** multer disk storage with nanoid filenames, served as `/uploads/*` static files. Cleaned on session delete or admin orphan sweep.
- **Guards:** `storageGuard` (Content-Length vs MAX_STORAGE_MB) and `sessionLimitGuard` (MAX_SESSIONS) middleware on creation/upload routes.
- **Graceful shutdown:** SIGTERM saves all sessions, stops auto-save, closes DB.
- **Vite proxy:** Dev mode proxies `/api`, `/uploads`, `/admin`, `/socket.io` to localhost:3001.

## Environment Variables

See `.env.example`: PORT, DATA_DIR, ADMIN_PASSWORD, MAX_STORAGE_MB, MAX_SESSIONS.

## Deployment

Fly.io (Amsterdam). Persistent volume at `/data`. Auto-stop when idle. Production runs pre-compiled JS via `node server/dist/index.js`. CI deploys on push to main via `.github/workflows/deploy.yml`.
