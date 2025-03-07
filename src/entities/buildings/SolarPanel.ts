import Phaser from "phaser";
import { RangeSelectionBuilding } from "./RangeSelectionBuilding";
import { TILE_SIZE } from "../../constants";

export class SolarPanel extends RangeSelectionBuilding {
  protected energyOutput: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number = 1,
    height: number = 1
  ) {
    // Use the solar-panel texture, not custom rendering
    super(scene, x, y, "solar-panel", width, height, false, false);

    // Calculate energy output based on size
    this.energyOutput = width * height * 10; // 10 energy per tile

    console.log(
      `SolarPanel constructor called with dimensions: ${width}x${height}`
    );
  }

  /**
   * Create a sprite for a tile at the given position
   * Override to customize the appearance of solar panel tiles
   */
  protected createTileSprite(
    tileX: number,
    tileY: number,
    row: number,
    col: number
  ): Phaser.GameObjects.Sprite {
    const tileSprite = this.scene.add.sprite(tileX, tileY, "solar-panel");
    tileSprite.setDisplaySize(TILE_SIZE, TILE_SIZE);
    return tileSprite;
  }

  protected getBuildingName(): string {
    return "Solar Panel";
  }

  public getEnergyOutput(): number {
    return this.energyOutput;
  }

  public update(time: number, delta: number): void {
    super.update(time, delta);
    // Solar panel specific update logic
    // Could update energy output based on time of day, etc.
  }
}

// Make the SolarPanel class available globally
(window as any).SolarPanelClass = SolarPanel;
