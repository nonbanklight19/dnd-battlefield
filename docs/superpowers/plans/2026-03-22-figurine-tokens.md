# Figurine-Style Tokens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace flat colored-circle tokens with 3D-style SVG hero figurines and icon-based enemy tokens.

**Architecture:** Discriminated union Token type (`HeroToken | EnemyToken`) with separate rendering components for each. Hero SVGs loaded as static assets, enemy tokens use Konva shapes + emoji/uploaded images. Side panel split into hero picker and enemy form.

**Tech Stack:** React, TypeScript, react-konva, Socket.io, Express, multer, better-sqlite3, SVG

---

## File Structure

### New Files
- `client/src/assets/heroes/warrior.svg` — warrior figurine SVG
- `client/src/assets/heroes/wizard.svg` — wizard figurine SVG
- `client/src/assets/heroes/rogue.svg` — rogue figurine SVG
- `client/src/assets/heroes/dwarf.svg` — dwarf figurine SVG
- `client/src/assets/heroes/triton.svg` — triton figurine SVG
- `client/src/hooks/useHeroImages.ts` — preloads hero SVGs as HTMLImageElements
- `client/src/components/HeroToken.tsx` — renders hero figurine on canvas via Konva.Image
- `client/src/components/EnemyToken.tsx` — renders enemy icon token on canvas (circle + icon + name plate)
- `client/src/components/HeroPicker.tsx` — "Place Hero" section in side panel
- `client/src/components/EnemyForm.tsx` — "Add Enemy" section in side panel

### Modified Files
- `client/src/types.ts` — discriminated union Token type
- `server/src/types.ts` — matching server-side Token type
- `server/src/db.ts` — new token columns, updated save/load
- `server/src/state.ts` — `addHero()` and `addEnemy()` replacing `addToken()`
- `server/src/socket.ts` — `token:add-hero` and `token:add-enemy` events replacing `token:add`
- `server/src/routes.ts` — new `/api/sessions/:id/enemy-icon` endpoint
- `client/src/hooks/useSession.ts` — `addHero()` and `addEnemy()` replacing `addToken()`
- `client/src/components/Token.tsx` — wrapper delegating to HeroToken or EnemyToken
- `client/src/components/SidePanel.tsx` — replace "Add Token" with HeroPicker + EnemyForm
- `client/src/components/BattleMap.tsx` — pass hero images to token layer
- `client/src/App.tsx` — wire up new addHero/addEnemy handlers

---

### Task 1: Update Shared Types

**Files:**
- Modify: `server/src/types.ts`
- Modify: `client/src/types.ts`

- [ ] **Step 1: Update server types**

In `server/src/types.ts`, replace the `Token` interface with the discriminated union:

```ts
export type GridMode = "none" | "square" | "hex";

export type HeroType = "warrior" | "wizard" | "rogue" | "dwarf" | "triton";

export interface HeroToken {
  id: string;
  sessionId: string;
  kind: "hero";
  heroType: HeroType;
  x: number;
  y: number;
  size: number;
}

export interface EnemyToken {
  id: string;
  sessionId: string;
  kind: "enemy";
  name: string;
  color: string;
  icon: string;
  customImage?: string;
  x: number;
  y: number;
  size: number;
}

export type Token = HeroToken | EnemyToken;

export interface MapData {
  sessionId: string;
  imageUrl: string;
  width: number;
  height: number;
}

export interface Session {
  id: string;
  gridMode: GridMode;
  gridSize: number;
  createdAt: string;
  map: MapData | null;
  tokens: Token[];
}
```

- [ ] **Step 2: Update client types**

In `client/src/types.ts`, replace with the client-side version (same but without `sessionId`):

```ts
export type GridMode = "none" | "square" | "hex";

export type HeroType = "warrior" | "wizard" | "rogue" | "dwarf" | "triton";

export interface HeroToken {
  id: string;
  kind: "hero";
  heroType: HeroType;
  x: number;
  y: number;
  size: number;
}

export interface EnemyToken {
  id: string;
  kind: "enemy";
  name: string;
  color: string;
  icon: string;
  customImage?: string;
  x: number;
  y: number;
  size: number;
}

export type Token = HeroToken | EnemyToken;

export interface MapData {
  imageUrl: string;
  width: number;
  height: number;
}

export interface SessionState {
  id: string;
  gridMode: GridMode;
  gridSize: number;
  map: MapData | null;
  tokens: Token[];
}
```

- [ ] **Step 3: Commit**

```bash
git add server/src/types.ts client/src/types.ts
git commit -m "feat: update Token types to discriminated union (hero/enemy)"
```

---

### Task 2: Update Database Schema and Queries

**Files:**
- Modify: `server/src/db.ts`

- [ ] **Step 1: Update the migrate() method**

Drop and recreate the tokens table with new columns. Replace the existing `CREATE TABLE IF NOT EXISTS tokens` block:

