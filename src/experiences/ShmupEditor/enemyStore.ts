/**
 * fsStore-backed persistence for the enemy library + in-progress draft
 * (specs/shmup-editor.todo.md, E2 #192). Per root CLAUDE.md's mandatory
 * rule: anything that saves data uses the virtual filesystem, never raw
 * localStorage — mirrors tileStore.ts's ENEMIES.DAT pattern exactly.
 *
 * DRAFT.DAT is separate from ENEMIES.DAT and holds whichever enemy is
 * currently being edited, written after every meaningful graph change (not
 * just on explicit Save) — root CLAUDE.md's mandatory
 * in-progress-session-survives-reload rule applies here more than it did to
 * E1's tile form: a half-built multi-node enemy graph is a much bigger loss
 * on an accidental mobile rotation/reload than a half-picked edge tag.
 */
import { fsStore } from "../NsDoors97/filesystem/FileSystemStore";
import { SHMUP_EDITOR_ENEMIES_ID, SHMUP_EDITOR_ENEMY_DRAFT_ID } from "../NsDoors97/filesystem/types";
import type {
  AttackPayload,
  BranchCondition,
  BulletDef,
  DwellBehavior,
  EnemyDef,
  EntranceAppearance,
  ExitConfig,
  GraphEdge,
  GraphNode,
  MovementBehavior,
} from "./enemyTypes";

// Bullet attack payloads can nest (a bullet's payload spawns another
// bullet, whose payload spawns another...) — this caps how deep a
// hand-edited ENEMIES.DAT/DRAFT.DAT's nesting can go before validation just
// gives up and rejects it, rather than recursing unbounded on adversarial
// input. Far beyond anything the editor's own UI would ever author.
const MAX_PAYLOAD_DEPTH = 32;

const SAVE_VERSION = 1;

interface SavedLibrary {
  version: number;
  enemies: EnemyDef[];
}

interface SavedDraft {
  version: number;
  enemy: EnemyDef | null;
}

function isNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}
function isVec2(v: unknown): v is { x: number; y: number } {
  return typeof v === "object" && v !== null && isNumber((v as Record<string, unknown>).x) && isNumber((v as Record<string, unknown>).y);
}

function isMovement(v: unknown): v is MovementBehavior {
  if (typeof v !== "object" || v === null) return false;
  const m = v as Record<string, unknown>;
  switch (m.kind) {
    case "straightLine":
      return isNumber(m.speed) && isNumber(m.accel) && isNumber(m.turnRate);
    case "wave":
      return (
        isNumber(m.speed) &&
        isNumber(m.amplitude) &&
        isNumber(m.frequency) &&
        isNumber(m.phase) &&
        (m.waveform === "smooth" || m.waveform === "triangle" || m.waveform === "square")
      );
    case "spiral":
      return isNumber(m.speed) && isNumber(m.radius) && isNumber(m.angularSpeed) && isNumber(m.radiusGrowth);
    case "teleport":
      return isNumber(m.delay) && typeof m.telegraphAtDestination === "boolean";
    default:
      return false;
  }
}

function isBulletMovement(v: unknown): v is MovementBehavior {
  return isMovement(v) && v.kind !== "teleport";
}

function isDwell(v: unknown): v is DwellBehavior {
  if (typeof v !== "object" || v === null) return false;
  const d = v as Record<string, unknown>;
  if (typeof d.scrollLocked !== "boolean") return false;
  if (d.kind === "wait") return true;
  if (d.kind === "orbit") return isNumber(d.radius) && isNumber(d.angularSpeed);
  return false;
}

function isExit(v: unknown): v is ExitConfig {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  return (e.type === "leave" || e.type === "vanish" || e.type === "ram") && isNumber(e.direction);
}

function isEntranceAppearance(v: unknown): v is EntranceAppearance {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  return (
    (e.kind === "none" || e.kind === "appear") &&
    (e.style === "fade" || e.style === "shrink" || e.style === "rise") &&
    isNumber(e.durationMs)
  );
}

function isBranch(v: unknown): v is BranchCondition {
  if (typeof v !== "object" || v === null) return false;
  const b = v as Record<string, unknown>;
  return (b.trigger === "hp" || b.trigger === "time") && isNumber(b.threshold) && typeof b.targetNodeId === "string";
}

