import Phaser from "phaser";
import { Building } from "./Building";

export class Habitat extends Building {
  protected habitatWidth: number;
  protected habitatHeight: number;
  protected habitatId: string;
  protected habitatTiles: { x: number; y: number }[] = [];

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

    // Create a visual representation of the habitat area
    const habitatArea = scene.add.rectangle(
      0,
      0, // Relative to container
      width * 64, // Assuming 64 is the tile size
      height * 64,
      0x0088ff,
      0.2
    );
    habitatArea.setStrokeStyle(2, 0x0088ff);
    this.add(habitatArea);

    // Resize the sprite to match the habitat size
    this.sprite.setDisplaySize(width * 64, height * 64);

    // Update the label position
    this.label.setPosition(0, -height * 32 - 20);
  }

  protected getBuildingName(): string {
    return `Habitat ${this.habitatId}`;
  }

  public setTiles(tiles: { x: number; y: number }[]): void {
    this.habitatTiles = tiles;
  }

  public getTiles(): { x: number; y: number }[] {
    return this.habitatTiles;
  }

  public getHabitatId(): string {
    return this.habitatId;
  }

  public update(): void {
    // Habitat-specific update logic
  }
}
