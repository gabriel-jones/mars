import Phaser from "phaser";
import { ResourceManager, ResourceType } from "../data/resources";
import { gameState } from "../state";
import { DEFAULT_FONT } from "../constants";

// Remove TOP_LEVEL_RESOURCES since we're showing everything in a flat list
// const TOP_LEVEL_RESOURCES: ResourceType[] = [
//   "energy",
//   "oxygen",
//   "water",
//   "iron",
//   "silicon",
// ];

export class ResourceDisplay {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private resourceDisplays: Map<ResourceType, Phaser.GameObjects.Container> =
    new Map();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = this.scene.add.container(10, 10).setScrollFactor(0);
    this.createResourceDisplay();

    // Listen for inventory changes
    gameState.resources.events.on(
      ResourceManager.EVENTS.INVENTORY_CHANGED,
      this.handleInventoryChanged,
      this
    );
  }

  private createResourceDisplay() {
    // Background panel
    const panel = this.scene.add
      .rectangle(0, 0, 200, 200, 0x000000, 0.5)
      .setOrigin(0, 0);
    this.container.add(panel);

    // Create display for each resource
    const resources = ResourceManager.getResources();

    // Get current inventory to check quantities
    const inventory = ResourceManager.getInventory();

    // Create a container for each resource but don't add it to the main container yet
    resources.forEach((resource) => {
      const resourceContainer = this.scene.add.container(0, 0);

      // Resource emoji
      const emoji = this.scene.add
        .text(20, 0, resource.emoji, {
          fontSize: "20px",
          fontFamily: DEFAULT_FONT,
        })
        .setOrigin(0, 0.5);

      // Resource name and amount
      const text = this.scene.add
        .text(50, 0, `${resource.name}: 0`, {
          fontSize: "16px",
          color: "#ffffff",
          fontFamily: DEFAULT_FONT,
        })
        .setOrigin(0, 0.5);

      resourceContainer.add([emoji, text]);

      // Store the container in our map
      this.resourceDisplays.set(resource.type, resourceContainer);
    });

    // Update the display initially
    this.update();
  }

  update() {
    // Get current inventory
    const inventory = ResourceManager.getInventory();

    // Clear the container except for the background panel
    while (this.container.length > 1) {
      const item = this.container.getAt(1);
      this.container.remove(item, false);
    }

    // Track position for adding resources
    let yPosition = 15;

    // Add resources with quantity > 0 to the container
    inventory.forEach((item) => {
      if (item.amount > 0) {
        const resourceContainer = this.resourceDisplays.get(item.type);
        if (resourceContainer) {
          // Position the container
          resourceContainer.setPosition(0, yPosition);

          // Update the text
          const textObject = resourceContainer.getAt(
            1
          ) as Phaser.GameObjects.Text;
          const resource = ResourceManager.getResource(item.type);
          if (resource && textObject) {
            textObject.setText(`${resource.name}: ${item.amount}`);
          }

          // Add to main container
          this.container.add(resourceContainer);

          // Move to next position
          yPosition += 25;
        }
      }
    });

    // Adjust panel height based on number of visible resources
    const visibleCount = inventory.filter((item) => item.amount > 0).length;
    const panel = this.container.getAt(0) as Phaser.GameObjects.Rectangle;
    if (panel) {
      panel.height = Math.max(50, visibleCount * 25 + 30); // Minimum height of 50px
    }
  }

  private handleInventoryChanged(inventory: any) {
    this.update();
  }

  destroy() {
    // Clean up event listeners when the display is destroyed
    gameState.resources.events.off(
      ResourceManager.EVENTS.INVENTORY_CHANGED,
      this.handleInventoryChanged,
      this
    );

    // Remove the container from the scene
    if (this.container) {
      this.container.destroy();
    }
  }

  /**
   * Get the container for camera management and positioning
   */
  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }
}
