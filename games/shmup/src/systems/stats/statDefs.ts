/**
 * The StatDef table — THE ground truth referenced by every other system
 * (stats.spec.md, combat.spec.todo.md). 16 main stats (level-up eligible)
 * + 6 exotic stats (weapons/items/shop only). Numeric constants come from the
 * tuning module; nothing here is a bare magic number.
 */
import { TUNING } from "../../tuning";
import type { StatDef, StatId } from "./types";

export const STAT_DEFS: Record<StatId, StatDef> = {
  // ── Offense ──────────────────────────────────────────────────────────────
  damage: {
    id: "damage",
    category: "offense",
    archetype: "unboundedMult",
    base: TUNING.stats.damageBase,
    unit: "multiplier",
    display: "Damage",
  },
  attackSpeed: {
    id: "attackSpeed",
    category: "offense",
    archetype: "unboundedMult",
    base: TUNING.stats.attackSpeedBase,
    unit: "multiplier",
    display: "Attack Speed",
  },
  // Crit chance is explicitly uncapped (combat.spec.todo.md): 250% = 2 guaranteed
  // crits + 50% chance of a 3rd. It accumulates like any unboundedMult stat;
  // the stochastic crit-count formula is applied downstream by combat (F6), not here.
  critChance: {
    id: "critChance",
    category: "offense",
    archetype: "unboundedMult",
    base: TUNING.combat.critChance,
    unit: "percent",
    display: "Crit Chance",
  },
  critDamage: {
    id: "critDamage",
    category: "offense",
    archetype: "unboundedMult",
    base: TUNING.combat.critDamage,
    unit: "percent",
    display: "Crit Damage",
  },

  // ── Defense ──────────────────────────────────────────────────────────────
  maxHp: {
    id: "maxHp",
    category: "defense",
    archetype: "unboundedMult",
    base: TUNING.stats.maxHpBase,
    min: 1,
    unit: "flat",
    display: "Max HP",
  },
  armor: {
    id: "armor",
    category: "defense",
    archetype: "hyperbolic",
    base: 0,
    K: TUNING.combat.armorK,
    min: 0,
    max: 1,
    unit: "percent",
    display: "Armor",
  },
  // max: 1 is a defensive clamp, not the reachable ceiling — raw/(raw+K) is
  // strictly < 1 for any finite raw >= 0, so 100% evasion is asymptotically
  // unreachable by the formula itself. The clamp only guards pathological
  // inputs (e.g. a negative K from a future tuning typo).
  evasion: {
    id: "evasion",
    category: "defense",
    archetype: "hyperbolic",
    base: TUNING.combat.evasion,
    K: TUNING.combat.evasionK,
    min: 0,
    max: 1,
    unit: "percent",
    display: "Evasion",
  },
  maxShield: {
    id: "maxShield",
    category: "defense",
    archetype: "flat",
    base: 0,
    min: 0,
    unit: "flat",
    display: "Max Shield",
  },
  hpRegen: {
    id: "hpRegen",
    category: "defense",
    archetype: "flat",
    base: 0,
    min: 0,
    unit: "flat",
    display: "HP Regen",
  },
  lifesteal: {
    id: "lifesteal",
    category: "defense",
    archetype: "unboundedMult",
    base: 0,
    min: 0,
    unit: "percent",
    display: "Lifesteal",
  },

  // ── Mobility ─────────────────────────────────────────────────────────────
  // Additive flat, geometry-capped (stats.spec.md) — the scene clamps the
  // ship to screen bounds; no numeric max is asserted at the stat layer.
  playerSpeed: {
    id: "playerSpeed",
    category: "mobility",
    archetype: "flat",
    base: TUNING.stats.playerSpeedBase,
    min: 0,
    unit: "px",
    display: "Player Speed",
  },
  // Raw accumulated value; combat (F6 #134) runs it through two separate
  // hyperbolic channels (bullets, movement) using TUNING.combat.reflexBulletK /
  // reflexMoveK — see the note on those constants.
  reflexes: {
    id: "reflexes",
    category: "mobility",
    archetype: "unboundedMult",
    base: 0,
    min: 0,
    unit: "percent",
    display: "Reflexes",
  },

  // ── Economy ──────────────────────────────────────────────────────────────
  // unboundedMult itself isn't exponential: within one category, bonuses add
  // (+10% + +10% = +20%); only stacking bonuses across many different
  // categories compounds multiplicatively. Crit chance "feels" explosive
  // because combat (F6) interprets the raw percentage as guaranteed-crit
  // counts above 100% — that interpretation is downstream of the stat, not
  // a property of the archetype. Luck/Credit Score get no such downstream
  // amplification, so their growth stays as flat as the modifiers granting
  // them (mostly single-category item/upgrade bonuses) make it.
  luck: {
    id: "luck",
    category: "economy",
    archetype: "unboundedMult",
    base: 0,
    unit: "percent",
    display: "Luck",
  },
  creditScore: {
    id: "creditScore",
    category: "economy",
    archetype: "unboundedMult",
    base: 0,
    unit: "percent",
    display: "Credit Score",
  },
  expGain: {
    id: "expGain",
    category: "economy",
    archetype: "unboundedMult",
    base: TUNING.stats.expGainBase,
    unit: "multiplier",
    display: "EXP Gain",
  },
  magnetRadius: {
    id: "magnetRadius",
    category: "economy",
    archetype: "flat",
    base: TUNING.stats.magnetRadiusBase,
    min: 0,
    unit: "px",
    display: "Magnet Radius",
  },

  // ── Exotic (weapons/items/shop only — never offered at level-up) ─────────
  pierce: {
    id: "pierce",
    category: "exotic",
    archetype: "unboundedMult",
    base: 0,
    min: 0,
    unit: "percent",
    display: "Pierce",
  },
  bounce: {
    id: "bounce",
    category: "exotic",
    archetype: "unboundedMult",
    base: 0,
    min: 0,
    unit: "percent",
    display: "Bounce",
  },
  fork: {
    id: "fork",
    category: "exotic",
    archetype: "flat",
    base: 0,
    min: 0,
    unit: "flat",
    display: "Fork",
  },
  chain: {
    id: "chain",
    category: "exotic",
    archetype: "flat",
    base: 0,
    min: 0,
    unit: "flat",
    display: "Chain",
  },
  blastRadius: {
    id: "blastRadius",
    category: "exotic",
    archetype: "flat",
    base: 0,
    min: 0,
    unit: "px",
    display: "Blast Radius",
  },
  homingStrength: {
    id: "homingStrength",
    category: "exotic",
    archetype: "unboundedMult",
    base: 0,
    min: 0,
    unit: "percent",
    display: "Homing Strength",
  },
};
