import Phaser from "phaser";
import { BuildingType } from "../../data/buildings";

// Base Building class
export class Building extends Phaser.GameObjects.Container {
  protected sprite: Phaser.GameObjects.Sprite;
  protected buildingType: BuildingType;
  protected label: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    buildingType: BuildingType
  ) {
    super(scene, x, y);
    this.buildingType = buildingType;

    // Create the building sprite
    this.sprite = scene.add.sprite(0, 0, buildingType);
    this.sprite.setDisplaySize(64, 64);
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
  }
}
