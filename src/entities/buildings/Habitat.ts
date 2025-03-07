import Phaser from "phaser";
import { Building } from "./Building";
import { TILE_SIZE } from "../../constants";

export class Habitat extends Building {
  protected habitatWidth: number;
  protected habitatHeight: number;
  protected habitatId: string;
  protected habitatTiles: { x: number; y: number }[] = [];
  protected floorContainer: Phaser.GameObjects.Container;
  protected wallsContainer: Phaser.GameObjects.Container;
  protected interactiveArea: Phaser.GameObjects.Rectangle | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    habitatId: string
  ) {
    super(scene, x, y, "habitat");

    this.habitatWidth = width;
    this.habitatHeight = height;
    this.habitatId = habitatId;

    // Create containers for floor and wall tiles
    this.floorContainer = scene.add.container(0, 0);
    this.wallsContainer = scene.add.container(0, 0);
    this.add(this.floorContainer);
    this.add(this.wallsContainer);

    // Hide the default sprite as we'll render our own tiles
    this.sprite.setVisible(false);

    // Update the label text and position
    this.label.setText(this.getBuildingName());
    this.label.setPosition(0, -height * 32 - 20);
  }

  protected getBuildingName(): string {
    return `Habitat ${this.habitatId}`;
  }

  public setTiles(tiles: { x: number; y: number }[]): void {
    this.habitatTiles = tiles;
    this.renderHabitat();
  }

  public getTiles(): { x: number; y: number }[] {
    return this.habitatTiles;
  }

  public getHabitatId(): string {
    return this.habitatId;
  }

  /**
   * Renders the habitat with floor tiles and wall edges
   */
  private renderHabitat(): void {
    if (!this.habitatTiles || this.habitatTiles.length === 0) {
      return;
    }

    // Clear existing tiles
    this.floorContainer.removeAll(true);
    this.wallsContainer.removeAll(true);

    // Remove existing interactive area if it exists
    if (this.interactiveArea) {
      this.interactiveArea.destroy();
      this.interactiveArea = null;
    }

    // Find the bounds of the habitat
    const minX = Math.min(...this.habitatTiles.map((t) => t.x));
    const maxX = Math.max(...this.habitatTiles.map((t) => t.x));
    const minY = Math.min(...this.habitatTiles.map((t) => t.y));
    const maxY = Math.max(...this.habitatTiles.map((t) => t.y));

    // Update the position of the habitat to be centered on the tiles
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const worldCenterX = centerX * TILE_SIZE + TILE_SIZE / 2;
    const worldCenterY = centerY * TILE_SIZE + TILE_SIZE / 2;
    this.setPosition(worldCenterX, worldCenterY);

    // Create a set of all tile positions for quick lookup
    const tileSet = new Set(this.habitatTiles.map((t) => `${t.x},${t.y}`));

    // Render floor tiles
    for (const tile of this.habitatTiles) {
      const relX = (tile.x - centerX) * TILE_SIZE;
      const relY = (tile.y - centerY) * TILE_SIZE;

      // Create floor tile
      const floorTile = this.scene.add.rectangle(
        relX,
        relY,
        TILE_SIZE,
        TILE_SIZE,
        0x888888, // Gray floor color
        1
      );
      floorTile.setOrigin(0.5);
      this.floorContainer.add(floorTile);

      // Check if this tile needs walls (edges)
      const needsWallNorth = !tileSet.has(`${tile.x},${tile.y - 1}`);
      const needsWallSouth = !tileSet.has(`${tile.x},${tile.y + 1}`);
      const needsWallEast = !tileSet.has(`${tile.x + 1},${tile.y}`);
      const needsWallWest = !tileSet.has(`${tile.x - 1},${tile.y}`);

      // Add walls where needed
      const wallThickness = 4;
      const wallColor = 0x444444; // Darker color for walls

      if (needsWallNorth) {
        const wall = this.scene.add.rectangle(
          relX,
          relY - TILE_SIZE / 2 + wallThickness / 2,
          TILE_SIZE,
          wallThickness,
          wallColor,
          1
        );
        wall.setOrigin(0.5);
        this.wallsContainer.add(wall);
      }

      if (needsWallSouth) {
        const wall = this.scene.add.rectangle(
          relX,
          relY + TILE_SIZE / 2 - wallThickness / 2,
          TILE_SIZE,
          wallThickness,
          wallColor,
          1
        );
        wall.setOrigin(0.5);
        this.wallsContainer.add(wall);
      }

      if (needsWallEast) {
        const wall = this.scene.add.rectangle(
          relX + TILE_SIZE / 2 - wallThickness / 2,
          relY,
          wallThickness,
          TILE_SIZE,
          wallColor,
          1
        );
        wall.setOrigin(0.5);
        this.wallsContainer.add(wall);
      }

      if (needsWallWest) {
        const wall = this.scene.add.rectangle(
          relX - TILE_SIZE / 2 + wallThickness / 2,
          relY,
          wallThickness,
          TILE_SIZE,
          wallColor,
          1
        );
        wall.setOrigin(0.5);
        this.wallsContainer.add(wall);
      }
    }

    // Create an invisible interactive area that covers all tiles
    // This makes the entire habitat clickable
    const width = (maxX - minX + 1) * TILE_SIZE;
    const height = (maxY - minY + 1) * TILE_SIZE;

    this.interactiveArea = this.scene.add.rectangle(
      0, // Centered on the container
      0,
      width,
      height,
      0xffffff,
      0 // Fully transparent
    );
    this.interactiveArea.setInteractive();
    this.add(this.interactiveArea);

    // Make the interactive area emit events to the parent container
    this.interactiveArea.on("pointerdown", () => {
      this.emit("pointerdown");
    });
    this.interactiveArea.on("pointerup", () => {
      this.emit("pointerup");
    });
    this.interactiveArea.on("pointerover", () => {
      this.emit("pointerover");
    });
    this.interactiveArea.on("pointerout", () => {
      this.emit("pointerout");
    });
  }

  public update(): void {
    // Habitat-specific update logic
  }
}
