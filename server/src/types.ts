export type GridMode = "none" | "square" | "hex";

export interface Token {
  id: string;
  sessionId: string;
  name: string;
  color: string;
  x: number;
  y: number;
  size: number;
}

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
