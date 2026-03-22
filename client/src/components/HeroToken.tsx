import { Image as KonvaImage, Group } from "react-konva";
import type { HeroToken as HeroTokenType, HeroType } from "../types.js";

interface Props {
  token: HeroTokenType;
  gridSize: number;
  heroImages: Record<HeroType, HTMLImageElement>;
  onDragEnd: (id: string, x: number, y: number) => void;
}

export function HeroTokenComponent({ token, gridSize, heroImages, onDragEnd }: Props) {
  const image = heroImages[token.heroType];
  if (!image) return null;

  const targetSize = gridSize * token.size;
  const aspect = image.naturalWidth / image.naturalHeight;
  const width = aspect >= 1 ? targetSize : targetSize * aspect;
  const height = aspect >= 1 ? targetSize / aspect : targetSize;

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
      <KonvaImage
        image={image}
        width={width}
        height={height}
        offsetX={width / 2}
        offsetY={height / 2}
      />
    </Group>
  );
}
