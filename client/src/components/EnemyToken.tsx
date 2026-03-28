import { useState, useEffect, useRef } from "react";
import { Circle, Text, Group, Rect, Image as KonvaImage, Line } from "react-konva";
import Konva from "konva";
import type { EnemyToken as EnemyTokenType } from "../types.js";

interface Props {
  token: EnemyTokenType;
  gridSize: number;
  onDragEnd: (id: string, x: number, y: number) => void;
  isActiveTurn?: boolean;
}

const imageCache = new Map<string, HTMLImageElement>();

export function EnemyTokenComponent({ token, gridSize, onDragEnd, isActiveTurn }: Props) {
  const radius = (gridSize * token.size) / 2.5;
  const [customImg, setCustomImg] = useState<HTMLImageElement | null>(null);
  const ringRef = useRef<Konva.Circle | null>(null);
  const animRef = useRef<Konva.Animation | null>(null);

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

  useEffect(() => {
    const ring = ringRef.current;
    if (!ring) return;
    if (isActiveTurn) {
      animRef.current = new Konva.Animation((frame) => {
        if (!frame) return;
        const opacity = 0.5 + 0.5 * Math.sin((frame.time / 600) * Math.PI * 2);
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

  // Name plate always uses the same size as a 1×1 token regardless of token.size
  const nameFontSize = Math.max(8, gridSize * 0.2);
  const plateWidth = Math.max(radius * 2, token.name.length * nameFontSize * 0.6);
  const plateHeight = nameFontSize + 6;
  const isDead = token.statuses?.includes("dead") ?? false;

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
        radius={radius + 6}
        stroke="#f6e05e"
        strokeWidth={3}
        fill="transparent"
        opacity={0}
        listening={false}
      />
      <Circle
        radius={radius}
        fill="transparent"
        shadowColor="black"
        shadowBlur={6}
        shadowOpacity={0.5}
        shadowOffsetY={2}
      />
      <Circle
        radius={radius}
        stroke={token.color}
        strokeWidth={3}
        fill="#1a1a1a"
      />
      <Circle
        radius={radius - 4}
        fill="#111"
      />
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
            filters={token.customImage?.startsWith("/uploads/") ? [Konva.Filters.Invert] : undefined}
            ref={(node) => { if (node && token.customImage?.startsWith("/uploads/")) node.cache({ pixelRatio: 3 }); }}
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
      {isDead && (
        <>
          <Circle radius={radius} fill="rgba(0,0,0,0.45)" listening={false} />
          <Line
            points={[-(radius * 0.6), -(radius * 0.6), radius * 0.6, radius * 0.6]}
            stroke="#e53e3e"
            strokeWidth={Math.max(2, radius * 0.18)}
            lineCap="round"
            listening={false}
          />
          <Line
            points={[radius * 0.6, -(radius * 0.6), -(radius * 0.6), radius * 0.6]}
            stroke="#e53e3e"
            strokeWidth={Math.max(2, radius * 0.18)}
            lineCap="round"
            listening={false}
          />
        </>
      )}
    </Group>
  );
}
