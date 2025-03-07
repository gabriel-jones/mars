import Phaser from "phaser";
import { Building } from "./Building";
import { TerrainFeatureType } from "../TerrainFeature";
import { ResourceManager } from "../../data/resources";
import { DEFAULT_FONT } from "../../constants";

export class IceDrill extends Building {
  protected waterOutput: number;
  protected drillEfficiency: number;
  protected outputText: Phaser.GameObjects.Text;
  protected lastHarvestTime: number = 0;
  protected harvestInterval: number = 5000; // 5 seconds in ms

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    tileWidth: number = 1,
    tileHeight: number = 1
  ) {
    super(scene, x, y, "ice-drill", tileWidth, tileHeight);

    // Set initial values
    this.drillEfficiency = 0.8 + Math.random() * 0.4; // 0.8 to 1.2 efficiency
    this.waterOutput = Math.floor(15 * this.drillEfficiency); // Base output of 15 water per minute

    // Add visual effects
    const drillEffect = scene.add.circle(0, 0, 32, 0x00ffff, 0.2);
    drillEffect.setStrokeStyle(1, 0x00ffff);
    this.add(drillEffect);

    // Create pulsing animation for the drill effect
    scene.tweens.add({
      targets: drillEffect,
      alpha: 0.5,
      duration: 1000,
      yoyo: true,
      repeat: -1,
    });

    // Add water output text
    this.outputText = scene.add.text(0, 40, `Water: ${this.waterOutput}/min`, {
      fontSize: "12px",
      color: "#ffffff",
      backgroundColor: "#000000",
      padding: { x: 3, y: 2 },
      fontFamily: DEFAULT_FONT,
    });
    this.outputText.setOrigin(0.5);
    this.add(this.outputText);
  }

  protected getBuildingName(): string {
    return "Ice Drill";
  }

  public getWaterOutput(): number {
    return this.waterOutput;
  }

  public setDrillEfficiency(efficiency: number): void {
    this.drillEfficiency = efficiency;
    this.waterOutput = Math.floor(15 * this.drillEfficiency);
    this.updateOutputText();
  }

  private updateOutputText(): void {
    this.outputText.setText(`Water: ${this.waterOutput}/min`);
  }

  public update(time: number): void {
    // Check if it's time to harvest water
    if (time - this.lastHarvestTime >= this.harvestInterval) {
      // Calculate how much water to add (waterOutput is per minute, so divide by 60 and multiply by seconds passed)
      const secondsPassed = (time - this.lastHarvestTime) / 1000;
      const waterToAdd = Math.floor((this.waterOutput / 60) * secondsPassed);

      if (waterToAdd > 0) {
        // Add water to resources
        ResourceManager.addResource("water", waterToAdd);

        // Update last harvest time
        this.lastHarvestTime = time;
      }
    }
  }
}
