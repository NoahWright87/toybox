import Phaser from "phaser";
import { MAIN_STAT_IDS, EXOTIC_STAT_IDS, STAT_DEFS, formatStatValue } from "../systems/stats";
import type { StatId } from "../systems/stats";
import { TUNING } from "../tuning";
import type { Player } from "../entities/Player";
import { ShakeDetector } from "./ShakeDetector";

const STAT_ORDER: StatId[] = [...MAIN_STAT_IDS, ...EXOTIC_STAT_IDS];

/**
 * Sentinel index, one past the last real stat — selects the debug-only
 * "Firing Cone" row (C12 #151 follow-up). Not a StatId: there's no
 * balance/upgrade/item source for it, it exists purely to spread the
 * weapon's fire for inspecting homing/fork/pierce behavior off-axis, so it
 * lives on `Player.debugFiringConeDeg` directly rather than in the
 * StatBlock/debugMods pipeline the rest of this overlay drives. The value
 * is the cone's full width — each shot's heading is drawn uniformly from
 * within ±half of it around straight up, not a fixed offset.
 */
const FIRING_CONE_INDEX = STAT_ORDER.length;
/**
 * Sentinel index for the debug-only "Fork Cone" row — overrides
 * `Player.debugForkConeOverrideDeg` (null = defer to the weapon's authored
 * `forkConeDeg`/`TUNING.weapons.defaultForkConeDeg`). Full width, in degrees,
 * of the cone a forked line's heading is drawn from around the forking
 * bullet's own heading at the moment of impact.
 */
const FORK_CONE_INDEX = STAT_ORDER.length + 1;
/**
 * Sentinel index for the debug-only "Spawn Rate" row — overrides
 * `Player.debugEnemySpawnIntervalMs` (null = defer to
 * `TUNING.enemies.drone.spawnIntervalMs`). Lower is faster spawning.
 */
const SPAWN_RATE_INDEX = STAT_ORDER.length + 2;
/** Sentinel index for the debug-only "Hitboxes" toggle row — flips `Player.debugShowHitboxes`, which drives Arcade Physics' built-in per-body debug draw. */
const HITBOXES_INDEX = STAT_ORDER.length + 3;
const SELECTABLE_COUNT = STAT_ORDER.length + 4;
const FIRING_CONE_STEP_DEG = 5;
const FORK_CONE_STEP_DEG = 5;
const SPAWN_RATE_STEP_MS = 50;
// Safety floor so the +/- buttons can't drive the spawn cooldown to (or past) zero.
const SPAWN_RATE_MIN_MS = 100;

/**
 * Per-stat nudge increment for the debug overlay (C12 #151's "preview a
 * build's effective stats without a full run"). These are inspection-tool
 * step sizes, not gameplay balance numbers — TUNING stays the home for
 * levers the game itself reads; this is just what makes the overlay usable.
 */
const STAT_STEP: Record<StatId, number> = {
  damage: 0.25,
  attackSpeed: 0.25,
  critChance: 0.1,
  critDamage: 0.1,
  maxHp: 10,
  armor: 10,
  evasion: 0.1,
  maxShield: 20,
  hpRegen: 2,
  lifesteal: 0.1,
  playerSpeed: 40,
  reflexes: 0.25,
  luck: 0.1,
  creditScore: 0.1,
  expGain: 0.25,
  magnetRadius: 20,
  pierce: 0.25,
  blastRadius: 20,
  homingStrength: 0.25,
};

/**
 * Expected crit multiplier for *display only* — combat's real per-shot roll
 * is rollCrit() (systems/combat/resolveHit.ts), which samples one concrete
 * outcome. This is the closed-form expectation: numCrits = guaranteed +
 * Bernoulli(frac), so E[(1+CD)^numCrits] = (1+CD)^guaranteed * E[(1+CD)^Bernoulli(frac)]
 * = (1+CD)^guaranteed * (1 + frac*CD).
 */
function expectedCritFactor(critChance: number, critDamage: number): number {
  const guaranteed = Math.floor(critChance);
  const frac = critChance - guaranteed;
  return Math.pow(1 + critDamage, guaranteed) * (1 + frac * critDamage);
}

