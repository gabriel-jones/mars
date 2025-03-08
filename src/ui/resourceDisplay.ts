import Phaser from "phaser";
import { ResourceManager, ResourceType } from "../data/resources";
import { gameState } from "../state";
import { DEFAULT_FONT } from "../constants";
import { DEPTH } from "../depth";
import { EnergyManager } from "../mechanics/EnergyManager";

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
  private energyInfoContainer: Phaser.GameObjects.Container;
  private energyProductionText: Phaser.GameObjects.Text;
  private energyConsumptionText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = this.scene.add
      .container(10, 10)
      .setScrollFactor(0)
      .setDepth(DEPTH.UI);

    // Create energy info container
    this.energyInfoContainer = this.scene.add.container(0, 0);

    // Create energy production text
    this.energyProductionText = this.scene.add
      .text(50, 0, "Production: 0", {
        fontSize: "12px",
        color: "#00ff00",
        fontFamily: DEFAULT_FONT,
      })
      .setOrigin(0, 0.5);

    // Create energy consumption text
    this.energyConsumptionText = this.scene.add
      .text(50, 15, "Consumption: 0", {
        fontSize: "12px",
        color: "#ff0000",
        fontFamily: DEFAULT_FONT,
      })
      .setOrigin(0, 0.5);

    // Add texts to energy info container
    this.energyInfoContainer.add([
      this.energyProductionText,
      this.energyConsumptionText,
    ]);

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

    // Debug: Log all resource definitions
    console.log("Resource definitions:", resources);

    // Check if energy resource is defined
    const energyResource = resources.find((r) => r.type === "energy");
    console.log("Energy resource definition:", energyResource);

    // Get current inventory to check quantities
    const inventory = ResourceManager.getInventory();

    // Create a container for each resource but don't add it to the main container yet
    resources.forEach((resource) => {
      console.log(`Creating display for resource: ${resource.type}`);
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

    // Debug: Log all resources in inventory
    console.log("Resource inventory:", inventory);

    // Debug: Check specifically for energy
    const energyResource = inventory.find((item) => item.type === "energy");
    console.log("Energy resource:", energyResource);

    // Clear the container except for the background panel
    while (this.container.length > 1) {
      const item = this.container.getAt(1);
      this.container.remove(item, false);
    }

    // Track position for adding resources
    let yPosition = 15;

    // First, ensure energy is displayed if it exists
    if (energyResource && energyResource.amount > 0) {
      const resourceContainer = this.resourceDisplays.get("energy");
      if (resourceContainer) {
        console.log("Adding energy resource to display");

        // Position the container
        resourceContainer.setPosition(0, yPosition);

        // Update the text
        const textObject = resourceContainer.getAt(
          1
        ) as Phaser.GameObjects.Text;
        const resource = ResourceManager.getResource("energy");
        if (resource && textObject) {
          textObject.setText(
            `${resource.name}: ${Math.floor(energyResource.amount)}`
          );

          // Update energy info
          this.updateEnergyInfo();

          // Position energy info container below the energy resource
          this.energyInfoContainer.setPosition(0, yPosition + 25);

          // Add energy info container to main container
          this.container.add(this.energyInfoContainer);

          // Add resource container to main container
          this.container.add(resourceContainer);

          // Move to next position
          yPosition += 70; // Extra space for energy details
        }
      }
    }

    // Add other resources with quantity > 0 to the container
    inventory.forEach((item) => {
      // Skip energy as it's already handled above
      if (item.type === "energy") return;

      if (item.amount > 0) {
        console.log(
          `Adding resource to display: ${item.type} - ${item.amount}`
        );
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
            textObject.setText(`${resource.name}: ${Math.floor(item.amount)}`);
          } else {
            console.warn(`Resource or text object not found for ${item.type}`);
          }

          // Add to main container
          this.container.add(resourceContainer);

          // Move to next position
          yPosition += 25;
        } else {
          console.warn(`Resource container not found for ${item.type}`);
        }
      }
    });

    // Adjust panel height based on number of visible resources
    const visibleCount = inventory.filter((item) => item.amount > 0).length;
    const panel = this.container.getAt(0) as Phaser.GameObjects.Rectangle;
    if (panel) {
      // Add extra height for energy info if energy is visible
      const energyVisible = inventory.some(
        (item) => item.type === "energy" && item.amount > 0
      );
      const extraHeight = energyVisible ? 45 : 0;
      panel.height = Math.max(50, visibleCount * 25 + 30 + extraHeight); // Minimum height of 50px
    }
  }

  private updateEnergyInfo() {
    // Get energy production, consumption, and balance
    const production = EnergyManager.getEnergyProduction();
    const consumption = EnergyManager.getEnergyConsumption();

    console.log("Updating energy info:", { production, consumption });

    // Update text objects
    this.energyProductionText.setText(`Production: ${production.toFixed(1)}`);
    this.energyConsumptionText.setText(
      `Consumption: ${consumption.toFixed(1)}`
    );

    // Make sure the energy info container is visible
    this.energyInfoContainer.setVisible(true);
  }

  private handleInventoryChanged = () => {
    this.update();
  };

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

  /**
   * Get the height of the resource display
   */
  getHeight(): number {
    const panel = this.container.getAt(0) as Phaser.GameObjects.Rectangle;
    return panel ? panel.height : 0;
  }
}
