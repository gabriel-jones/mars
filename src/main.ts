import Phaser from "phaser";
import { MainScene } from "./scenes/MainScene";

//  Find out more information about the Game Config at:
//  https://newdocs.phaser.io/docs/3.70.0/Phaser.Types.Core.GameConfig
// const config: Types.Core.GameConfig = {
//   type: AUTO,
//   width: 1024,
//   height: 768,
//   parent: "game-container",
//   backgroundColor: "#028af8",
//   scale: {
//     mode: Scale.FIT,
//     autoCenter: Scale.CENTER_BOTH,
//   },
//   scene: [MainScene],
// };

// Game configuration
export const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 0 }, // No gravity for top-down game
      debug: false,
    },
  },
  scene: [MainScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

// Game constants
export const TILE_SIZE = 64;
export const PLAYER_VELOCITY = 250;

export default new Phaser.Game(config);
