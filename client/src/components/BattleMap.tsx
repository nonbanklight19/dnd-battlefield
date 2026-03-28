import { useState, useRef, useEffect, useCallback } from "react";
import { Stage, Layer, Image as KonvaImage } from "react-konva";
import type { SessionState, HeroType } from "../types.js";
import { TokenComponent } from "./Token.js";
import { GridOverlay } from "./GridOverlay.js";

// Returns true when a token size multiplier corresponds to an even number of grid cells.
// size=1 → ~1 cell (odd), size=2.4 → ~2 cells (even), size=3.5 → ~3 cells (odd)
function isEvenCellToken(tokenSize: number): boolean {
  const cells = Math.round((tokenSize / 2.5) * 2);
  return cells % 2 === 0;
}

interface Props {
  session: SessionState;
  heroImages: Record<HeroType, HTMLImageElement> | null;
  onMoveToken: (id: string, x: number, y: number) => void;
  getViewCenterRef?: React.MutableRefObject<() => { x: number; y: number }>;
  getSpawnPosRef?: React.MutableRefObject<(tokenSize?: number) => { x: number; y: number }>;
  activeTurnTokenId?: string | null;
}

export function BattleMap({ session, heroImages, onMoveToken, getViewCenterRef, getSpawnPosRef, activeTurnTokenId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [mapImage, setMapImage] = useState<HTMLImageElement | null>(null);

  // Pinch-to-zoom touch state
  const lastTouchDist = useRef(0);
  const lastTouchCenter = useRef<{ x: number; y: number } | null>(null);
  const isPinching = useRef(false);

  // Keep refs so getViewCenter always reads latest values
  const stagePosRef = useRef(stagePos);
  const scaleRef = useRef(scale);
  const dimensionsRef = useRef(dimensions);
  const sessionRef = useRef(session);
  stagePosRef.current = stagePos;
  scaleRef.current = scale;
  dimensionsRef.current = dimensions;
  sessionRef.current = session;

  useEffect(() => {
    if (getViewCenterRef) {
      getViewCenterRef.current = () => {
        const { width, height } = dimensionsRef.current;
        const { x, y } = stagePosRef.current;
        const s = scaleRef.current;
        return {
          x: (width / 2 - x) / s,
          y: (height / 2 - y) / s,
        };
      };
    }
  }, [getViewCenterRef]);

  useEffect(() => {
    if (!getSpawnPosRef) return;
    getSpawnPosRef.current = (tokenSize = 1) => {
      const { width, height } = dimensionsRef.current;
      const { x, y } = stagePosRef.current;
      const s = scaleRef.current;
      const cx = (width / 2 - x) / s;
      const cy = (height / 2 - y) / s;

      const { gridMode, gridSize, tokens } = sessionRef.current;

      // No grid — just return center
      if (gridMode === "none") return { x: cx, y: cy };

      const evenCell = isEvenCellToken(tokenSize);

      // Collect occupied positions
      const occupied = new Set(tokens.map((t) => `${Math.round(t.x)},${Math.round(t.y)}`));

      // Generate candidate grid positions by spiralling outward from center
      const candidates: { x: number; y: number }[] = [];

      if (gridMode === "square") {
        // Even-cell tokens (2×2) snap to corners; odd-cell tokens snap to cell centers
        const originX = evenCell
          ? Math.round(cx / gridSize) * gridSize
          : Math.floor(cx / gridSize) * gridSize + gridSize / 2;
        const originY = evenCell
          ? Math.round(cy / gridSize) * gridSize
          : Math.floor(cy / gridSize) * gridSize + gridSize / 2;
        // Spiral through grid positions
        for (let radius = 0; radius <= 20; radius++) {
          if (radius === 0) {
            candidates.push({ x: originX, y: originY });
          } else {
            for (let dx = -radius; dx <= radius; dx++) {
              for (let dy = -radius; dy <= radius; dy++) {
                if (Math.abs(dx) === radius || Math.abs(dy) === radius) {
                  candidates.push({ x: originX + dx * gridSize, y: originY + dy * gridSize });
                }
              }
            }
          }
        }
      } else {
        // Hex grid — spiral through axial coordinates
        const hexW = gridSize * Math.sqrt(3);
        const hexH = gridSize * 1.5;
        // Convert center to nearest hex axial coords
        const q0 = (Math.sqrt(3) / 3 * cx - cy / 3) / gridSize;
        const r0 = (2 / 3 * cy) / gridSize;
        const s0 = -q0 - r0;
        let rq = Math.round(q0), rr = Math.round(r0), rs = Math.round(s0);
        if (Math.abs(rq - q0) > Math.abs(rr - r0) && Math.abs(rq - q0) > Math.abs(rs - s0)) rq = -rr - rs;
        else if (Math.abs(rr - r0) > Math.abs(rs - s0)) rr = -rq - rs;
        else rs = -rq - rr;

        const axialToPixel = (aq: number, ar: number) => {
          const col = aq + (ar - (ar & 1)) / 2;
          const row = ar;
          const offsetX = row % 2 === 0 ? 0 : hexW / 2;
          return { x: col * hexW + offsetX, y: row * hexH };
        };

        // BFS-style ring spiral in axial coords
        const dirs = [[1,-1,0],[1,0,-1],[0,1,-1],[-1,1,0],[-1,0,1],[0,-1,1]];
        candidates.push(axialToPixel(rq, rr));
        for (let radius = 1; radius <= 20; radius++) {
          let hq = rq + dirs[4][0] * radius;
          let hr = rr + dirs[4][1] * radius;
          for (let side = 0; side < 6; side++) {
            for (let step = 0; step < radius; step++) {
              candidates.push(axialToPixel(hq, hr));
              hq += dirs[side][0];
              hr += dirs[side][1];
            }
          }
        }
      }

      // Return first candidate not occupied
      for (const c of candidates) {
        const key = `${Math.round(c.x)},${Math.round(c.y)}`;
        if (!occupied.has(key)) return c;
      }

      return { x: cx, y: cy };
    };
  }, [getSpawnPosRef]);


  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  useEffect(() => {
    if (!session.map?.imageUrl) {
      setMapImage(null);
      return;
    }
    const img = new window.Image();
    img.src = session.map.imageUrl;
    img.onload = () => setMapImage(img);
  }, [session.map?.imageUrl]);

  const handleWheel = useCallback((e: any) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = Math.min(Math.max(oldScale + direction * 0.1, 0.1), 5);
    setScale(newScale);
    setStagePos({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  }, []);

  const getTouchDist = (t1: Touch, t2: Touch) =>
    Math.sqrt(Math.pow(t2.clientX - t1.clientX, 2) + Math.pow(t2.clientY - t1.clientY, 2));

  const getTouchCenter = (t1: Touch, t2: Touch) => ({
    x: (t1.clientX + t2.clientX) / 2,
    y: (t1.clientY + t2.clientY) / 2,
  });

  const handleTouchStart = useCallback((e: any) => {
    if (e.evt.touches.length === 2) {
      isPinching.current = true;
      lastTouchDist.current = getTouchDist(e.evt.touches[0], e.evt.touches[1]);
      lastTouchCenter.current = getTouchCenter(e.evt.touches[0], e.evt.touches[1]);
      // Stop one-finger drag so it doesn't fight with the pinch
      e.target.getStage()?.stopDrag();
    }
  }, []);

  const handleTouchMove = useCallback((e: any) => {
    if (e.evt.touches.length !== 2) return;
    e.evt.preventDefault();

    const touch1 = e.evt.touches[0];
    const touch2 = e.evt.touches[1];
    const dist = getTouchDist(touch1, touch2);
    const center = getTouchCenter(touch1, touch2);
    const prevCenter = lastTouchCenter.current ?? center;
    const oldScale = scaleRef.current;
    const oldPos = stagePosRef.current;

    const scaleBy = dist / (lastTouchDist.current || dist);
    const newScale = Math.min(Math.max(oldScale * scaleBy, 0.1), 5);

    // Point under the pinch center (in canvas coords)
    const pointTo = {
      x: (center.x - oldPos.x) / oldScale,
      y: (center.y - oldPos.y) / oldScale,
    };

    // Pan delta from two-finger translation
    const dx = center.x - prevCenter.x;
    const dy = center.y - prevCenter.y;

    const newPos = {
      x: center.x - pointTo.x * newScale + dx,
      y: center.y - pointTo.y * newScale + dy,
    };

    setScale(newScale);
    setStagePos(newPos);
    lastTouchDist.current = dist;
    lastTouchCenter.current = center;
  }, []);

  const handleTouchEnd = useCallback((e: any) => {
    if (e.evt.touches.length < 2) {
      isPinching.current = false;
      lastTouchDist.current = 0;
      lastTouchCenter.current = null;
    }
  }, []);

  const snapToGrid = useCallback(
    (x: number, y: number, tokenSize = 1): { x: number; y: number } => {
      if (session.gridMode === "none") return { x, y };
      const size = session.gridSize;
      if (session.gridMode === "square") {
        if (isEvenCellToken(tokenSize)) {
          // Snap center to nearest grid corner/intersection
          return {
            x: Math.round(x / size) * size,
            y: Math.round(y / size) * size,
          };
        }
        // Snap center to nearest cell center (1×1, 3×3, …)
        return {
          x: Math.floor(x / size) * size + size / 2,
          y: Math.floor(y / size) * size + size / 2,
        };
      }
      // Hex grid snapping via cube coordinates (flat-top hexes)
      const hexW = size * Math.sqrt(3);
      const hexH = size * 1.5;
      const q = (Math.sqrt(3) / 3 * x - y / 3) / size;
      const r = (2 / 3 * y) / size;
      const s = -q - r;
      let rq = Math.round(q);
      let rr = Math.round(r);
      let rs = Math.round(s);
      const dq = Math.abs(rq - q);
      const dr = Math.abs(rr - r);
      const ds = Math.abs(rs - s);
      if (dq > dr && dq > ds) {
        rq = -rr - rs;
      } else if (dr > ds) {
        rr = -rq - rs;
      } else {
        rs = -rq - rr;
      }
      // Axial to odd-row offset, then to pixel
      const col = rq + (rr - (rr & 1)) / 2;
      const row = rr;
      const offsetX = row % 2 === 0 ? 0 : hexW / 2;
      return { x: col * hexW + offsetX, y: row * hexH };
    },
    [session.gridMode, session.gridSize]
  );

  const handleTokenDragEnd = useCallback(
    (id: string, x: number, y: number) => {
      const token = session.tokens.find((t) => t.id === id);
      const tokenSize = token?.size ?? 1;
      const snapped = snapToGrid(x, y, tokenSize);
      onMoveToken(id, snapped.x, snapped.y);
    },
    [snapToGrid, onMoveToken, session.tokens]
  );

  return (
    <div ref={containerRef} style={{ flex: 1, overflow: "hidden", background: "#0a0c07", touchAction: "none" }}>
      <Stage
        width={dimensions.width}
        height={dimensions.height}
        x={stagePos.x}
        y={stagePos.y}
        scaleX={scale}
        scaleY={scale}
        draggable
        onDragEnd={(e) => {
          if (e.target === e.target.getStage()) {
            setStagePos({ x: e.target.x(), y: e.target.y() });
          }
        }}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <Layer>
          {mapImage && (
            <KonvaImage
              image={mapImage}
              width={session.map?.width || mapImage.width}
              height={session.map?.height || mapImage.height}
            />
          )}
        </Layer>
        <Layer>
          <GridOverlay
            gridMode={session.gridMode}
            gridSize={session.gridSize}
            width={session.map?.width || mapImage?.width || 2000}
            height={session.map?.height || mapImage?.height || 2000}
          />
        </Layer>
        <Layer>
          {session.tokens.map((token) => (
            <TokenComponent
              key={token.id}
              token={token}
              gridSize={session.gridSize}
              heroImages={heroImages}
              onDragEnd={handleTokenDragEnd}
              isActiveTurn={activeTurnTokenId === token.id}
            />
          ))}
        </Layer>
      </Stage>
    </div>
  );
}
