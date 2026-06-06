export interface BoardWall {
  x: number;
  y: number;
  w: number;
  h: number;
  angle?: number; // radians
}

export interface BoardBumper {
  x: number;
  y: number;
  r: number;
  label?: string;
}

export interface BoardPost {
  x: number;
  y: number;
  r: number;
}

export interface BoardFlipper {
  side: "left" | "right";
  pivotX: number;
  pivotY: number;
  length: number;
}

export interface BoardSlingshot {
  x: number;
  y: number;
  w: number;
  h: number;
  angle?: number;
}

export interface BoardTarget {
  x: number;
  y: number;
  w: number;
  h: number;
  angle?: number;
  label?: string;
}

export interface BoardPlunger {
  x: number;
  topY: number;
  bottomY: number;
  launchPower?: number; // multiplier on max launch velocity (default 1.0)
}

export interface BoardRailPoint {
  x: number;
  y: number;
}

export interface BoardRail {
  points: BoardRailPoint[];
  magnetStrength: number; // 0 = off, 0.3 = subtle, 1.0 = strong
  captureRadius: number;  // px beyond physical walls where capture pull begins
}

export interface Board {
  width: number;
  height: number;
  walls: BoardWall[];
  bumpers: BoardBumper[];
  posts: BoardPost[];
  flippers: BoardFlipper[];
  slingshots: BoardSlingshot[];
  targets: BoardTarget[];
  plunger: BoardPlunger;
  ballStartX: number;
  ballStartY: number;
  rails?: BoardRail[];
}
