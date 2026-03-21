# DnD Battlefield - Design Spec

## Overview

A real-time collaborative battle map app for D&D sessions. Users upload a battle map image, place tokens representing players/enemies, and move them across the battlefield. All changes sync instantly between connected clients.

**Target users:** Small friend group (personal use, no public-facing features).

## Key Decisions

- **No accounts/auth** - simple room-based sessions via shareable link/code
- **Equal control** - no DM/player distinction, everyone can do everything
- **Grid modes** - per-map choice of: no grid, square grid, or hex grid
- **Minimal tokens** - name/label + color (no HP, stats, or conditions for now)
- **Optimistic updates** - instant local feedback with server authority
- **Persistent storage** - SQLite on a Fly.io persistent volume
- **Single deployment** - everything in one Docker container on Fly.io (free tier)

## Tech Stack

- **Frontend:** React + TypeScript + Vite + react-konva (canvas rendering)
- **Backend:** Express + Socket.io + better-sqlite3 + multer (file uploads)
- **Deploy:** Docker on Fly.io with persistent volume

## Data Model

**Storage:** SQLite via `better-sqlite3`, single file on persistent volume (`/data/battlefield.db`).

**Persistence strategy:** State lives in memory; SQLite is only for persistence. All real-time operations read/write only in-memory state (zero DB latency). State is saved to SQLite in three ways:
- **Manual save** - a "Save" button in the UI triggers a full state write
- **Auto-save** - every 30-60 seconds, automatically write current state to DB
- **On last disconnect** - auto-save when the last client disconnects from a session

Worst-case data loss on server crash: ~60 seconds of changes between auto-saves.

### Session
| Field | Type | Description |
|-------|------|-------------|
| id | string | Short random code (e.g., `"BX7K"`) |
| gridMode | enum | `"none"` \| `"square"` \| `"hex"` |
| gridSize | number | Pixels per grid cell |
| createdAt | datetime | For cleanup purposes |

### Map
| Field | Type | Description |
|-------|------|-------------|
| sessionId | string | FK to session |
| imageUrl | string | Server path to uploaded image |
| width | number | Original image width |
| height | number | Original image height |

### Token
| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| sessionId | string | FK to session |
| name | string | Display label |
| color | string | Hex color |
| x | number | X position (pixel coordinates) |
| y | number | Y position (pixel coordinates) |
| size | number | Grid cells occupied (default 1) |

## Real-Time Sync (Optimistic Updates)

### Token Movement Flow

1. User drags a token on the canvas
2. Client applies the move instantly (optimistic) - token moves on their screen immediately
3. Client emits `token:move` event to server via Socket.io
4. Server updates in-memory state, broadcasts `token:moved` to all other clients
5. Other clients apply the update to their canvas

### Conflict Handling

Last write wins. If two people grab the same token simultaneously, the last `token:move` the server processes is the final position. No rollback needed - if the server accepted it, it's valid. The only "rejection" scenario would be moving a token that was deleted, in which case the client removes it.

### Joining a Session

1. New client connects, sends `session:join` with the room code
2. Server sends back the full session state (map, all tokens, grid settings)
3. Client renders everything and is in sync

### Synced Events

| Client Emits | Server Broadcasts | Description |
|-------------|-------------------|-------------|
| `session:join` | `session:state` | Join room, receive full state |
| `token:add` | `token:added` | Add a token to the map |
| `token:move` | `token:moved` | Move a token |
| `token:remove` | `token:removed` | Remove a token |
| `grid:update` | `grid:updated` | Change grid mode/size |
| `map:upload` | (via REST + broadcast) | Upload new battle map |

### Reconnection

Socket.io handles reconnection automatically. On reconnect, client requests full state to resync.

## Canvas & UI

### Canvas (react-konva)

- Battle map image rendered as the base layer
- Grid overlay drawn on top (toggleable) - square or hex lines
- Tokens rendered as colored circles with name labels, draggable
- Pan and zoom the entire canvas (mouse drag + scroll wheel / pinch on mobile)
- When grid is active, tokens snap to the nearest cell center on drop

### UI Layout

Single page, minimal:

- **Top bar:** Session code (copyable), grid mode toggle (none/square/hex), grid size slider
- **Canvas:** Takes up most of the screen
- **Side panel (collapsible):**
  - Upload map button
  - Add token form (name + color picker)
  - List of tokens on the map (click to remove)

### Responsive

Works on desktop and tablets. Mobile is usable but not the primary target (dragging tokens on a small screen is inherently awkward).

## Backend & API

### REST Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/sessions` | Create a new session, returns room code |
| GET | `/api/sessions/:id` | Get session state (fallback) |
| POST | `/api/sessions/:id/map` | Upload battle map image |
| GET | `/uploads/:filename` | Serve uploaded map images |
| GET | `/health` | Health check for Fly.io |

### File Structure

```
/
├── client/                # React + Vite
│   └── src/
│       ├── components/    # Canvas, TopBar, SidePanel, Token, Grid
│       ├── hooks/         # useSocket, useSession
│       └── App.tsx
├── server/                # Express + Socket.io
│   ├── index.ts
│   ├── routes/            # REST endpoints
│   ├── socket/            # Socket event handlers
│   └── db.ts              # SQLite setup & queries
├── Dockerfile
└── fly.toml
```

## Deployment

### Docker on Fly.io

- Single Dockerfile: build the Vite frontend, serve static files from Express
- Express handles everything - static files, API, WebSocket - one process, one port
- Fly.io persistent volume mounted at `/data` for SQLite DB + uploaded map images

### Fly.io Config

- Single machine (free tier)
- Persistent volume for `/data`
- Health check on `GET /health`
- Auto-stop when idle to save resources (wakes on request)

### Session Cleanup

Periodic task (every 24h) deletes sessions older than 7 days and their associated map images to avoid filling up storage.