function isAttackPayload(v: unknown, depth: number): v is AttackPayload {
  if (depth > MAX_PAYLOAD_DEPTH) return false;
  if (typeof v !== "object" || v === null) return false;
  const a = v as Record<string, unknown>;
  return (
    typeof a.enabled === "boolean" &&
    (a.shape === "single" || a.shape === "arc" || a.shape === "radialBurst" || a.shape === "beam") &&
    (a.aim === "fixed" || a.aim === "aimed" || a.aim === "rotating") &&
    (a.trigger === "continuous" || a.trigger === "onDeath" || a.trigger === "onTrigger" || a.trigger === "onProximity") &&
    isNumber(a.projectileCount) &&
    isNumber(a.arcSpreadDeg) &&
    isNumber(a.fixedAngleDeg) &&
    isNumber(a.rotationSpeedDeg) &&
    isNumber(a.intervalMs) &&
    isNumber(a.telegraphMs) &&
    isNumber(a.proximityRadius) &&
    isBullet(a.bullet, depth + 1)
  );
}

function isBullet(v: unknown, depth: number): v is BulletDef {
  if (typeof v !== "object" || v === null) return false;
  const b = v as Record<string, unknown>;
  return (
    typeof b.spriteId === "string" &&
    (b.customSprite === null || typeof b.customSprite === "string") &&
    isBulletMovement(b.movement) &&
    (b.attack === null || isAttackPayload(b.attack, depth))
  );
}

function isGraphNode(v: unknown): v is GraphNode {
  if (typeof v !== "object" || v === null) return false;
  const n = v as Record<string, unknown>;
  return (
    typeof n.id === "string" &&
    isVec2(n.pos) &&
    (n.dwell === null || isDwell(n.dwell)) &&
    (n.attack === null || isAttackPayload(n.attack, 0)) &&
    (n.branch === null || isBranch(n.branch)) &&
    (n.exit === null || isExit(n.exit)) &&
    (n.entranceAppearance === null || isEntranceAppearance(n.entranceAppearance))
  );
}

function isGraphEdge(v: unknown): v is GraphEdge {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.id === "string" &&
    typeof e.fromNodeId === "string" &&
    typeof e.toNodeId === "string" &&
    isMovement(e.movement) &&
    (e.attack === null || isAttackPayload(e.attack, 0)) &&
    (e.branch === null || isBranch(e.branch))
  );
}

/** Defensive shape check (same spirit as tileStore.ts/MahjongSolitaire's loadSavedState) — a corrupt or stale-shape save falls back to an empty/null result rather than crashing. */
function isValidEnemyDef(v: unknown): v is EnemyDef {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.id === "string" &&
    typeof e.name === "string" &&
    typeof e.spriteId === "string" &&
    (e.customSprite === null || typeof e.customSprite === "string") &&
    (e.entranceNodeId === null || typeof e.entranceNodeId === "string") &&
    Array.isArray(e.nodes) &&
    e.nodes.every(isGraphNode) &&
    Array.isArray(e.edges) &&
    e.edges.every(isGraphEdge)
  );
}

export function loadEnemies(): EnemyDef[] {
  const content = fsStore.getFile(SHMUP_EDITOR_ENEMIES_ID)?.content;
  if (!content) return [];
  try {
    const parsed = JSON.parse(content) as SavedLibrary;
    if (parsed.version !== SAVE_VERSION || !Array.isArray(parsed.enemies)) return [];
    return parsed.enemies.filter(isValidEnemyDef);
  } catch {
    return [];
  }
}

export function saveEnemies(enemies: EnemyDef[]): void {
  const saved: SavedLibrary = { version: SAVE_VERSION, enemies };
  fsStore.writeFile(SHMUP_EDITOR_ENEMIES_ID, JSON.stringify(saved));
}

/** The in-progress enemy being edited, if a reload/rotation interrupted a session — null if there's nothing to resume. */
export function loadDraft(): EnemyDef | null {
  const content = fsStore.getFile(SHMUP_EDITOR_ENEMY_DRAFT_ID)?.content;
  if (!content) return null;
  try {
    const parsed = JSON.parse(content) as SavedDraft;
    if (parsed.version !== SAVE_VERSION) return null;
    return parsed.enemy && isValidEnemyDef(parsed.enemy) ? parsed.enemy : null;
  } catch {
    return null;
  }
}

export function saveDraft(enemy: EnemyDef): void {
  const saved: SavedDraft = { version: SAVE_VERSION, enemy };
  fsStore.writeFile(SHMUP_EDITOR_ENEMY_DRAFT_ID, JSON.stringify(saved));
}

export function clearDraft(): void {
  fsStore.writeFile(SHMUP_EDITOR_ENEMY_DRAFT_ID, "");
}
