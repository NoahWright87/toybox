import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { PlayScene } from "./scenes/PlayScene";
import { GAME_WIDTH, GAME_HEIGHT } from "./config";

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
    // Arcade physics + object pooling is the perf plan (see specs).
    default: "arcade",
    arcade: { debug: false },
  },
  scene: [BootScene, PlayScene],
});
