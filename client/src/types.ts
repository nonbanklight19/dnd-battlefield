export type GridMode = "none" | "square" | "hex";

export type HeroType = "warrior" | "wizard" | "rogue" | "dwarf" | "triton";

export interface HeroToken {
  id: string;
  kind: "hero";
  heroType: HeroType;
  x: number;
  y: number;
  size: number;
}

export interface EnemyToken {
  id: string;
  kind: "enemy";
  name: string;
  color: string;
  icon: string;
  customImage?: string;
  x: number;
  y: number;
  size: number;
}

export type Token = HeroToken | EnemyToken;

export interface MapData {
  imageUrl: string;
  width: number;
  height: number;
}

export interface SessionState {
  id: string;
  gridMode: GridMode;
  gridSize: number;
  map: MapData | null;
  tokens: Token[];
}
