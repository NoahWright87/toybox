import type { PuzzlePreset } from "./puzzleImages";

export type Level = 0 | 1 | 2;

export const LEVEL_LABELS: readonly ["Easy", "Medium", "Hard"] = ["Easy", "Medium", "Hard"];

// Target piece counts indexed by pieceCount level
export const PIECE_COUNT_TARGETS: [number, number, number] = [12, 48, 108];

// Piece cell size (px) indexed by pieceCount level
export const CELL_SIZE: [number, number, number] = [72, 58, 46];

// Snap threshold (px) indexed by snapSensitivity level (0=wide, 2=precise)
export const SNAP_THRESHOLDS: [number, number, number] = [36, 18, 9];

// Rotation increment (degrees) indexed by rotationMode level
export const ROTATION_INCREMENTS: [0, 90, 10] = [0, 90, 10];

export type ImageSource =
  | { kind: "preset"; presetId: PuzzlePreset }
  | { kind: "custom" };

export interface JigsawConfig {
  imageSource: ImageSource;
  pieceCount: Level;      // 0≈12  1≈48  2≈108
  previewMode: Level;     // 0=ghost in field  1=separate corner box  2=none
  cutStyle: Level;        // 0=varied shapes  1=varied sizes  2=uniform
  rotationMode: Level;    // 0=fixed  1=90° increments  2=~10° free
  imageFilter: Level;     // 0=color  1=partial gray  2=grayscale
  snapSensitivity: Level; // 0=wide 36px  1=normal 18px  2=precise 9px
  timed: boolean;
}

export const DEFAULT_CONFIG: JigsawConfig = {
  imageSource: { kind: "preset", presetId: "arch" },
  pieceCount: 1,
  previewMode: 0,
  cutStyle: 1,
  rotationMode: 0,
  imageFilter: 0,
  snapSensitivity: 1,
  timed: true,
};

export function bestTimeKey(imageSource: ImageSource, pieceCount: Level): string {
  const imageKey = imageSource.kind === "preset" ? imageSource.presetId : "custom";
  return `${imageKey}:${pieceCount}`;
}

export function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
