import Phaser from "phaser";
import { Building } from "./Building";
import { TILE_SIZE } from "../../constants";

export class SolarPanel extends Building {
  protected energyOutput: number;
  protected panelWidth: number;
  protected panelHeight: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number = 1,
    height: number = 1
  ) {
    super(scene, x, y, "solar-panel");

    this.panelWidth = width;
    this.panelHeight = height;

    // Calculate energy output based on size
    this.energyOutput = width * height * 10; // 10 energy per tile

    // Create a visual representation of the solar panel area
    const panelArea = scene.add.rectangle(
      0,
      0, // Relative to container
      width * 64, // Assuming 64 is the tile size
      height * 64,
      0xffff00,
      0.1
    );
    panelArea.setStrokeStyle(1, 0xffff00);
    this.add(panelArea);
  }

  protected getBuildingName(): string {
    return "Solar Panel";
  }

  public getEnergyOutput(): number {
    return this.energyOutput;
  }

  public update(): void {
    // Solar panel specific update logic
    // Could update energy output based on time of day, etc.
  }
}
