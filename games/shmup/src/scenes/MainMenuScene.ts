import Phaser from "phaser";
import { GAME_WIDTH, GAME_HEIGHT } from "../config";
import { copy } from "../content";
import { createNewCareer, hasCareerSave, saveCareer } from "../systems/career";
import { SCENE_KEYS } from "./sceneData";

interface MenuEntry {
  labelKey: string;
  enabled: boolean;
  onSelect: () => void;
}

const BUTTON_WIDTH = GAME_WIDTH - 120;
const BUTTON_HEIGHT = 84;
const BUTTON_GAP = 22;
const FIRST_BUTTON_Y = GAME_HEIGHT * 0.5;

/**
 * The title / main-menu screen and top-level app hub (S3 #173): boot lands
 * here, "New Career"/"Continue" are the only two doors into the map, and a
 * finished career (ResolveScene's Cancelled screen) comes back here rather
 * than auto-starting a new one — this scene owns every high-level
 * menu<->game<->results transition so nothing else needs to know how a
 * career starts or resumes. Settings/Hall of Fame are stub destinations
 * until their own Epic 4 issues land.
 */
export class MainMenuScene extends Phaser.Scene {
  private entries: MenuEntry[] = [];
  private buttons: Phaser.GameObjects.Rectangle[] = [];
  private selected = 0;

  constructor() {
    super(SCENE_KEYS.mainMenu);
  }

  create() {
    this.selected = 0;
    this.buttons = [];
    this.entries = this.buildEntries();

    const cx = GAME_WIDTH / 2;

    this.add
      .text(cx, GAME_HEIGHT * 0.16, copy("intro.presents"), {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#ff6b00",
      })
      .setOrigin(0.5);

    this.add
      .text(cx, GAME_HEIGHT * 0.24, copy("game.title"), {
        fontFamily: "monospace",
        fontSize: "56px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    this.add
      .text(cx, GAME_HEIGHT * 0.33, copy("intro.sticker"), {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#7b3dbe",
      })
      .setOrigin(0.5);

    this.entries.forEach((entry, i) => this.renderButton(entry, i));

    this.add
      .text(cx, GAME_HEIGHT - 40, copy("menu.hint"), {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#888888",
      })
      .setOrigin(0.5);

    this.refreshSelection();
    this.bindKeyboard();
  }

  private buildEntries(): MenuEntry[] {
    const canContinue = hasCareerSave();
    return [
      {
        labelKey: "menu.newCareer",
        enabled: true,
        onSelect: () => {
          saveCareer(createNewCareer());
          this.scene.start(SCENE_KEYS.map);
        },
      },
      {
        labelKey: canContinue ? "menu.continue" : "menu.continue.disabled",
        enabled: canContinue,
        onSelect: () => this.scene.start(SCENE_KEYS.map),
      },
      {
        // Sits above Settings deliberately: while `/shmup-editor` content
        // is the thing being built out, "play what I just authored" is a
        // first-class door into the game, not a buried debug affordance.
        labelKey: "menu.encounterTest",
        enabled: true,
        onSelect: () => this.scene.start(SCENE_KEYS.encounterSelect),
      },
      {
        labelKey: "menu.settings",
        enabled: true,
        onSelect: () => this.scene.start(SCENE_KEYS.settings),
      },
      {
        labelKey: "menu.hallOfFame",
        enabled: true,
        onSelect: () => this.scene.start(SCENE_KEYS.hallOfFame),
      },
    ];
  }

  private renderButton(entry: MenuEntry, index: number): void {
    const cx = GAME_WIDTH / 2;
    const y = FIRST_BUTTON_Y + index * (BUTTON_HEIGHT + BUTTON_GAP);

    const box = this.add
      .rectangle(cx, y, BUTTON_WIDTH, BUTTON_HEIGHT, entry.enabled ? 0x2a1000 : 0x1a1a1a)
      .setStrokeStyle(3, entry.enabled ? 0x7b3dbe : 0x444444);
    this.add
      .text(cx, y, copy(entry.labelKey), {
        fontFamily: "monospace",
        fontSize: "18px",
        color: entry.enabled ? "#ffffff" : "#666666",
      })
      .setOrigin(0.5);

    // Disabled entries (Continue with no save) render greyed and stay
    // non-interactive — no tap target at all, matching root CLAUDE.md's
    // "large tap targets, no hover-only affordances" for the enabled ones.
    if (entry.enabled) {
      box.setInteractive({ useHandCursor: true });
      box.on("pointerover", () => {
        this.selected = index;
        this.refreshSelection();
      });
      box.on("pointerdown", () => this.activate(index));
    }

    this.buttons.push(box);
  }

  private bindKeyboard(): void {
    const kb = this.input.keyboard;
    kb?.on("keydown-UP", () => this.move(-1));
    kb?.on("keydown-DOWN", () => this.move(1));
    kb?.on("keydown-W", () => this.move(-1));
    kb?.on("keydown-S", () => this.move(1));
    kb?.on("keydown-ENTER", () => this.activate(this.selected));
    kb?.on("keydown-SPACE", () => this.activate(this.selected));
  }

  /** Cycles selection, skipping disabled entries so a keyboard-only player never lands on an unusable option. */
  private move(delta: number): void {
    const len = this.entries.length;
    let next = this.selected;
    for (let i = 0; i < len; i++) {
      next = (next + delta + len) % len;
      if (this.entries[next].enabled) break;
    }
    this.selected = next;
    this.refreshSelection();
  }

  private refreshSelection(): void {
    this.buttons.forEach((box, i) => {
      const entry = this.entries[i];
      const isSelected = i === this.selected;
      box.setStrokeStyle(isSelected && entry.enabled ? 4 : 3, entry.enabled ? (isSelected ? 0xffcc88 : 0x7b3dbe) : 0x444444);
    });
  }

  private activate(index: number): void {
    const entry = this.entries[index];
    if (!entry.enabled) return;
    this.selected = index;
    this.refreshSelection();
    entry.onSelect();
  }
}
