/**
 * Defensive shape validation for EncounterDef (specs/shmup-editor.todo.md,
 * E2 #192) — shared by tileStore.ts (encounters embedded in a saved tile)
 * and the tile-editing session draft. Same spirit as tileStore.ts's
 * isValidTileDef: a corrupt or stale-shape encounter (including a
 * hand-edited TILES.DAT/DRAFT.DAT, which this hackable app explicitly
 * permits per root CLAUDE.md) is rejected rather than crashing.
 */
import type {
  AttackPayload,
  BulletDef,
  DwellBehavior,
  EncounterDef,
  EncounterEnemy,
  EntranceAppearance,
  ExitConfig,
  GraphEdge,
  GraphNode,
  MovementBehavior,
} from "./encounterTypes";

// Bullet attack payloads can nest (a bullet's payload spawns another
// bullet, whose payload spawns another...) — this caps how deep a
// hand-edited save's nesting can go before validation just gives up and
// rejects it, rather than recursing unbounded on adversarial input. Far
// beyond anything the editor's own UI would ever author.
const MAX_PAYLOAD_DEPTH = 32;

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
  return isMovement(v) && (v as { kind: string }).kind !== "teleport";
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
    (n.exit === null || isExit(n.exit)) &&
    (n.entranceAppearance === null || isEntranceAppearance(n.entranceAppearance))
  );
}

function isGraphEdge(v: unknown): v is GraphEdge {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  return typeof e.id === "string" && typeof e.fromNodeId === "string" && typeof e.toNodeId === "string" && isMovement(e.movement) && (e.attack === null || isAttackPayload(e.attack, 0));
}

function isEncounterEnemy(v: unknown): v is EncounterEnemy {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.id === "string" &&
    typeof e.enemyDefId === "string" &&
    (e.entranceNodeId === null || typeof e.entranceNodeId === "string") &&
    Array.isArray(e.nodes) &&
    e.nodes.every(isGraphNode) &&
    Array.isArray(e.edges) &&
    e.edges.every(isGraphEdge)
  );
}

export function isValidEncounter(v: unknown): v is EncounterDef {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.id === "string" &&
    typeof e.name === "string" &&
    isNumber(e.weight) &&
    Array.isArray(e.enemies) &&
    e.enemies.every(isEncounterEnemy)
  );
}
