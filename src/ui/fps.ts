// Add this to your UI initialization function (likely createUI or similar)
export function createFPS(scene: Phaser.Scene): Phaser.GameObjects.Text {
  // Create FPS text in top right corner
  const fpsText = scene.add
    .text(scene.cameras.main.width - 10, 10, "FPS: 0", {
      fontFamily: "Arial",
      fontSize: "18px", // Slightly larger
      color: "#ffff00", // Yellow color for better visibility
      stroke: "#000000", // Black outline
      strokeThickness: 2, // Outline thickness
    })
    .setOrigin(1, 0); // Right-aligned

  // Make it fixed to the camera so it doesn't move with the game world
  fpsText.setScrollFactor(0);

  // Ensure it's on top of other UI elements
  fpsText.setDepth(1000);

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
