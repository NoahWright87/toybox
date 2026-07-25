import Phaser from "phaser";
import { TUNING } from "../../tuning";
import { GAME_WIDTH, GAME_HEIGHT } from "../../config";
import { AuthoredUnit } from "../../entities/AuthoredUnit";
import { editorSpriteTextureKey } from "../../sprites/editorArt";
import { dueShots, isTelegraphing } from "./attacks";
import { instanceHeadingDegAt, instanceStateAt, invincibleAt, lastAuthoredTime, resolveFacingDeg } from "./movement";
import { applyPingPong, resolveScaling, resolveScalingSlots, spawnDelayOffsetsSec } from "./scaling";
import { toScreen, type TileFrame } from "./frame";
import { EDITOR_PART_BOX, facingToRotation, partScaleFor, unitDisplaySize } from "./spriteScale";
import type {
  AuthoredAction,
  AuthoredAttack,
  AuthoredCollisionGroup,
  AuthoredContent,
  AuthoredEncounter,
  AuthoredEncounterUnit,
  AuthoredPart,
  AuthoredPartActionPlacement,
  AuthoredStep,
  AuthoredTile,
  AuthoredUnitDef,
  Vec2,
} from "./authoredTypes";

/**
 * Plays one authored Encounter in the real engine.
 *
 * Everything here is driven by the encounter's **one shared clock**, in
 * seconds from the moment the encounter engages — the same clock the
 * editor's timeline scrubber shows. A placed instance appears when that
 * clock reaches its first step, walks its authored bezier path, and its
 * Actions (the base track read off the steps, plus one independent track
 * per Part) turn into facing, invincibility, and fire.
 *
 * Three properties of the authored model shape this file more than
 * anything else:
 *
 * 1. **A projectile is a Unit.** Firing spawns another live instance with
 *    its own stats, art, Parts and Actions, so a bullet that splits, homes,
 *    or shoots back needs no special case — `spawnProjectile` recurses
 *    through the same code path as everything else.
 * 2. **A step's `time` is already derived** from arc length and speed at
 *    authoring time, and persisted. The runner interpolates the curve
 *    against those stored times rather than re-deriving them, so playback
 *    can't drift away from the timeline the author actually scrubbed.
 * 3. **Difficulty is one currency all the way down.** An instance resolves
 *    its own count/power from the incoming Difficulty and hands `power` on
 *    to whatever it spawns. (`power` has no stat effect yet — the authored
 *    model reserves it, and threading it through now is what lets that
 *    land as a data change later.)
 *
 * Positions are **tile-local** throughout, converted through `frame` only
 * at the point of touching a sprite. A single-tile playtest holds that
 * frame still; scrolling it is what turns this into a level, and nothing
 * else here has to change for that.
 */

/** Depth per authored layer, keeping ground clutter under air traffic and both under the player (depth 10). */
const LAYER_DEPTH: Record<string, number> = { doodad: 1, ground: 2, air: 4 };
const PART_DEPTH_OFFSET = 1;
const PROJECTILE_DEPTH = 6;

/** Alpha applied to a firing anchor during an attack's telegraph wind-up — the runtime read of the editor timeline's telegraph colour. */
const TELEGRAPH_ALPHA = 0.55;

/** Tracks how far through an Action's attack one firing anchor has already fired, so no shot is ever emitted twice. */
interface AttackTrack {
  /** Which Action is currently running here — a change restarts the schedule. */
  actionId: string | null;
  /** Encounter time (sec) the current Action started at. */
  startedAtSec: number;
  /** Milliseconds of that Action's own timeline already resolved into shots. */
  firedThroughMs: number;
}

function freshTrack(): AttackTrack {
  return { actionId: null, startedAtSec: 0, firedThroughMs: 0 };
}

interface LivePart {
  def: AuthoredPart;
  /** Null when the Part has neither art nor a hitbox — a pure logical anchor for its own Actions, which is what the default "Main" Part is on most Units. */
  entity: AuthoredUnit | null;
  /** This Part's own placements, ascending by time. */
  placements: AuthoredPartActionPlacement[];
  track: AttackTrack;
  /** Screen position, refreshed each frame from the hull's position plus its rotated offset. */
  pos: Vec2;
}

