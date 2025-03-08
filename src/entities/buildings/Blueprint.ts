import Phaser from "phaser";
import { Building } from "./Building";
import {
  BuildingType,
  BUILDING_DEFINITIONS,
  BuildingManager,
  Building as BuildingData,
} from "../../data/buildings";
import {
  ResourceType,
  ResourceManager,
  RESOURCE_DEFINITIONS,
} from "../../data/resources";
import { TILE_SIZE, DEFAULT_FONT } from "../../constants";
import { JobManager, JobType } from "../robots/JobManager";
import { HasHealth } from "../../interfaces/Health";
import { DEPTH } from "../../depth";

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

    // Store the building type
    this.buildingType = buildingType;

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
        fontFamily: DEFAULT_FONT,
      }
    );
    this.resourceText.setOrigin(0.5, 0);
    this.resourceText.setDepth(DEPTH.BLUEPRINT); // Ensure it's on top of other elements
    this.add(this.resourceText);

    // Create progress bar (initially hidden)
    this.progressBar = scene.add.graphics();
    this.progressBar.setDepth(DEPTH.BLUEPRINT);
    this.add(this.progressBar);

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

    // Get building definition to determine resource requirements
    const buildingDef = BUILDING_DEFINITIONS.find(
      (def) => def.buildingType === buildingType
    );

    if (buildingDef) {
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

      // Set building effort based on building type (default to 5 seconds)
      // Use a default value if buildEffort is not defined
      this.buildingEffort = (buildingDef as any).buildEffort || 5000;
    } else {
      console.error(`Could not find building definition for ${buildingType}`);
    }

    // Update the resource text
    this.updateResourceText();
  }

  // Add resources to the blueprint
  public addResource(type: ResourceType, amount: number): number {
    // Find the resource requirement
    const resourceReq = this.requiredResources.find((req) => req.type === type);

    if (!resourceReq) {
      return 0; // Resource not needed
    }

    // Calculate how much we can actually add
    const amountToAdd = Math.min(
      amount,
      resourceReq.amount - resourceReq.current
    );

    if (amountToAdd <= 0) {
      return 0; // Already have enough
    }

    // Add the resource to the requirement
    resourceReq.current += amountToAdd;

    // Also add to the inventory using the parent class method
    super.addResource(type, amountToAdd);

    // Update the resource text
    this.updateResourceText();

    // Check if all resources are delivered
    const allDelivered = this.checkResourcesComplete();

    return amountToAdd; // Return how much was actually added
  }

  // Get the required resources
  public getRequiredResources(): {
    type: ResourceType;
    amount: number;
    current: number;
  }[] {
    return this.requiredResources;
  }

  // Check if all required resources have been delivered
  private checkResourcesComplete(): boolean {
    // Check if all required resources have been delivered
    const allDelivered = this.requiredResources.every(
      (req) => req.current >= req.amount
    );

    if (allDelivered && !this.isBuilding) {
      this.startBuilding();
    }

    return allDelivered;
  }

  // Start the building process
  private startBuilding(): void {
    this.isBuilding = true;
    this.buildStartTime = this.scene.time.now;

    // Create a building job
    const jobManager = JobManager.getInstance();
    const position = new Phaser.Math.Vector2(this.x, this.y);

    const job = jobManager.createBuildJob(position, this.buildingEffort);
    this.buildingJob = job.id;

    // Update the progress bar to show 0% progress
    this.updateProgressBar();
  }

  // Update the resource text display
  private updateResourceText(): void {
    if (!this.resourceText) return;

    let text = "Required:\n";

    this.requiredResources.forEach((req) => {
      text += `${req.type}: ${req.current}/${req.amount}\n`;
    });

    this.resourceText.setText(text);

    // Make sure the text is visible
    this.resourceText.setVisible(true);
  }

  // Update the progress bar
  private updateProgressBar(): void {
    if (!this.progressBar) return;

    // Clear the previous progress bar
    this.progressBar.clear();

    // Calculate progress if building is in progress
    if (this.isBuilding) {
      const currentTime = this.scene.time.now;
      const elapsedTime = currentTime - this.buildStartTime;
      this.buildProgress = Math.min(elapsedTime / this.buildingEffort, 1);
    }

    // Draw the progress bar background
    this.progressBar.fillStyle(0x000000, 0.8);
    this.progressBar.fillRect(-50, 60, 100, 10);

    // Draw the progress bar fill
    this.progressBar.fillStyle(0x00ff00, 1);
    this.progressBar.fillRect(-50, 60, 100 * this.buildProgress, 10);

    // Make sure the progress bar is visible if building
    this.progressBar.setVisible(this.isBuilding);
  }

  // Check if the blueprint is complete
  public isComplete(): boolean {
    return this.buildProgress >= 1;
  }

  // Update the blueprint
  public update(time: number, delta: number): void {
    // Update the progress bar if building is in progress
    if (this.isBuilding) {
      this.updateProgressBar();

      // Check if building is complete
      if (this.isComplete()) {
        this.completeBuilding();
      }
    }
  }

  // Complete the building process
  private completeBuilding(): void {
    // Only proceed if we're actually building
    if (!this.isBuilding) {
      return;
    }

    // For habitat buildings, handle differently
    if (this.buildingType === "habitat") {
      // Create or expand a habitat
      if (this.targetHabitatId) {
        // This is an expansion to an existing habitat
        BuildingManager.expandHabitat(
          this.targetHabitatId,
          this.expansionTiles || []
        );
      } else {
        // This is a new habitat
        // Create a new habitat building
        const habitatBuilding = {
          type: "habitat" as BuildingType,
          displayName: "Habitat",
          position: { x: this.x, y: this.y },
          placedAt: Date.now(),
          tiles: this.habitatTiles || [],
          hasInventory: true,
          inventory: {},
        };

        BuildingManager.addBuilding(habitatBuilding);
      }
    } else {
      // Create a regular building
      const building = {
        type: this.buildingType,
        displayName:
          BUILDING_DEFINITIONS.find((b) => b.buildingType === this.buildingType)
            ?.name || "Building",
        position: { x: this.x, y: this.y },
        placedAt: Date.now(),
        tileWidth: this.tileWidth,
        tileHeight: this.tileHeight,
        hasInventory:
          BUILDING_DEFINITIONS.find((b) => b.buildingType === this.buildingType)
            ?.hasInventory || false,
        inventory: {},
      };

      BuildingManager.addBuilding(building);

      // Emit an event to create the actual building instance in the scene
      this.scene.events.emit("buildingCreated", {
        type: this.buildingType,
        x: this.x,
        y: this.y,
        tileWidth: this.tileWidth,
        tileHeight: this.tileHeight,
      });
    }

    // Destroy the blueprint
    this.destroy();
  }

  // Destroy the blueprint and clean up resources
  public destroy(): void {
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
   * Get the sprite for this blueprint
   */
  public getSprite(): Phaser.GameObjects.Sprite {
    return this.sprite;
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
    if (this.resourceText) {
      this.resourceText.setPosition(0, height / 2 + 10);
    }

    // Update the progress bar position if it exists
    if (this.progressBar) {
      this.progressBar.setPosition(0, height / 2 + 30);
    }
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
