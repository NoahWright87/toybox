import Phaser from "phaser";
import { TUNING } from "../../tuning";
import { GAME_WIDTH, GAME_HEIGHT } from "../../config";
import { AuthoredUnit } from "../../entities/AuthoredUnit";
import { editorSpriteTextureKey } from "../../sprites/editorArt";
import { advanceAttackTrack, freshAttackTrack, isTelegraphing, type AttackTrack } from "./attacks";
import { instanceHeadingDegAt, instanceStateAt, invincibleAt, lastAuthoredTime, resolveFacingDeg } from "./movement";
import { applyPingPong, resolveScaling, resolveScalingSlots, spawnDelayOffsetsSec } from "./scaling";
import { toScreen, type TileFrame } from "./frame";
import { orientAngleDeg, orientMirrorsArc, orientPoint, type TileOrientation } from "./levelLayout";
import { EDITOR_PART_BOX, facingToRotation, partScaleFor, unitDisplaySize } from "./spriteScale";
import type {
  AuthoredAction,
  AuthoredFootprint,
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
 * at the point of touching a sprite — and that frame **moves**, because the
 * level scrolls. Everything on the tile therefore scrolls with it for free,
 * which is what a turret bolted to the ground requires and what makes a
 * level nothing more than several of these runners at staggered depths.
 * `LevelRunner` owns the clock and hands this one a fresh frame each tick.
 *
 * Spawned projectiles are the deliberate exception: they're placed in
 * screen space at the moment they're fired and fly under their own power
 * from there, rather than inheriting the terrain's motion — a bullet in the
 * air isn't bolted to the ground.
 *
 * If the tile is rotated or flipped in the level, authored content comes
 * with it (`levelLayout.ts`): step positions are oriented once up front,
 * fixed facings are oriented as they're read, and a flip additionally
 * mirrors arc offsets so a spread authored to fan left fans right on the
 * mirrored copy.
 */

/** Depth per authored layer, keeping ground clutter under air traffic and both under the player (depth 10). */
const LAYER_DEPTH: Record<string, number> = { doodad: 1, ground: 2, air: 4 };
const PART_DEPTH_OFFSET = 1;
const PROJECTILE_DEPTH = 6;

/** Alpha applied to a firing anchor during an attack's telegraph wind-up — the runtime read of the editor timeline's telegraph colour. */
const TELEGRAPH_ALPHA = 0.55;

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
  /**
   * Whether this instance has ever actually been inside the viewport. Culling a
   * *placed* instance is gated on this: `pathEndSec` alone is not a safe
   * "it has had its turn" signal, because a stationary or single-step unit (a
   * Turret — one step at time 0) has `pathEndSec === 0`, so the path-is-over
   * test passed on its very first frame. Any scaling slot that happened to sit
   * outside the viewport at spawn was then culled instantly, before the level
   * had scrolled it into view. That is why a `maxCount: 30` turret group only
   * put a handful on the field, and why adding a spawn delay "fixed" it —
   * staggering the spawns meant each slot was already on screen by the time it
   * appeared, rather than changing how many were resolved.
   */
  seenOnScreen: boolean;
  /**
   * **Scroll-locked vs time-locked reference frame**, keyed off `UnitDef.layer`
   * (the concept `shmup-editor.todo.md` deferred; this is it arriving).
   *
   * Every authored position resolves through the tile frame, and that frame
   * slides down the screen as the level scrolls — so everything on a tile moved
   * with it, which is exactly right for a turret bolted to the ground and
   * exactly wrong for an aircraft. A jet is not attached to the terrain; the
   * terrain passes beneath it.
   *
   * True for ground and doodad units, which keep resolving against the live
   * frame forever. False for air, which decouples — see `pinnedOriginY`.
   */
  scrollLocked: boolean;
  /**
   * The frame origin Y an air unit resolves against, captured **at spawn**,
   * or `null` for a scroll-locked one that never decouples.
   *
   * Air units used to ride the scrolling frame until they first became
   * visible and pin there, so that a unit authored high in its tile got
   * carried on screen by the scroll rather than being stranded above it.
   * The cost was that an authored air route was not the route flown: it slid
   * with the terrain for the first few seconds and then stopped, which made
   * the editor's own drawing of it wrong and left an author unable to say
   * where on screen an aircraft would actually be.
   *
   * Pinning at spawn makes an air route rigid in screen space for its whole
   * life. Flying in from off-screen is still perfectly possible — it is now
   * simply *authored*, by putting the first waypoint above the camera and a
   * later one inside it, which is both more predictable and more expressive
   * than having the scroll do it. Mirrored by the editor's `airFrame.ts`.
   */
  pinnedOriginY: number | null;
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
  /** Where the tile sits on screen right now. Replaced every tick by `setFrame` as the level scrolls. */
  frame: TileFrame;
  /** How the tile is rotated/flipped in the level. Authored content is transformed to match. */
  orientation: TileOrientation;
  footprint: AuthoredFootprint;
  /** Groups the scene has already wired its collision overlaps against. */
  hostiles: Phaser.Physics.Arcade.Group;
  friendlies: Phaser.Physics.Arcade.Group;
  /** Where the player currently is, in screen space, for `facePlayer`. */
  playerPos: () => Vec2;
  /** Texture key used when an authored sprite id resolves to nothing loadable. */
  fallbackTexture: string;
}