interface LiveInstance {
  entity: AuthoredUnit;
  def: AuthoredUnitDef;
  /** A hand-placed instance's authored path, already offset to its scaling slot. Null for a dynamically spawned one. */
  steps: AuthoredStep[] | null;
  /** When a placed instance's path ends — after this it's finished travelling and may be culled once off screen. */
  pathEndSec: number;
  /** The Action a dynamically spawned instance runs (its `defaultActionId`). Null for a placed one, which reads its Action off each step. */
  spawnedAction: AuthoredAction | null;
  /** Encounter time (sec) this instance's own local clock started at. */
  startSec: number;
  /** The Difficulty share this instance passes on to whatever it spawns. */
  power: number;
  /** Multiplier from the spawning attack's `spawnScale`; 1 for a placed instance. */
  scale: number;
  facingDeg: number;
  track: AttackTrack;
  parts: LivePart[];
  collisionGroup: AuthoredCollisionGroup;
}

/** One placed instance's resolved scaling slot, waiting for the clock to reach its first step. */
interface PendingPlacement {
  placement: AuthoredEncounterUnit;
  def: AuthoredUnitDef;
  steps: AuthoredStep[];
  startSec: number;
  power: number;
}

export interface EncounterRunnerConfig {
  scene: Phaser.Scene;
  content: AuthoredContent;
  tile: AuthoredTile;
  encounter: AuthoredEncounter;
  /** Incoming Difficulty budget — the currency every instance's scaling resolves against. */
  difficulty: number;
  frame: TileFrame;
  /** Groups the scene has already wired its collision overlaps against. */
  hostiles: Phaser.Physics.Arcade.Group;
  friendlies: Phaser.Physics.Arcade.Group;
  /** Where the player currently is, in screen space, for `facePlayer`. */
  playerPos: () => Vec2;
  /** Texture key used when an authored sprite id resolves to nothing loadable. */
  fallbackTexture: string;
}

export class EncounterRunner {
  private readonly config: EncounterRunnerConfig;
  private pending: PendingPlacement[];
  private readonly live: LiveInstance[] = [];
  private clockSec = 0;
  /** The last moment anything authored is scheduled to happen — when the encounter has nothing left to start. */
  private readonly authoredEndSec: number;

  constructor(config: EncounterRunnerConfig) {
    this.config = config;
    this.pending = this.resolvePlacements();
    this.authoredEndSec = this.pending.reduce(
      (max, p) => Math.max(max, p.startSec + lastAuthoredTime(p.steps, p.placement.partActions)),
      0
    );
  }

  /** Encounter time in seconds — the same clock the editor's timeline scrubber shows. */
  get elapsedSec(): number {
    return this.clockSec;
  }

  /** The last authored moment, for a progress readout. */
  get authoredDurationSec(): number {
    return this.authoredEndSec;
  }

  /** How many hand-placed instances are still alive. Projectiles don't count — they aren't what you have to clear. */
  get liveEnemyCount(): number {
    return this.live.reduce((n, i) => (i.steps !== null && i.entity.active ? n + 1 : n), 0);
  }

  /**
   * True once every authored moment has passed, the grace period for
   * in-flight shots is over, and nothing hand-placed is left on the field.
   * A placed instance whose final step parks it on screen keeps this false
   * on purpose — clearing the field is what playing an encounter *through*
   * means.
   */
  get complete(): boolean {
    return (
      this.pending.length === 0 &&
      this.clockSec >= this.authoredEndSec + TUNING.encounters.completionGraceSec &&
      this.liveEnemyCount === 0
    );
  }

  /** Every live hostile projectile — what grazing measures itself against. */
  hostileProjectiles(): AuthoredUnit[] {
    const out: AuthoredUnit[] = [];
    for (const instance of this.live) {
      if (instance.entity.active && instance.collisionGroup === "enemyProjectile") out.push(instance.entity);
    }
    return out;
  }

  // ── Setup ────────────────────────────────────────────────────────────────

