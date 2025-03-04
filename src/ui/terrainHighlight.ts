// New file for terrain highlighting functionality
import { Scene } from "phaser";
import { CELL_SIZE } from "../constants";

export class TerrainHighlight {
  private scene: Scene;
  private highlight: Phaser.GameObjects.Rectangle;

  constructor(scene: Scene) {
    this.scene = scene;

    // Create highlight rectangle
    this.highlight = scene.add
      .rectangle(0, 0, CELL_SIZE, CELL_SIZE)
      .setStrokeStyle(2, 0xffff00)
      .setFillStyle(0xffff00, 0.3)
      .setVisible(false);
  }

  showAt(x: number, y: number): void {
    this.highlight.setPosition(x, y);
    this.highlight.setVisible(true);
  }

  hide(): void {
    this.highlight.setVisible(false);
  }

  // Additional methods as needed
}
