/**
 * Combat (F6 #134) consumes the F3 stat schema for the damage/defense
 * pipeline (combat.spec.todo.md). No parallel stat definitions here.
 */
import type { StatBlock } from "../stats";

export type DamageStats = Pick<StatBlock, "damage" | "critChance" | "critDamage">;

/** armor/evasion arrive already hyperbolic-transformed by computeStats() — they ARE the mitigation/dodge fractions. */
export type DefenseStats = Pick<StatBlock, "armor" | "evasion">;

/** Mutable combat state for one ship (player or — in principle — any future shielded enemy). */
export interface Defender {
  hp: number;
  shield: number;
  /** Seconds remaining before shield regen resumes; reset to TUNING.combat.shieldRegenDelay on any non-dodged hit. */
  shieldRegenDelayRemaining: number;
}

export interface ApplyDamageResult {
  dodged: boolean;
  shieldDamage: number;
  hpDamage: number;
  defeated: boolean;
}
