import Phaser from "phaser";
import { BuildingType } from "../../data/buildings";
import { TILE_SIZE } from "../../constants";

// Base Building class
export class Building extends Phaser.GameObjects.Container {
  protected sprite: Phaser.GameObjects.Sprite;
  protected buildingType: BuildingType;
  protected label: Phaser.GameObjects.Text;
  public tileWidth: number = 1;
  public tileHeight: number = 1;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    buildingType: BuildingType,
    tileWidth: number = 1,
    tileHeight: number = 1
  ) {
    // The x and y coordinates are the center of the building
    super(scene, x, y);
    this.buildingType = buildingType;
    this.tileWidth = tileWidth;
    this.tileHeight = tileHeight;

    console.log(
      `Creating Building: ${buildingType} at (${x}, ${y}) with size ${tileWidth}x${tileHeight}`
    );

    // Create the building sprite at the origin (0,0) of the container
    this.sprite = scene.add.sprite(0, 0, buildingType);

    // Set the display size based on the tile dimensions
    this.sprite.setDisplaySize(TILE_SIZE * tileWidth, TILE_SIZE * tileHeight);

    // Center the sprite within the container
    this.sprite.setOrigin(0.5, 0.5);

    // Add the sprite to the container
    this.add(this.sprite);

    // Add to scene
    scene.add.existing(this);
  }

  protected getBuildingName(): string {
    // Default implementation, should be overridden by subclasses
    return this.buildingType;
  }

  public update(time?: number, delta?: number): void {
    // Base update method, to be overridden by subclasses
    console.log(`Base Building.update called for ${this.buildingType}`);
  }
}
