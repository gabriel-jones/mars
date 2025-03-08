import * as Phaser from "phaser";
import { Resource, ResourceType, ResourceManager } from "../data/resources";
import { TILE_SIZE } from "../constants";
import { DEPTH } from "../depth";

export enum ResourceNodeType {
  IceDeposit = "ice_deposit",
}

export class ResourceNode extends Phaser.GameObjects.Container {
  private resource: Resource;
  private amount: number;
  private emojiText: Phaser.GameObjects.Text;
  private pulseEffect: Phaser.Tweens.Tween;
  private label: Phaser.GameObjects.Text;
  public tileX: number;
  public tileY: number;
  private static MAX_STACK_SIZE = 64;
  private static nodesByTile: Map<string, ResourceNode> = new Map();

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    resource: Resource,
    amount: number = 64
  ) {
    // Snap to tile grid
    const tileX = Math.floor(x / TILE_SIZE);
    const tileY = Math.floor(y / TILE_SIZE);
    const snappedX = tileX * TILE_SIZE + TILE_SIZE / 2;
    const snappedY = tileY * TILE_SIZE + TILE_SIZE / 2;

    super(scene, snappedX, snappedY);

    this.tileX = tileX;
    this.tileY = tileY;

    // Check if a resource node already exists at this tile
    const tileKey = `${tileX},${tileY}`;
    if (ResourceNode.nodesByTile.has(tileKey)) {
      // If a node exists, add to its amount instead of creating a new one
      const existingNode = ResourceNode.nodesByTile.get(tileKey)!;
      existingNode.addAmount(amount);
      this.destroy();
      return;
    }

    // Cap the amount to MAX_STACK_SIZE
    this.resource = resource;
    this.amount = Math.min(amount, ResourceNode.MAX_STACK_SIZE);

    // Register this node in the global inventory system
    ResourceManager.registerResourceNode(this);

    // Register this node in the tile map
    ResourceNode.nodesByTile.set(tileKey, this);

    // Create the emoji text instead of orb graphic
    this.emojiText = scene.add
      .text(0, 0, resource.emoji, {
        fontSize: "32px",
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.RESOURCE_NODE);
    this.add(this.emojiText);

    // Add a label showing the resource type and amount
    const labelText = `${resource.type} (${this.amount})`;
    this.label = scene.add
      .text(0, 30, labelText, {
        fontSize: "11px",
        color: "#FFFFFF",
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.RESOURCE_NODE);
    this.add(this.label);

    // Add a pulsing effect to the emoji
    this.pulseEffect = scene.tweens.add({
      targets: this.emojiText,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // Add physics to the resource node
    scene.physics.world.enable(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCircle(20); // Set collision radius
    body.setBounce(0); // No bounce since we want them to stay in place
    body.setImmovable(true); // Make immovable to prevent pushing
    body.setVelocity(0, 0);

    scene.add.existing(this);
  }

  public getAmount(): number {
    return this.amount;
  }

  public getResource(): Resource {
    return this.resource;
  }

  public getTilePosition(): { x: number; y: number } {
    return { x: this.tileX, y: this.tileY };
  }

  public addAmount(amount: number): void {
    const newAmount = Math.min(
      this.amount + amount,
      ResourceNode.MAX_STACK_SIZE
    );
    const actualAdded = newAmount - this.amount;
    this.amount = newAmount;

    // Update the label to show the new amount if it exists
    if (this.label && this.label.active) {
      this.label.setText(`${this.resource.type} (${this.amount})`);
    }

    // Don't return anything since the method is void
  }

  public harvest(amount: number): number {
    const harvestedAmount = Math.min(amount, this.amount);
    this.amount -= harvestedAmount;

    // Update the label
    if (this.label && this.label.active) {
      this.label.setText(`${this.resource.type} (${this.amount})`);
    }

    // If the node is depleted, destroy it and remove from tracking
    if (this.amount <= 0) {
      const tileKey = `${this.tileX},${this.tileY}`;
      ResourceNode.nodesByTile.delete(tileKey);
      ResourceManager.unregisterResourceNode(this);
      this.destroy();
    }

    return harvestedAmount;
  }

  // Override the destroy method to ensure proper cleanup
  public override destroy(fromScene?: boolean): void {
    // Clean up the label if it exists
    if (this.label && this.label.active) {
      this.label.destroy();
      this.label = null as any;
    }

    // Clean up the emoji text if it exists
    if (this.emojiText && this.emojiText.active) {
      this.emojiText.destroy();
      this.emojiText = null as any;
    }

    // Stop any active tweens
    if (this.pulseEffect) {
      this.pulseEffect.stop();
      this.pulseEffect.remove();
      this.pulseEffect = null as any;
    }

    // Call the parent destroy method
    super.destroy(fromScene);
  }

  // Static method to get a resource node at a specific tile
  public static getNodeAtTile(
    tileX: number,
    tileY: number
  ): ResourceNode | undefined {
    return ResourceNode.nodesByTile.get(`${tileX},${tileY}`);
  }

  // Static method to check if a tile has a resource node
  public static hasTileResource(tileX: number, tileY: number): boolean {
    return ResourceNode.nodesByTile.has(`${tileX},${tileY}`);
  }

  // Static method to get all resource nodes
  public static getAllNodes(): ResourceNode[] {
    const nodes: ResourceNode[] = [];
    ResourceNode.nodesByTile.forEach((node) => {
      nodes.push(node);
    });
    return nodes;
  }

  // Method to add this node's resources to the global inventory
  public addToInventory(): void {
    // Add the resource to the global inventory
    ResourceManager.addResource(this.resource.type, this.amount);

    // Clear the node's amount since it's been added to inventory
    this.amount = 0;

    // Update the label
    if (this.label && this.label.active) {
      this.label.setText(`${this.resource.type} (${this.amount})`);
    }

    // Remove from tracking and destroy
    const tileKey = `${this.tileX},${this.tileY}`;
    ResourceNode.nodesByTile.delete(tileKey);
    ResourceManager.unregisterResourceNode(this);
    this.destroy();
  }

  // No longer need applyForce since nodes are now immovable
}