  /**
   * Expands every placed instance into its scaling slots up front. Slot
   * geometry only depends on the authored shape and the incoming
   * Difficulty, so there's nothing to recompute per frame — only *when*
   * each slot's clock starts is staggered, by `spawnDelayMs`.
   */
  private resolvePlacements(): PendingPlacement[] {
    const { content, encounter, difficulty, frame } = this.config;
    const out: PendingPlacement[] = [];

    for (const placement of encounter.units) {
      const def = content.units.find((u) => u.id === placement.unitDefId);
      // A dangling `unitDefId` (its Unit was deleted after placement) drops
      // that one instance rather than failing the whole encounter.
      if (!def || placement.steps.length === 0) continue;

      const { count, power } = resolveScaling(placement.scaling, difficulty);
      if (count <= 0) continue; // priced out at this Difficulty — see scaling.ts

      const origin = placement.steps[0].pos;
      const slots = applyPingPong(resolveScalingSlots(placement.scaling, origin, count), placement.scaling, frame.widthPx);
      const delays = spawnDelayOffsetsSec(placement.scaling, slots.length);

      slots.forEach((slot, i) => {
        const dx = slot.x - origin.x;
        const dy = slot.y - origin.y;
        out.push({
          placement,
          def,
          steps: placement.steps.map((s) => ({ ...s, pos: { x: s.pos.x + dx, y: s.pos.y + dy } })),
          startSec: delays[i] ?? 0,
          power,
        });
      });
    }
    return out;
  }

  // ── Frame ────────────────────────────────────────────────────────────────

  update(dtSec: number): void {
    const previousSec = this.clockSec;
    this.clockSec += dtSec;
    this.spawnDuePlacements();

    for (const instance of this.live) {
      if (!instance.entity.active) continue;
      if (instance.steps) this.updatePlaced(instance, previousSec);
      else this.updateSpawned(instance, dtSec, previousSec);
    }

    this.cull();
  }

  private spawnDuePlacements(): void {
    if (this.pending.length === 0) return;
    const due = this.pending.filter((p) => this.clockSec >= p.startSec + p.steps[0].time);
    if (due.length === 0) return;
    this.pending = this.pending.filter((p) => this.clockSec < p.startSec + p.steps[0].time);
    for (const p of due) this.spawnPlaced(p);
  }

  private spawnPlaced(p: PendingPlacement): void {
    const entity = this.acquire("enemy");
    if (!entity) return; // pool exhausted — dropping a spawn beats stalling the frame
    const displaySize = unitDisplaySize(p.def.size);
    entity.spawn({
      // Position is meaningless until the first update reads it off the
      // authored curve, which happens at the bottom of this method.
      x: 0,
      y: 0,
      textureKey: this.textureFor(p.def.spriteId, p.def.id),
      displaySize,
      hitRadius: p.def.size,
      hp: p.def.hp,
      contactDamage: p.def.contactDamage,
      scoreValue: p.def.scoreValue,
      collisionGroup: "enemy",
      depth: LAYER_DEPTH[p.def.layer] ?? LAYER_DEPTH.ground,
    });

    const instance: LiveInstance = {
      entity,
      def: p.def,
      steps: p.steps,
      pathEndSec: p.startSec + p.steps[p.steps.length - 1].time,
      spawnedAction: null,
      startSec: p.startSec,
      power: p.power,
      scale: 1,
      facingDeg: 90,
      track: freshTrack(),
      parts: this.createParts(p.def, entity, "enemy", displaySize, p.placement.partActions),
      collisionGroup: "enemy",
    };
    this.live.push(instance);
    this.updatePlaced(instance, this.clockSec);
  }

