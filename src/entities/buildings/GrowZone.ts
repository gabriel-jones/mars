import Phaser from "phaser";
import { TILE_SIZE } from "../../constants";
import { JobManager } from "../robots/JobManager";
import { BuildingType } from "../../data/buildings";
import { BuildingManager } from "../../data/buildings";
import { ResourceType } from "../../data/resources";
import { RangeSelectionBuilding } from "./RangeSelectionBuilding";

// Define growth stages
export enum GrowthStage {
  DRY = "dry", // Initial state, needs watering
  WET = "wet", // Watered, ready for planting
  GROWING = "baby", // Seeds planted, growing
  READY = "ready", // Ready to harvest
}

// Define crop types
export type CropType = "carrots" | "tomatoes" | "potatoes" | "beans";

// Define a grow tile
interface GrowTile {
  x: number;
  y: number;
  stage: GrowthStage;
  sprite: Phaser.GameObjects.Sprite;
  cropType?: CropType;
  growthStartTime?: number;
  growthProgress?: number;
}

export class GrowZone extends RangeSelectionBuilding {
  private tiles: GrowTile[] = [];
  private selectedCropType: CropType = "carrots"; // Default crop
  private growthTime: number = 30000; // 30 seconds to grow crops
  private detailPanel: Phaser.GameObjects.Container | null = null;
  private cropButtons: Phaser.GameObjects.Container | null = null;
  private isDetailViewOpen: boolean = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    tileWidth: number,
    tileHeight: number
  ) {
    super(scene, x, y, "grow-zone", tileWidth, tileHeight, true);

    console.log(
      `GrowZone constructor called with dimensions: ${tileWidth}x${tileHeight}`
    );

    // Add click handler to show detail view
    this.on("pointerdown", () => {
      // Find the DetailView in the scene
      const detailView = (this.scene as any).detailView;
      if (detailView) {
        detailView.selectEntity(this);
      } else {
        // Fallback to our own detail view if the scene's DetailView is not available
        this.showDetailView();
      }
    });

    // Initialize our custom tiles
    this.initializeGrowTiles();

    // Log the number of tiles created
    console.log(`GrowZone initialized with ${this.tiles.length} tiles`);
  }

  /**
   * Override createTileSprite to customize the appearance of grow zone tiles
   */
  protected createTileSprite(
    tileX: number,
    tileY: number,
    row: number,
    col: number
  ): Phaser.GameObjects.Sprite {
    // Create a farm tile
    const tileSprite = this.scene.add.sprite(tileX, tileY, "farm-dry");
    tileSprite.setDisplaySize(TILE_SIZE, TILE_SIZE);
    return tileSprite;
  }

  /**
   * Initialize the grow tiles
   */
  private initializeGrowTiles(): void {
    // Clear existing tiles
    this.tiles = [];

    // Calculate the tile grid position of the grow zone center
    const tileGridX = Math.floor(this.x / TILE_SIZE);
    const tileGridY = Math.floor(this.y / TILE_SIZE);

    // Calculate the top-left corner of the grow zone in world coordinates
    const alignedTopLeftX = tileGridX * TILE_SIZE;
    const alignedTopLeftY = tileGridY * TILE_SIZE;

    console.log(
      `GrowZone aligned top-left: (${alignedTopLeftX}, ${alignedTopLeftY})`
    );
    console.log(`GrowZone has ${this.tileSprites.length} tile sprites`);

    // Create a grow tile for each position in the grow zone
    for (let row = 0; row < this.tileHeight; row++) {
      for (let col = 0; col < this.tileWidth; col++) {
        // Get the corresponding sprite from the tileSprites array
        const index = row * this.tileWidth + col;

        if (index >= this.tileSprites.length) {
          console.error(
            `Tile sprite index ${index} out of bounds (max: ${
              this.tileSprites.length - 1
            })`
          );
          continue;
        }

        const sprite = this.tileSprites[index];

        // Calculate the world position for this tile (for interaction purposes)
        const worldX = alignedTopLeftX + col * TILE_SIZE;
        const worldY = alignedTopLeftY + row * TILE_SIZE;

        // Add to tiles array
        this.tiles.push({
          x: worldX,
          y: worldY,
          stage: GrowthStage.DRY,
          sprite: sprite,
        });
      }
    }

    console.log(
      `Created ${this.tiles.length} grow tiles for grow zone at (${this.x}, ${this.y}) with dimensions ${this.tileWidth}x${this.tileHeight}`
    );
  }

  // Get all tiles in the grow zone
  public getTiles(): GrowTile[] {
    return this.tiles;
  }

  // Get the selected crop type
  public getSelectedCropType(): CropType {
    return this.selectedCropType;
  }

  // Set the selected crop type
  public setSelectedCropType(cropType: CropType): void {
    this.selectedCropType = cropType;
    console.log(`Selected crop type: ${cropType}`);
  }

  // Water a specific tile
  public waterTile(tileIndex: number): boolean {
    if (tileIndex < 0 || tileIndex >= this.tiles.length) {
      return false;
    }

    const tile = this.tiles[tileIndex];
    if (tile.stage === GrowthStage.DRY) {
      tile.stage = GrowthStage.WET;
      tile.sprite.setTexture("farm-wet");
      return true;
    }

    return false;
  }

  // Plant a seed in a specific tile
  public plantSeed(tileIndex: number): boolean {
    if (tileIndex < 0 || tileIndex >= this.tiles.length) {
      return false;
    }

    const tile = this.tiles[tileIndex];
    if (tile.stage === GrowthStage.WET) {
      tile.stage = GrowthStage.GROWING;
      tile.cropType = this.selectedCropType;
      tile.growthStartTime = this.scene.time.now;
      tile.growthProgress = 0;
      tile.sprite.setTexture("farm-growing-1");
      return true;
    }

    return false;
  }

  // Harvest a specific tile
  public harvestTile(tileIndex: number): ResourceType | null {
    if (tileIndex < 0 || tileIndex >= this.tiles.length) {
      return null;
    }

    const tile = this.tiles[tileIndex];
    if (tile.stage === GrowthStage.READY && tile.cropType) {
      const harvestedCrop = tile.cropType;
      tile.stage = GrowthStage.DRY;
      tile.sprite.setTexture("farm-dry");
      tile.cropType = undefined;
      tile.growthStartTime = undefined;
      tile.growthProgress = undefined;
      return harvestedCrop;
    }

    return null;
  }

  // Check if all tiles are in a specific stage
  public areAllTilesInStage(stage: GrowthStage): boolean {
    return this.tiles.every((tile) => tile.stage === stage);
  }

  // Count tiles in a specific stage
  public countTilesInStage(stage: GrowthStage): number {
    return this.tiles.filter((tile) => tile.stage === stage).length;
  }

  // Show the detail view for this grow zone
  public showDetailView(): void {
    // Implementation omitted for brevity
  }

  // Hide the detail view
  public hideDetailView(): void {
    // Implementation omitted for brevity
  }

  // Create crop buttons for the detail view
  private createCropButtons(): void {
    // Implementation omitted for brevity
  }

  // Update the detail view
  private updateDetailView(): void {
    // Implementation omitted for brevity
  }

  // Generate farming jobs for robots
  public generateFarmingJobs(): void {
    const jobManager = JobManager.getInstance();

    // Generate watering jobs for dry tiles
    this.tiles.forEach((tile, index) => {
      if (tile.stage === GrowthStage.DRY) {
        jobManager.createWaterTileJob(this, index);
      }
    });

    // Generate planting jobs for wet tiles
    this.tiles.forEach((tile, index) => {
      if (tile.stage === GrowthStage.WET) {
        jobManager.createPlantSeedJob(this, index);
      }
    });

    // Generate harvesting jobs for ready tiles
    this.tiles.forEach((tile, index) => {
      if (tile.stage === GrowthStage.READY) {
        jobManager.createHarvestCropJob(this, index);
      }
    });
  }

  // Update method to handle crop growth
  public update(time: number, delta: number): void {
    super.update(time, delta);

    // Update each tile
    this.tiles.forEach((tile) => {
      if (
        tile.stage === GrowthStage.GROWING &&
        tile.growthStartTime &&
        tile.cropType
      ) {
        // Calculate growth progress
        const elapsedTime = time - tile.growthStartTime;
        tile.growthProgress = Math.min(1, elapsedTime / this.growthTime);

        // Check if growth is complete
        if (tile.growthProgress >= 1) {
          // Crop is ready to harvest
          tile.stage = GrowthStage.READY;
          tile.sprite.setTexture(`plant-${tile.cropType}`);

          // Generate a new harvest job
          const tileIndex = this.tiles.indexOf(tile);
          if (tileIndex !== -1) {
            JobManager.getInstance().createHarvestCropJob(this, tileIndex);
          }
        }
      }
    });

    // Generate farming jobs every 5 seconds
    if (time % 5000 < delta) {
      this.generateFarmingJobs();
    }
  }

  // Get the building type
  public getBuildingType(): BuildingType {
    return "grow-zone";
  }

  // Get growth information for the detail view
  public getGrowthInfo(): { stage: GrowthStage; count: number }[] {
    const stageCount = new Map<GrowthStage, number>();

    // Initialize counts for all stages
    stageCount.set(GrowthStage.DRY, 0);
    stageCount.set(GrowthStage.WET, 0);
    stageCount.set(GrowthStage.GROWING, 0);
    stageCount.set(GrowthStage.READY, 0);

    // Count tiles in each stage
    this.tiles.forEach((tile) => {
      const currentCount = stageCount.get(tile.stage) || 0;
      stageCount.set(tile.stage, currentCount + 1);
    });

    // Convert to array of objects
    return Array.from(stageCount.entries()).map(([stage, count]) => ({
      stage,
      count,
    }));
  }

  // Water all dry tiles
  public waterAllTiles(): number {
    let wateredCount = 0;

    this.tiles.forEach((tile, index) => {
      if (tile.stage === GrowthStage.DRY) {
        if (this.waterTile(index)) {
          wateredCount++;
        }
      }
    });

    return wateredCount;
  }

  // Plant seeds in all wet tiles
  public plantAllSeeds(): number {
    let plantedCount = 0;

    this.tiles.forEach((tile, index) => {
      if (tile.stage === GrowthStage.WET) {
        if (this.plantSeed(index)) {
          plantedCount++;
        }
      }
    });

    return plantedCount;
  }

  // Harvest all ready tiles
  public harvestAllTiles(): { [key in ResourceType]?: number } {
    const harvested: { [key in ResourceType]?: number } = {};

    this.tiles.forEach((tile, index) => {
      if (tile.stage === GrowthStage.READY) {
        const crop = this.harvestTile(index);
        if (crop) {
          harvested[crop] = (harvested[crop] || 0) + 1;
        }
      }
    });

    return harvested;
  }

  // Get the average growth progress of all growing tiles
  public getAverageGrowthProgress(): number {
    const growingTiles = this.tiles.filter(
      (tile) =>
        tile.stage === GrowthStage.GROWING && tile.growthProgress !== undefined
    );

    if (growingTiles.length === 0) {
      return 0;
    }

    const totalProgress = growingTiles.reduce(
      (sum, tile) => sum + (tile.growthProgress || 0),
      0
    );

    return totalProgress / growingTiles.length;
  }

  // Get the time until the next harvest
  public getTimeUntilNextHarvest(): number {
    const growingTiles = this.tiles.filter(
      (tile) =>
        tile.stage === GrowthStage.GROWING && tile.growthStartTime !== undefined
    );

    if (growingTiles.length === 0) {
      return -1; // No growing tiles
    }

    const now = this.scene.time.now;
    const timeUntilHarvest = growingTiles.map((tile) => {
      const elapsedTime = now - (tile.growthStartTime || 0);
      const remainingTime = this.growthTime - elapsedTime;
      return Math.max(0, remainingTime);
    });

    return Math.min(...timeUntilHarvest);
  }

  // Get the potential yield of the grow zone (if all tiles were planted and harvested)
  public getPotentialYield(): number {
    return this.tiles.length;
  }

  // Get the current yield of the grow zone (number of ready tiles)
  public getCurrentYield(): number {
    return this.countTilesInStage(GrowthStage.READY);
  }
}
