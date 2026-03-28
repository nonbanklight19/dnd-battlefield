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
- `client/src/App.tsx` — Routing, session state wiring, role selection (DM/Player), AOE effect state
- `client/src/hooks/useSession.ts` — Socket.io event binding, state sync
- `client/src/hooks/useInitiative.ts` — Initiative tracker socket events and state
- `client/src/hooks/useActiveTurn.ts` — Active turn notification state
- `client/src/hooks/useHeroConfig.ts` — Hero HP/AC configuration state
- `client/src/components/BattleMap.tsx` — Konva canvas with pan/zoom, grid overlay, AOE placement/drag/snap
- `client/src/components/AoeShape.tsx` — Konva AOE shape rendering (circle, cone, line, square) with drag, rotation handle, origin footprint
- `client/src/components/AoePanel.tsx` — AOE editor modal (shape, size, damage type, origin size picker, placed effects list)
- `client/src/components/SidePanel.tsx` — Token management UI, initiative tracker link (DM only), spawns tokens at view center
- `client/src/components/TopBar.tsx` — Header bar with tools (ruler, AOE, save, panel toggle); sticky on mobile
- `client/src/components/InitiativeTracker.tsx` — Initiative order UI (separate page, synced via room code)
- `client/src/components/HeroConfigModal.tsx` — Modal for setting hero HP/AC
- `client/src/components/RoleSelection.tsx` — DM/Player role chooser on session join
- `client/src/components/TurnNotification.tsx` — Active turn toast notification

**Data flow:** Client emits Socket.io events → server updates in-memory state → broadcasts to room → 30s auto-save to SQLite. Optimistic UI updates on the client side.

## Key Patterns

- **Token types:** `HeroToken | EnemyToken` union. Heroes are one-per-type-per-session (warrior, wizard, rogue, dwarf, triton). Enemies have custom name/color/icon and optional uploaded image. Both have a `statuses` array (currently supports `"dead"`).
- **Initiative tracker:** Separate page (`/initiative/:sessionId`) synced via Socket.io. Rows link to battlefield tokens via `tokenId`. Adding/removing tokens auto-updates initiative. Dead tokens are auto-removed from initiative. Link moved to SidePanel (DM only).
- **Hero configs:** Per-session HP/AC defaults for each hero type, stored in `hero_configs` table. Applied when heroes are added to initiative.
- **Roles:** DM or Player, chosen on session join. DM-only controls (grid, map upload) hidden from players.
- **Grid modes:** `"none" | "square" | "hex"` — stored per session, affects snap-to-grid and overlay rendering.
- **Session IDs:** 4-char uppercase alphanumeric, collision-checked at creation.
- **Uploads:** multer disk storage with nanoid filenames, served as `/uploads/*` static files. Cleaned on session delete or admin orphan sweep.
- **Guards:** `storageGuard` (Content-Length vs MAX_STORAGE_MB) and `sessionLimitGuard` (MAX_SESSIONS) middleware on creation/upload routes.
- **Graceful shutdown:** SIGTERM saves all sessions, stops auto-save, closes DB.
- **Vite proxy:** Dev mode proxies `/api`, `/uploads`, `/admin`, `/socket.io` to localhost:3001.

## AOE Effects System

AOE effects are client-side only (not persisted to server/SQLite). State lives in `App.tsx`.

### AoeEffect type
```ts
interface AoeEffect {
  id: string;
  type: "circle" | "cone" | "line" | "square";
  feet: number;          // spell range in feet (converted to px via gridSize)
  x: number; y: number;  // origin point in world coords (snapped to grid)
  rotation: number;      // radians — meaningful for cone & line
  color: AoeColor;       // fire | cold | lightning | poison | necrotic | radiant | psychic
  originSize: 1 | 2 | 3; // grid-cell footprint of the caster (1×1, 2×2, 3×3)
}
```

### Geometry rules
- `halfEdge = (originSize × gridSize) / 2` — pixel distance from origin to footprint edge
- All shape measurements start at the footprint edge, not the origin center:
  - **Circle**: `radius = halfEdge + L`
  - **Square**: `half-side = halfEdge + L/2` (symmetric expansion)
  - **Cone**: apex at `(halfEdge·cos r, halfEdge·sin r)`, length L from there
  - **Line**: starts at `halfEdge` along `r`, ends at `halfEdge + L`
- `handleR = halfEdge + L` — arc radius for the rotation handle

### Snapping (`snapAoeOrigin` in BattleMap.tsx)
- `originSize 1 or 3` → snap to **cell centre** (`floor(x/gs)·gs + gs/2`)
- `originSize 2` → snap to **grid corner** (`round(x/gs)·gs`)
- Hex → reuses existing hex-centre snap

### Interaction
- **Place**: click map in placement mode → origin snapped → AoeEffect added → placement mode exits
- **Drag**: transparent hit-area shape on Group; `onDragEnd` snaps via `handleAoeDragEnd` in BattleMap
- **Rotate** (cone/line): white handle dot at far end; desktop uses Konva drag (`onDragMove`); mobile uses raw `onTouchMove` with screen→world coord conversion (bypasses Konva drag to avoid Group/handle drag conflict); Group drag is imperatively disabled during handle touch
- **Select**: click shape → glow shadow; click empty stage → deselect; Escape → deselect
- **Delete**: press `Delete` or `Backspace` while a shape is selected

### Mobile rotation fix
The rotation handle has an enlarged hit area via Konva `hitFunc` (`max(hr, 22/scale)`). On `touchStart`/`dragStart`, the parent Group's `draggable` is set to `false` imperatively (`node.draggable(false)`) and restored on `touchEnd`/`dragEnd`. Rotation angle is computed from raw touch `clientX/Y` converted to world coords.

## Mobile Layout

- `#root` uses `height: 100svh` (small viewport height) with `100vh` fallback — prevents overflow when the mobile URL bar collapses
- `html` and `body` have `overflow: hidden` to prevent page scroll
- `TopBar` is `sticky top-0 z-30` to guarantee it stays visible

## Environment Variables

See `.env.example`: PORT, DATA_DIR, ADMIN_PASSWORD, MAX_STORAGE_MB, MAX_SESSIONS.

## Deployment

Fly.io (Amsterdam). Persistent volume at `/data`. Auto-stop when idle. Production runs pre-compiled JS via `node server/dist/index.js`. CI deploys on push to main via `.github/workflows/deploy.yml`.
