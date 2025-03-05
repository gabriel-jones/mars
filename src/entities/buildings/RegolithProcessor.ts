import Phaser from "phaser";
import { Building } from "./Building";
import { ResourceManager } from "../../data/resources";

export class RegolithProcessor extends Building {
  private processingText: Phaser.GameObjects.Text;
  private regolithAmount: number = 0;
  private processingRate: number = 5; // Process 5 regolith per minute
  private lastProcessTime: number = 0;
  private processingInterval: number = 12000; // Process every 12 seconds

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "regolith-processor");

    // Add processing text
    this.processingText = scene.add.text(0, -40, "Regolith: 0", {
      fontSize: "12px",
      color: "#ffffff",
      backgroundColor: "#000000",
      padding: { x: 3, y: 2 },
    });
    this.processingText.setOrigin(0.5);
    this.add(this.processingText);

    // Initialize the last process time
    this.lastProcessTime = scene.time.now;
  }

  protected getBuildingName(): string {
    return "Regolith Processor";
  }

  // Add regolith to the processor
  public addRegolith(amount: number): void {
    this.regolithAmount += amount;
    this.updateProcessingText();
  }

  // Get the current regolith amount
  public getRegolithAmount(): number {
    return this.regolithAmount;
  }

  // Check if the processor can accept more regolith
  public canAcceptRegolith(): boolean {
    return true; // For now, always accept regolith
  }

  private updateProcessingText(): void {
    this.processingText.setText(`Regolith: ${this.regolithAmount}`);
  }

  public update(): void {
    // Process regolith at regular intervals
    if (this.scene.time.now - this.lastProcessTime >= this.processingInterval) {
      this.processRegolith();
      this.lastProcessTime = this.scene.time.now;
    }
  }

  private processRegolith(): void {
    if (this.regolithAmount > 0) {
      // Calculate how much to process
      const amountToProcess = Math.min(
        this.regolithAmount,
        this.processingRate
      );

      // Process the regolith (convert to other resources)
      ResourceManager.addResource("silicon", Math.floor(amountToProcess * 0.6));
      ResourceManager.addResource("iron", Math.floor(amountToProcess * 0.3));
      ResourceManager.addResource(
        "titanium",
        Math.floor(amountToProcess * 0.1)
      );

      // Reduce the regolith amount
      this.regolithAmount -= amountToProcess;

      // Update the display
      this.updateProcessingText();
    }
  }
}
