import { useState, useEffect } from "react";
import { Circle, Text, Group, Rect, Image as KonvaImage } from "react-konva";
import Konva from "konva";
import type { EnemyToken as EnemyTokenType } from "../types.js";

interface Props {
  token: EnemyTokenType;
  gridSize: number;
  onDragEnd: (id: string, x: number, y: number) => void;
}

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
            filters={[Konva.Filters.Invert]}
            ref={(node) => { if (node) node.cache(); }}
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
    </Group>
  );
}
