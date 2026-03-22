export type GridMode = "none" | "square" | "hex";

export type TokenStatus = "dead";

export type HeroType = "warrior" | "wizard" | "rogue" | "dwarf" | "triton";

export const HERO_TYPES: HeroType[] = ["warrior", "wizard", "rogue", "dwarf", "triton"];

export interface HeroConfig {
  heroType: HeroType;
  hp: number | null;
  ac: number | null;
}

export interface InitiativeRow {
  id: string;
  tokenId?: string;  // linked battlefield token id
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
  sessionId: string;
  kind: "hero";
  heroType: HeroType;
  x: number;
  y: number;
  size: number;
  statuses: TokenStatus[];
}

export interface EnemyToken {
  id: string;
  sessionId: string;
  kind: "enemy";
  name: string;
  color: string;
  icon: string;
  customImage?: string;
  x: number;
  y: number;
  size: number;
  statuses: TokenStatus[];
}

export type Token = HeroToken | EnemyToken;

export interface MapData {
  sessionId: string;
  imageUrl: string;
  width: number;
  height: number;
}

export interface Session {
  id: string;
  gridMode: GridMode;
  gridSize: number;
  createdAt: string;
  map: MapData | null;
  tokens: Token[];
}
