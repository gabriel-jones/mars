import Phaser from "phaser";
import { RangeSelectionBuilding } from "./RangeSelectionBuilding";
import { TILE_SIZE } from "../../constants";
import { ResourceNode } from "../resourceNode";
import { ResourceType } from "../../data/resources";
import { BuildingType } from "../../data/buildings";

/**
 * InventoryZone is a building that allows robots to deliver and store resources.
 * Resources are stored in stacks, with one stack per tile.
 * When resources are delivered, they are merged with existing stacks if possible.
 */
export class InventoryZone extends RangeSelectionBuilding {
  // Map to track which tiles have resources
  private resourceTiles: Map<string, ResourceNode> = new Map();

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    tileWidth: number,
    tileHeight: number
  ) {
    // Use the inventory-zone texture, not custom rendering
    super(scene, x, y, "inventory-zone", tileWidth, tileHeight, true, false);

    console.log(
      `InventoryZone constructor called with dimensions: ${tileWidth}x${tileHeight}`
    );
  }

  /**
   * Create a sprite for a tile at the given position
   * Override to customize the appearance of inventory zone tiles
   */
  protected createTileSprite(
    tileX: number,
    tileY: number,
    row: number,
    col: number
  ): Phaser.GameObjects.Sprite {
    const tileSprite = this.scene.add.sprite(tileX, tileY, "inventory-zone");
    tileSprite.setDisplaySize(TILE_SIZE, TILE_SIZE);
    return tileSprite;
  }

  /**
   * Get the building type
   */
  public getBuildingType(): BuildingType {
    return "inventory-zone";
  }

  /**
   * Get the building name
   */
  protected getBuildingName(): string {
    return "Inventory Zone";
  }

  /**
   * Add a resource node to the inventory zone
   * @param resource The resource node to add
   * @returns True if the resource was added, false if there was no space
   */
  public addResourceNode(resource: ResourceNode): boolean {
    // Calculate the tile grid position of the inventory zone
    // Use Math.round instead of Math.floor to get the center of the inventory zone
    const tileGridX = Math.round(this.x / TILE_SIZE);
    const tileGridY = Math.round(this.y / TILE_SIZE);

    // Log the inventory zone position for debugging
    console.log(`Inventory zone position: (${this.x}, ${this.y})`);
    console.log(
      `Inventory zone tile grid position: (${tileGridX}, ${tileGridY})`
    );
    console.log(
      `Inventory zone dimensions: ${this.tileWidth}x${this.tileHeight}`
    );

    // Get the resource type and amount
    const resourceType = resource.getResource().type;
    const resourceAmount = resource.getAmount();

    // First, try to merge with existing stacks of the same type that aren't full
    for (let row = 0; row < this.tileHeight; row++) {
      for (let col = 0; col < this.tileWidth; col++) {
        // Calculate the tile position relative to the center of the inventory zone
        const tileX = tileGridX - Math.floor(this.tileWidth / 2) + col;
        const tileY = tileGridY - Math.floor(this.tileHeight / 2) + row;
        const tileKey = `${tileX},${tileY}`;

        // Check if this tile already has a resource of the same type
        const existingResource = this.resourceTiles.get(tileKey);
        if (
          existingResource &&
          existingResource.getResource().type === resourceType &&
          existingResource.getAmount() < 64 // Only merge if the stack isn't full
        ) {
          // Calculate how much can be added to this stack
          const spaceAvailable = 64 - existingResource.getAmount();
          const amountToAdd = Math.min(resourceAmount, spaceAvailable);

          // Try to add to the existing stack
          existingResource.addAmount(amountToAdd);

          console.log(
            `Merged ${amountToAdd} ${resourceType} into existing stack at ${tileKey}, now has ${existingResource.getAmount()}`
          );

          // If we added all the resources, destroy the original node
          if (amountToAdd >= resourceAmount) {
            resource.destroy();
            return true;
          } else {
            // Otherwise, reduce the amount in the original node and continue looking for space
            resource.harvest(amountToAdd);
            // Continue looking for space for the remaining resources
            continue;
          }
        }
      }
    }

    // If we still have resources to place, find empty tiles
    if (resource.getAmount() > 0) {
      // If we couldn't merge all resources, find empty tiles
      for (let row = 0; row < this.tileHeight; row++) {
        for (let col = 0; col < this.tileWidth; col++) {
          // Calculate the tile position relative to the center of the inventory zone
          const tileX = tileGridX - Math.floor(this.tileWidth / 2) + col;
          const tileY = tileGridY - Math.floor(this.tileHeight / 2) + row;
          const tileKey = `${tileX},${tileY}`;

          // Check if this tile is empty
          if (
            !this.resourceTiles.has(tileKey) &&
            !ResourceNode.hasTileResource(tileX, tileY)
          ) {
            // Calculate the world position for the center of this tile
            const worldX = tileX * TILE_SIZE + TILE_SIZE / 2;
            const worldY = tileY * TILE_SIZE + TILE_SIZE / 2;

            console.log(
              `Creating resource at world position: (${worldX}, ${worldY})`
            );
            console.log(`Tile position: (${tileX}, ${tileY})`);

            // Create a new resource node at this position
            const newResource = new ResourceNode(
              this.scene,
              worldX,
              worldY,
              resource.getResource(),
              resource.getAmount()
            );

            // Ensure the resource is visible above the inventory zone
            newResource.setDepth(this.depth + 1);

            // Add to our tracking map
            this.resourceTiles.set(tileKey, newResource);

            // Remove the original resource node
            resource.destroy();

            console.log(
              `Added ${resource.getAmount()} ${resourceType} to empty tile at ${tileKey}`
            );
            return true;
          }
        }
      }
    } else {
      // If we've distributed all the resources through merging
      resource.destroy();
      return true;
    }

    // If we get here, there was no space
    console.log(
      `No space to add ${resourceAmount} ${resourceType} to inventory zone`
    );
    return false;
  }

  /**
   * Check if the inventory zone has space for more resources
   * @returns True if there is space, false if full
   */
  public hasSpace(): boolean {
    // Calculate the tile grid position of the inventory zone
    const tileGridX = Math.round(this.x / TILE_SIZE);
    const tileGridY = Math.round(this.y / TILE_SIZE);

    console.log(
      `hasSpace checking inventory zone at (${tileGridX}, ${tileGridY}) with dimensions ${this.tileWidth}x${this.tileHeight}`
    );

    // Check if any tiles are empty
    for (let row = 0; row < this.tileHeight; row++) {
      for (let col = 0; col < this.tileWidth; col++) {
        const tileX = tileGridX - Math.floor(this.tileWidth / 2) + col;
        const tileY = tileGridY - Math.floor(this.tileHeight / 2) + row;
        const tileKey = `${tileX},${tileY}`;

        // Check if this tile is empty
        if (
          !this.resourceTiles.has(tileKey) &&
          !ResourceNode.hasTileResource(tileX, tileY)
        ) {
          console.log(`Found empty tile at (${tileX}, ${tileY})`);
          return true;
        }
      }
    }

    // If we get here, all tiles are full
    return false;
  }

  /**
   * Get the total amount of each resource type in the inventory zone
   * @returns Map of resource type to total amount
   */
  public getResourceTotals(): Map<ResourceType, number> {
    const totals = new Map<ResourceType, number>();

    // Iterate through all resource nodes in the inventory zone
    for (const resourceNode of this.resourceTiles.values()) {
      const resource = resourceNode.getResource();
      if (!resource) continue;

      const resourceType = resource.type;
      const amount = resourceNode.getAmount();

      // Add to the total for this resource type
      const currentTotal = totals.get(resourceType) || 0;
      totals.set(resourceType, currentTotal + amount);
    }

    return totals;
  }

  /**
   * Get all resource nodes in the inventory zone
   * @returns Array of resource nodes
   */
  public getResourceNodes(): ResourceNode[] {
    return Array.from(this.resourceTiles.values());
  }

  /**
   * Update method called every frame
   */
  public update(time: number, delta: number): void {
    super.update(time, delta);

    // Clean up any resources that have been destroyed
    for (const [tileKey, resource] of this.resourceTiles.entries()) {
      if (!resource.active) {
        this.resourceTiles.delete(tileKey);
      }
    }
  }

  /**
   * Clean up when destroyed
   */
  public destroy(): void {
    // Clean up resources
    this.resourceTiles.clear();

    // Call parent destroy
    super.destroy();
  }

  /**
   * Find the best inventory zone for a resource
   * First tries to find a zone with the same resource type that isn't full
   * Then falls back to any zone with space
   * @param resourceType The type of resource to find a zone for
   * @param inventoryZones Array of inventory zones to check
   * @returns The best inventory zone, or null if none found
   */
  public static findBestZoneForResource(
    resourceType: ResourceType,
    inventoryZones: InventoryZone[]
  ): InventoryZone | null {
    if (inventoryZones.length === 0) {
      return null;
    }

    // First, try to find a zone that already has this resource type with a non-full stack
    for (const zone of inventoryZones) {
      // Skip zones that are full
      if (!zone.hasSpace()) {
        continue;
      }

      // Check if this zone has the same resource type with a non-full stack
      const zoneResources = zone.getResourceNodes();
      for (const resource of zoneResources) {
        if (
          resource.getResource().type === resourceType &&
          resource.getAmount() < 64 // Only consider if the stack isn't full
        ) {
          // Found a zone with the same resource type that isn't full
          return zone;
        }
      }
    }

    // Next, try to find a zone that already has this resource type (even if all stacks are full)
    // This allows creating new stacks of the same type in zones that already have that type
    for (const zone of inventoryZones) {
      // Skip zones that are full
      if (!zone.hasSpace()) {
        continue;
      }

      // Check if this zone has the same resource type
      const zoneResources = zone.getResourceNodes();
      for (const resource of zoneResources) {
        if (resource.getResource().type === resourceType) {
          // Found a zone with the same resource type
          return zone;
        }
      }
    }

    // If no zone with the same resource type, find any zone with space
    for (const zone of inventoryZones) {
      if (zone.hasSpace()) {
        return zone;
      }
    }

    // No suitable zone found
    return null;
  }

  /**
   * Find an available tile in the inventory zone
   * First tries to find a tile with the same resource type that isn't full
   * Then falls back to any empty tile
   * @param resourceType The type of resource to find a tile for
   * @returns The world position of the available tile, or null if no space
   */
  public findAvailableTilePosition(
    resourceType: ResourceType
  ): Phaser.Math.Vector2 | null {
    // Calculate the tile grid position of the inventory zone
    // Use Math.round instead of Math.floor to get the center of the inventory zone
    const tileGridX = Math.round(this.x / TILE_SIZE);
    const tileGridY = Math.round(this.y / TILE_SIZE);

    // Log the search for debugging
    console.log(
      `Searching for available tile for ${resourceType} in inventory zone at (${this.x}, ${this.y})`
    );
    console.log(
      `Inventory zone dimensions: ${this.tileWidth}x${this.tileHeight}`
    );
    console.log(`Tile grid position: (${tileGridX}, ${tileGridY})`);

    // First, try to find a tile with the same resource type that isn't full
    for (let row = 0; row < this.tileHeight; row++) {
      for (let col = 0; col < this.tileWidth; col++) {
        // Calculate the tile position relative to the center of the inventory zone
        const tileX = tileGridX - Math.floor(this.tileWidth / 2) + col;
        const tileY = tileGridY - Math.floor(this.tileHeight / 2) + row;
        const tileKey = `${tileX},${tileY}`;

        // Check if this tile has a resource of the same type that isn't full
        const existingResource = this.resourceTiles.get(tileKey);
        if (
          existingResource &&
          existingResource.getResource().type === resourceType &&
          existingResource.getAmount() < 64 // Only consider if the stack isn't full
        ) {
          // Found a tile with the same resource type that isn't full
          const worldX = tileX * TILE_SIZE + TILE_SIZE / 2;
          const worldY = tileY * TILE_SIZE + TILE_SIZE / 2;
          console.log(
            `Found tile with same resource type (not full) at (${worldX}, ${worldY}), current amount: ${existingResource.getAmount()}`
          );
          return new Phaser.Math.Vector2(worldX, worldY);
        }
      }
    }

    // If we couldn't find a tile with the same resource type that isn't full, find any empty tile
    // Start from the center and spiral outward to fill from the center
    const centerRow = Math.floor(this.tileHeight / 2);
    const centerCol = Math.floor(this.tileWidth / 2);

    // Define a spiral pattern
    const directions = [
      [0, 1], // right
      [1, 0], // down
      [0, -1], // left
      [-1, 0], // up
    ];

    let row = centerRow;
    let col = centerCol;
    let directionIndex = 0;
    let stepsInDirection = 1;
    let stepsTaken = 0;
    let totalSteps = 0;
    const maxSteps = this.tileWidth * this.tileHeight;

    while (totalSteps < maxSteps) {
      // Calculate the tile position relative to the center of the inventory zone
      const tileX = tileGridX - Math.floor(this.tileWidth / 2) + col;
      const tileY = tileGridY - Math.floor(this.tileHeight / 2) + row;

      // Check if this position is within the zone
      if (
        row >= 0 &&
        row < this.tileHeight &&
        col >= 0 &&
        col < this.tileWidth
      ) {
        const tileKey = `${tileX},${tileY}`;

        // Check if this tile is empty
        if (
          !this.resourceTiles.has(tileKey) &&
          !ResourceNode.hasTileResource(tileX, tileY)
        ) {
          // Found an empty tile
          const worldX = tileX * TILE_SIZE + TILE_SIZE / 2;
          const worldY = tileY * TILE_SIZE + TILE_SIZE / 2;
          console.log(`Found empty tile at (${worldX}, ${worldY})`);
          console.log(`Tile position: (${tileX}, ${tileY})`);
          return new Phaser.Math.Vector2(worldX, worldY);
        }
      }

      // Move in the current direction
      row += directions[directionIndex][0];
      col += directions[directionIndex][1];

      // Increment step counters
      stepsTaken++;
      totalSteps++;

      // Check if we need to change direction
      if (stepsTaken === stepsInDirection) {
        stepsTaken = 0;
        directionIndex = (directionIndex + 1) % 4;

        // Increase steps in direction after completing a half cycle
        if (directionIndex === 0 || directionIndex === 2) {
          stepsInDirection++;
        }
      }
    }

    // If the spiral search didn't find anything, fall back to the original method
    for (let row = 0; row < this.tileHeight; row++) {
      for (let col = 0; col < this.tileWidth; col++) {
        // Calculate the tile position relative to the center of the inventory zone
        const tileX = tileGridX - Math.floor(this.tileWidth / 2) + col;
        const tileY = tileGridY - Math.floor(this.tileHeight / 2) + row;
        const tileKey = `${tileX},${tileY}`;

        // Check if this tile is empty
        if (
          !this.resourceTiles.has(tileKey) &&
          !ResourceNode.hasTileResource(tileX, tileY)
        ) {
          // Found an empty tile
          const worldX = tileX * TILE_SIZE + TILE_SIZE / 2;
          const worldY = tileY * TILE_SIZE + TILE_SIZE / 2;
          console.log(`Found empty tile (fallback) at (${worldX}, ${worldY})`);
          console.log(`Tile position: (${tileX}, ${tileY})`);
          return new Phaser.Math.Vector2(worldX, worldY);
        }
      }
    }

    console.log(
      `No available tile found in inventory zone at (${this.x}, ${this.y})`
    );
    // No available tile found
    return null;
  }
}
