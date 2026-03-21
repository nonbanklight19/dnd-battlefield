import { useState, useRef, useEffect, useCallback } from "react";
import { Stage, Layer, Image as KonvaImage } from "react-konva";
import type { SessionState, Token as TokenType, GridMode } from "../types.js";
import { TokenComponent } from "./Token.js";
import { GridOverlay } from "./GridOverlay.js";

interface Props {
  session: SessionState;
  onMoveToken: (id: string, x: number, y: number) => void;
}

export function BattleMap({ session, onMoveToken }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [mapImage, setMapImage] = useState<HTMLImageElement | null>(null);

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
    <div ref={containerRef} style={{ flex: 1, overflow: "hidden", background: "#0f0f23" }}>
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
              onDragEnd={handleTokenDragEnd}
            />
          ))}
        </Layer>
      </Stage>
    </div>
  );
}
