/**
 * "Play this in the actual game" — the editor's half of the handoff.
 *
 * The game is a separately-built bundle served full-page at `/shmup/`, so
 * this is a real page navigation, the same crossing `SHMUP.EXE` already
 * makes from NS-TOS. The request rides in the query string
 * (`games/shmup/src/scenes/playtestRequest.ts` parses it), which keeps it
 * linkable and reloadable — the game's "play again" button is literally a
 * page reload.
 *
 * Callers are expected to have **persisted** whatever they're about to play
 * before calling: the game reads the saved `TILES.DAT`/`LEVEL.DAT`, not the
 * editor's in-memory draft, so an unsaved edit would simply not be there.
 */

/**
 * Where the game bundle is served from. Spelled out to `index.html` rather
 * than the bare `/shmup/` that `SHMUP.EXE` uses: a static host resolves
 * both, but Vite's dev server answers a bare directory path with the Doors
 * app's own SPA fallback instead of the game — which would make the whole
 * editor->game handoff untestable locally for no reason.
 */
const GAME_URL = "/shmup/index.html";

/**
 * Difficulty a playtest launches at when the caller has nothing better to
 * offer. Deliberately non-zero: `resolveScaling` floors an instance's count
 * at zero, so a run below an instance's Unit's cost (unitTypes.ts's
 * UnitDef.cost) correctly spawns nothing at all, which reads as "it's
 * broken" the first time you see it.
 */
export const DEFAULT_PLAYTEST_DIFFICULTY = 10;

function launch(params: URLSearchParams): void {
  window.location.href = `${GAME_URL}?${params.toString()}`;
}

/** Plays one specific Encounter, on its own tile, as a level of one. */
export function playtestEncounter(tileId: string, encounterId: string, difficulty = DEFAULT_PLAYTEST_DIFFICULTY): void {
  launch(new URLSearchParams({ playtest: "encounter", tile: tileId, encounter: encounterId, difficulty: String(Math.round(difficulty)) }));
}

/**
 * Plays the whole layout the Connection Viewer last saved. No ids in the
 * URL — the game reads `LEVEL.DAT`, so the link stays valid while the
 * layout behind it changes, and each tile rolls its own Encounter the way
 * a real level does.
 */
export function playtestLevel(difficulty = DEFAULT_PLAYTEST_DIFFICULTY): void {
  launch(new URLSearchParams({ playtest: "level", difficulty: String(Math.round(difficulty)) }));
}
