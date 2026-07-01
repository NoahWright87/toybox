import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import { TUNING } from "../tuning";
import { copy, ratingsTierForScore, ratingsTierRank } from "../content";
import { loadCareer, saveCareer } from "../systems/career";
import type { CareerState } from "../systems/career";
import { STAT_DEFS, formatStatValue } from "../systems/stats";
import type { MainStatId } from "../systems/stats";
import { nextRerollCost, rollLevelUpOffers } from "../systems/economy";
import { SCENE_KEYS } from "./sceneData";
import type { LevelUpLaunchData, ShopLaunchData } from "./sceneData";

/**
 * Level-up picks (economy.spec.todo.md's hard rule): resolved ONLY at the
 * end-of-level break, never mid-play. ResolveScene hands off the total
 * number of levels gained this episode; this scene resolves them one at a
 * time, in sequence — each pick offers 4 MAIN stats with reroll, per the
 * spec ("if you gained multiple levels during the level, you pick multiple
 * times, in sequence, at that break"). `scene.restart()` re-enters `init`/
 * `create` for the next pick, matching the pattern PlayScene already uses
 * for its own per-episode reset.
 */
export class LevelUpScene extends Phaser.Scene {
  private launch!: LevelUpLaunchData;
  private career!: CareerState;
  private ratingsRank = 0;
  private offers: MainStatId[] = [];
  private rerollsUsedThisPick = 0;
  private optionObjects: Phaser.GameObjects.GameObject[] = [];
  private rerollText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;

  constructor() {
    super(SCENE_KEYS.levelUp);
  }

  init(data: LevelUpLaunchData) {
    this.launch = data;
  }

  create() {
    this.career = loadCareer();
    this.ratingsRank = ratingsTierRank(ratingsTierForScore(this.career.ratings));
    this.rerollsUsedThisPick = 0;
    this.offers = rollLevelUpOffers();
    this.optionObjects = [];

    this.add
      .text(GAME_WIDTH / 2, 90, copy("levelup.title"), {
        fontFamily: "monospace",
        fontSize: "28px",
        color: "#ffcc00",
      })
      .setOrigin(0.5);

    const current = this.launch.totalPicks - this.launch.picksRemaining + 1;
    this.add
      .text(GAME_WIDTH / 2, 140, copy("levelup.pickPrompt", { current, total: this.launch.totalPicks }), {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    this.statusText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 140, "", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#ff6666",
      })
      .setOrigin(0.5);

    this.renderOptions();
    this.renderReroll();
  }

  private renderOptions(): void {
    for (const obj of this.optionObjects) obj.destroy();
    this.optionObjects = [];

    const startY = 260;
    const gap = 130;
    this.offers.forEach((stat, i) => {
      const def = STAT_DEFS[stat];
      const amount = TUNING.economy.mainStatPickAmount[stat];
      const y = startY + i * gap;

      const box = this.add
        .rectangle(GAME_WIDTH / 2, y, GAME_WIDTH - 80, 100, 0x2a1000)
        .setStrokeStyle(2, 0xff6b00)
        .setInteractive({ useHandCursor: true });
      const label = this.add
        .text(GAME_WIDTH / 2, y - 16, def.display, {
          fontFamily: "monospace",
          fontSize: "16px",
          color: "#ffffff",
        })
        .setOrigin(0.5);
      const amountLabel = this.add
        .text(GAME_WIDTH / 2, y + 16, `+${formatStatValue(def, amount)}`, {
          fontFamily: "monospace",
          fontSize: "14px",
          color: "#ffcc88",
        })
        .setOrigin(0.5);

      box.on("pointerdown", () => this.pick(stat));
      this.optionObjects.push(label, amountLabel, box);
    });
  }

  private renderReroll(): void {
    const cost = nextRerollCost(this.rerollsUsedThisPick, this.ratingsRank);
    const label = cost <= 0 ? copy("reroll.free") : copy("reroll.cost", { cost: Math.round(cost) });

    this.rerollText?.destroy();
    this.rerollText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 190, label, {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#7b3dbe",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.rerollText.on("pointerdown", () => this.reroll());
  }

  private reroll(): void {
    const cost = nextRerollCost(this.rerollsUsedThisPick, this.ratingsRank);
    if (this.career.gold < cost) {
      this.statusText.setText(copy("reroll.cantAfford"));
      return;
    }
    this.career = { ...this.career, gold: this.career.gold - cost };
    saveCareer(this.career);
    this.rerollsUsedThisPick += 1;
    this.offers = rollLevelUpOffers();
    this.statusText.setText("");
    this.renderOptions();
    this.renderReroll();
  }

  private pick(stat: MainStatId): void {
    const statPicks = { ...this.career.statPicks, [stat]: (this.career.statPicks[stat] ?? 0) + 1 };
    saveCareer({ ...this.career, statPicks });

    const remaining = this.launch.picksRemaining - 1;
    if (remaining > 0) {
      this.scene.restart({ picksRemaining: remaining, totalPicks: this.launch.totalPicks } satisfies LevelUpLaunchData);
    } else {
      this.scene.start(SCENE_KEYS.shop, { variant: "baseline" } satisfies ShopLaunchData);
    }
  }
}
