import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import { chassisById, copy, itemById, ratingsTierForScore, ratingsTierName, weaponById } from "../content";
import { applyRatingsDelta } from "../systems/hype";
import { advanceDeadline } from "../systems/map";
import { advanceToNextSeason, loadCareer, saveCareer } from "../systems/career";
import type { CareerState } from "../systems/career";
import { applyExpGain, statPickMods } from "../systems/economy";
import { resolveLoadout } from "../systems/effects";
import type { OwnedItem } from "../systems/effects";
import { SCENE_KEYS } from "./sceneData";
import type { LevelUpLaunchData, ResolveLaunchData, ShopLaunchData } from "./sceneData";

/**
 * The resolve screen (run-structure.spec.todo.md, F8 #136's episode flow):
 * "enter an episode -> on clear/end, a resolve screen cashes Hype into
 * Ratings -> return to the map." This is the ONLY place a career mutation is
 * persisted — PlayScene and MapScene both just hand off a ResolveLaunchData
 * and let this scene load the current career, apply the delta, and save.
 *
 * F9 #137 extends this: EXP earned during the episode is rolled into
 * CareerState.level/exp here, and gold collected is banked. The end-of-level
 * break (economy.spec.todo.md's hard rule — level-ups and the baseline shop
 * NEVER happen mid-play) is this scene routing onward to LevelUpScene (once
 * per level gained, sequentially) and/or ShopScene instead of straight back
 * to the map — see `routeAfterResolve`.
 */
export class ResolveScene extends Phaser.Scene {
  private episode!: ResolveLaunchData;

  constructor() {
    super(SCENE_KEYS.resolve);
  }

  init(data: ResolveLaunchData) {
    this.episode = data;
  }

  create() {
    const career = loadCareer();
    if (career.phase === "syndication") {
      this.resolveSyndication(career);
    } else {
      this.resolveCareer(career);
    }
  }

  private resolveCareer(career: CareerState): void {
    const result = applyRatingsDelta(career.ratings, this.episode.ratingsDelta);

    if (result.cancelled) {
      this.showCancelled(null);
      return;
    }

    const economy = applyExpGain({ level: career.level, exp: career.exp }, this.episode.expGained);
    const gold = career.gold + this.episode.goldCollected;

    if (this.episode.nodeType === "bossFinale") {
      if (this.episode.isSeriesFinale) {
        const updated: CareerState = {
          ...career,
          ratings: result.ratings,
          gold,
          level: economy.level,
          exp: economy.exp,
          finaleScore: result.ratings,
          phase: "syndication",
          syndicationEpisodeIndex: 0,
          savedAt: Date.now(),
        };
        saveCareer(updated);
        this.showSeriesFinale(updated, economy.levelsGained);
        return;
      }

      const advanced = advanceToNextSeason({ ...career, ratings: result.ratings, gold, level: economy.level, exp: economy.exp });
      saveCareer(advanced);
      this.showSeasonFinale(advanced, career.season, economy.levelsGained);
      return;
    }

    const playerSpeed = this.resolvedPlayerSpeed(career);
    const updated: CareerState = {
      ...career,
      ratings: result.ratings,
      gold,
      level: economy.level,
      exp: economy.exp,
      currentNodeId: this.episode.nodeId,
      visitedNodeIds: [...career.visitedNodeIds, this.episode.nodeId],
      deadlinePosition: advanceDeadline(career.deadlinePosition, playerSpeed),
      savedAt: Date.now(),
    };
    saveCareer(updated);
    this.showNodeResult(updated, economy.levelsGained);
  }

  private resolveSyndication(career: CareerState): void {
    const result = applyRatingsDelta(career.ratings, this.episode.ratingsDelta);

    if (result.cancelled) {
      this.showCancelled(career.ratings);
      return;
    }

    const economy = applyExpGain({ level: career.level, exp: career.exp }, this.episode.expGained);
    const updated: CareerState = {
      ...career,
      ratings: result.ratings,
      gold: career.gold + this.episode.goldCollected,
      level: economy.level,
      exp: economy.exp,
      syndicationEpisodeIndex: career.syndicationEpisodeIndex + 1,
      savedAt: Date.now(),
    };
    saveCareer(updated);
    this.showSyndicationEpisodeResult(updated, economy.levelsGained);
  }

  /** Full resolved build (weapons + items + level-up stat picks) — used for Player Speed's overworld-deadline effect. */
  private resolvedPlayerSpeed(career: CareerState): number {
    const weapons = career.weapons.map((w) => ({ weapon: weaponById(w.weaponId), tier: w.tier }));
    const items: OwnedItem[] = career.items
      .map((ref) => {
        const item = itemById(ref.itemId);
        return item ? { item, count: ref.count } : undefined;
      })
      .filter((owned): owned is OwnedItem => owned !== undefined);
    const chassis = chassisById(career.chassisId);
    return resolveLoadout({
      weapons,
      items,
      chassisBase: chassis.statBase,
      chassisMods: chassis.mods,
      statPickMods: statPickMods(career.statPicks),
      maxWeaponSlots: chassis.maxWeaponSlots,
    }).stats.playerSpeed;
  }

