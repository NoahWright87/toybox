import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";

// Base design resolution; Phaser scales to fit the fullscreen container.
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: "#0c0400",
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    // Arcade physics + object pooling is the perf plan (see specs/overview.spec.md).
    default: "arcade",
    arcade: { debug: false },
  },
  scene: [BootScene],
});
