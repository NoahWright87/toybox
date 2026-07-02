import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import { copy, ALL_CHASSIS } from "../content";
import { loadCareer, saveCareer } from "../systems/career";
import { SCENE_KEYS } from "./sceneData";

const ROW_HEIGHT = 96;
const ROW_START_Y = 130;

/**
 * The Hangar (chassis.spec.md, F10 #138 / C7 #146): a persisted, real
 * chassis-selection screen — tap any chassis in `ALL_CHASSIS` to equip it
 * onto the current career (`CareerState.chassisId`), same "id + registry
 * lookup" persistence convention as owned weapons/items. Reachable any time
 * from the map (not gated behind starting a new career), since a chassis is
 * career-persistent equipment, not a one-time character pick.
 */
export class ChassisSelectScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.chassisSelect);
  }

  create() {
    const career = loadCareer();

    this.add
      .text(GAME_WIDTH / 2, 40, copy("hangar.title"), {
        fontFamily: "monospace",
        fontSize: "26px",
        color: "#ffcc00",
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 74, copy("hangar.hint"), {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#cccccc",
      })
      .setOrigin(0.5);

    ALL_CHASSIS.forEach((chassis, i) => {
      const y = ROW_START_Y + i * ROW_HEIGHT;
      const equipped = chassis.id === career.chassisId;

      const panel = this.add
        .rectangle(GAME_WIDTH / 2, y + ROW_HEIGHT / 2 - 10, GAME_WIDTH - 48, ROW_HEIGHT - 12, 0x2a1000)
        .setStrokeStyle(3, equipped ? 0xffcc00 : 0x7b3dbe)
        .setInteractive({ useHandCursor: true });

      this.add
        .text(40, y, chassis.name, {
          fontFamily: "monospace",
          fontSize: "16px",
          color: "#ffffff",
        })
        .setOrigin(0, 0.5);

      this.add
        .text(40, y + 24, copy(`chassis.${chassis.id}.description`), {
          fontFamily: "monospace",
          fontSize: "11px",
          color: "#cccccc",
          wordWrap: { width: GAME_WIDTH - 120 },
        })
        .setOrigin(0, 0.5);

      if (equipped) {
        this.add
          .text(GAME_WIDTH - 40, y, copy("hangar.equipped"), {
            fontFamily: "monospace",
            fontSize: "12px",
            color: "#ffcc00",
          })
          .setOrigin(1, 0.5);
      }

      panel.on("pointerdown", () => {
        if (equipped) return;
        saveCareer({ ...career, chassisId: chassis.id });
        this.scene.restart();
      });
    });

    const backButton = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 40, 220, 48, 0x1a5c2e)
      .setStrokeStyle(3, 0x88ff88)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 40, copy("hangar.back"), {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    backButton.on("pointerdown", () => this.scene.start(SCENE_KEYS.map));
  }
}
