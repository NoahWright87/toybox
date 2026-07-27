/**
 * "How big is one footprint slot, in editor world-coordinate units" — a
 * single shared constant every file that needs a default distance relative
 * to a tile reads (`encounterSteps.ts`'s default step offset,
 * `unitScaling.ts`'s default shape handles, `EncounterEditor.tsx`'s
 * canvas), instead of each independently guessing a number that happened to
 * look right against whatever the others picked. That's exactly how the
 * editor drifted out of scale in the first place: three files with three
 * hand-matched constants and nothing enforcing they stayed in sync.
 *
 * It used to declare its own `720`, chosen by hand to match the game's
 * `GAME_WIDTH`. It no longer declares anything — a number the editor picks
 * to match the game is a number that drifts from the game, which is the
 * same failure one level up. It now re-exports the game's own constant from
 * `games/shmup/src/systems/encounters/scrollModel.ts`, the one module the
 * two packages genuinely share (see its header for why the tile size and
 * the level scroll speed in particular can't be mirrored). That module has
 * no imports of its own beyond the playfield size, so pulling it into the
 * Doors bundle costs nothing.
 */
export { TILE_UNIT } from "../../../games/shmup/src/systems/encounters/scrollModel";