/** Whether a layer's authored positions ride the scrolling tile frame. Air does not — see `LiveInstance.pinnedOriginY`. */
export function isScrollLocked(layer: string): boolean {
  return layer !== "air";
}

/**
 * Whether a layer takes part in collision at all. Doodads do not: they are
 * scenery — a tree, a sandbag wall, a rooftop — that renders and scrolls with
 * the terrain but is never in the collision set.
 *
 * Without this every authored Unit spawned into `collisionGroup: "enemy"`
 * with a real `hitRadius`, so player fire hit the scenery and popped it
 * (doodads carry `hp: 1`). The editor already declares the intent by putting
 * them on their own layer with no Actions, no scaling, no contact damage and
 * no score; this is the runtime honoring it. Note the layer is the *only*
 * thing consulted — `hasHitbox` on a Unit's Parts is a separate, per-Part
 * concern that was never about the hull.
 */
export function isCollidableLayer(layer: string): boolean {
  return layer !== "doodad";
}

/**
 * Whether a live instance should be recycled this frame. Pure and exported so
 * the rule can be tested without standing up a Phaser entity — it encodes a
 * regression that cost a lot of authored content: see `seenOnScreen`.
 */
export function shouldCull(state: {
  /** A hand-placed instance (has an authored path); false for a dynamically spawned one. */
  placed: boolean;
  offScreen: boolean;
  seenOnScreen: boolean;
  /** Seconds since this instance's own local clock started. */
  ageSec: number;
  /** Whether the authored path has finished (meaningless for a spawned instance). */
  pathOver: boolean;
}): boolean {
  if (!state.placed) return state.offScreen || state.ageSec > TUNING.encounters.spawnedLifespanSec;
  // "Seen, then left" is the real end-of-life signal for placed content.
  // `pathOver` alone is trivially true for a stationary/single-step unit, whose
  // path ends at time 0 — which used to cull every off-screen scaling slot on
  // its first frame, before the level had scrolled it into view.
  if (state.seenOnScreen && state.offScreen && state.pathOver) return true;
  // Backstop for a slot the scroll genuinely never reaches, so it can't hold a
  // pool slot for the whole episode.
  return state.ageSec > TUNING.encounters.placedUnseenLifespanSec;
}

export class EncounterRunner {
  private readonly config: EncounterRunnerConfig;
  private frame: TileFrame;
  private pending: PendingPlacement[];
  private readonly live: LiveInstance[] = [];
  private clockSec = 0;
  /** The last moment anything authored is scheduled to happen — when the encounter has nothing left to start. */
  private readonly authoredEndSec: number;

