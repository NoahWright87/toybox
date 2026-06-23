/**
 * Content / copy registry — "copy is an asset" (specs/content-and-assets.spec.md).
 *
 * All player-facing text lives here as data, referenced by key. Noah edits this;
 * systems never inline strings. Missing keys degrade gracefully (never throw).
 *
 * This is a minimal stub for the scaffold; F2 (#130) builds the full registry,
 * typed crowd-comment tags, token interpolation, and per-domain files.
 */

export const COPY = {
  "game.title": "SHMUP",
  "intro.presents": "Noahsoft presents:",
  "intro.sticker": "Works on Doors 97!",
} as const;

export type CopyKey = keyof typeof COPY;

/** Look up a line by key; returns a visible fallback rather than throwing. */
export function copy(key: CopyKey | string): string {
  return (COPY as Record<string, string>)[key] ?? `[missing: ${key}]`;
}