  /**
   * Routes onward from the resolve screen's "continue" per economy.spec.todo.md's
   * end-of-level break (F9 #137): a combat episode (`outcome !== "special"`)
   * always gets the small baseline shop, with any level-ups gained resolved
   * first, one pick at a time, in sequence — the hard rule that a level-up
   * never interrupts play, only ever resolving at this break. A dedicated
   * shop map node (`outcome === "special"`, `nodeType === "shop"`) instead
   * gets the bigger dedicated-node shop, no level-ups (no episode was
   * played). Any other special node (event/treasure) returns straight to
   * the map, unchanged from before F9.
   */
  private routeAfterResolve(levelsGained: number): void {
    if (this.episode.outcome !== "special") {
      if (levelsGained > 0) {
        this.scene.start(SCENE_KEYS.levelUp, {
          picksRemaining: levelsGained,
          totalPicks: levelsGained,
        } satisfies LevelUpLaunchData);
      } else {
        this.scene.start(SCENE_KEYS.shop, { variant: "baseline" } satisfies ShopLaunchData);
      }
      return;
    }
    if (this.episode.nodeType === "shop") {
      this.scene.start(SCENE_KEYS.shop, { variant: "node" } satisfies ShopLaunchData);
      return;
    }
    this.scene.start(SCENE_KEYS.map);
  }

  private outcomeLines(): string[] {
    const lines =
      this.episode.outcome === "death"
        ? [
            copy("play.episodeOver.title"),
            "",
            copy("play.episodeOver.score", { score: this.episode.score }),
            copy("play.episodeOver.ratingsLoss", { ratings: Math.round(-this.episode.ratingsDelta) }),
          ]
        : [
            copy("play.episodeClear.title"),
            "",
            copy("play.episodeClear.score", { score: this.episode.score }),
            copy("play.episodeClear.ratingsGain", { ratings: Math.round(this.episode.ratingsDelta) }),
          ];
    // Gold/EXP only ever come from an actual episode — special (shop/event/
    // treasure) nodes never run PlayScene, so goldCollected/expGained are 0.
    if (this.episode.goldCollected > 0) lines.push(copy("resolve.goldCollected", { gold: this.episode.goldCollected }));
    return lines;
  }

  /** A non-empty line only when at least one level was gained this episode — shown as a preview before LevelUpScene actually resolves the picks. */
  private levelUpLines(levelsGained: number): string[] {
    return levelsGained > 0 ? [copy("resolve.levelUp", { count: levelsGained })] : [];
  }

  private showNodeResult(career: CareerState, levelsGained: number): void {
    this.render(
      [...this.outcomeLines(), ...this.levelUpLines(levelsGained), "", this.ratingsLine(career), "", copy("play.continuePrompt")],
      () => this.routeAfterResolve(levelsGained)
    );
  }

  private showSeasonFinale(career: CareerState, justResolvedSeason: number, levelsGained: number): void {
    this.render(
      [
        copy("season.finale.title"),
        copy("season.finale.flavor"),
        "",
        ...this.outcomeLines(),
        ...this.levelUpLines(levelsGained),
        "",
        this.ratingsLine(career),
        "",
        `Season ${justResolvedSeason + 1}`,
        copy("play.continuePrompt"),
      ],
      () => this.routeAfterResolve(levelsGained)
    );
  }

  private showSeriesFinale(career: CareerState, levelsGained: number): void {
    this.render(
      [
        copy("series.finale.title"),
        copy("series.finale.flavor"),
        "",
        ...this.outcomeLines(),
        ...this.levelUpLines(levelsGained),
        "",
        this.ratingsLine(career),
        copy("resolve.finaleScore", { score: Math.round(career.finaleScore ?? 0) }),
        "",
        copy("syndication.title"),
        copy("syndication.flavor"),
        "",
        copy("play.continuePrompt"),
      ],
      () => this.routeAfterResolve(levelsGained)
    );
  }

  private showSyndicationEpisodeResult(career: CareerState, levelsGained: number): void {
    this.render(
      [...this.outcomeLines(), ...this.levelUpLines(levelsGained), "", this.ratingsLine(career), "", copy("play.continuePrompt")],
      () => this.routeAfterResolve(levelsGained)
    );
  }

  /**
   * Cumulative Ratings < 0 is Cancelled — the career ends here; no
   * meta-progression carries into the next one. `syndicationScore` is only
   * recorded when the cancellation happened during Syndication. Per the
   * app-level flow (S3 #173: boot -> menu -> game -> results -> menu), a
   * finished career lands back on MainMenuScene rather than auto-starting a
   * new one — the player picks New Career from there themselves.
   */
  private showCancelled(syndicationScore: number | null): void {
    const lines = [
      copy("cancelled.title"),
      copy("cancelled.flavor", { playerName: "Pilot" }),
      "",
      copy("play.episodeOver.score", { score: this.episode.score }),
    ];
    if (syndicationScore !== null) lines.push(copy("resolve.syndicationScore", { score: Math.round(syndicationScore) }));
    lines.push("", copy("cancelled.restartPrompt"));

    this.render(lines, () => this.scene.start(SCENE_KEYS.mainMenu));
  }

  private ratingsLine(career: CareerState): string {
    return copy("resolve.ratingsLine", {
      ratings: Math.round(career.ratings),
      tier: ratingsTierName(ratingsTierForScore(career.ratings)),
    });
  }

  private render(lines: string[], onContinue: () => void): void {
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, lines.join("\n"), {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#ff6b00",
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(200);

    const proceed = () => onContinue();
    this.input.keyboard?.once("keydown", proceed);
    this.input.once("pointerdown", proceed);
  }
}
