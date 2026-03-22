# DnD Battlefield

A real-time collaborative battle map for D&D sessions. Upload a map image, place hero and enemy tokens, and move them across the battlefield — all changes sync instantly between connected players.

Built for personal use with a small friend group. No accounts, no auth — just share a 4-character room code and play.

## Features

- **Real-time sync** — token movements broadcast instantly via WebSocket (Socket.io)
- **Battle map upload** — drag-and-drop any image as your map background
- **Hero tokens** — pick from preset figurine-style hero images
- **Enemy tokens** — custom name + color
- **Grid overlay** — toggleable square or hex grid with configurable cell size
- **Snap-to-grid** — tokens snap to the nearest cell center when grid is active
- **Pan & zoom** — navigate large maps with mouse drag + scroll wheel
- **Auto-save** — session state persists to SQLite every 30 seconds
- **Admin panel** — optional server management UI (enabled via `ADMIN_PASSWORD` env var)

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React, TypeScript, Vite, react-konva, Tailwind CSS |
| Backend | Express, Socket.io, better-sqlite3, multer |
| Deploy | Docker on Fly.io with persistent volume |

## Project Structure

```
client/                  # React + Vite frontend
  src/
    components/          # BattleMap, Token, GridOverlay, SidePanel, TopBar, etc.
    hooks/               # useSocket, useSession, useHeroImages
    App.tsx              # Main app with session routing
server/                  # Express + Socket.io backend
  src/
    index.ts             # Server entry point
    routes.ts            # REST API endpoints
    socket.ts            # WebSocket event handlers
    state.ts             # In-memory state manager
    db.ts                # SQLite persistence
    admin.ts             # Admin panel routes
    guards.ts            # Resource limit guards
    types.ts             # Shared types
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
2. Upload a battle map image
3. Add hero tokens (preset images) or enemy tokens (name + color)
4. Drag tokens around the map — all connected clients see moves in real time
5. Toggle grid overlay and adjust grid size as needed

State lives in memory for zero-latency reads; SQLite persists it for durability. Sessions auto-cleanup after 7 days of inactivity.

## Deployment

Deployed on [Fly.io](https://fly.io) with a persistent volume at `/data` for the SQLite database and uploaded map images. The machine auto-stops when idle and wakes on incoming requests.