  /**
   * A Part gets a real entity when it has art to draw or a hitbox to be
   * shot at; otherwise it stays a pure logical anchor — a named position on
   * the hull that its own Actions fire from.
   */
  private createParts(
    def: AuthoredUnitDef,
    owner: AuthoredUnit,
    group: AuthoredCollisionGroup,
    ownerDisplaySize: number,
    placements: readonly AuthoredPartActionPlacement[]
  ): LivePart[] {
    const partScale = partScaleFor(ownerDisplaySize);
    const partDisplaySize = EDITOR_PART_BOX * partScale;
    const out: LivePart[] = [];

    for (const part of def.parts) {
      const textureKey = this.optionalTextureFor(part.spriteId, part.id);
      let entity: AuthoredUnit | null = null;

      if (textureKey !== null || part.hasHitbox) {
        entity = this.acquire(group);
        if (entity) {
          entity.spawn({
            x: owner.x,
            y: owner.y,
            textureKey: textureKey ?? this.config.fallbackTexture,
            displaySize: partDisplaySize,
            // A Part's hitbox isn't authored separately; its render box is
            // the only size information there is, so half of it stands in.
            hitRadius: partDisplaySize / 2,
            hp: part.hp,
            contactDamage: 0, // touching the vehicle is already the hull's contact damage
            scoreValue: 0, // a destroyed turret isn't a kill — the hull pays out
            collisionGroup: group,
            hasCollision: part.hasHitbox,
            damageMultiplier: part.damageMultiplier,
            owner,
            forwardsDamage: part.hasHitbox && !part.hasHealth,
            depth: owner.depth + PART_DEPTH_OFFSET,
          });
          entity.setVisible(textureKey !== null);
          owner.parts.push(entity);
        }
      }

      out.push({
        def: part,
        entity,
        placements: placements.filter((p) => p.partId === part.id).sort((a, b) => a.time - b.time),
        track: freshTrack(),
        pos: { x: owner.x, y: owner.y },
      });
    }
    return out;
  }

  private updatePlaced(instance: LiveInstance, previousSec: number): void {
    const steps = instance.steps;
    if (!steps) return;
    const localT = this.clockSec - instance.startSec;
    const state = instanceStateAt(steps, instance.def.turnRate, localT);
    if (!state) return;

    const screen = toScreen(this.config.frame, state.pos);
    instance.entity.setPosition(screen.x, screen.y);

    const action = this.actionById(instance.def.actions, state.step.actionId);
    const heading = instanceHeadingDegAt(steps, instance.def.turnRate, localT);
    instance.facingDeg = action ? resolveFacingDeg(action, screen, this.config.playerPos(), heading) : heading;
    instance.entity.setRotation(facingToRotation(instance.facingDeg));
    instance.entity.setInvincible(invincibleAt(steps, instance.def.actions, localT));

    this.runAttackTrack(instance, instance.track, action, instance.startSec + state.step.time, screen, previousSec);
    this.updateParts(instance, screen, previousSec, localT);
  }

  private updateSpawned(instance: LiveInstance, dtSec: number, previousSec: number): void {
    const action = instance.spawnedAction;
    const current = { x: instance.entity.x, y: instance.entity.y };

    if (action) {
      // A spawned instance has no authored path, so its facing IS its
      // direction of travel: "faceMovement" keeps whatever angle it was
      // fired at, and "facePlayer" turns it into a seeker for free.
      instance.facingDeg = resolveFacingDeg(action, current, this.config.playerPos(), instance.facingDeg);
      const speed = instance.def.speed * (Math.max(0, action.movementPercent) / 100);
      if (speed > 0) {
        const rad = (instance.facingDeg * Math.PI) / 180;
        instance.entity.setPosition(current.x + Math.cos(rad) * speed * dtSec, current.y + Math.sin(rad) * speed * dtSec);
      }
    }
    instance.entity.setRotation(facingToRotation(instance.facingDeg));

    const screen = { x: instance.entity.x, y: instance.entity.y };
    this.runAttackTrack(instance, instance.track, action, instance.startSec, screen, previousSec);
    this.updateParts(instance, screen, previousSec, this.clockSec - instance.startSec);
  }

