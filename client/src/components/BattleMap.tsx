import { useState, useRef, useEffect, useCallback } from "react";
import { Stage, Layer, Image as KonvaImage, Line, Circle, Group, Rect, Text } from "react-konva";
import type { SessionState, HeroType, AoeEffect, AoeType, AoeColor } from "../types.js";
import { TokenComponent } from "./Token.js";
import { GridOverlay } from "./GridOverlay.js";
import { AoeShapeComponent } from "./AoeShape.js";

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
  rulerActive?: boolean;
  aoeEffects?: AoeEffect[];
  aoeMode?: { type: AoeType; feet: number; color: AoeColor; originSize: 1 | 2 | 3 } | null;
  onPlaceAoe?: (x: number, y: number) => void;
  onMoveAoe?: (id: string, x: number, y: number) => void;
  onRotateAoe?: (id: string, rotation: number) => void;
  selectedAoeId?: string | null;
  onSelectAoe?: (id: string) => void;
  onDeselectAoe?: () => void;
}

export function BattleMap({ session, heroImages, onMoveToken, getViewCenterRef, getSpawnPosRef, activeTurnTokenId, rulerActive = false, aoeEffects = [], aoeMode = null, onPlaceAoe, onMoveAoe, onRotateAoe, selectedAoeId, onSelectAoe, onDeselectAoe }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [mapImage, setMapImage] = useState<HTMLImageElement | null>(null);

  // AoE placement preview
  const [aoePreviewPos, setAoePreviewPos] = useState<{ x: number; y: number } | null>(null);
  const aoeModeRef = useRef(aoeMode);
  const onPlaceAoeRef = useRef(onPlaceAoe);
  aoeModeRef.current = aoeMode;
  onPlaceAoeRef.current = onPlaceAoe;

  useEffect(() => {
    if (!aoeMode) setAoePreviewPos(null);
  }, [aoeMode]);

  // Ruler state
  const [rulerStart, setRulerStart] = useState<{ x: number; y: number } | null>(null);
  const [rulerEnd, setRulerEnd] = useState<{ x: number; y: number } | null>(null);
  const rulerStartRef = useRef<{ x: number; y: number } | null>(null);
  const rulerActiveRef = useRef(rulerActive);
  rulerStartRef.current = rulerStart;
  rulerActiveRef.current = rulerActive;

  // Clear ruler when deactivated and reset any in-progress gesture state
  useEffect(() => {
    if (!rulerActive) {
      setRulerStart(null);
      setRulerEnd(null);
      // Stop any Konva drag that may have been started by a lingering touch
      stageRef.current?.stopDrag();
      // Reset pinch tracking so the next 2-finger gesture starts clean
      isPinching.current = false;
      lastTouchDist.current = 0;
      lastTouchCenter.current = null;
    }
  }, [rulerActive]);

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

  /** Convert a native Touch to canvas (world) coordinates */
  const touchToCanvas = (touch: Touch) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const screenX = touch.clientX - rect.left;
    const screenY = touch.clientY - rect.top;
    return {
      x: (screenX - stagePosRef.current.x) / scaleRef.current,
      y: (screenY - stagePosRef.current.y) / scaleRef.current,
    };
  };

  const handleTouchStart = useCallback((e: any) => {
    if (e.evt.touches.length === 2) {
      const stage = e.target.getStage();
      // Sync our refs with the actual Konva stage state.
      // Konva's built-in drag (draggable=true) updates stage.x()/y() internally
      // without going through React state, so stagePosRef may be stale.
      // Reading directly here ensures the first handleTouchMove frame is correct.
      if (stage) {
        stagePosRef.current = { x: stage.x(), y: stage.y() };
        scaleRef.current = stage.scaleX();
      }
      isPinching.current = true;
      lastTouchDist.current = getTouchDist(e.evt.touches[0], e.evt.touches[1]);
      lastTouchCenter.current = getTouchCenter(e.evt.touches[0], e.evt.touches[1]);
      stage?.stopDrag();
    } else if (e.evt.touches.length === 1 && rulerActiveRef.current) {
      // Single-finger ruler: set start point or clear
      e.evt.preventDefault();
      const pos = touchToCanvas(e.evt.touches[0]);
      if (!rulerStartRef.current) {
        setRulerStart(pos);
        setRulerEnd(pos);
      } else {
        setRulerStart(null);
        setRulerEnd(null);
      }
    } else if (e.evt.touches.length === 1 && aoeModeRef.current) {
      // Single-finger AoE placement
      e.evt.preventDefault();
      const pos = touchToCanvas(e.evt.touches[0]);
      const snapped = snapAoeOriginRef.current(pos.x, pos.y, aoeModeRef.current.originSize ?? 1);
      onPlaceAoeRef.current?.(snapped.x, snapped.y);
    }
  }, []);

  const handleTouchMove = useCallback((e: any) => {
    if (e.evt.touches.length === 2) {
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
    } else if (e.evt.touches.length === 1 && rulerActiveRef.current && rulerStartRef.current) {
      // Single-finger ruler drag: update end point
      e.evt.preventDefault();
      const pos = touchToCanvas(e.evt.touches[0]);
      setRulerEnd(pos);
    }
  }, []);

  const handleTouchEnd = useCallback((e: any) => {
    if (e.evt.touches.length < 2) {
      isPinching.current = false;
      lastTouchDist.current = 0;
      lastTouchCenter.current = null;
    }
  }, []);

  // ── Top-layer mouse handlers (ruler + AoE placement) ─────────────────────
  const handleRulerMouseDown = useCallback((e: any) => {
    const stage = e.target.getStage();
    const pos = stage.getRelativePointerPosition();
    if (aoeModeRef.current) {
      const snapped = snapAoeOriginRef.current(pos.x, pos.y, aoeModeRef.current.originSize ?? 1);
      onPlaceAoeRef.current?.(snapped.x, snapped.y);
    } else {
      if (!rulerStartRef.current) {
        setRulerStart(pos);
        setRulerEnd(pos);
      } else {
        setRulerStart(null);
        setRulerEnd(null);
      }
    }
  }, []);

  const handleRulerMouseMove = useCallback((e: any) => {
    const stage = e.target.getStage();
    const pos = stage.getRelativePointerPosition();
    if (aoeModeRef.current) {
      const snapped = snapAoeOriginRef.current(pos.x, pos.y, aoeModeRef.current.originSize ?? 1);
      setAoePreviewPos(snapped);
    }
    if (rulerStartRef.current) setRulerEnd(pos);
  }, []);

  // ── Snapping ─────────────────────────────────────────────────────────────────
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

  // ── AOE snapping ──────────────────────────────────────────────────────────────
  const snapAoeOrigin = useCallback(
    (x: number, y: number, originSize: 1 | 2 | 3): { x: number; y: number } => {
      if (session.gridMode === "none") return { x, y };
      const gs = session.gridSize;
      if (session.gridMode === "square") {
        if (originSize === 2) {
          // 2×2: origin sits on a grid corner (intersection of 4 cells)
          return { x: Math.round(x / gs) * gs, y: Math.round(y / gs) * gs };
        }
        // 1×1 and 3×3: origin sits on a cell centre
        return { x: Math.floor(x / gs) * gs + gs / 2, y: Math.floor(y / gs) * gs + gs / 2 };
      }
      // Hex: snap to nearest hex centre (reuse existing logic)
      return snapToGrid(x, y, 1);
    },
    [session.gridMode, session.gridSize, snapToGrid]
  );

  const snapAoeOriginRef = useRef(snapAoeOrigin);
  snapAoeOriginRef.current = snapAoeOrigin;

  const aoeEffectsRef = useRef(aoeEffects);
  aoeEffectsRef.current = aoeEffects;

  const handleAoeDragEnd = useCallback(
    (id: string, x: number, y: number) => {
      const aoe = aoeEffectsRef.current.find((e) => e.id === id);
      const snapped = snapAoeOriginRef.current(x, y, aoe?.originSize ?? 1);
      onMoveAoe?.(id, snapped.x, snapped.y);
    },
    [onMoveAoe]
  );

  // ── Ruler distance ────────────────────────────────────────────────────────────
  const rulerFeet = (() => {
    if (!rulerStart || !rulerEnd) return 0;
    const dx = rulerEnd.x - rulerStart.x;
    const dy = rulerEnd.y - rulerStart.y;
    const pixelDist = Math.sqrt(dx * dx + dy * dy);
    // 1 grid cell = 5 ft.
    // Square: cell width = gridSize px.
    // Hex: adjacent center-to-center = gridSize × √3 px (circumradius → flat-to-flat distance).
    const cellPx =
      session.gridMode === "hex"
        ? session.gridSize * Math.sqrt(3)
        : session.gridSize;
    return Math.round((pixelDist / cellPx) * 5);
  })();

  const feetLabel = `${rulerFeet} ft`;
  const labelFontSize = 13 / scale;
  const labelW = Math.max(52, feetLabel.length * 9) / scale;
  const labelH = 24 / scale;

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        overflow: "hidden",
        background: "#0a0c07",
        touchAction: "none",
        cursor: (rulerActive || !!aoeMode) ? "crosshair" : "default",
      }}
    >
      <Stage
        ref={stageRef}
        width={dimensions.width}
        height={dimensions.height}
        x={stagePos.x}
        y={stagePos.y}
        scaleX={scale}
        scaleY={scale}
        draggable
        onDragStart={(e) => {
          if (rulerActive && e.target === e.target.getStage()) {
            e.target.stopDrag();
          }
        }}
        onDragEnd={(e) => {
          if (e.target === e.target.getStage()) {
            setStagePos({ x: e.target.x(), y: e.target.y() });
          }
        }}
        onClick={(e) => {
          if (e.target === e.target.getStage()) onDeselectAoe?.();
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

        {/* ── AoE shapes layer (below tokens) ──────────────────────────────── */}
        <Layer>
          {aoeEffects.map((aoe) => (
            <AoeShapeComponent
              key={aoe.id}
              aoe={aoe}
              gridSize={session.gridSize}
              scale={scale}
              onMove={handleAoeDragEnd}
              onRotate={onRotateAoe}
              onSelect={onSelectAoe}
              selected={selectedAoeId === aoe.id}
            />
          ))}
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

        {/* ── Top layer: interaction overlay + ruler + AoE preview ─────────── */}
        <Layer>
          {/* Transparent overlay: active when ruler or AoE placement is on */}
          {(rulerActive || !!aoeMode) && (
            <Rect
              x={-50000}
              y={-50000}
              width={100000}
              height={100000}
              fill="transparent"
              onMouseDown={handleRulerMouseDown}
              onMouseMove={handleRulerMouseMove}
            />
          )}

          {/* AoE ghost preview following the mouse */}
          {aoeMode && aoePreviewPos && (
            <AoeShapeComponent
              aoe={{
                id: "__aoe_preview__",
                type: aoeMode.type,
                feet: aoeMode.feet,
                x: aoePreviewPos.x,
                y: aoePreviewPos.y,
                rotation: 0,
                color: aoeMode.color,
                originSize: aoeMode.originSize,
              }}
              gridSize={session.gridSize}
              scale={scale}
              preview
            />
          )}

          {rulerStart && rulerEnd && (
            <Group listening={false}>
              {/* Dashed measurement line */}
              <Line
                points={[rulerStart.x, rulerStart.y, rulerEnd.x, rulerEnd.y]}
                stroke="#f6e05e"
                strokeWidth={2 / scale}
                dash={[10 / scale, 5 / scale]}
                lineCap="round"
              />
              {/* Start dot */}
              <Circle
                x={rulerStart.x}
                y={rulerStart.y}
                radius={5 / scale}
                fill="#f6e05e"
              />
              {/* End dot */}
              <Circle
                x={rulerEnd.x}
                y={rulerEnd.y}
                radius={5 / scale}
                fill="#f6e05e"
              />
              {/* Distance label at midpoint */}
              <Group
                x={(rulerStart.x + rulerEnd.x) / 2}
                y={(rulerStart.y + rulerEnd.y) / 2}
              >
                <Rect
                  x={-labelW / 2}
                  y={-labelH / 2}
                  width={labelW}
                  height={labelH}
                  fill="#1a1a1a"
                  stroke="#f6e05e"
                  strokeWidth={1 / scale}
                  cornerRadius={4 / scale}
                />
                <Text
                  text={feetLabel}
                  fontSize={labelFontSize}
                  fontStyle="bold"
                  fill="#f6e05e"
                  align="center"
                  verticalAlign="middle"
                  width={labelW}
                  height={labelH}
                  x={-labelW / 2}
                  y={-labelH / 2}
                />
              </Group>
            </Group>
          )}
        </Layer>
      </Stage>
    </div>
  );
}
