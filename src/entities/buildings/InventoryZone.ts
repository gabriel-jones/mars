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
    const tileGridX = Math.floor(this.x / TILE_SIZE);
    const tileGridY = Math.floor(this.y / TILE_SIZE);

    // Get the resource type and amount
    const resourceType = resource.getResource().type;
    const resourceAmount = resource.getAmount();

    // First, try to merge with existing stacks of the same type
    for (let row = 0; row < this.tileHeight; row++) {
      for (let col = 0; col < this.tileWidth; col++) {
        const tileX = tileGridX - Math.floor(this.tileWidth / 2) + col;
        const tileY = tileGridY - Math.floor(this.tileHeight / 2) + row;
        const tileKey = `${tileX},${tileY}`;

        // Check if this tile already has a resource of the same type
        const existingResource = this.resourceTiles.get(tileKey);
        if (
          existingResource &&
          existingResource.getResource().type === resourceType
        ) {
          // Try to add to the existing stack
          existingResource.addAmount(resourceAmount);

          // Remove the original resource node
          resource.destroy();

          console.log(
            `Merged ${resourceAmount} ${resourceType} into existing stack at ${tileKey}`
          );
          return true;
        }
      }
    }

    // If we couldn't merge, find an empty tile
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
          // Move the resource to this tile
          const worldX = tileX * TILE_SIZE + TILE_SIZE / 2;
          const worldY = tileY * TILE_SIZE + TILE_SIZE / 2;

          // Create a new resource node at this position
          const newResource = new ResourceNode(
            this.scene,
            worldX,
            worldY,
            resource.getResource(),
            resourceAmount
          );

          // Add to our tracking map
          this.resourceTiles.set(tileKey, newResource);

          // Remove the original resource node
          resource.destroy();

          console.log(
            `Added ${resourceAmount} ${resourceType} to empty tile at ${tileKey}`
          );
          return true;
        }
      }
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
    const tileGridX = Math.floor(this.x / TILE_SIZE);
    const tileGridY = Math.floor(this.y / TILE_SIZE);

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
          return true;
        }
      }
    }

    // If we get here, all tiles are full
    return false;
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
}
