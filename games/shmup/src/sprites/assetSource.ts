import { getSpriteOverrideUrl } from "./fsOverride";

/**
 * Every PNG currently checked into assets/sprites/, keyed by its import
 * specifier. Vite resolves this at build time, so dropping a new file into
 * assets/sprites/{category}/ and pointing a manifest entry's `path` at it
 * is a data-only change — no code change, no re-glob step.
 */
const BUNDLED_SPRITES = import.meta.glob("../assets/sprites/**/*.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

function bundledUrl(relativePath: string): string | undefined {
  return BUNDLED_SPRITES[`../assets/sprites/${relativePath}`];
}

/**
 * Resolves a manifest entry's relative path to a loadable URL: an FS
 * override wins if present, otherwise the bundled PNG if one has been
 * dropped in, otherwise undefined (meaning: render the placeholder).
 */
export function resolveSpriteUrl(relativePath: string): string | undefined {
  return getSpriteOverrideUrl(relativePath) ?? bundledUrl(relativePath);
}
