import { Line } from "react-konva";
import type { GridMode } from "../types.js";

interface Props {
  gridMode: GridMode;
  gridSize: number;
  width: number;
  height: number;
}

export function GridOverlay({ gridMode, gridSize, width, height }: Props) {
  if (gridMode === "none") return null;
  if (gridMode === "square") return <SquareGrid gridSize={gridSize} width={width} height={height} />;
  return <HexGrid gridSize={gridSize} width={width} height={height} />;
}

function SquareGrid({ gridSize, width, height }: { gridSize: number; width: number; height: number }) {
  const lines: JSX.Element[] = [];
  const stroke = "rgba(202, 169, 104, 0.35)";

  for (let x = 0; x <= width; x += gridSize) {
    lines.push(
      <Line key={`v${x}`} points={[x, 0, x, height]} stroke={stroke} strokeWidth={1.5} />
    );
  }
  for (let y = 0; y <= height; y += gridSize) {
    lines.push(
      <Line key={`h${y}`} points={[0, y, width, y]} stroke={stroke} strokeWidth={1.5} />
    );
  }
  return <>{lines}</>;
}

function HexGrid({ gridSize, width, height }: { gridSize: number; width: number; height: number }) {
  const lines: JSX.Element[] = [];
  const stroke = "rgba(202, 169, 104, 0.35)";
  const hexW = gridSize * Math.sqrt(3);
  const hexH = gridSize * 1.5;

  let idx = 0;
  for (let row = 0; row * hexH <= height + gridSize; row++) {
    for (let col = 0; col * hexW <= width + hexW; col++) {
      const offsetX = row % 2 === 0 ? 0 : hexW / 2;
      const cx = col * hexW + offsetX;
      const cy = row * hexH;

      const points: number[] = [];
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        points.push(cx + gridSize * Math.cos(angle), cy + gridSize * Math.sin(angle));
      }
      lines.push(
        <Line key={`hex${idx++}`} points={points} stroke={stroke} strokeWidth={1.5} closed />
      );
    }
  }
  return <>{lines}</>;
}
