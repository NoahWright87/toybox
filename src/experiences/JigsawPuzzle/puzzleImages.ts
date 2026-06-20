// Built-in puzzle images reuse the same source art as the desktop
// wallpapers. We use the "-original" (non-dithered) versions for the
// puzzle itself so pieces have crisp detail, and the "-degraded" (1997
// 256-color) versions as small settings-screen thumbnails for consistency
// with the Display settings app.

import archUrl from "../NsDoors97/wallpapers/arch-original.png";
import sunsetUrl from "../NsDoors97/wallpapers/sunset-original.png";
import archThumbUrl from "../NsDoors97/wallpapers/arch-degraded.png";
import sunsetThumbUrl from "../NsDoors97/wallpapers/sunset-degraded.png";

export type PuzzlePreset = "arch" | "sunset";

export const PUZZLE_PRESETS: PuzzlePreset[] = ["arch", "sunset"];

export const PUZZLE_PRESET_URLS: Record<PuzzlePreset, string> = {
  arch: archUrl,
  sunset: sunsetUrl,
};

export const PUZZLE_PRESET_THUMB_URLS: Record<PuzzlePreset, string> = {
  arch: archThumbUrl,
  sunset: sunsetThumbUrl,
};

export const PUZZLE_PRESET_LABELS: Record<PuzzlePreset, string> = {
  arch: "Desert Arch",
  sunset: "Sunset",
};
