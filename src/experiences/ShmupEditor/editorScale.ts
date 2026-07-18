/**
 * "How big is one footprint slot, in editor world-coordinate units" — a
 * single shared constant every file that needs a default distance
 * relative to a tile reads, instead of each independently guessing a
 * number that happened to look right against whatever the others picked.
 * That's exactly how the editor drifted out of scale in the first place:
 * `EncounterEditor.tsx` had its own local `TILE_UNIT = 130`,
 * `encounterSteps.ts` had its own `DEFAULT_NEXT_OFFSET` tuned to match it
 * by hand, `unitScaling.ts` had its own default shape-handle sizes tuned
 * to match it by hand — nothing enforced they stayed in sync, and 130 was
 * never anchored to anything real to begin with. Noah's report: "units
 * are half their size" — a fixed 56px authoring icon reads as huge next
 * to a 130px-wide tile.
 *
 * Anchored to `games/shmup/src/config.ts`'s real `GAME_WIDTH` (720) — a
 * 1x1 tile now represents roughly one real screen's width, not an
 * arbitrary editor-only number, the same "tie the editor to real
 * gameplay scale" reasoning `hitboxPreview.ts` already applies to the
 * camera-bounds preview. Same "no shared code with the game" stance as
 * the rest of the editor: independently declared, not imported.
 */
export const TILE_UNIT = 720;
