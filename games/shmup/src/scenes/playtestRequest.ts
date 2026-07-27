/**
 * The handoff from `/shmup-editor` into the game.
 *
 * The editor is a route in the Doors 97 React app and the game is a
 * separately-built bundle at `/shmup/`, so "play this" is a real page
 * navigation — the same way `SHMUP.EXE` already launches from NS-TOS. The
 * request rides in the query string, which makes it linkable, reloadable,
 * and trivially inspectable when something doesn't play the way it looked
 * in the editor.
 *
 *     /shmup/?playtest=encounter&tile=<tileId>&encounter=<encId>&difficulty=10
 *     /shmup/?playtest=level&difficulty=10
 *
 * A level request carries no ids: it plays whatever layout the Connection
 * Viewer last saved to `LEVEL.DAT`, so the URL stays stable while the
 * layout behind it changes.
 */

export type PlaytestRequest =
  | { kind: "encounter"; tileId: string; encounterId: string; difficulty: number }
  | { kind: "level"; difficulty: number };

/** Fallback when a request arrives with no usable Difficulty. Never 0 — `scaling.ts` spawns nothing there. */
export const PLAYTEST_DEFAULT_DIFFICULTY = 10;

/**
 * An absent or unparseable `difficulty` falls back; an explicit `0` is
 * honoured. The two have to be told apart by hand, because `Number(null)`
 * and `Number("")` are both `0` — so a URL with no difficulty at all would
 * otherwise read as Difficulty 0, which spawns nothing whatsoever
 * (`scaling.ts`) and looks exactly like broken content.
 */
function parseDifficulty(raw: string | null): number {
  if (raw === null || raw.trim() === "") return PLAYTEST_DEFAULT_DIFFICULTY;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : PLAYTEST_DEFAULT_DIFFICULTY;
}

/** Reads a playtest request out of a query string, or null if this is an ordinary launch. */
export function parsePlaytestRequest(search: string): PlaytestRequest | null {
  const params = new URLSearchParams(search);
  const kind = params.get("playtest");
  const difficulty = parseDifficulty(params.get("difficulty"));

  if (kind === "level") return { kind: "level", difficulty };
  if (kind === "encounter") {
    const tileId = params.get("tile");
    const encounterId = params.get("encounter");
    if (!tileId || !encounterId) return null;
    return { kind: "encounter", tileId, encounterId, difficulty };
  }
  return null;
}

/** The request this page was opened with, if any. */
export function currentPlaytestRequest(): PlaytestRequest | null {
  if (typeof window === "undefined") return null;
  return parsePlaytestRequest(window.location.search);
}

/** Where "back to the editor" goes. The editor is a route in the main Doors 97 app, not part of this bundle. */
export const EDITOR_URL = "/shmup-editor";
