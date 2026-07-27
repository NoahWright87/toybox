import Phaser from "phaser";
import { copy } from "../content";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import { requestMotionPermission } from "../debug/ShakeDetector";
import { createNewCareer } from "../systems/career";
import { loadAuthoredContent, tileById } from "../systems/encounters/authoredContent";
import { loadAuthoredLevel } from "../systems/encounters/authoredLevel";
import { currentPlaytestRequest, EDITOR_URL, type PlaytestRequest } from "./playtestRequest";
import { SCENE_KEYS } from "./sceneData";
import type { EpisodeLaunchData } from "./sceneData";

/**
 * Title card — proves the skeleton renders and that copy comes from the
 * content registry (specs/content-and-assets), not inline strings.
 * Press any key / tap to land on the main menu (S3 #173) — the intro splash
 * sequence itself (S2 #172) isn't built yet, so this card is the whole
 * pre-menu beat for now; a real splash can slot in ahead of it later
 * without touching where it hands off to.
 *
 * A **playtest launch** skips all of that. When `/shmup-editor` sends you
 * here with a request in the URL (`playtestRequest.ts`), the whole point is
 * to see the thing you just authored — a title card and two menus in the
 * way of that would make the authoring loop worse, not better. So this
 * scene starts the episode directly and the game never shows a menu at all
 * unless you ask for one.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create() {
    const request = currentPlaytestRequest();
    if (request && !this.playtestHasContent(request)) {
      this.showNothingToPlay();
      return;
    }
    if (request) {
      // Still worth asking here: this is the only guaranteed pre-gameplay
      // moment, and iOS only grants devicemotion from a user gesture. A
      // playtest launch has no gesture to hang it on, so it simply goes
      // without — the debug shake gesture stays unavailable, nothing breaks.
      this.startPlaytest(request);
      return;
    }

    const cx = GAME_WIDTH / 2;

    this.add
      .text(cx, GAME_HEIGHT * 0.34, copy("intro.presents"), {
        fontFamily: "monospace",
        fontSize: "28px",
        color: "#ff6b00",
      })
      .setOrigin(0.5);

    this.add
      .text(cx, GAME_HEIGHT * 0.46, copy("game.title"), {
        fontFamily: "monospace",
        fontSize: "64px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    this.add
      .text(cx, GAME_HEIGHT * 0.57, copy("intro.sticker"), {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#7b3dbe",
      })
      .setOrigin(0.5);

    const prompt = this.add
      .text(cx, GAME_HEIGHT * 0.74, "PRESS ANY KEY OR TAP TO PLAY", {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#cccccc",
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: prompt,
      alpha: 0.2,
      duration: 600,
      yoyo: true,
      repeat: -1,
    });

    // iOS gates devicemotion (shake-to-open the debug overlay) behind a
    // permission prompt that only resolves from inside a user-gesture
    // handler — this tap is the only one guaranteed before PlayScene exists.
    const start = () => {
      requestMotionPermission();
      this.scene.start(SCENE_KEYS.mainMenu);
    };
    this.input.keyboard?.once("keydown", start);
    this.input.once("pointerdown", start);
  }

  /**
   * A playtest request can point at content that has since been deleted, or
   * arrive before the Connection Viewer has ever saved a layout. Falling
   * through to a normal episode would silently run the ambient spawner and
   * look like the authored content simply didn't work, so say so instead.
   */
  private playtestHasContent(request: PlaytestRequest): boolean {
    if (request.kind === "level") return loadAuthoredLevel().placements.length > 0;
    const tile = tileById(loadAuthoredContent(), request.tileId);
    return Boolean(tile?.encounters.some((e) => e.id === request.encounterId));
  }

  private showNothingToPlay(): void {
    const cx = GAME_WIDTH / 2;
    this.add
      .text(cx, GAME_HEIGHT * 0.34, copy("encounter.missing.title"), {
        fontFamily: "monospace",
        fontSize: "32px",
        color: "#ff6666",
      })
      .setOrigin(0.5);
    this.add
      .text(cx, GAME_HEIGHT * 0.45, copy("encounter.missing.body"), {
        fontFamily: "monospace",
        fontSize: "15px",
        color: "#cccccc",
        align: "center",
        wordWrap: { width: GAME_WIDTH - 140 },
      })
      .setOrigin(0.5);
    const back = this.add
      .text(cx, GAME_HEIGHT * 0.62, copy("encounter.result.backToEditor"), {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#ffcc88",
      })
      .setOrigin(0.5);
    back.setInteractive({ useHandCursor: true });
    back.on("pointerdown", () => {
      window.location.href = EDITOR_URL;
    });
  }

  /**
   * Builds a throwaway episode around the request, using a fresh career's
   * **starting** build rather than whatever a save happens to be carrying —
   * so how authored content feels doesn't depend on an unrelated run, and
   * never drifts from the real opening loadout either. The career object is
   * discarded, never saved.
   */
  private startPlaytest(request: PlaytestRequest): void {
    const build = createNewCareer();
    this.scene.start(SCENE_KEYS.play, {
      nodeId: request.kind === "encounter" ? `playtest:${request.tileId}:${request.encounterId}` : "playtest:level",
      nodeType: "standard",
      season: build.season,
      D: request.difficulty,
      ratings: 0,
      chassisId: build.chassisId,
      weapons: build.weapons,
      items: build.items,
      statPicks: build.statPicks,
      level: build.level,
      isSeriesFinale: false,
      playtest:
        request.kind === "encounter"
          ? { tileId: request.tileId, encounterId: request.encounterId, difficulty: request.difficulty }
          : { difficulty: request.difficulty },
    } satisfies EpisodeLaunchData);
  }
}
