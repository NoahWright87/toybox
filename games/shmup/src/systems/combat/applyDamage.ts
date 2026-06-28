/**
 * Defense pipeline (combat.spec.todo.md), incoming hit, no hull lives:
 *   1. EVASION  chance = Evasion/(Evasion+Ke) -> dodged => 0 damage
 *   2. SHIELD   absorbs at FULL value, armor IGNORED: shield -= HIT
 *   3. OVERFLOW past shield continues down
 *   4. ARMOR    mitigates overflow only: toHP = overflow * (1 - Armor/(Armor+Ka))
 *   5. HP       -= toHP -> HP <= 0 ends the episode (run-structure.spec.todo.md)
 *
 * `evasion` and `armor` arrive already hyperbolic-transformed by F3's
 * computeStats() (stats.spec.md: archetype "hyperbolic", effective =
 * raw/(raw+K)) — they ARE the dodge chance / mitigation fraction already,
 * so this module never touches a K constant itself.
 */
import { TUNING } from "../../tuning";
import type { ApplyDamageResult, Defender } from "./types";

export function rollEvasion(evasion: number, rng: () => number = Math.random): boolean {
  return rng() < evasion;
}

export function applyDamage(
  defender: Defender,
  hit: number,
  armor: number,
  evasion: number,
  rng: () => number = Math.random
): ApplyDamageResult {
  if (rollEvasion(evasion, rng)) {
    return { dodged: true, shieldDamage: 0, hpDamage: 0, defeated: false };
  }

  let remaining = hit;
  let shieldDamage = 0;
  if (defender.shield > 0) {
    shieldDamage = Math.min(defender.shield, remaining);
    defender.shield -= shieldDamage;
    remaining -= shieldDamage;
  }

  const hpDamage = remaining * (1 - armor);
  defender.hp = Math.max(0, defender.hp - hpDamage);
  defender.shieldRegenDelayRemaining = TUNING.combat.shieldRegenDelay;

  return { dodged: false, shieldDamage, hpDamage, defeated: defender.hp <= 0 };
}

/** Shield regen ticks down its delay, then refills as a fraction of maxShield/s (combat.spec.todo.md). Called once per frame. */
export function tickShieldRegen(defender: Defender, maxShield: number, dt: number): void {
  if (defender.shieldRegenDelayRemaining > 0) {
    defender.shieldRegenDelayRemaining = Math.max(0, defender.shieldRegenDelayRemaining - dt);
    return;
  }
  if (defender.shield >= maxShield) return;
  defender.shield = Math.min(maxShield, defender.shield + maxShield * TUNING.combat.shieldRegenFracPerSecond * dt);
}
