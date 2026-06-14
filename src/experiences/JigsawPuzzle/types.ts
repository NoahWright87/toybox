import type { PuzzlePreset } from "./puzzleImages";

export type Difficulty = "easy" | "medium" | "hard";

export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

export const DIFFICULTY_TARGET_PIECES: Record<Difficulty, number> = {
  easy: 12,
  medium: 48,
  hard: 108,
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Easy (~12 pieces)",
  medium: "Medium (~48 pieces)",
  hard: "Hard (~108 pieces)",
};

// Roughly-square cell size in px, scaled down for harder puzzles so the
// assembled board doesn't get unwieldy.
export const CELL_SIZE: Record<Difficulty, number> = {
  easy: 72,
  medium: 58,
  hard: 46,
};

export type ImageSource =
  | { kind: "preset"; presetId: PuzzlePreset }
  | { kind: "custom" };

export interface JigsawConfig {
  imageSource: ImageSource;
  difficulty: Difficulty;
  timed: boolean;
}

export const DEFAULT_CONFIG: JigsawConfig = {
  imageSource: { kind: "preset", presetId: "arch" },
  difficulty: "medium",
  timed: true,
};

export function bestTimeKey(imageSource: ImageSource, difficulty: Difficulty): string {
  const imageKey = imageSource.kind === "preset" ? imageSource.presetId : "custom";
  return `${imageKey}:${difficulty}`;
}

export function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
