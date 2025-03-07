import Phaser from "phaser";
import { Building } from "./Building";
import { BuildingType, BUILDING_DEFINITIONS } from "../../data/buildings";
import { ResourceType, ResourceManager } from "../../data/resources";
import { TILE_SIZE } from "../../constants";
import { JobManager, JobType } from "../robots/JobManager";

// Blueprint class - represents a building in the planning phase
export class Blueprint extends Building {
  private requiredResources: {
    type: ResourceType;
    amount: number;
    current: number;
  }[] = [];
  private resourceText: Phaser.GameObjects.Text;
  private progressBar: Phaser.GameObjects.Graphics;
  private buildingEffort: number = 0; // Time in ms needed to build
  private buildProgress: number = 0; // Current progress (0-1)
  private isBuilding: boolean = false; // Whether construction has started
  private buildStartTime: number = 0;
  public buildingType: BuildingType;
  private buildingJob: string | null = null; // ID of the building job

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    buildingType: BuildingType,
    tileWidth: number = 1,
    tileHeight: number = 1
  ) {
    super(scene, x, y, buildingType, tileWidth, tileHeight);
    this.buildingType = buildingType;

    console.log(`Creating blueprint for ${buildingType} at (${x}, ${y})`);

    // Set the blueprint tint to blue
    this.sprite.setTint(0x0088ff);
    this.sprite.setAlpha(0.7);

    // Get building definition to determine resource requirements
    const buildingDef = BUILDING_DEFINITIONS.find(
      (def) => def.buildingType === buildingType
    );

    if (buildingDef) {
      console.log(`Found building definition for ${buildingType}`);
      console.log(`Resource requirements:`, buildingDef.cost);

      // Initialize required resources with current amount set to 0
      this.requiredResources = buildingDef.cost.map((cost) => ({
        type: cost.type,
        amount: cost.amount,
        current: 0,
      }));

      console.log(`Initialized required resources:`, this.requiredResources);

      // Set building effort based on building type (default to 5 seconds)
      // Use a default value if buildEffort is not defined
      this.buildingEffort = (buildingDef as any).buildEffort || 5000;
      console.log(`Building effort set to ${this.buildingEffort}ms`);
    } else {
      console.error(`Could not find building definition for ${buildingType}`);
    }

    // Create resource text display
    this.resourceText = scene.add.text(
      0,
      (tileHeight * TILE_SIZE) / 2 + 10,
      "",
      {
        fontSize: "14px",
        color: "#ffffff",
        backgroundColor: "#00000080",
        padding: { x: 5, y: 5 },
        stroke: "#000000",
        strokeThickness: 2,
      }
    );
    this.resourceText.setOrigin(0.5, 0);
    this.resourceText.setDepth(100); // Ensure it's on top of other elements
    this.add(this.resourceText);

    // Create progress bar (initially hidden)
    this.progressBar = scene.add.graphics();
    this.progressBar.setDepth(100);
    this.add(this.progressBar);

    // Update the resource text
    this.updateResourceText();
  }

  // Add resources to the blueprint
  public addResource(type: ResourceType, amount: number): number {
    console.log(`Blueprint.addResource called with ${amount} ${type}`);

    // Find the resource requirement
    const resourceReq = this.requiredResources.find((req) => req.type === type);

    if (!resourceReq) {
      console.log(`Resource ${type} not needed for this blueprint`);
      return 0; // Resource not needed
    }

    // Calculate how much we can actually add
    const amountToAdd = Math.min(
      amount,
      resourceReq.amount - resourceReq.current
    );

    console.log(
      `Can add ${amountToAdd} of ${type} (current: ${resourceReq.current}, needed: ${resourceReq.amount})`
    );

    if (amountToAdd <= 0) {
      console.log(`Already have enough ${type}`);
      return 0; // Already have enough
    }

    // Add the resource
    resourceReq.current += amountToAdd;
    console.log(
      `Added ${amountToAdd} ${type}, now have ${resourceReq.current}/${resourceReq.amount}`
    );

    // Update the resource text
    this.updateResourceText();

    // Check if all resources are delivered
    const allDelivered = this.checkResourcesComplete();
    console.log(`All resources delivered: ${allDelivered}`);

    return amountToAdd; // Return how much was actually added
  }

  // Get the required resources for this blueprint
  public getRequiredResources(): {
    type: ResourceType;
    amount: number;
    current: number;
  }[] {
    return this.requiredResources;
  }

  // Check if all required resources have been delivered
  private checkResourcesComplete(): boolean {
    console.log("Checking if all resources are delivered...");

    // Log the current state of all resources
    this.requiredResources.forEach((req) => {
      console.log(`${req.type}: ${req.current}/${req.amount}`);
    });

    const allDelivered = this.requiredResources.every(
      (req) => req.current >= req.amount
    );

    console.log(`All resources delivered: ${allDelivered}`);

    if (allDelivered && !this.isBuilding) {
      console.log("All resources delivered, starting building process");
      this.startBuilding();
    }

    return allDelivered;
  }

  // Start the building process
  private startBuilding(): void {
    console.log(`Starting building process for ${this.buildingType}`);

    this.isBuilding = true;
    this.buildStartTime = this.scene.time.now;

    // Create a building job
    const jobManager = JobManager.getInstance();
    const position = new Phaser.Math.Vector2(this.x, this.y);

    console.log(`Creating build job with effort: ${this.buildingEffort}ms`);
    const job = jobManager.createBuildJob(position, this.buildingEffort);
    this.buildingJob = job.id;

    console.log(
      `Started building ${this.buildingType} - job ID: ${job.id}, effort: ${this.buildingEffort}ms`
    );

    // Update the progress bar to show 0% progress
    this.updateProgressBar();
  }

  // Update the resource text display
  private updateResourceText(): void {
    let text = "Required:\n";

    this.requiredResources.forEach((req) => {
      text += `${req.type}: ${req.current}/${req.amount}\n`;
    });

    this.resourceText.setText(text);

    // Make sure the text is visible
    this.resourceText.setVisible(true);

    console.log("Updated blueprint resource text:", text);
  }

  // Update the progress bar
  private updateProgressBar(): void {
    this.progressBar.clear();

    // Position the progress bar just above the resource text
    const barWidth = 80;
    const barHeight = 10;
    const barX = -barWidth / 2;

    // Calculate the resource text height to position the progress bar just above it
    const resourceTextHeight = this.resourceText.height;
    const resourceTextY = (this.tileHeight * TILE_SIZE) / 2 + 10; // Same as in constructor

    // Position the bar just above the resource text
    const barY = resourceTextY - barHeight - 5;

    // Draw background
    this.progressBar.fillStyle(0x000000, 0.8);
    this.progressBar.fillRect(barX, barY, barWidth, barHeight);

    // Draw border
    this.progressBar.lineStyle(2, 0xffffff, 1);
    this.progressBar.strokeRect(barX, barY, barWidth, barHeight);

    // Draw progress
    this.progressBar.fillStyle(0x00ff00, 1);
    this.progressBar.fillRect(
      barX,
      barY,
      barWidth * this.buildProgress,
      barHeight
    );

    // Make sure the progress bar is visible
    this.progressBar.setVisible(true);
    this.progressBar.setDepth(100); // Ensure it's on top
  }

  // Check if the blueprint is ready to be converted to a real building
  public isComplete(): boolean {
    return this.isBuilding && this.buildProgress >= 1;
  }

  // Update method called every frame
  public update(time: number, delta: number): void {
    // If building is in progress, update the progress
    if (this.isBuilding) {
      const elapsed = time - this.buildStartTime;
      const oldProgress = this.buildProgress;
      this.buildProgress = Math.min(elapsed / this.buildingEffort, 1);

      // Only log when progress changes significantly
      if (
        Math.floor(this.buildProgress * 100) !== Math.floor(oldProgress * 100)
      ) {
        console.log(
          `Building progress: ${Math.floor(this.buildProgress * 100)}%`
        );
      }

      this.updateProgressBar();

      // Check if building is complete
      if (this.buildProgress >= 1) {
        console.log(`Blueprint for ${this.buildingType} is complete!`);
      }
    }
  }

  // Destroy the blueprint and clean up resources
  public destroy(): void {
    console.log(`Destroying blueprint for ${this.buildingType}`);

    // Cancel the building job if it exists
    if (this.buildingJob) {
      JobManager.getInstance().cancelJob(this.buildingJob);
      this.buildingJob = null;
    }

    // Destroy the resource text
    if (this.resourceText) {
      this.resourceText.destroy();
    }

    // Destroy the progress bar
    if (this.progressBar) {
      this.progressBar.destroy();
    }

    // Call the parent destroy method to clean up the sprite
    super.destroy();
  }

  // Get the building type
  public getBuildingType(): BuildingType {
    return this.buildingType;
  }
}
