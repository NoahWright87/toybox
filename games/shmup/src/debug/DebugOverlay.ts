import Phaser from "phaser";
import { MAIN_STAT_IDS, EXOTIC_STAT_IDS, STAT_DEFS, formatStatValue } from "../systems/stats";
import type { StatId } from "../systems/stats";
import { TUNING } from "../tuning";
import type { Player } from "../entities/Player";

const STAT_ORDER: StatId[] = [...MAIN_STAT_IDS, ...EXOTIC_STAT_IDS];

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

/**
 * C12 #151 ("Debug / balance instrumentation overlay") — a shell sized to
 * F6's scope: live effective stats, a way to nudge them without a real
 * level-up/item system to grant them yet, and the resulting weapon behavior
 * (pierce decay / forks / blast) so a stat's effect is visible immediately
 * instead of inferred from a balance spreadsheet. The fuller overlay #151
 * calls for (graze/hype readouts, a real build simulator) is its own job
 * once those systems (F7+) exist.
 */
export class DebugOverlay {
  private readonly text: Phaser.GameObjects.Text;
  private readonly toggleKey: Phaser.Input.Keyboard.Key;
  private readonly prevKey: Phaser.Input.Keyboard.Key;
  private readonly nextKey: Phaser.Input.Keyboard.Key;
  private readonly decKey: Phaser.Input.Keyboard.Key;
  private readonly incKey: Phaser.Input.Keyboard.Key;
  private readonly resetOneKey: Phaser.Input.Keyboard.Key;
  private readonly resetAllKey: Phaser.Input.Keyboard.Key;

  private visible = false;
  private selectedIndex = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly player: Player
  ) {
    const kb = scene.input.keyboard!;
    this.toggleKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.BACKTICK);
    this.prevKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.OPEN_BRACKET);
    this.nextKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.CLOSED_BRACKET);
    this.decKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.MINUS);
    this.incKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.PLUS);
    this.resetOneKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.ZERO);
    this.resetAllKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.BACKSPACE);

    this.text = scene.add
      .text(scene.scale.width - 16, 14, "", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#00ff88",
        backgroundColor: "#000000cc",
        padding: { x: 8, y: 6 },
        lineSpacing: 2,
      })
      .setOrigin(1, 0)
      .setDepth(300)
      .setVisible(false);
  }

  /** Call once per frame regardless of game-over state — inspecting/nudging stats shouldn't require an active run. */
  update(): void {
    if (Phaser.Input.Keyboard.JustDown(this.toggleKey)) {
      this.visible = !this.visible;
      this.text.setVisible(this.visible);
    }
    if (!this.visible) return;

    const len = STAT_ORDER.length;
    if (Phaser.Input.Keyboard.JustDown(this.prevKey)) this.selectedIndex = (this.selectedIndex - 1 + len) % len;
    if (Phaser.Input.Keyboard.JustDown(this.nextKey)) this.selectedIndex = (this.selectedIndex + 1) % len;

    const selected = STAT_ORDER[this.selectedIndex];
    if (Phaser.Input.Keyboard.JustDown(this.decKey)) this.player.nudgeDebugStat(selected, -STAT_STEP[selected]);
    if (Phaser.Input.Keyboard.JustDown(this.incKey)) this.player.nudgeDebugStat(selected, STAT_STEP[selected]);
    if (Phaser.Input.Keyboard.JustDown(this.resetOneKey)) this.player.setDebugMod(selected, 0);
    if (Phaser.Input.Keyboard.JustDown(this.resetAllKey)) this.player.clearDebugMods();

    this.text.setText(this.render());
  }

  private render(): string {
    const stats = this.player.stats;
    const lines: string[] = ["-- DEBUG (` to close) --", ""];

    STAT_ORDER.forEach((stat, i) => {
      const def = STAT_DEFS[stat];
      const cursor = i === this.selectedIndex ? "> " : "  ";
      const mod = this.player.debugModAmount(stat);
      const modTag = mod !== 0 ? ` (dbg ${mod > 0 ? "+" : ""}${mod})` : "";
      lines.push(`${cursor}${def.display.padEnd(14)} ${formatStatValue(def, stats[stat])}${modTag}`);
    });

    lines.push("");
    lines.push("[ ] select stat   - = adjust");
    lines.push("0 reset stat   Backspace reset all");
    lines.push("");
    lines.push("-- weapon (placeholder) --");

    const shotsPerSec = TUNING.weapons.baseFireRate * stats.attackSpeed;
    const avgHit = stats.damage * expectedCritFactor(stats.critChance, stats.critDamage);
    lines.push(`shots/s: ${shotsPerSec.toFixed(2)}   avg hit: ${avgHit.toFixed(1)}`);

    const behavior = this.player.projectileBehaviors[0];
    if (behavior) {
      const fractions = behavior.tailHitFractions.map((f) => f.toFixed(2)).join(", ");
      lines.push(`pierce line (${behavior.tailHitFractions.length} hits): [${fractions}]`);
      lines.push(`forked full-dmg lines: ${behavior.flatLineCount}`);
      lines.push(`blast: radius ${stats.blastRadius.toFixed(0)}px @ ${(behavior.blastDamageFraction * 100).toFixed(0)}%`);
    }

    return lines.join("\n");
  }
}
