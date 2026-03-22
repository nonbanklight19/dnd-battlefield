import { useState, useRef, useEffect, useCallback } from "react";
import { Stage, Layer, Image as KonvaImage } from "react-konva";
import type { SessionState, HeroType } from "../types.js";
import { TokenComponent } from "./Token.js";
import { GridOverlay } from "./GridOverlay.js";

interface Props {
  session: SessionState;
  heroImages: Record<HeroType, HTMLImageElement> | null;
  onMoveToken: (id: string, x: number, y: number) => void;
  getViewCenterRef?: React.MutableRefObject<() => { x: number; y: number }>;
  getSpawnPosRef?: React.MutableRefObject<() => { x: number; y: number }>;
}

export function BattleMap({ session, heroImages, onMoveToken, getViewCenterRef, getSpawnPosRef }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [mapImage, setMapImage] = useState<HTMLImageElement | null>(null);

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
    getSpawnPosRef.current = () => {
      const { width, height } = dimensionsRef.current;
      const { x, y } = stagePosRef.current;
      const s = scaleRef.current;
      const cx = (width / 2 - x) / s;
      const cy = (height / 2 - y) / s;

      const { gridMode, gridSize, tokens } = sessionRef.current;

      // No grid — just return center
      if (gridMode === "none") return { x: cx, y: cy };

      // Collect occupied cell centers
      const occupied = new Set(tokens.map((t) => `${Math.round(t.x)},${Math.round(t.y)}`));

      // Generate candidate grid positions by spiralling outward from center
      const candidates: { x: number; y: number }[] = [];

      if (gridMode === "square") {
        const cellX = Math.floor(cx / gridSize) * gridSize + gridSize / 2;
        const cellY = Math.floor(cy / gridSize) * gridSize + gridSize / 2;
        // Spiral through square cells
        for (let radius = 0; radius <= 20; radius++) {
          if (radius === 0) {
            candidates.push({ x: cellX, y: cellY });
          } else {
            for (let dx = -radius; dx <= radius; dx++) {
              for (let dy = -radius; dy <= radius; dy++) {
                if (Math.abs(dx) === radius || Math.abs(dy) === radius) {
                  candidates.push({ x: cellX + dx * gridSize, y: cellY + dy * gridSize });
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

  const snapToGrid = useCallback(
    (x: number, y: number): { x: number; y: number } => {
      if (session.gridMode === "none") return { x, y };
      const size = session.gridSize;
      if (session.gridMode === "square") {
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
      const snapped = snapToGrid(x, y);
      onMoveToken(id, snapped.x, snapped.y);
    },
    [snapToGrid, onMoveToken]
  );

  return (
    <div ref={containerRef} style={{ flex: 1, overflow: "hidden", background: "#0a0c07" }}>
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
            />
          ))}
        </Layer>
      </Stage>
    </div>
  );
}
