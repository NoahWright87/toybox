import Phaser from "phaser";
import { copy } from "../content";
import { GAME_WIDTH, GAME_HEIGHT } from "../main";

/**
 * Placeholder boot scene — proves the skeleton renders and that copy comes
 * from the content registry (see specs/content-and-assets.spec.md), not
 * inline strings. Real boot flow (Noahsoft card → menu → map) lands later.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create() {
    const cx = GAME_WIDTH / 2;

    this.add
      .text(cx, GAME_HEIGHT * 0.38, copy("intro.presents"), {
        fontFamily: "monospace",
        fontSize: "28px",
        color: "#ff6b00",
      })
      .setOrigin(0.5);

    this.add
      .text(cx, GAME_HEIGHT * 0.5, copy("game.title"), {
        fontFamily: "monospace",
        fontSize: "48px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    this.add
      .text(cx, GAME_HEIGHT * 0.62, copy("intro.sticker"), {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#7b3dbe",
      })
      .setOrigin(0.5);
  }
}
