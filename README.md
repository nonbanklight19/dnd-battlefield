# DnD Battlefield

A real-time collaborative battle map for D&D sessions. Upload a map image, place hero and enemy tokens, and move them across the battlefield — all changes sync instantly between connected players.

Built for personal use with a small friend group. No accounts, no auth — just share a 4-character room code and play.

## Features

- **Real-time sync** — token movements broadcast instantly via WebSocket (Socket.io)
- **Battle map upload** — drag-and-drop any image as your map background
- **Hero tokens** — pick from preset figurine-style hero images
- **Enemy tokens** — custom name + color + optional icon
- **Grid overlay** — toggleable square or hex grid with configurable cell size
- **Snap-to-grid** — tokens snap to the nearest cell center when grid is active
- **Pan & zoom** — navigate large maps with mouse drag + scroll wheel; pinch-to-zoom on touch
- **Token statuses** — mark tokens as **Dead** (red cross overlay); dead tokens are removed from the initiative tracker automatically
- **Role selection** — choose **DM** or **Player** on session join; DM-only controls (grid, map upload) are hidden from players
- **Auto-save** — session state persists to SQLite every 30 seconds
- **Initiative Tracker** — separate page, synced to the session by room code; link in the side panel (DM only)
- **Turn notifications** — toast shown on the battle map when initiative advances or a token is marked dead
- **Area of Effect (AoE)** — place, drag, rotate, and delete spell effect overlays on the map
- **Ruler tool** — measure distances in feet between any two points on the map
- **Admin panel** — optional server management UI (enabled via `ADMIN_PASSWORD` env var)

## Area of Effect

Open the 🎯 button in the top bar to launch the AoE editor.

| Option | Description |
|--------|-------------|
| **Shape** | Circle, Cone, Line, Square |
| **Size** | Spell range in feet (5 ft – 300 ft) |
| **Origin Size** | Footprint of the caster: 1×1, 2×2, or 3×3 grid cells |
| **Type** | Damage type colour — Fire, Cold, Lightning, Poison, Necrotic, Radiant, Psychic |

### How it works

- Click **Place on Map** then tap/click the map to drop the shape. Placement exits automatically after the first placement.
- The **origin footprint** (dashed border) shows the caster's occupied space. The spell area starts at the footprint edge and extends the chosen distance beyond it.
- **Origin snapping** — 1×1 and 3×3 origins snap to cell centres; 2×2 origins snap to grid corners.
- **Drag** the shape to reposition it; it snaps to the grid on release.
- **Rotate** cone and line shapes by dragging the white dot at the far end. Works on both desktop (mouse drag) and mobile (touch).
- **Select** a shape by clicking/tapping it (glow highlight). Press `Delete` or `Backspace` to remove it. Press `Escape` to deselect.
- Remove individual shapes from the placed list in the editor panel, or use **Clear All**.

## Initiative Tracker

Open `/<SESSION_CODE>/initiative` in any browser (or tap **⚡ Initiative Tracker** in the side panel) to get the initiative tracker for that session. It is a separate full-screen page that stays in sync with the battle map via the same socket room.

### Features

| Feature | Description |
|---------|-------------|
| **Rows** | Each row has Initiative, Name, HP, AC fields — all editable inline |
| **Auto-population** | When a hero or enemy token is added to the map a row is automatically added. When removed or marked Dead the row is removed |
| **Hero defaults** | Set default HP and AC per hero type via **OPTIONS → Heroes**. Applied automatically when the hero token is placed on the map |
| **NEXT** | Advances the highlighted row to the next combatant; wraps to round start and increments the round counter |
| **SORT** | Sorts all rows by initiative value descending |
| **Drag to reorder** | Hold the ⠿ handle to drag rows into a custom order |
| **Export / Import** | **OPTIONS → Export** saves the current rows as a JSON file. **OPTIONS → Import** loads rows from a JSON file (replaces current rows) |
| **Clear** | **OPTIONS → Clear** resets all rows and the round counter (with confirmation) |
| **Turn highlight** | The active row is highlighted in green; a gold pulsing ring appears on the corresponding token on the battle map for 5 seconds |
| **Death notification** | Marking a token Dead shows a skull toast on the battle map for all connected clients |
| **Persistence** | Rows, active index, and round are saved to SQLite alongside session data |

### JSON export format

```json
[
  { "initiative": 18, "name": "Warrior", "hp": 45, "ac": 16 },
  { "initiative": 12, "name": "Goblin",  "hp": 7,  "ac": 13 },
  { "initiative": null, "name": "Unknown", "hp": null, "ac": null }
]
```

### Database tables

| Table | Purpose |
|-------|---------|
| `initiative_meta` | One row per session — stores `activeIndex` and `round` |
| `initiative_rows` | One row per combatant — `id`, `sessionId`, `tokenId` (optional link to a battlefield token), `initiative`, `name`, `hp`, `ac`, `position` |
| `hero_configs` | Saved default HP/AC per hero type per session |

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React, TypeScript, Vite, react-konva, Tailwind CSS v4 |
| Backend | Express, Socket.io, better-sqlite3, multer |
| Deploy | Docker on Fly.io with persistent volume |

## Project Structure

```
client/                  # React + Vite frontend
  src/
    components/          # BattleMap, Token, GridOverlay, SidePanel, TopBar,
    |                    #   AoeShape, AoePanel, InitiativeTracker, etc.
    hooks/               # useSocket, useSession, useHeroImages, useInitiative, …
    types.ts             # Shared frontend types (Token, AoeEffect, …)
    App.tsx              # Main app — routing, session wiring, AOE state
server/                  # Express + Socket.io backend
  src/
    index.ts             # Server entry point
    routes.ts            # REST API endpoints
    socket.ts            # WebSocket event handlers
    state.ts             # In-memory state manager
    db.ts                # SQLite persistence
    admin.ts             # Admin panel routes
    guards.ts            # Resource limit guards
    types.ts             # Shared server types
Dockerfile               # Multi-stage build
fly.toml                 # Fly.io deployment config
```

## Getting Started

### Prerequisites

- Node.js 20+

### Development

```bash
# Install dependencies
npm install
cd client && npm install
cd ../server && npm install
cd ..

# Run both client and server in dev mode
npm run dev
```

The client runs on Vite's dev server (default port 5173) and the server runs on port 3001.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `DATA_DIR` | `./data` | Directory for SQLite DB and uploads |
| `ADMIN_PASSWORD` | — | Enables admin panel when set |
| `MAX_STORAGE_MB` | `1000` | Max storage for uploaded maps |
| `MAX_SESSIONS` | `50` | Max concurrent sessions |

### Production Build

```bash
npm run build    # Builds client to client/dist
npm start        # Starts server (serves client/dist as static files)
```

### Docker

```bash
docker build -t dnd-battlefield .
docker run -p 3001:3001 -v battlefield_data:/data dnd-battlefield
```

## How It Works

1. Create or join a session using a 4-character room code
2. Upload a battle map image (DM only)
3. Add hero tokens (preset images) or enemy tokens (name + color)
4. Drag tokens around the map — all connected clients see moves in real time
5. Toggle grid overlay and adjust grid size as needed
6. Use the 🎯 AoE tool to overlay spell effects; use the 📏 ruler to measure distances

State lives in memory for zero-latency reads; SQLite persists it for durability. Sessions auto-cleanup after 7 days of inactivity.

## Deployment

Deployed on [Fly.io](https://fly.io) with a persistent volume at `/data` for the SQLite database and uploaded map images. The machine auto-stops when idle and wakes on incoming requests.