// Panel/button geometry, in game-space px. Buttons are sized well above a
// finger's worth of canvas pixels even after the FIT-mode downscale to a
// real phone width (see ShakeDetector's mobile-input rationale) — this is
// the touch-equivalent of the keyboard's bracket/minus/plus/zero/backspace.
const PANEL_WIDTH = 360;
const PANEL_MARGIN = 16;
const ARROW_BTN = 64;
const ADJUST_BTN_W = 130;
const ADJUST_BTN_H = 80;
const RESET_BTN_W = 165;
const RESET_BTN_H = 56;
const ROW_GAP = 14;

interface Button {
  rect: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
}

/**
 * C12 #151 ("Debug / balance instrumentation overlay") — a shell sized to
 * F6's scope: live effective stats, a way to nudge them without a real
 * level-up/item system to grant them yet, and the resulting weapon behavior
 * (pierce decay / forks / blast) so a stat's effect is visible immediately
 * instead of inferred from a balance spreadsheet. The fuller overlay #151
 * calls for (graze/hype readouts, a real build simulator) is its own job
 * once those systems (F7+) exist. Toggle is backtick on a keyboard or a
 * device shake on mobile (see ShakeDetector); stat selection/adjustment is
 * mouse/touch buttons (work with both pointer types) plus keyboard shortcuts
 * for desktop speed — there's no keyboard on a phone to drive the old
 * keys-only version.
 */
export class DebugOverlay {
  private readonly panelLeft: number;
  private readonly panelRight: number;

  private readonly panelBg: Phaser.GameObjects.Rectangle;
  private readonly listText: Phaser.GameObjects.Text;
  private readonly selectedText: Phaser.GameObjects.Text;
  private readonly infoText: Phaser.GameObjects.Text;
  private readonly buttons: Button[] = [];

  private readonly toggleKey: Phaser.Input.Keyboard.Key;
  private readonly prevKey: Phaser.Input.Keyboard.Key;
  private readonly nextKey: Phaser.Input.Keyboard.Key;
  private readonly decKey: Phaser.Input.Keyboard.Key;
  private readonly incKey: Phaser.Input.Keyboard.Key;
  private readonly resetOneKey: Phaser.Input.Keyboard.Key;
  private readonly resetAllKey: Phaser.Input.Keyboard.Key;
  private readonly shake: ShakeDetector;

