import { HeroTokenComponent } from "./HeroToken.js";
import { EnemyTokenComponent } from "./EnemyToken.js";
import type { Token, HeroType } from "../types.js";

interface Props {
  token: Token;
  gridSize: number;
  heroImages: Record<HeroType, HTMLImageElement> | null;
  onDragEnd: (id: string, x: number, y: number) => void;
  isActiveTurn?: boolean;
}

export function TokenComponent({ token, gridSize, heroImages, onDragEnd, isActiveTurn }: Props) {
  if (token.kind === "hero") {
    if (!heroImages) return null;
    return (
      <HeroTokenComponent
        token={token}
        gridSize={gridSize}
        heroImages={heroImages}
        onDragEnd={onDragEnd}
        isActiveTurn={isActiveTurn}
      />
    );
  }
  return (
    <EnemyTokenComponent
      token={token}
      gridSize={gridSize}
      onDragEnd={onDragEnd}
      isActiveTurn={isActiveTurn}
    />
  );
}
