/**
 * Enemy data model for the Shmup Editor (specs/shmup-editor.todo.md, E2 #192).
 * Deliberately self-contained — not imported from games/shmup/src/.
 *
 * An enemy is just a sprite + a handful of stats — sprite, HP, contact
 * damage, score value, base speed, hitbox size. It carries NO behavior of
 * its own: movement/dwell/attack are authored per encounter instead (see
 * encounterTypes.ts's `EncounterEnemy`), since the same enemy (e.g. a
 * "Skull Buggy") might move in a straight line in one tile's encounter and
 * spiral in another's — behavior is a property of how an enemy appears in
 * a specific encounter, not of the enemy's identity.
 */

export interface EnemyDef {
  id: string;
  name: string;
  spriteId: string;
  customSprite: string | null;
  hp: number;
  contactDamage: number;
  scoreValue: number;
  baseSpeed: number;
  /** Hitbox radius, px. */
  size: number;
  createdAt: number;
  modifiedAt: number;
}

export function makeEnemyId(): string {
  return `enemy-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createBlankEnemy(existingCount: number): EnemyDef {
  const now = Date.now();
  return {
    id: makeEnemyId(),
    name: `New Enemy ${existingCount + 1}`,
    spriteId: "none",
    customSprite: null,
    hp: 10,
    contactDamage: 1,
    scoreValue: 100,
    baseSpeed: 120,
    size: 16,
    createdAt: now,
    modifiedAt: now,
  };
}
