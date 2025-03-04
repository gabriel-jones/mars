import Phaser from "phaser";
import { TILE_SIZE } from "./config";

// Create tile highlight
export function createTileHighlight(
  scene: Phaser.Scene
): Phaser.GameObjects.Rectangle {
  const highlightRect = scene.add.rectangle(
    0,
    0,
    TILE_SIZE,
    TILE_SIZE,
    0x00ff00,
    0.3
  );
  highlightRect.setOrigin(0);
  highlightRect.setVisible(false);
  return highlightRect;
}

// Update tile highlight based on mouse position
export function updateTileHighlight(
  scene: Phaser.Scene,
  highlightRect: Phaser.GameObjects.Rectangle,
  map: Phaser.Tilemaps.Tilemap,
  currentTilePos: { x: number; y: number }
): { x: number; y: number } {
  // Get the pointer position in world coordinates (accounting for camera)
  const worldPoint = scene.input.activePointer.positionToCamera(
    scene.cameras.main
  ) as Phaser.Math.Vector2;

  // Convert world position to tile position
  const tileX = map.worldToTileX(worldPoint.x);
  const tileY = map.worldToTileY(worldPoint.y);

  // Only update if the tile position has changed
  if (tileX !== currentTilePos.x || tileY !== currentTilePos.y) {
    // Convert tile position back to world position for the highlight
    const tileWorldX = map.tileToWorldX(tileX);
    const tileWorldY = map.tileToWorldY(tileY);

    // Make sure the tile is within the map bounds
    if (tileX >= 0 && tileX < map.width && tileY >= 0 && tileY < map.height) {
      // Update highlight position - center on tile
      highlightRect.setPosition(tileWorldX, tileWorldY);
      highlightRect.setVisible(true);
    } else {
      // Hide the highlight if outside the map
      highlightRect.setVisible(false);
    }

    // Return the new tile position
    return { x: tileX, y: tileY };
  }

  return currentTilePos;
}

export class UI {
  private messageText: Phaser.GameObjects.Text | null = null;
  private messageTimer: Phaser.Time.TimerEvent | null = null;

  constructor(private scene: Phaser.Scene) {}

  showMessage(message: string, duration: number = 2000) {
    if (this.messageText) {
      this.messageText.destroy();
    }

    if (this.messageTimer) {
      this.messageTimer.remove();
    }

    this.messageText = this.scene.add.text(
      this.scene.cameras.main.width / 2,
      this.scene.cameras.main.height - 100,
      message,
      {
        fontSize: "24px",
        color: "#ffffff",
        backgroundColor: "#000000",
        padding: { x: 10, y: 5 },
      }
    );
    this.messageText.setOrigin(0.5);
    this.messageText.setScrollFactor(0);
    this.messageText.setDepth(100);

    this.messageTimer = this.scene.time.delayedCall(duration, () => {
      if (this.messageText) {
        this.messageText.destroy();
        this.messageText = null;
      }
    });
  }
}
