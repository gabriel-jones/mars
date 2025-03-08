import { DEFAULT_FONT } from "../constants";
import { DEPTH } from "../depth";

// Add this to your UI initialization function (likely createUI or similar)
export function createFPS(scene: Phaser.Scene): Phaser.GameObjects.Text {
  // Create FPS text in top right corner
  const fpsText = scene.add
    .text(scene.cameras.main.width - 10, 10, "FPS: 0", {
      fontFamily: DEFAULT_FONT,
      fontSize: "18px", // Slightly larger
      color: "#ffffff", // Yellow color for better visibility
    })
    .setAlpha(0.8)
    .setOrigin(1, 0); // Right-aligned

  // Make it fixed to the camera so it doesn't move with the game world
  fpsText.setScrollFactor(0);

  // Ensure it's on top of other UI elements
  fpsText.setDepth(DEPTH.UI);

  return fpsText;
}

// Add this function to update the FPS display
export function updateFPS(
  fpsText: Phaser.GameObjects.Text,
  scene: Phaser.Scene
) {
  if (fpsText) {
    fpsText.setText(`FPS: ${Math.round(scene.game.loop.actualFps)}`);
  }
}
