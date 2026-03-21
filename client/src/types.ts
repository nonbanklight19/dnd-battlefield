export type GridMode = "none" | "square" | "hex";

export interface Token {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  size: number;
}

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