  constructor(config: EncounterRunnerConfig) {
    this.config = config;
    this.frame = config.frame;
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

  /** Called by `LevelRunner` each tick, before `update`, as the tile scrolls down the screen. */
  setFrame(frame: TileFrame): void {
    this.frame = frame;
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
   * in-flight shots is over, and nothing hand-placed is left on the field —
   * "there are no more enemy actions playing out."
   *
   * This is only half the end condition. The other half, "the tile has
   * scrolled completely off screen," belongs to `LevelRunner`, which owns
   * the scroll clock; either one finishes a tile's encounter.
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
    const { content, encounter, difficulty } = this.config;
    const out: PendingPlacement[] = [];

    for (const placement of encounter.units) {
      const def = content.units.find((u) => u.id === placement.unitDefId);
      // A dangling `unitDefId` (its Unit was deleted after placement) drops
      // that one instance rather than failing the whole encounter.
      if (!def || placement.steps.length === 0) continue;

      const { count, power } = resolveScaling(placement.scaling, difficulty);
      if (count <= 0) continue; // priced out at this Difficulty — see scaling.ts

      const origin = placement.steps[0].pos;
      const slots = applyPingPong(resolveScalingSlots(placement.scaling, origin, count), placement.scaling, this.frame.widthPx);
      const delays = spawnDelayOffsetsSec(placement.scaling, slots.length);

      // Slots are resolved in UNORIENTED tile space and each resulting
      // position is oriented afterwards. Doing it in that order keeps the
      // transform exact for every shape — orienting the shape's own handles
      // instead would have to swap a grid's width and depth on a quarter
      // turn, and get a ring's handedness right on a flip.
      slots.forEach((slot, i) => {
        const dx = slot.x - origin.x;
        const dy = slot.y - origin.y;
        out.push({
          placement,
          def,
          steps: placement.steps.map((s) => ({ ...s, pos: this.orient({ x: s.pos.x + dx, y: s.pos.y + dy }) })),
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
      // Scenery renders and scrolls but is never hittable — see `isCollidableLayer`.
      hasCollision: isCollidableLayer(p.def.layer),
      depth: LAYER_DEPTH[p.def.layer] ?? LAYER_DEPTH.ground,
    });

    const instance: LiveInstance = {
      entity,
      def: p.def,
      steps: p.steps,
      pathEndSec: p.startSec + p.steps[p.steps.length - 1].time,
      seenOnScreen: false,
      scrollLocked: isScrollLocked(p.def.layer),
      // Air pins immediately: its authored path is a path through the screen,
      // not across the terrain (see `pinnedOriginY`).
      pinnedOriginY: isScrollLocked(p.def.layer) ? null : this.frame.originY,
      spawnedAction: null,
      startSec: p.startSec,
      power: p.power,
      scale: 1,
      facingDeg: 90,
      track: freshAttackTrack(),
      parts: this.createParts(p.def, entity, "enemy", displaySize, p.placement.partActions),
      collisionGroup: "enemy",
    };
    // Deliberately NOT updated here. `update()` pushes onto `this.live`
    // before its own loop starts, so the loop picks this instance up on the
    // very same frame — with the real frame-start `previousSec`. Updating it
    // here too would advance its attack track using "now" as the frame
    // start, which swallows every shot the Action schedules at t = 0. Its
    // position is still resolved before anything renders.
    this.live.push(instance);
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
        track: freshAttackTrack(),
        pos: { x: owner.x, y: owner.y },
      });
    }
    return out;
  }

  /** The frame an instance resolves authored positions through — the live scrolling one, or its pinned copy for a time-locked (air) unit. */
  private frameFor(instance: LiveInstance): TileFrame {
    if (instance.pinnedOriginY === null) return this.frame;
    return { ...this.frame, originY: instance.pinnedOriginY };
  }

  private updatePlaced(instance: LiveInstance, previousSec: number): void {
    const steps = instance.steps;
    if (!steps) return;
    const localT = this.clockSec - instance.startSec;
    const state = instanceStateAt(steps, instance.def, localT);
    if (!state) return;

    const screen = toScreen(this.frameFor(instance), state.pos);
    instance.entity.setPosition(screen.x, screen.y);

    const action = this.actionById(instance.def.actions, state.step.actionId);
    const heading = instanceHeadingDegAt(steps, instance.def, localT);
    instance.facingDeg = action ? this.facingFor(action, screen, heading) : heading;
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
      instance.facingDeg = this.facingFor(action, current, instance.facingDeg);
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

    for (const part of instance.parts) {
      const ox = part.def.offset.x * partScale;
      const oy = part.def.offset.y * partScale;
      part.pos = { x: hullScreen.x + ox * cos - oy * sin, y: hullScreen.y + ox * sin + oy * cos };
      if (part.entity?.active) part.entity.setPosition(part.pos.x, part.pos.y);

      const resolved = this.activePartAction(instance, part, localT);
      if (part.entity?.active) {
        if (resolved.action) {
          part.entity.setRotation(facingToRotation(this.facingFor(resolved.action, part.pos, instance.facingDeg)));
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
   * Resolves one firing anchor's shots for this frame and puts them on the
   * field. The schedule bookkeeping itself is `advanceAttackTrack` — pure,
   * and unit tested there, since getting `previousSec` wrong is silent and
   * costs you exactly the shots an Action fires at its own t = 0.
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
    const attack = action?.attack ?? null;
    const shots = advanceAttackTrack(track, attack, action?.id ?? null, actionStartSec, previousSec, this.clockSec);
    if (!action || !attack) return;

    const anchorEntity = part ? part.entity : instance.entity;
    if (anchorEntity?.active && anchorEntity.hittable) {
      anchorEntity.setAlpha(isTelegraphing(attack, (this.clockSec - track.startedAtSec) * 1000) ? TELEGRAPH_ALPHA : 1);
    }
    if (shots.length === 0) return;

    const baseFacing = part ? this.facingFor(action, anchor, instance.facingDeg) : instance.facingDeg;
    // A mirrored tile mirrors the shape of a fan too, not just where it
    // points — otherwise a spread authored to fan left fans right here
    // while its base direction is correctly mirrored.
    const arcSign = orientMirrorsArc(this.config.orientation) ? -1 : 1;
    for (const shot of shots) {
      this.spawnProjectile(attack, anchor, baseFacing + arcSign * shot.angleOffsetDeg, instance.power);
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
      seenOnScreen: false,
      // A dynamically spawned instance already moves in pure screen space
      // (`updateSpawned` integrates velocity directly), so it has no tile frame
      // to track or pin either way.
      scrollLocked: true,
      pinnedOriginY: null,
      spawnedAction: action,
      startSec: this.clockSec,
      power,
      scale,
      facingDeg: angleDeg,
      track: freshAttackTrack(),
      parts: this.createParts(def, entity, attack.spawnGroup, displaySize, []),
      collisionGroup: attack.spawnGroup,
    });
  }

  // ── Housekeeping ─────────────────────────────────────────────────────────

  /**
   * A **placed** instance is only culled once it has actually been on screen
   * *and* its authored path is over — authored paths routinely start (and can
   * loop) well off screen, so culling on position alone would delete an enemy
   * on the very frame it spawned, before it ever flew in.
   *
   * The `seenOnScreen` half of that is load-bearing, not belt-and-braces: the
   * path-is-over test alone is trivially true for a stationary or single-step
   * unit (a Turret's one step sits at time 0, so `pathEndSec` is 0), which made
   * every such duplicate whose slot started outside the viewport get culled on
   * its first frame. See the field's own doc comment.
   *
   * A **spawned** one has no path to finish, so off-screen (or a backstop
   * lifespan) is the whole rule.
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
      // Culling uses the generous despawn margin, so a path that loops just
      // off the edge isn't deleted mid-manoeuvre; `seenOnScreen` uses actual
      // visibility, so something that never made it into view isn't treated as
      // having been and gone.
      const onScreen = entity.x >= 0 && entity.x <= GAME_WIDTH && entity.y >= 0 && entity.y <= GAME_HEIGHT;
      if (onScreen) instance.seenOnScreen = true;
      const done = shouldCull({
        placed: instance.steps !== null,
        offScreen,
        seenOnScreen: instance.seenOnScreen,
        ageSec: this.clockSec - instance.startSec,
        pathOver: this.clockSec > instance.pathEndSec,
      });
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

  /** A tile-local point as it lands after the tile's own rotation/flip. */
  private orient(pos: Vec2): Vec2 {
    return orientPoint(pos, this.config.footprint, this.config.orientation);
  }

  /**
   * An Action's facing, with the tile's orientation folded in. Only a
   * `fixed` facing needs it: `faceMovement` reads the already-oriented
   * path, and `facePlayer` is resolved in screen space, so both come out
   * right on their own.
   */
  private facingFor(action: AuthoredAction, anchor: Vec2, movementHeadingDeg: number): number {
    if (action.facing === "fixed") return orientAngleDeg(action.fixedFacingDeg, this.config.orientation);
    return resolveFacingDeg(action, anchor, this.config.playerPos(), movementHeadingDeg);
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
