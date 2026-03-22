import { useRef, useEffect } from "react";
import { Image as KonvaImage, Group, Line, Circle } from "react-konva";
import Konva from "konva";
import type { HeroToken as HeroTokenType, HeroType } from "../types.js";

interface Props {
  token: HeroTokenType;
  gridSize: number;
  heroImages: Record<HeroType, HTMLImageElement>;
  onDragEnd: (id: string, x: number, y: number) => void;
  isActiveTurn?: boolean;
}

export function HeroTokenComponent({ token, gridSize, heroImages, onDragEnd, isActiveTurn }: Props) {
  const image = heroImages[token.heroType];
  if (!image) return null;

  const targetSize = gridSize * token.size;
  const aspect = image.naturalWidth / image.naturalHeight;
  const width = aspect >= 1 ? targetSize : targetSize * aspect;
  const height = aspect >= 1 ? targetSize / aspect : targetSize;
  const isDead = token.statuses?.includes("dead") ?? false;
  const crossR = Math.min(width, height) * 0.35;
  const ringR = Math.min(width, height) / 2 + 5;

  const ringRef = useRef<Konva.Circle | null>(null);
  const animRef = useRef<Konva.Animation | null>(null);

  useEffect(() => {
    const ring = ringRef.current;
    if (!ring) return;
    if (isActiveTurn) {
      let t = 0;
      animRef.current = new Konva.Animation((frame) => {
        if (!frame) return;
        t = frame.time / 600;
        const opacity = 0.5 + 0.5 * Math.sin(t * Math.PI * 2);
        ring.opacity(opacity);
      }, ring.getLayer());
      animRef.current.start();
    } else {
      animRef.current?.stop();
      animRef.current = null;
      ring.opacity(0);
      ring.getLayer()?.batchDraw();
    }
    return () => { animRef.current?.stop(); animRef.current = null; };
  }, [isActiveTurn]);

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
      {/* Active turn ring */}
      <Circle
        ref={ringRef}
        radius={ringR}
        stroke="#f6e05e"
        strokeWidth={3}
        fill="transparent"
        opacity={0}
        listening={false}
      />
      <KonvaImage
        image={image}
        width={width}
        height={height}
        offsetX={width / 2}
        offsetY={height / 2}
      />
      {isDead && (
        <>
          <Circle radius={Math.min(width, height) / 2} fill="rgba(0,0,0,0.45)" listening={false} />
          <Line
            points={[-crossR, -crossR, crossR, crossR]}
            stroke="#e53e3e"
            strokeWidth={Math.max(2, crossR * 0.25)}
            lineCap="round"
            listening={false}
          />
          <Line
            points={[crossR, -crossR, -crossR, crossR]}
            stroke="#e53e3e"
            strokeWidth={Math.max(2, crossR * 0.25)}
            lineCap="round"
            listening={false}
          />
        </>
      )}
    </Group>
  );
}
