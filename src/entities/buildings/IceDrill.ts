import Phaser from "phaser";
import { Building } from "./Building";

export class IceDrill extends Building {
  protected waterOutput: number;
  protected drillEfficiency: number;
  protected outputText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "ice-drill");

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

  public update(): void {
    // Ice drill specific update logic
  }
}