  /**
   * Parts ride the hull: an authored offset is expressed against the art as
   * drawn, so it rotates with the hull's facing exactly as the sprite does.
   * Each Part then resolves its own Action track independently — a turret
   * aiming and firing on its own schedule while the vehicle it's bolted to
   * drives its own path.
   */
  private updateParts(instance: LiveInstance, hullScreen: Vec2, previousSec: number, localT: number): void {
    if (instance.parts.length === 0) return;
    const rotation = facingToRotation(instance.facingDeg);
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const partScale = partScaleFor(unitDisplaySize(instance.def.size) * instance.scale);
    const player = this.config.playerPos();

    for (const part of instance.parts) {
      const ox = part.def.offset.x * partScale;
      const oy = part.def.offset.y * partScale;
      part.pos = { x: hullScreen.x + ox * cos - oy * sin, y: hullScreen.y + ox * sin + oy * cos };
      if (part.entity?.active) part.entity.setPosition(part.pos.x, part.pos.y);

      const resolved = this.activePartAction(instance, part, localT);
      if (part.entity?.active) {
        if (resolved.action) {
          part.entity.setRotation(facingToRotation(resolveFacingDeg(resolved.action, part.pos, player, instance.facingDeg)));
        }
        part.entity.setInvincible(invincibleAt(part.placements, part.def.actions, localT));
      }
      this.runAttackTrack(instance, part.track, resolved.action, resolved.startSec, part.pos, previousSec, part);
    }
  }

  /**
   * Which Action a Part is running, and when it started.
   *
   * A hand-placed hull drives its Parts entirely from the encounter's
   * Part-action placements — no placements means that Part is idle, exactly
   * as the editor's timeline shows it. A *dynamically spawned* Unit has no
   * placement track at all, so its Parts fall back to their own first
   * Action — the same "a spawn has nothing to draw a starting Action from"
   * rule `defaultActionId` exists for on the base Unit.
   */
  private activePartAction(instance: LiveInstance, part: LivePart, localT: number): { action: AuthoredAction | null; startSec: number } {
    if (part.placements.length === 0) {
      if (instance.steps !== null) return { action: null, startSec: instance.startSec };
      return { action: part.def.actions[0] ?? null, startSec: instance.startSec };
    }
    let active: AuthoredPartActionPlacement | null = null;
    for (const placement of part.placements) {
      if (placement.time <= localT) active = placement;
      else break;
    }
    if (!active) return { action: null, startSec: instance.startSec };
    return { action: this.actionById(part.def.actions, active.actionId), startSec: instance.startSec + active.time };
  }

  // ── Firing ───────────────────────────────────────────────────────────────

  /**
   * Advances one firing anchor's schedule. Switching to a different Action
   * restarts that schedule, which is what makes an Action's
   * `telegraphMs`/`burstIntervalMs` relative to *itself* rather than to the
   * encounter clock — author a wind-up once and it reads the same wherever
   * that Action is placed.
   *
   * On a switch, `firedThroughMs` jumps straight to however much of the new
   * Action's timeline is already in the past. Normally that's ~0 (the
   * switch lands within a frame of the authored moment); after a long
   * frame hitch it's what stops the runner from replaying a whole backlog
   * of bursts in one go.
   */
  private runAttackTrack(
    instance: LiveInstance,
    track: AttackTrack,
    action: AuthoredAction | null,
    actionStartSec: number,
    anchor: Vec2,
    previousSec: number,
    part?: LivePart
  ): void {
    const actionId = action?.id ?? null;
    if (track.actionId !== actionId) {
      track.actionId = actionId;
      track.startedAtSec = actionStartSec;
      track.firedThroughMs = Math.max(0, (previousSec - actionStartSec) * 1000);
    }
    if (!action || !action.attack) return;
    const attack = action.attack;

    const elapsedMs = (this.clockSec - track.startedAtSec) * 1000;
    const anchorEntity = part ? part.entity : instance.entity;
    if (anchorEntity?.active && anchorEntity.hittable) {
      anchorEntity.setAlpha(isTelegraphing(attack, elapsedMs) ? TELEGRAPH_ALPHA : 1);
    }

    const shots = dueShots(attack, track.firedThroughMs, elapsedMs);
    track.firedThroughMs = Math.max(track.firedThroughMs, elapsedMs);
    if (shots.length === 0) return;

    const baseFacing = part
      ? resolveFacingDeg(action, anchor, this.config.playerPos(), instance.facingDeg)
      : instance.facingDeg;
    for (const shot of shots) {
      this.spawnProjectile(attack, anchor, baseFacing + shot.angleOffsetDeg, instance.power);
    }
  }

