import Phaser from "phaser";
import { Building } from "./Building";
import {
  BuildingType,
  BUILDING_DEFINITIONS,
  BuildingManager,
  Building as BuildingData,
} from "../../data/buildings";
import { ResourceType, ResourceManager } from "../../data/resources";
import { TILE_SIZE } from "../../constants";
import { JobManager, JobType } from "../robots/JobManager";
import { HasHealth } from "../../interfaces/Health";

// Blueprint class - represents a building in the planning phase
export class Blueprint extends Building implements HasHealth {
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
  private habitatId: string | undefined;
  private targetHabitatId: string | undefined;
  private expansionTiles: { x: number; y: number }[] | undefined;
  private habitatTiles: { x: number; y: number }[] | undefined;
  private floorContainer: Phaser.GameObjects.Container | null = null;
  private wallsContainer: Phaser.GameObjects.Container | null = null;
  private interactiveArea: Phaser.GameObjects.Rectangle | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    buildingType: BuildingType,
    tileWidth: number = 1,
    tileHeight: number = 1,
    options: any = {}
  ) {
    super(scene, x, y, buildingType, tileWidth, tileHeight, true);
    this.buildingType = buildingType;

    // Store habitat-specific data if provided
    if (buildingType === "habitat") {
      this.habitatId = options.habitatId;
      this.targetHabitatId = options.targetHabitatId;
      this.expansionTiles = options.expansionTiles;
      this.habitatTiles = options.tiles || options.expansionTiles;

      // Create containers for floor and wall tiles
      this.floorContainer = scene.add.container(0, 0);
      this.wallsContainer = scene.add.container(0, 0);
      this.add(this.floorContainer);
      this.add(this.wallsContainer);

      // Hide the default sprite for habitats
      this.sprite.setVisible(false);

      // Render the habitat blueprint
      if (this.habitatTiles) {
        this.renderHabitatBlueprint();
      }
    } else {
      // For non-habitat buildings, set the blueprint tint to blue
      this.sprite.setTint(0x0088ff);
      this.sprite.setAlpha(0.7);
    }

    console.log(`Creating blueprint for ${buildingType} at (${x}, ${y})`);

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

      // Also initialize the inventory with the required resources
      buildingDef.cost.forEach((cost) => {
        this.inventory[cost.type] = 0;
      });

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

    // Add the resource to the requirement
    resourceReq.current += amountToAdd;

    // Also add to the inventory using the parent class method
    super.addResource(type, amountToAdd);

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

        // Handle habitat expansion completion
        if (
          this.buildingType === "habitat" &&
          this.targetHabitatId &&
          this.expansionTiles
        ) {
          console.log(
            `Completing habitat expansion for ${this.targetHabitatId}`
          );

          // Expand the target habitat with the expansion tiles
          const expanded = BuildingManager.expandHabitat(
            this.targetHabitatId,
            this.expansionTiles
          );

          if (expanded) {
            // Emit an event to update the habitat visuals
            this.scene.events.emit("habitatExpanded", {
              habitatId: this.targetHabitatId,
              newTiles: this.expansionTiles,
            });

            // Remove the expansion blueprint from the building manager
            if (this.habitatId) {
              const blueprintBuilding = BuildingManager.getBuildings().find(
                (b: BuildingData) =>
                  b.type === "habitat" && b.habitatId === this.habitatId
              );

              if (blueprintBuilding) {
                const index =
                  BuildingManager.getBuildings().indexOf(blueprintBuilding);
                if (index !== -1) {
                  BuildingManager.getBuildings().splice(index, 1);
                }
              }
            }
          }
        }

        // Emit the blueprint completed event
        this.scene.events.emit("blueprintCompleted", {
          type: this.buildingType,
          x: this.x,
          y: this.y,
          tileWidth: this.tileWidth,
          tileHeight: this.tileHeight,
          habitatId: this.habitatId,
          habitatTiles: this.habitatTiles,
        });
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

  /**
   * Renders a habitat blueprint with floor tiles and wall edges
   */
  private renderHabitatBlueprint(): void {
    if (
      !this.habitatTiles ||
      this.habitatTiles.length === 0 ||
      !this.floorContainer ||
      !this.wallsContainer
    ) {
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

      // Create floor tile with blueprint tint
      const floorTile = this.scene.add.rectangle(
        relX,
        relY,
        TILE_SIZE,
        TILE_SIZE,
        0x0088ff, // Blue color for blueprint
        0.5 // Semi-transparent
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
      const wallColor = 0x0066cc; // Darker blue for walls

      if (needsWallNorth) {
        const wall = this.scene.add.rectangle(
          relX,
          relY - TILE_SIZE / 2 + wallThickness / 2,
          TILE_SIZE,
          wallThickness,
          wallColor,
          0.7
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
          0.7
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
          0.7
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
          0.7
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

    // Position the resource text and progress bar below the habitat
    this.resourceText.setPosition(0, height / 2 + 10);
  }

  // Shield-related methods (blueprints don't have shields)
  public hasShield(): boolean {
    return false;
  }

  public getMaxShield(): number {
    return 0;
  }

  public getCurrentShield(): number {
    return 0;
  }

  public setShield(value: number): void {
    // Blueprints don't have shields, so this is a no-op
  }

  public damageShield(amount: number): void {
    // Blueprints don't have shields, so damage goes directly to health
    this.damage(amount);
  }

  public rechargeShield(amount: number): void {
    // Blueprints don't have shields, so this is a no-op
  }
}