  private visible = false;
  private selectedIndex = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Player
  ) {
    this.panelRight = scene.scale.width - PANEL_MARGIN;
    this.panelLeft = this.panelRight - PANEL_WIDTH;

    const kb = scene.input.keyboard!;
    this.toggleKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.BACKTICK);
    this.prevKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.OPEN_BRACKET);
    this.nextKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.CLOSED_BRACKET);
    this.decKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.MINUS);
    this.incKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.PLUS);
    this.resetOneKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ZERO);
    this.resetAllKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.BACKSPACE);

    this.shake = new ShakeDetector(() => this.toggleVisible());
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.shake.destroy());

    this.panelBg = scene.add
      .rectangle(this.panelLeft, 14, PANEL_WIDTH, 10, 0x000000, 0.85)
      .setOrigin(0, 0)
      .setDepth(299)
      .setVisible(false);

    this.listText = scene.add
      .text(this.panelRight, 14, "", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#00ff88",
        padding: { x: 8, y: 6 },
        lineSpacing: 2,
      })
      .setOrigin(1, 0)
      .setDepth(300)
      .setVisible(false);
    // Line count (header + one per stat) never changes, so this height is
    // stable — measure it once up front to lay out the controls below it.
    this.listText.setText(this.renderList());
    let y = 14 + this.listText.height + ROW_GAP;

    this.addButton(this.panelLeft, y, ARROW_BTN, ARROW_BTN, "<", () => this.selectDelta(-1));
    this.addButton(this.panelRight - ARROW_BTN, y, ARROW_BTN, ARROW_BTN, ">", () => this.selectDelta(1));
    this.selectedText = scene.add
      .text(this.panelLeft + PANEL_WIDTH / 2, y + ARROW_BTN / 2, "", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#ffffff",
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(300)
      .setVisible(false);
    y += ARROW_BTN + ROW_GAP;

    this.addButton(this.panelLeft, y, ADJUST_BTN_W, ADJUST_BTN_H, "-", () => this.adjustSelected(-1));
    this.addButton(this.panelRight - ADJUST_BTN_W, y, ADJUST_BTN_W, ADJUST_BTN_H, "+", () => this.adjustSelected(1));
    y += ADJUST_BTN_H + ROW_GAP;

    this.addButton(this.panelLeft, y, RESET_BTN_W, RESET_BTN_H, "RESET", () => this.resetSelected());
    this.addButton(this.panelRight - RESET_BTN_W, y, RESET_BTN_W, RESET_BTN_H, "RESET ALL", () => this.resetAll());
    y += RESET_BTN_H + ROW_GAP;

    this.infoText = scene.add
      .text(this.panelRight, y, "", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#00ff88",
        padding: { x: 8, y: 6 },
        lineSpacing: 2,
      })
      .setOrigin(1, 0)
      .setDepth(300)
      .setVisible(false);
  }

  private addButton(x: number, y: number, w: number, h: number, label: string, onTap: () => void): void {
    const rect = this.scene.add
      .rectangle(x, y, w, h, 0x103322, 0.95)
      .setStrokeStyle(2, 0x00ff88)
      .setOrigin(0, 0)
      .setDepth(300)
      .setVisible(false)
      .setInteractive({ useHandCursor: true });
    // Without this, the tap also bubbles to PlayScene's scene-level
    // "pointerdown" handler and starts dragging the ship toward the button.
    rect.on(
      "pointerdown",
      (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        onTap();
      }
    );
    const text = this.scene.add
      .text(x + w / 2, y + h / 2, label, { fontFamily: "monospace", fontSize: "22px", color: "#00ff88" })
      .setOrigin(0.5)
      .setDepth(301)
      .setVisible(false);
    this.buttons.push({ rect, label: text });
  }

  private toggleVisible(): void {
    this.visible = !this.visible;
    this.panelBg.setVisible(this.visible);
    this.listText.setVisible(this.visible);
    this.selectedText.setVisible(this.visible);
    this.infoText.setVisible(this.visible);
    for (const b of this.buttons) {
      b.rect.setVisible(this.visible);
      b.label.setVisible(this.visible);
    }
  }

  private selectDelta(dir: number): void {
    this.selectedIndex = (this.selectedIndex + dir + SELECTABLE_COUNT) % SELECTABLE_COUNT;
  }

  private adjustSelected(dir: number): void {
    if (this.selectedIndex === FIRING_CONE_INDEX) {
      this.player.debugFiringConeDeg = Math.max(0, this.player.debugFiringConeDeg + dir * FIRING_CONE_STEP_DEG);
      return;
    }
    if (this.selectedIndex === FORK_CONE_INDEX) {
      const current = this.player.effectiveForkConeDeg;
      this.player.debugForkConeOverrideDeg = Math.max(0, current + dir * FORK_CONE_STEP_DEG);
      return;
    }
    if (this.selectedIndex === SPAWN_RATE_INDEX) {
      const current = this.player.effectiveEnemySpawnIntervalMs;
      this.player.debugEnemySpawnIntervalMs = Math.max(SPAWN_RATE_MIN_MS, current + dir * SPAWN_RATE_STEP_MS);
      return;
    }
    if (this.selectedIndex === HITBOXES_INDEX) {
      this.player.debugShowHitboxes = !this.player.debugShowHitboxes;
      return;
    }
    const stat = STAT_ORDER[this.selectedIndex];
    this.player.nudgeDebugStat(stat, dir * STAT_STEP[stat]);
  }

  private resetSelected(): void {
    if (this.selectedIndex === FIRING_CONE_INDEX) {
      this.player.debugFiringConeDeg = 0;
      return;
    }
    if (this.selectedIndex === FORK_CONE_INDEX) {
      this.player.debugForkConeOverrideDeg = null;
      return;
    }
    if (this.selectedIndex === SPAWN_RATE_INDEX) {
      this.player.debugEnemySpawnIntervalMs = null;
      return;
    }
    if (this.selectedIndex === HITBOXES_INDEX) {
      this.player.debugShowHitboxes = false;
      return;
    }
    this.player.setDebugMod(STAT_ORDER[this.selectedIndex], 0);
  }

  private resetAll(): void {
    this.player.clearDebugMods();
    this.player.debugFiringConeDeg = 0;
    this.player.debugForkConeOverrideDeg = null;
    this.player.debugEnemySpawnIntervalMs = null;
    this.player.debugShowHitboxes = false;
  }

  /** Call once per frame regardless of game-over state — inspecting/nudging stats shouldn't require an active run. */
  update(): void {
    if (Phaser.Input.Keyboard.JustDown(this.toggleKey)) this.toggleVisible();
    if (!this.visible) return;

    if (Phaser.Input.Keyboard.JustDown(this.prevKey)) this.selectDelta(-1);
    if (Phaser.Input.Keyboard.JustDown(this.nextKey)) this.selectDelta(1);
    if (Phaser.Input.Keyboard.JustDown(this.decKey)) this.adjustSelected(-1);
    if (Phaser.Input.Keyboard.JustDown(this.incKey)) this.adjustSelected(1);
    if (Phaser.Input.Keyboard.JustDown(this.resetOneKey)) this.resetSelected();
    if (Phaser.Input.Keyboard.JustDown(this.resetAllKey)) this.resetAll();

    this.listText.setText(this.renderList());

    if (this.selectedIndex === FIRING_CONE_INDEX) {
      this.selectedText.setText(`Firing Cone\n${this.player.debugFiringConeDeg.toFixed(0)}°`);
    } else if (this.selectedIndex === FORK_CONE_INDEX) {
      this.selectedText.setText(`Fork Cone\n${this.player.effectiveForkConeDeg.toFixed(0)}°`);
    } else if (this.selectedIndex === SPAWN_RATE_INDEX) {
      this.selectedText.setText(`Spawn Rate\n${this.player.effectiveEnemySpawnIntervalMs.toFixed(0)}ms`);
    } else if (this.selectedIndex === HITBOXES_INDEX) {
      this.selectedText.setText(`Hitboxes\n${this.player.debugShowHitboxes ? "ON" : "OFF"}`);
    } else {
      const selected = STAT_ORDER[this.selectedIndex];
      const def = STAT_DEFS[selected];
      this.selectedText.setText(`${def.display}\n${formatStatValue(def, this.player.stats[selected])}`);
    }

    this.infoText.setText(this.renderInfo());
    this.panelBg.setSize(PANEL_WIDTH, this.infoText.y + this.infoText.height + 10 - this.panelBg.y);
  }

  private renderList(): string {
    const stats = this.player.stats;
    const lines: string[] = ["-- DEBUG (` or shake to close) --", ""];

    STAT_ORDER.forEach((stat, i) => {
      const def = STAT_DEFS[stat];
      const cursor = i === this.selectedIndex ? "> " : "  ";
      const mod = this.player.debugModAmount(stat);
      const roundedMod = Math.round(mod * 100) / 100;
      const modTag = roundedMod !== 0 ? ` (dbg ${roundedMod > 0 ? "+" : ""}${roundedMod})` : "";
      lines.push(`${cursor}${def.display.padEnd(14)} ${formatStatValue(def, stats[stat])}${modTag}`);
    });

    const coneCursor = this.selectedIndex === FIRING_CONE_INDEX ? "> " : "  ";
    lines.push(`${coneCursor}${"Firing Cone".padEnd(14)} ${this.player.debugFiringConeDeg.toFixed(0)}°`);

    const forkConeCursor = this.selectedIndex === FORK_CONE_INDEX ? "> " : "  ";
    lines.push(`${forkConeCursor}${"Fork Cone".padEnd(14)} ${this.player.effectiveForkConeDeg.toFixed(0)}°`);

    const spawnRateCursor = this.selectedIndex === SPAWN_RATE_INDEX ? "> " : "  ";
    lines.push(`${spawnRateCursor}${"Spawn Rate".padEnd(14)} ${this.player.effectiveEnemySpawnIntervalMs.toFixed(0)}ms`);

    const hitboxesCursor = this.selectedIndex === HITBOXES_INDEX ? "> " : "  ";
    lines.push(`${hitboxesCursor}${"Hitboxes".padEnd(14)} ${this.player.debugShowHitboxes ? "ON" : "OFF"}`);

    return lines.join("\n");
  }

  private renderInfo(): string {
    const stats = this.player.stats;
    const lines: string[] = ["-- weapon (placeholder) --"];

    const shotsPerSec = TUNING.weapons.baseFireRate * stats.attackSpeed;
    const avgHit = stats.damage * expectedCritFactor(stats.critChance, stats.critDamage);
    lines.push(`shots/s: ${shotsPerSec.toFixed(2)}   avg hit: ${avgHit.toFixed(1)}`);

    const behavior = this.player.projectileBehaviors[0];
    if (behavior) {
      lines.push(`pierce tail hits: ${behavior.tailHitFractions.length}   forked lines: ${behavior.flatLineCount}`);
      lines.push(`blast: radius ${stats.blastRadius.toFixed(0)}px @ ${(behavior.blastDamageFraction * 100).toFixed(0)}%`);
    }

    return lines.join("\n");
  }
}