  /** Fires one shot — which means spawning a whole new live instance of whatever Unit the attack spawns. */
  private spawnProjectile(attack: AuthoredAttack, from: Vec2, angleDeg: number, power: number): void {
    if (!attack.spawnUnitId) return;
    const def = this.config.content.units.find((u) => u.id === attack.spawnUnitId);
    if (!def) return;

    const entity = this.acquire(attack.spawnGroup);
    if (!entity) return; // pool ceiling reached: drop the shot rather than blow the budget

    const scale = Math.max(0.05, attack.spawnScale);
    const displaySize = unitDisplaySize(def.size) * scale;
    entity.spawn({
      x: from.x,
      y: from.y,
      textureKey: this.textureFor(def.spriteId, def.id),
      displaySize,
      hitRadius: def.size * scale,
      hp: def.hp,
      contactDamage: def.contactDamage,
      scoreValue: def.scoreValue,
      collisionGroup: attack.spawnGroup,
      depth: PROJECTILE_DEPTH,
    });
    entity.setRotation(facingToRotation(angleDeg));

    const action = this.actionById(def.actions, def.defaultActionId) ?? def.actions[0] ?? null;
    if (action && action.setsInvincible !== null) entity.setInvincible(action.setsInvincible);

    this.live.push({
      entity,
      def,
      steps: null,
      pathEndSec: 0,
      spawnedAction: action,
      startSec: this.clockSec,
      power,
      scale,
      facingDeg: angleDeg,
      track: freshTrack(),
      parts: this.createParts(def, entity, attack.spawnGroup, displaySize, []),
      collisionGroup: attack.spawnGroup,
    });
  }

  // ── Housekeeping ─────────────────────────────────────────────────────────

  /**
   * A **placed** instance is only culled once its authored path is over —
   * authored paths routinely start (and can loop) well off screen, so
   * culling on position alone would delete an enemy on the very frame it
   * spawned, before it ever flew in. A **spawned** one has no path to
   * finish, so off-screen (or a backstop lifespan) is the whole rule.
   */
  private cull(): void {
    const margin = TUNING.encounters.despawnMarginPx;
    for (let i = this.live.length - 1; i >= 0; i--) {
      const instance = this.live[i];
      const entity = instance.entity;
      if (!entity.active) {
        this.live.splice(i, 1);
        continue;
      }
      const offScreen =
        entity.x < -margin || entity.x > GAME_WIDTH + margin || entity.y < -margin || entity.y > GAME_HEIGHT + margin;
      const done =
        instance.steps !== null
          ? offScreen && this.clockSec > instance.pathEndSec
          : offScreen || this.clockSec - instance.startSec > TUNING.encounters.spawnedLifespanSec;
      if (done) {
        entity.recycle();
        this.live.splice(i, 1);
      }
    }
  }

  /** Recycles everything this runner put on the field — called when the episode ends for any reason. */
  destroy(): void {
    for (const instance of this.live) instance.entity.recycle();
    this.live.length = 0;
    this.pending = [];
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private acquire(group: AuthoredCollisionGroup): AuthoredUnit | null {
    const target = group === "friendly" || group === "friendlyProjectile" ? this.config.friendlies : this.config.hostiles;
    return (target.get(0, 0, this.config.fallbackTexture) as AuthoredUnit | null) ?? null;
  }

  private actionById(actions: readonly AuthoredAction[], id: string | null): AuthoredAction | null {
    if (!id) return null;
    return actions.find((a) => a.id === id) ?? null;
  }

  /**
   * The loaded texture key for an authored sprite reference, or null when
   * there's no art to draw. A custom upload was already keyed by its owning
   * record's id at preload time (`sprites/editorArt.ts`), so the data URL
   * itself is never needed here.
   */
  private optionalTextureFor(spriteId: string, ownerId: string): string | null {
    const key = editorSpriteTextureKey(spriteId, ownerId);
    return this.config.scene.textures.exists(key) ? key : null;
  }

  /** Same, but substituting the scene's fallback — a missing sprite should look wrong, not crash the encounter. */
  private textureFor(spriteId: string, ownerId: string): string {
    return this.optionalTextureFor(spriteId, ownerId) ?? this.config.fallbackTexture;
  }
}
