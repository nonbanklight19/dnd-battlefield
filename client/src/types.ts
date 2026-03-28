export type GridMode = "none" | "square" | "hex";

export type Role = "dm" | "player";

export type TokenStatus = "dead";

export type HeroType = "warrior" | "wizard" | "rogue" | "dwarf" | "triton";

export type AoeType = "circle" | "cone" | "line" | "square";
export type AoeColor = "fire" | "cold" | "lightning" | "poison" | "necrotic" | "radiant" | "psychic";

export interface AoeEffect {
  id: string;
  type: AoeType;
  feet: number;
  x: number;
  y: number;
  rotation: number; // radians — meaningful for cone & line
  color: AoeColor;
  originSize: 1 | 2 | 3; // grid cells for the origin footprint (1×1, 2×2, 3×3)
}

export const HERO_TYPES: HeroType[] = ["warrior", "wizard", "rogue", "dwarf", "triton"];

export interface HeroConfig {
  heroType: HeroType;
  hp: number | null;
  ac: number | null;
}

export interface InitiativeRow {
  id: string;
  tokenId?: string;
  initiative: number | null;
  name: string;
  hp: number | null;
  ac: number | null;
}

export interface InitiativeState {
  rows: InitiativeRow[];
  activeIndex: number;
  round: number;
}

export interface HeroToken {
  id: string;
  kind: "hero";
  heroType: HeroType;
  x: number;
  y: number;
  size: number;
  statuses?: TokenStatus[];
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
  statuses?: TokenStatus[];
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
