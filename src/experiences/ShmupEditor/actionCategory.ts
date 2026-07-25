/**
 * Movement/attack/state-toggle categorization for an Action, purely for
 * `EncounterTimeline.tsx`'s marker coloring (design-handoff v3 §8.2: "each
 * read as visually distinct at a glance," with an invincible-setting
 * Action rendering as "a darker variant" of whatever category color
 * applies). Not a stored field — every category is derived from the
 * Action's own already-authored fields, same "derive, don't store"
 * approach as `actionState.ts`'s invincibility resolution.
 *
 * Attack takes priority over movement (a moving-and-firing Action reads
 * primarily as an attack on the timeline), movement over state (the state
 * category is only for an Action that neither moves nor fires — a pure
 * dwell/toggle, e.g. a submarine's "surface" beat).
 */
import type { ActionDef } from "./unitTypes";

export type ActionCategory = "movement" | "attack" | "state";

export function actionCategory(action: ActionDef | null | undefined): ActionCategory {
  if (!action) return "state";
  if (action.attack) return "attack";
  if (action.movementPercent > 0) return "movement";
  return "state";
}

interface CategoryColors {
  fill: string;
  border: string;
}

/** Movement stays the existing orange step color (no visual change for the common case); attack matches the existing Part-track marker red; state is new, using CLAUDE.md's purple secondary. */
const CATEGORY_COLORS: Record<ActionCategory, CategoryColors> = {
  movement: { fill: "#cc4400", border: "#ffcc88" },
  attack: { fill: "#990000", border: "#ff8844" },
  state: { fill: "#5b2d8e", border: "#c9a3f0" },
};

export function actionCategoryColors(action: ActionDef | null | undefined): CategoryColors {
  return CATEGORY_COLORS[actionCategory(action)];
}