```ts
private migrate() {
  this.db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      gridMode TEXT NOT NULL DEFAULT 'none',
      gridSize INTEGER NOT NULL DEFAULT 50,
      createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS maps (
      sessionId TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
      imageUrl TEXT NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL
    );
    DROP TABLE IF EXISTS tokens;
    CREATE TABLE tokens (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      kind TEXT NOT NULL DEFAULT 'enemy',
      heroType TEXT,
      name TEXT,
      color TEXT,
      icon TEXT,
      customImage TEXT,
      x REAL NOT NULL,
      y REAL NOT NULL,
      size INTEGER NOT NULL DEFAULT 1
    );
  `);
}
```

- [ ] **Step 2: Update saveSession() token insert**

Replace the token insert statement to handle the new columns:

```ts
const insertToken = this.db.prepare(
  `INSERT INTO tokens (id, sessionId, kind, heroType, name, color, icon, customImage, x, y, size)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);
for (const t of session.tokens) {
  if (t.kind === "hero") {
    insertToken.run(t.id, t.sessionId, "hero", t.heroType, null, null, null, null, t.x, t.y, t.size);
  } else {
    insertToken.run(t.id, t.sessionId, "enemy", null, t.name, t.color, t.icon, t.customImage ?? null, t.x, t.y, t.size);
  }
}
```

- [ ] **Step 3: Update loadSession() token mapping**

Replace the token loading to reconstruct the discriminated union from DB rows:

```ts
const tokenRows = this.db
  .prepare(`SELECT * FROM tokens WHERE sessionId = ?`)
  .all(id) as Array<{
    id: string; sessionId: string; kind: string; heroType: string | null;
    name: string | null; color: string | null; icon: string | null;
    customImage: string | null; x: number; y: number; size: number;
  }>;

const tokens: Token[] = tokenRows.map((row) => {
  if (row.kind === "hero") {
    return {
      id: row.id, sessionId: row.sessionId, kind: "hero" as const,
      heroType: row.heroType as HeroType, x: row.x, y: row.y, size: row.size,
    };
  }
  return {
    id: row.id, sessionId: row.sessionId, kind: "enemy" as const,
    name: row.name!, color: row.color!, icon: row.icon!,
    ...(row.customImage ? { customImage: row.customImage } : {}),
    x: row.x, y: row.y, size: row.size,
  };
});
```

Make sure to add the `Token` and `HeroType` imports at the top of `db.ts`:

```ts
import type { Session, Token, MapData, HeroType } from "./types.js";
```

- [ ] **Step 4: Verify server compiles**

Run: `cd server && npx tsc --noEmit`
Expected: No errors (or only errors from files we haven't updated yet — `state.ts`, `socket.ts`)

- [ ] **Step 5: Commit**

```bash
git add server/src/db.ts
git commit -m "feat: update database schema for hero/enemy token types"
```

---

### Task 3: Update StateManager

**Files:**
- Modify: `server/src/state.ts`

- [ ] **Step 1: Replace addToken() with addHero() and addEnemy()**

Remove the existing `addToken` method and add two new methods:

```ts
addHero(
  sessionId: string,
  data: { heroType: HeroType; x: number; y: number }
): Token | undefined {
  const session = this.sessions.get(sessionId);
  if (!session) return undefined;
  // Each hero type can only exist once per session
  if (session.tokens.some((t) => t.kind === "hero" && t.heroType === data.heroType)) {
    return undefined;
  }
  const token: HeroToken = {
    id: nanoid(8),
    sessionId,
    kind: "hero",
    heroType: data.heroType,
    x: data.x,
    y: data.y,
    size: 1,
  };
  session.tokens.push(token);
  return token;
}

addEnemy(
  sessionId: string,
  data: { name: string; color: string; icon: string; customImage?: string; x: number; y: number }
): Token | undefined {
  const session = this.sessions.get(sessionId);
  if (!session) return undefined;
  const token: EnemyToken = {
    id: nanoid(8),
    sessionId,
    kind: "enemy",
    name: data.name,
    color: data.color,
    icon: data.icon,
    customImage: data.customImage,
    x: data.x,
    y: data.y,
    size: 1,
  };
  session.tokens.push(token);
  return token;
}
```

Add the necessary imports at the top:

```ts
import type { Session, Token, HeroToken, EnemyToken, HeroType, GridMode, MapData } from "./types.js";
```

- [ ] **Step 2: Verify server compiles**

Run: `cd server && npx tsc --noEmit`
Expected: Only errors from `socket.ts` (still references old `token:add`)

- [ ] **Step 3: Commit**

```bash
git add server/src/state.ts
git commit -m "feat: split addToken into addHero and addEnemy in StateManager"
```

---

### Task 4: Update Socket Handlers

**Files:**
- Modify: `server/src/socket.ts`

- [ ] **Step 1: Replace token:add handler with token:add-hero and token:add-enemy**

Remove the existing `socket.on("token:add", ...)` handler and add:

```ts
socket.on("token:add-hero", (data: { heroType: string; x: number; y: number }) => {
  const sessionId = clientSessions.get(socket.id);
  if (!sessionId) return;
  const validTypes = ["warrior", "wizard", "rogue", "dwarf", "triton"];
  if (!validTypes.includes(data.heroType)) return;
  const token = state.addHero(sessionId, {
    heroType: data.heroType as any,
    x: data.x,
    y: data.y,
  });
  if (token) {
    socket.to(sessionId).emit("token:added", token);
    socket.emit("token:added", token);
  }
});

socket.on("token:add-enemy", (data: { name: string; color: string; icon: string; customImage?: string; x: number; y: number }) => {
  const sessionId = clientSessions.get(socket.id);
  if (!sessionId) return;
  const token = state.addEnemy(sessionId, data);
  if (token) {
    socket.to(sessionId).emit("token:added", token);
    socket.emit("token:added", token);
  }
});
```

- [ ] **Step 2: Verify server compiles clean**

Run: `cd server && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add server/src/socket.ts
git commit -m "feat: add token:add-hero and token:add-enemy socket events"
```

---

### Task 5: Add Enemy Icon Upload Endpoint

**Files:**
- Modify: `server/src/routes.ts`

- [ ] **Step 1: Add the enemy-icon upload route**

Add this route after the existing `/api/sessions/:id/map` route in `createRoutes()`:

```ts
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
```

- [ ] **Step 2: Verify server compiles**

Run: `cd server && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add server/src/routes.ts
git commit -m "feat: add enemy icon upload endpoint"
```

---

### Task 6: Update Existing Tests

**Files:**
- Modify: `server/__tests__/state.test.ts`
- Modify: `server/__tests__/socket.test.ts`
- Modify: `server/__tests__/db.test.ts`

- [ ] **Step 1: Update state.test.ts**

Replace all `state.addToken(...)` calls with `state.addEnemy(...)` and update assertions to match the new token shape. Replace each occurrence:

- `state.addToken(session.id, { name: "Fighter", color: "#ff0000", x: 100, y: 200 })` → `state.addEnemy(session.id, { name: "Fighter", color: "#ff0000", icon: "👹", x: 100, y: 200 })`
- Same pattern for "Rogue", "Wizard", "Paladin", "Bard" tokens

Update assertions that check `token.name` — enemy tokens still have `.name` so those should work. But add a test for `addHero`:

```ts
it("adds a hero token to a session", () => {
  const session = state.createSession();
  const token = state.addHero(session.id, { heroType: "warrior", x: 100, y: 200 });
  expect(token).toBeDefined();
  expect(token!.kind).toBe("hero");
  if (token!.kind === "hero") {
    expect(token!.heroType).toBe("warrior");
  }
  expect(state.getSession(session.id)!.tokens).toHaveLength(1);
});

it("prevents duplicate hero types", () => {
  const session = state.createSession();
  state.addHero(session.id, { heroType: "warrior", x: 100, y: 200 });
  const dupe = state.addHero(session.id, { heroType: "warrior", x: 300, y: 400 });
  expect(dupe).toBeUndefined();
  expect(state.getSession(session.id)!.tokens).toHaveLength(1);
});
```

For the "loads sessions from database on init" test, update the assertion from `loaded!.tokens[0].name` to check the kind field:

```ts
expect(loaded!.tokens[0].kind).toBe("enemy");
if (loaded!.tokens[0].kind === "enemy") {
  expect(loaded!.tokens[0].name).toBe("Bard");
}
```

- [ ] **Step 2: Update socket.test.ts**

Replace `state.addToken(...)` calls with `state.addEnemy(...)`:

- `state.addToken(session.id, { name: "Rogue", color: "#00ff00", x: 0, y: 0 })` → `state.addEnemy(session.id, { name: "Rogue", color: "#00ff00", icon: "👹", x: 0, y: 0 })`
- Same for "Wizard" and "Paladin"

Replace the "broadcasts token:added" test to use the new event:

```ts
client1.emit("token:add-enemy", { name: "Fighter", color: "#ff0000", icon: "👹", x: 100, y: 200 });
```

Update the assertion from `token.name` to:

```ts
expect(token.kind).toBe("enemy");
expect(token.name).toBe("Fighter");
```

- [ ] **Step 3: Update db.test.ts**

Update the token objects in "saves and loads a session with map and tokens" to use the new schema:

```ts
tokens: [
  { id: "t1", sessionId: "MAP1", kind: "enemy" as const, name: "Fighter", color: "#ff0000", icon: "👹", x: 100, y: 200, size: 1 },
  { id: "t2", sessionId: "MAP1", kind: "hero" as const, heroType: "wizard" as const, x: 300, y: 400, size: 1 },
],
```

Update the assertion to match — `toEqual` will check the full shape including `kind`, `icon`, `heroType` fields.

Also update the "deletes a session" test token:

```ts
tokens: [{ id: "t1", sessionId: "DEL", kind: "enemy" as const, name: "Rogue", color: "#00ff00", icon: "👹", x: 0, y: 0, size: 1 }],
```

- [ ] **Step 4: Run tests**

Run: `cd server && npm test`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add server/__tests__/
git commit -m "test: update existing tests for hero/enemy token types"
```

---

### Task 7: Create Hero SVG Assets

**Files:**
- Create: `client/src/assets/heroes/warrior.svg`
- Create: `client/src/assets/heroes/wizard.svg`
- Create: `client/src/assets/heroes/rogue.svg`
- Create: `client/src/assets/heroes/dwarf.svg`
- Create: `client/src/assets/heroes/triton.svg`

- [ ] **Step 1: Create warrior.svg**

Red armor, sword and shield. Figurine on a round base with ground shadow. Uses SVG gradients for 3D painted-mini look. Viewbox should be square (e.g., `0 0 100 120`) to fit the figurine + base.

Visual spec from brainstorming mockup:
- Body: red gradient (`#e05252` to `#8a2020`), rounded rectangle shape
- Head: skin tone gradient (`#e8c9a0` to `#c9a87a`), circle
- Sword: silver/gray gradient on the right side
- Shield: red gradient on the left side, rounded
- Base: dark gray ellipse with 3D gradient (`#555` to `#222`)
- Ground shadow: semi-transparent ellipse below base

- [ ] **Step 2: Create wizard.svg**

Blue robes, pointed hat, staff with glowing orb.

Visual spec:
- Body: blue gradient (`#3b82f6` to `#1d4ed8`), wider at bottom (robe)
- Head: skin tone, smaller circle
- Hat: blue triangle above head
- Staff: brown line on right with glowing blue orb at top (`#7dd3fc` to `#3b82f6`)
- Base + shadow: same as warrior

- [ ] **Step 3: Create rogue.svg**

Purple cloak with hood, dual daggers.

Visual spec:
- Body: purple gradient (`#7c6dec` to `#4c3d9c`), slimmer build
- Head: skin tone circle with dark purple hood arc above
- Daggers: two silver/gray lines crossed on each side
- Base + shadow: same style

- [ ] **Step 4: Create dwarf.svg**

Amber/gold armor, shorter stature, battle axe, beard.

Visual spec:
- Body: amber gradient (`#f59e0b` to `#b45309`), wider and shorter
- Head: skin tone circle, larger relative to body
- Beard: brown gradient below head (`#92400e` to `#78350f`)
- Axe: brown handle + gray axe head on right
- Base + shadow: same style

- [ ] **Step 5: Create triton.svg**

Cyan/teal armor, trident, aquatic features.

Visual spec:
- Body: cyan gradient (`#06b6d4` to `#0e7490`)
- Head: blue-tinted skin (`#67e8f9` to `#22d3ee`)
- Trident: blue/cyan handle with 3-pronged top
- Fin details on arms
- Base + shadow: same style

- [ ] **Step 6: Commit**

```bash
git add client/src/assets/heroes/
git commit -m "feat: add hero figurine SVG assets"
```

---

### Task 8: Create Hero Image Preloader Hook

**Files:**
- Create: `client/src/hooks/useHeroImages.ts`

- [ ] **Step 1: Create the hook**

```ts
import { useState, useEffect } from "react";
import type { HeroType } from "../types.js";

import warriorSvg from "../assets/heroes/warrior.svg";
import wizardSvg from "../assets/heroes/wizard.svg";
import rogueSvg from "../assets/heroes/rogue.svg";
import dwarfSvg from "../assets/heroes/dwarf.svg";
import tritonSvg from "../assets/heroes/triton.svg";

const HERO_SVGS: Record<HeroType, string> = {
  warrior: warriorSvg,
  wizard: wizardSvg,
  rogue: rogueSvg,
  dwarf: dwarfSvg,
  triton: tritonSvg,
};

export function useHeroImages() {
  const [images, setImages] = useState<Record<HeroType, HTMLImageElement> | null>(null);

  useEffect(() => {
    const entries = Object.entries(HERO_SVGS) as [HeroType, string][];
    const loaded: Partial<Record<HeroType, HTMLImageElement>> = {};
    let cancelled = false;

    Promise.all(
      entries.map(
        ([type, src]) =>
          new Promise<void>((resolve) => {
            const img = new window.Image();
            img.src = src;
            img.onload = () => {
              loaded[type] = img;
              resolve();
            };
            img.onerror = () => resolve(); // graceful fallback
          })
      )
    ).then(() => {
      if (!cancelled) {
        setImages(loaded as Record<HeroType, HTMLImageElement>);
      }
    });

    return () => { cancelled = true; };
  }, []);

  return images;
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/hooks/useHeroImages.ts
git commit -m "feat: add useHeroImages hook for SVG preloading"
```

---

### Task 9: Create HeroToken Canvas Component

**Files:**
- Create: `client/src/components/HeroToken.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { Image as KonvaImage, Group } from "react-konva";
import type { HeroToken as HeroTokenType, HeroType } from "../types.js";

interface Props {
  token: HeroTokenType;
  gridSize: number;
  heroImages: Record<HeroType, HTMLImageElement>;
  onDragEnd: (id: string, x: number, y: number) => void;
}

export function HeroTokenComponent({ token, gridSize, heroImages, onDragEnd }: Props) {
  const image = heroImages[token.heroType];
  if (!image) return null;

  // Scale SVG to fit grid cell
  const targetSize = gridSize * token.size;
  const aspect = image.naturalWidth / image.naturalHeight;
  const width = aspect >= 1 ? targetSize : targetSize * aspect;
  const height = aspect >= 1 ? targetSize / aspect : targetSize;

  return (
    <Group
      x={token.x}
      y={token.y}
      draggable
      onDragEnd={(e) => {
        const node = e.target;
        const x = node.x();
        const y = node.y();
        node.position({ x: token.x, y: token.y });
        onDragEnd(token.id, x, y);
      }}
    >
      <KonvaImage
        image={image}
        width={width}
        height={height}
        offsetX={width / 2}
        offsetY={height / 2}
      />
    </Group>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/HeroToken.tsx
git commit -m "feat: add HeroToken canvas component"
```

---

### Task 10: Create EnemyToken Canvas Component

**Files:**
- Create: `client/src/components/EnemyToken.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useState, useEffect } from "react";
import { Circle, Text, Group, Rect, Image as KonvaImage } from "react-konva";
import type { EnemyToken as EnemyTokenType } from "../types.js";

interface Props {
  token: EnemyTokenType;
  gridSize: number;
  onDragEnd: (id: string, x: number, y: number) => void;
}

// Cache for custom images
const imageCache = new Map<string, HTMLImageElement>();

export function EnemyTokenComponent({ token, gridSize, onDragEnd }: Props) {
  const radius = (gridSize * token.size) / 2.5;
  const [customImg, setCustomImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!token.customImage) {
      setCustomImg(null);
      return;
    }
    const cached = imageCache.get(token.customImage);
    if (cached) {
      setCustomImg(cached);
      return;
    }
    const img = new window.Image();
    img.src = token.customImage;
    img.onload = () => {
      imageCache.set(token.customImage!, img);
      setCustomImg(img);
    };
  }, [token.customImage]);

  const nameFontSize = Math.max(8, radius * 0.5);
  const plateWidth = Math.max(radius * 2, token.name.length * nameFontSize * 0.6);
  const plateHeight = nameFontSize + 6;

  return (
    <Group
      x={token.x}
      y={token.y}
      draggable
      onDragEnd={(e) => {
        const node = e.target;
        const x = node.x();
        const y = node.y();
        node.position({ x: token.x, y: token.y });
        onDragEnd(token.id, x, y);
      }}
    >
      {/* Shadow */}
      <Circle
        radius={radius}
        fill="transparent"
        shadowColor="black"
        shadowBlur={6}
        shadowOpacity={0.5}
        shadowOffsetY={2}
      />
      {/* Outer ring (colored border) */}
      <Circle
        radius={radius}
        stroke={token.color}
        strokeWidth={3}
        fill="#1a1a1a"
      />
      {/* Inner dark fill */}
      <Circle
        radius={radius - 4}
        fill="#111"
      />
      {/* Icon: custom image or emoji */}
      {customImg ? (
        <Group
          clipFunc={(ctx) => {
            ctx.arc(0, 0, radius - 5, 0, Math.PI * 2, false);
          }}
        >
          <KonvaImage
            image={customImg}
            width={(radius - 5) * 2}
            height={(radius - 5) * 2}
            offsetX={radius - 5}
            offsetY={radius - 5}
          />
        </Group>
      ) : (
        <Text
          text={token.icon}
          fontSize={radius * 1.1}
          align="center"
          verticalAlign="middle"
          width={radius * 2}
          height={radius * 2}
          offsetX={radius}
          offsetY={radius}
          listening={false}
        />
      )}
      {/* Name plate */}
      <Rect
        x={-plateWidth / 2}
        y={radius + 4}
        width={plateWidth}
        height={plateHeight}
        fill="#333"
        stroke="#555"
        strokeWidth={1}
        cornerRadius={3}
      />
      <Text
        text={token.name}
        fontSize={nameFontSize}
        fill="#e8e0d0"
        align="center"
        verticalAlign="middle"
        width={plateWidth}
        height={plateHeight}
        x={-plateWidth / 2}
        y={radius + 4}
        listening={false}
      />
    </Group>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/EnemyToken.tsx
git commit -m "feat: add EnemyToken canvas component with icon and name plate"
```

---

### Task 11: Update Token.tsx as Wrapper

**Files:**
- Modify: `client/src/components/Token.tsx`

- [ ] **Step 1: Rewrite Token.tsx to delegate based on kind**

Replace the entire file:

```tsx
import { HeroTokenComponent } from "./HeroToken.js";
import { EnemyTokenComponent } from "./EnemyToken.js";
import type { Token, HeroType } from "../types.js";

interface Props {
  token: Token;
  gridSize: number;
  heroImages: Record<HeroType, HTMLImageElement> | null;
  onDragEnd: (id: string, x: number, y: number) => void;
}

export function TokenComponent({ token, gridSize, heroImages, onDragEnd }: Props) {
  if (token.kind === "hero") {
    if (!heroImages) return null;
    return (
      <HeroTokenComponent
        token={token}
        gridSize={gridSize}
        heroImages={heroImages}
        onDragEnd={onDragEnd}
      />
    );
  }
  return (
    <EnemyTokenComponent
      token={token}
      gridSize={gridSize}
      onDragEnd={onDragEnd}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/Token.tsx
git commit -m "feat: update Token.tsx as wrapper for hero/enemy rendering"
```

---

### Task 12: Update useSession Hook

**Files:**
- Modify: `client/src/hooks/useSession.ts`

- [ ] **Step 1: Replace addToken with addHero and addEnemy**

Replace the `addToken` callback with:

```ts
const addHero = useCallback(
  (data: { heroType: string; x: number; y: number }) => {
    socket?.emit("token:add-hero", data);
  },
  [socket]
);

const addEnemy = useCallback(
  (data: { name: string; color: string; icon: string; customImage?: string; x: number; y: number }) => {
    socket?.emit("token:add-enemy", data);
  },
  [socket]
);
```

Update the return object to replace `addToken` with `addHero` and `addEnemy`:

```ts
return {
  session,
  connected,
  error,
  saveStatus,
  addHero,
  addEnemy,
  moveToken,
  removeToken,
  updateGrid,
  saveSession,
};
```

- [ ] **Step 2: Commit**

```bash
git add client/src/hooks/useSession.ts
git commit -m "feat: split addToken into addHero and addEnemy in useSession"
```

---

### Task 13: Create HeroPicker Component

**Files:**
- Create: `client/src/components/HeroPicker.tsx`

- [ ] **Step 1: Create the component**

```tsx
import type { HeroType, Token } from "../types.js";

import warriorSvg from "../assets/heroes/warrior.svg";
import wizardSvg from "../assets/heroes/wizard.svg";
import rogueSvg from "../assets/heroes/rogue.svg";
import dwarfSvg from "../assets/heroes/dwarf.svg";
import tritonSvg from "../assets/heroes/triton.svg";

const HEROES: { type: HeroType; label: string; svg: string; color: string }[] = [
  { type: "warrior", label: "Warrior", svg: warriorSvg, color: "#e05252" },
  { type: "wizard", label: "Wizard", svg: wizardSvg, color: "#3b82f6" },
  { type: "rogue", label: "Rogue", svg: rogueSvg, color: "#7c6dec" },
  { type: "dwarf", label: "Dwarf", svg: dwarfSvg, color: "#f59e0b" },
  { type: "triton", label: "Triton", svg: tritonSvg, color: "#06b6d4" },
];

interface Props {
  tokens: Token[];
  onAddHero: (data: { heroType: string; x: number; y: number }) => void;
  onRemoveToken: (id: string) => void;
}

export function HeroPicker({ tokens, onAddHero, onRemoveToken }: Props) {
  const placedHeroes = tokens.filter((t) => t.kind === "hero");

  const isPlaced = (type: HeroType) =>
    placedHeroes.some((t) => t.kind === "hero" && t.heroType === type);

  const getPlacedTokenId = (type: HeroType) =>
    placedHeroes.find((t) => t.kind === "hero" && t.heroType === type)?.id;

  const handleClick = (hero: typeof HEROES[0]) => {
    if (isPlaced(hero.type)) {
      const id = getPlacedTokenId(hero.type);
      if (id) onRemoveToken(id);
    } else {
      onAddHero({ heroType: hero.type, x: 100, y: 100 });
    }
  };

  return (
    <div className="flex gap-3 flex-wrap justify-center">
      {HEROES.map((hero) => {
        const placed = isPlaced(hero.type);
        return (
          <div
            key={hero.type}
            onClick={() => handleClick(hero)}
            className="flex flex-col items-center cursor-pointer p-2 rounded-lg transition-all duration-150"
            style={{
              border: `2px solid ${placed ? hero.color : `${hero.color}4D`}`,
              background: placed ? `${hero.color}1A` : "transparent",
              opacity: placed ? 0.5 : 1,
            }}
          >
            <img
              src={hero.svg}
              alt={hero.label}
              className="w-10 h-[52px] object-contain"
            />
            <span
              className="text-[9px] font-medium mt-1"
              style={{ color: hero.color }}
            >
              {hero.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/HeroPicker.tsx
git commit -m "feat: add HeroPicker side panel component"
```

---

### Task 14: Create EnemyForm Component

**Files:**
- Create: `client/src/components/EnemyForm.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useState, useRef } from "react";

const PRESET_ICONS = ["👹", "💀", "🐉", "🕷️", "🐺", "🧟", "👻", "🦇", "🐍", "🧌", "🔥", "⚡"];

const PRESET_COLORS = [
  "#e05252", "#f59e0b", "#4ade80", "#3b82f6",
  "#7c6dec", "#ec4899", "#6b7280", "#e8e0d0",
];

interface Props {
  sessionId: string;
  onAddEnemy: (data: { name: string; color: string; icon: string; customImage?: string; x: number; y: number }) => void;
}

export function EnemyForm({ sessionId, onAddEnemy }: Props) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(PRESET_ICONS[0]);
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [customImage, setCustomImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAdd = () => {
    if (!name.trim()) return;
    onAddEnemy({
      name: name.trim(),
      color,
      icon,
      ...(customImage ? { customImage } : {}),
      x: 100,
      y: 100,
    });
    setName("");
    setCustomImage(null);
  };

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("icon", file);
    const res = await fetch(`/api/sessions/${sessionId}/enemy-icon`, {
      method: "POST",
      body: formData,
    });
    if (res.ok) {
      const data = await res.json();
      setCustomImage(data.imageUrl);
    }
  };

  return (
    <div>
      <input
        type="text"
        placeholder="Enemy name..."
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        className="w-full py-2.5 px-3.5 bg-bg-deep border border-border-default rounded-lg text-text-primary text-sm outline-none transition-all duration-150 focus:border-gold-muted focus:shadow-[0_0_0_3px_rgba(202,169,104,0.15)] mb-4"
      />

      <span className="text-[10px] uppercase tracking-[1px] text-text-muted block mb-2">Icon</span>
      <div className="flex gap-1.5 flex-wrap mb-4">
        {PRESET_ICONS.map((ic) => (
          <div
            key={ic}
            onClick={() => { setIcon(ic); setCustomImage(null); }}
            className="w-8 h-8 rounded-md flex items-center justify-center text-lg cursor-pointer transition-all duration-150"
            style={{
              background: icon === ic && !customImage ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
              border: icon === ic && !customImage
                ? "2px solid var(--color-gold-bright, #caa968)"
                : "1px solid rgba(255,255,255,0.1)",
            }}
          >
            {ic}
          </div>
        ))}
        {/* Upload button */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className="w-8 h-8 rounded-md flex items-center justify-center text-sm cursor-pointer transition-all duration-150 text-text-muted hover:text-text-primary"
          style={{
            background: customImage ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
            border: customImage
              ? "2px solid var(--color-gold-bright, #caa968)"
              : "1px solid rgba(255,255,255,0.1)",
          }}
        >
          {customImage ? "✓" : "↑"}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleIconUpload}
          className="hidden"
        />
      </div>

      <span className="text-[10px] uppercase tracking-[1px] text-text-muted block mb-2">Color</span>
      <div className="flex gap-2 flex-wrap mb-4">
        {PRESET_COLORS.map((c) => (
          <div
            key={c}
            onClick={() => setColor(c)}
            className="w-7 h-7 rounded-full cursor-pointer transition-all duration-150 hover:scale-115"
            style={{
              background: c,
              border: c === color ? "2px solid var(--color-gold-bright, #caa968)" : "2px solid transparent",
              boxShadow: c === color ? "0 0 8px rgba(202,169,104,0.3)" : "none",
            }}
          />
        ))}
      </div>

      <button
        onClick={handleAdd}
        disabled={!name.trim()}
        className="w-full py-2.5 bg-gold-dim text-gold-bright border border-border-hover rounded-lg text-sm font-medium cursor-pointer transition-all duration-150 hover:bg-gold-subtle hover:border-gold-muted disabled:opacity-40 disabled:cursor-not-allowed"
      >
        + Add Enemy
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/EnemyForm.tsx
git commit -m "feat: add EnemyForm side panel component"
```

---

### Task 15: Update SidePanel

**Files:**
- Modify: `client/src/components/SidePanel.tsx`

- [ ] **Step 1: Replace Add Token section with HeroPicker and EnemyForm**

Update the imports at the top of the file:

```ts
import { HeroPicker } from "./HeroPicker.js";
import { EnemyForm } from "./EnemyForm.js";
```

Update the Props interface — replace `onAddToken` with `onAddHero`, `onAddEnemy`, and add `sessionId`:

```ts
interface Props {
  tokens: Token[];
  gridMode: GridMode;
  gridSize: number;
  sessionId: string;
  onAddHero: (data: { heroType: string; x: number; y: number }) => void;
  onAddEnemy: (data: { name: string; color: string; icon: string; customImage?: string; x: number; y: number }) => void;
  onRemoveToken: (id: string) => void;
  onUploadMap: (file: File) => void;
  onGridModeChange: (mode: GridMode) => void;
  onGridSizeChange: (size: number) => void;
  visible: boolean;
}
```

Update the component destructuring and remove `name`, `color` state + `handleAdd` + `PRESET_COLORS` (no longer needed in this file).

Replace the "Add Token" `CollapsibleSection` with two sections:

```tsx
{/* Place Hero */}
<CollapsibleSection title="Place Hero">
  <HeroPicker
    tokens={tokens}
    onAddHero={onAddHero}
    onRemoveToken={onRemoveToken}
  />
</CollapsibleSection>

{/* Add Enemy */}
<CollapsibleSection title="Add Enemy">
  <EnemyForm
    sessionId={sessionId}
    onAddEnemy={onAddEnemy}
  />
</CollapsibleSection>
```

Update the Tokens list to handle both types — hero tokens show type label, enemy tokens show icon + name:

```tsx
{tokens.map((t) => (
  <div
    key={t.id}
    className="group flex items-center gap-3 py-3 px-3.5 bg-bg-deep rounded-lg border border-transparent transition-all duration-150 hover:border-border-default hover:bg-bg-elevated"
  >
    {t.kind === "hero" ? (
      <>
        <div className="w-3.5 h-3.5 rounded-full shrink-0 bg-text-muted" />
        <span className="flex-1 text-sm text-text-primary capitalize">{t.heroType}</span>
      </>
    ) : (
      <>
        <span className="text-sm shrink-0">{t.icon}</span>
        <span className="flex-1 text-sm text-text-primary">{t.name}</span>
        <button
          onClick={() => onRemoveToken(t.id)}
          className="text-sm text-text-muted cursor-pointer opacity-0 group-hover:opacity-100 transition-all duration-150 hover:text-danger bg-transparent border-none"
        >
          ✕
        </button>
      </>
    )}
  </div>
))}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/SidePanel.tsx
git commit -m "feat: update SidePanel with HeroPicker and EnemyForm"
```

---

### Task 16: Update BattleMap and App

**Files:**
- Modify: `client/src/components/BattleMap.tsx`
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Update BattleMap to pass heroImages**

Add `heroImages` to the Props interface and pass it through to `TokenComponent`:

```tsx
import type { HeroType } from "../types.js";

interface Props {
  session: SessionState;
  heroImages: Record<HeroType, HTMLImageElement> | null;
  onMoveToken: (id: string, x: number, y: number) => void;
}
```

Update the `TokenComponent` usage in the render:

```tsx
{session.tokens.map((token) => (
  <TokenComponent
    key={token.id}
    token={token}
    gridSize={session.gridSize}
    heroImages={heroImages}
    onDragEnd={handleTokenDragEnd}
  />
))}
```

- [ ] **Step 2: Update App.tsx to wire everything together**

Add the hero images hook import:

```ts
import { useHeroImages } from "./hooks/useHeroImages.js";
```

Inside the `App` component, call the hook:

```ts
const heroImages = useHeroImages();
```

Update destructuring of `useSession` — replace `addToken` with `addHero`, `addEnemy`:

```ts
const { session, connected, error, saveStatus, addHero, addEnemy, moveToken, removeToken, updateGrid, saveSession } =
  useSession(socket, sessionId);
```

Update the BattleMap rendering to pass `heroImages`:

```tsx
<BattleMap session={session} heroImages={heroImages} onMoveToken={moveToken} />
```

Update the SidePanel rendering to pass new props:

```tsx
<SidePanel
  tokens={session.tokens}
  gridMode={session.gridMode}
  gridSize={session.gridSize}
  sessionId={session.id}
  onAddHero={addHero}
  onAddEnemy={addEnemy}
  onRemoveToken={removeToken}
  onUploadMap={handleUploadMap}
  onGridModeChange={handleGridModeChange}
  onGridSizeChange={handleGridSizeChange}
  visible={sidePanelVisible}
/>
```

- [ ] **Step 3: Commit**

```bash
git add client/src/components/BattleMap.tsx client/src/App.tsx
git commit -m "feat: wire up hero images and new token handlers in BattleMap and App"
```

---

### Task 17: Manual Smoke Test

- [ ] **Step 1: Start dev servers**

Run: `npm run dev`

- [ ] **Step 2: Test hero placement**

1. Create a new session
2. In side panel, click "Place Hero" section
3. Click the Warrior figurine — should appear on the map as the SVG
4. Click Warrior again in the picker — should be removed from the map
5. Place all 5 heroes — verify each has a distinct figurine look
6. Verify heroes are draggable and snap to grid when grid is enabled

- [ ] **Step 3: Test enemy placement**

1. In "Add Enemy" section, type "Goblin 1"
2. Select the goblin emoji icon
3. Pick a red color
4. Click "Add Enemy" — should appear on map as icon token with name plate
5. Add another enemy with a different icon
6. Test custom icon upload — click the upload button, select an image, verify it shows in the token

- [ ] **Step 4: Test multi-client sync**

1. Open the same session in a second browser tab
2. Place a hero in tab 1 — should appear in tab 2
3. Add an enemy in tab 2 — should appear in tab 1
4. Move tokens — should sync between tabs

- [ ] **Step 5: Test save/load**

1. Place heroes and enemies
2. Click Save
3. Refresh the page
4. Verify all tokens reload correctly with their types

- [ ] **Step 6: Commit final state if any fixes were needed**

```bash
git add -A
git commit -m "fix: smoke test fixes for figurine tokens"
```
