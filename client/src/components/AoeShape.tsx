import { Group, Line, Circle, Rect } from "react-konva";
import type { AoeEffect, AoeColor } from "../types.js";

// D&D 5e cone: width at the far end equals the length → half-angle = atan(0.5)
const CONE_HALF = Math.atan(0.5);

export const AOE_COLOR_HEX: Record<AoeColor, string> = {
  fire:      "#ea580c",
  cold:      "#3b82f6",
  lightning: "#eab308",
  poison:    "#22c55e",
  necrotic:  "#a855f7",
  radiant:   "#e2e8f0",
  psychic:   "#ec4899",
};

export const AOE_COLOR_MAP: Record<AoeColor, { fill: string; stroke: string }> = {
  fire:      { fill: "rgba(234,88,12,0.22)",   stroke: "rgba(234,88,12,0.9)"   },
  cold:      { fill: "rgba(59,130,246,0.22)",  stroke: "rgba(59,130,246,0.9)"  },
  lightning: { fill: "rgba(234,179,8,0.22)",   stroke: "rgba(234,179,8,0.9)"   },
  poison:    { fill: "rgba(34,197,94,0.22)",   stroke: "rgba(34,197,94,0.9)"   },
  necrotic:  { fill: "rgba(168,85,247,0.22)",  stroke: "rgba(168,85,247,0.9)"  },
  radiant:   { fill: "rgba(226,232,240,0.15)", stroke: "rgba(226,232,240,0.9)" },
  psychic:   { fill: "rgba(236,72,153,0.22)",  stroke: "rgba(236,72,153,0.9)"  },
};

interface Props {
  aoe: AoeEffect;
  gridSize: number;
  scale: number;
  onMove?: (id: string, x: number, y: number) => void;
  onRotate?: (id: string, rotation: number) => void;
  onSelect?: (id: string) => void;
  selected?: boolean;
  preview?: boolean;
}

