import { Circle, Text, Group } from "react-konva";
import type { Token } from "../types.js";

interface Props {
  token: Token;
  gridSize: number;
  onDragEnd: (id: string, x: number, y: number) => void;
}

export function TokenComponent({ token, gridSize, onDragEnd }: Props) {
  const radius = (gridSize * token.size) / 2.5;

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
        fill={token.color}
        stroke="white"
        strokeWidth={2}
        shadowColor="black"
        shadowBlur={4}
        shadowOpacity={0.5}
      />
      <Text
        text={token.name}
        fontSize={Math.max(10, radius * 0.7)}
        fill="white"
        align="center"
        verticalAlign="middle"
        offsetX={radius}
        offsetY={Math.max(10, radius * 0.7) / 2}
        width={radius * 2}
        listening={false}
      />
    </Group>
  );
}
