import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import { copy, ratingsTierForScore, ratingsTierName, weaponById } from "../content";
import { applyRatingsDelta } from "../systems/hype";
import { advanceDeadline } from "../systems/map";
import { advanceToNextSeason, createNewCareer, loadCareer, saveCareer } from "../systems/career";
import type { CareerState } from "../systems/career";
import { resolveLoadout } from "../systems/effects";
import { SCENE_KEYS } from "./sceneData";
import type { ResolveLaunchData } from "./sceneData";

/**
 * The resolve screen (run-structure.spec.todo.md, F8 #136's episode flow):
 * "enter an episode -> on clear/end, a resolve screen cashes Hype into
 * Ratings -> return to the map." This is the ONLY place a career mutation is
 * persisted — PlayScene and MapScene both just hand off a ResolveLaunchData
 * and let this scene load the current career, apply the delta, and save.
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

    if (this.episode.nodeType === "bossFinale") {
      if (this.episode.isSeriesFinale) {
        const updated: CareerState = {
          ...career,
          ratings: result.ratings,
          finaleScore: result.ratings,
          phase: "syndication",
          syndicationEpisodeIndex: 0,
          savedAt: Date.now(),
        };
        saveCareer(updated);
        this.showSeriesFinale(updated);
        return;
      }

      const advanced = advanceToNextSeason({ ...career, ratings: result.ratings });
      saveCareer(advanced);
      this.showSeasonFinale(advanced, career.season);
      return;
    }

    const playerSpeed = this.resolvedPlayerSpeed(career);
    const updated: CareerState = {
      ...career,
      ratings: result.ratings,
      currentNodeId: this.episode.nodeId,
      visitedNodeIds: [...career.visitedNodeIds, this.episode.nodeId],
      deadlinePosition: advanceDeadline(career.deadlinePosition, playerSpeed),
      savedAt: Date.now(),
    };
    saveCareer(updated);
    this.showNodeResult(updated);
  }

  private resolveSyndication(career: CareerState): void {
    const result = applyRatingsDelta(career.ratings, this.episode.ratingsDelta);

    if (result.cancelled) {
      this.showCancelled(career.ratings);
      return;
    }

    const updated: CareerState = {
      ...career,
      ratings: result.ratings,
      syndicationEpisodeIndex: career.syndicationEpisodeIndex + 1,
      savedAt: Date.now(),
    };
    saveCareer(updated);
    this.showSyndicationEpisodeResult(updated);
  }

  private resolvedPlayerSpeed(career: CareerState): number {
    const weapons = career.weapons.map((w) => ({ weapon: weaponById(w.weaponId), tier: w.tier }));
    return resolveLoadout({ weapons }).stats.playerSpeed;
  }

  private outcomeLines(): string[] {
    if (this.episode.outcome === "death") {
      return [
        copy("play.episodeOver.title"),
        "",
        copy("play.episodeOver.score", { score: this.episode.score }),
        copy("play.episodeOver.ratingsLoss", { ratings: Math.round(-this.episode.ratingsDelta) }),
      ];
    }
    return [
      copy("play.episodeClear.title"),
      "",
      copy("play.episodeClear.score", { score: this.episode.score }),
      copy("play.episodeClear.ratingsGain", { ratings: Math.round(this.episode.ratingsDelta) }),
    ];
  }

  private showNodeResult(career: CareerState): void {
    this.render(
      [...this.outcomeLines(), "", this.ratingsLine(career), "", copy("play.continuePrompt")],
      () => this.scene.start(SCENE_KEYS.map)
    );
  }

  private showSeasonFinale(career: CareerState, justResolvedSeason: number): void {
    this.render(
      [
        copy("season.finale.title"),
        copy("season.finale.flavor"),
        "",
        ...this.outcomeLines(),
        "",
        this.ratingsLine(career),
        "",
        `Season ${justResolvedSeason + 1}`,
        copy("play.continuePrompt"),
      ],
      () => this.scene.start(SCENE_KEYS.map)
    );
  }

  private showSeriesFinale(career: CareerState): void {
    this.render(
      [
        copy("series.finale.title"),
        copy("series.finale.flavor"),
        "",
        ...this.outcomeLines(),
        "",
        this.ratingsLine(career),
        copy("resolve.finaleScore", { score: Math.round(career.finaleScore ?? 0) }),
        "",
        copy("syndication.title"),
        copy("syndication.flavor"),
        "",
        copy("play.continuePrompt"),
      ],
      () => this.scene.start(SCENE_KEYS.map)
    );
  }

  private showSyndicationEpisodeResult(career: CareerState): void {
    this.render(
      [...this.outcomeLines(), "", this.ratingsLine(career), "", copy("play.continuePrompt")],
      () => this.scene.start(SCENE_KEYS.map)
    );
  }

  /** Cumulative Ratings < 0 is Cancelled — the career ends here; no meta-progression carries into the next one. `syndicationScore` is only recorded when the cancellation happened during Syndication. */
  private showCancelled(syndicationScore: number | null): void {
    const lines = [
      copy("cancelled.title"),
      copy("cancelled.flavor", { playerName: "Pilot" }),
      "",
      copy("play.episodeOver.score", { score: this.episode.score }),
    ];
    if (syndicationScore !== null) lines.push(copy("resolve.syndicationScore", { score: Math.round(syndicationScore) }));
    lines.push("", copy("cancelled.restartPrompt"));

    this.render(lines, () => {
      saveCareer(createNewCareer());
      this.scene.start(SCENE_KEYS.map);
    });
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