export function AoeShapeComponent({ aoe, gridSize, scale, onMove, onRotate, onSelect, selected = false, preview = false }: Props) {
  const { type, feet, rotation: r, color } = aoe;
  const c = AOE_COLOR_MAP[color];
  // 1 grid cell = gridSize px = 5 ft
  const L = (feet / 5) * gridSize;
  const sw = 2 / scale;
  const hr = 7 / scale; // handle radius (constant on screen)
  const draggable = !preview && !!onMove;

  // ── Origin footprint geometry ───────────────────────────────────────────────
  const os = aoe.originSize ?? 1;
  // halfEdge: distance from origin centre to the footprint edge (px)
  const halfEdge = (os * gridSize) / 2;
  // The AOE body starts at the footprint edge and extends L px beyond it.
  const handleR = halfEdge + L; // arc radius for rotation handle (distance from origin)

  // ── Shape body ──────────────────────────────────────────────────────────────
  let body: React.ReactNode;
  let hitArea: React.ReactNode = null;
  let handle: React.ReactNode = null;

  if (type === "circle") {
    const R = halfEdge + L;
    body = <Circle radius={R} fill={c.fill} stroke={c.stroke} strokeWidth={sw} listening={false} />;
    if (draggable) hitArea = <Circle radius={R} fill="rgba(0,0,0,0.001)" />;

  } else if (type === "square") {
    // Square extends L beyond the footprint on every side
    const half = halfEdge + L / 2;
    body = (
      <Rect
        x={-half} y={-half} width={half * 2} height={half * 2}
        fill={c.fill} stroke={c.stroke} strokeWidth={sw}
        listening={false}
      />
    );
    if (draggable) hitArea = <Rect x={-half} y={-half} width={half * 2} height={half * 2} fill="rgba(0,0,0,0.001)" />;

  } else if (type === "cone") {
    // Apex sits on the footprint edge, far corners at handleR from origin
    const ax = halfEdge * Math.cos(r), ay = halfEdge * Math.sin(r);
    const pts = [
      ax, ay,
      ax + L * Math.cos(r - CONE_HALF), ay + L * Math.sin(r - CONE_HALF),
      ax + L * Math.cos(r + CONE_HALF), ay + L * Math.sin(r + CONE_HALF),
    ];
    body = <Line points={pts} closed fill={c.fill} stroke={c.stroke} strokeWidth={sw} listening={false} />;
    if (draggable) hitArea = <Line points={pts} closed fill="rgba(0,0,0,0.001)" />;

    if (!preview && onRotate) {
      handle = (
        <Circle
          x={handleR * Math.cos(r)} y={handleR * Math.sin(r)}
          radius={hr} fill="white" opacity={0.85}
          draggable
          onMouseEnter={(e) => { e.target.getStage()!.container().style.cursor = "crosshair"; }}
          onMouseLeave={(e) => { e.target.getStage()!.container().style.cursor = draggable ? "grab" : "default"; }}
          onDragStart={(e) => { e.cancelBubble = true; }}
          onDragMove={(e) => {
            e.cancelBubble = true;
            const angle = Math.atan2(e.target.y(), e.target.x());
            e.target.position({ x: handleR * Math.cos(angle), y: handleR * Math.sin(angle) });
            onRotate(aoe.id, angle);
          }}
          onDragEnd={(e) => { e.cancelBubble = true; }}
        />
      );
    }

  } else {
    // line — 5 ft wide (one cell), starts at footprint edge, extends L
    const hw = gridSize / 2;
    const sx = halfEdge * Math.cos(r),    sy = halfEdge * Math.sin(r);
    const ex = handleR * Math.cos(r),     ey = handleR * Math.sin(r);
    const px = -Math.sin(r) * hw,         py = Math.cos(r) * hw;
    const pts = [sx + px, sy + py, ex + px, ey + py, ex - px, ey - py, sx - px, sy - py];
    body = <Line points={pts} closed fill={c.fill} stroke={c.stroke} strokeWidth={sw} listening={false} />;
    if (draggable) hitArea = <Line points={pts} closed fill="rgba(0,0,0,0.001)" />;

    if (!preview && onRotate) {
      handle = (
        <Circle
          x={ex} y={ey}
          radius={hr} fill="white" opacity={0.85}
          draggable
          onMouseEnter={(e) => { e.target.getStage()!.container().style.cursor = "crosshair"; }}
          onMouseLeave={(e) => { e.target.getStage()!.container().style.cursor = draggable ? "grab" : "default"; }}
          onDragStart={(e) => { e.cancelBubble = true; }}
          onDragMove={(e) => {
            e.cancelBubble = true;
            const angle = Math.atan2(e.target.y(), e.target.x());
            e.target.position({ x: handleR * Math.cos(angle), y: handleR * Math.sin(angle) });
            onRotate(aoe.id, angle);
          }}
          onDragEnd={(e) => { e.cancelBubble = true; }}
        />
      );
    }
  }

  const setCursor = (cursor: string) => (e: any) => {
    e.target.getStage()?.container().style.setProperty("cursor", cursor);
  };

  // ── Origin footprint rect (drawn behind the AOE body) ───────────────────────
  const fo = -halfEdge;
  const fw = halfEdge * 2;

  return (
    <Group
      x={aoe.x} y={aoe.y}
      opacity={preview ? 0.45 : 1}
      draggable={draggable}
      shadowBlur={selected ? 18 / scale : 0}
      shadowColor={c.stroke}
      shadowOpacity={selected ? 0.9 : 0}
      onMouseEnter={draggable ? setCursor("grab") : undefined}
      onMouseLeave={draggable ? setCursor("default") : undefined}
      onDragStart={draggable ? setCursor("grabbing") : undefined}
      onDragEnd={draggable && onMove ? (e) => {
        setCursor("grab")(e);
        onMove(aoe.id, e.target.x(), e.target.y());
      } : undefined}
      onClick={!preview && onSelect ? (e) => {
        e.cancelBubble = true;
        onSelect(aoe.id);
      } : undefined}
    >
      {/* Origin footprint — drawn behind the AOE body */}
      <Rect
        x={fo} y={fo} width={fw} height={fw}
        fill={c.fill}
        stroke={c.stroke}
        strokeWidth={sw}
        dash={[4 / scale, 2 / scale]}
        listening={false}
      />
      {body}
      {/* Transparent hit area so the Group can be dragged from anywhere inside the shape */}
      {hitArea}
      {/* Origin anchor dot */}
      {!preview && <Circle radius={4 / scale} fill={c.stroke} listening={false} />}
      {handle}
    </Group>
  );
}

