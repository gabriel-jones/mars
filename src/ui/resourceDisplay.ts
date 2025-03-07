import Phaser from "phaser";
import { ResourceManager, ResourceType } from "../data/resources";
import { gameState } from "../state";
import { DEFAULT_FONT } from "../constants";

const TOP_LEVEL_RESOURCES: ResourceType[] = [
  "energy",
  "oxygen",
  "water",
  "iron",
  "silicon",
];

export class ResourceDisplay {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private resourceDisplays: Map<ResourceType, Phaser.GameObjects.Text> =
    new Map();
  private categoryContainers: Map<string, Phaser.GameObjects.Container> =
    new Map();
  private categoryStates: Map<string, boolean> = new Map(); // true = expanded, false = collapsed

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
    // Background panel - make it taller to accommodate groups
    const panel = this.scene.add
      .rectangle(0, 0, 200, 200, 0x000000, 0.5)
      .setOrigin(0, 0);
    this.container.add(panel);

    // Initialize category states (collapsed by default)
    this.categoryStates.set("Food", false);
    this.categoryStates.set("Metals", false);

    // Create display for each resource
    const resources = ResourceManager.getResources();

    // Group resources by category
    const resourcesByCategory = new Map<string, ResourceType[]>();

    // First add standalone resources (Oxygen, Water, Iron, and Silicon)
    let yPosition = 15;

    resources.forEach((resource) => {
      // Common resources to display separately
      if (TOP_LEVEL_RESOURCES.includes(resource.type)) {
        // Resource emoji instead of icon
        const emoji = this.scene.add
          .text(20, yPosition, resource.emoji, {
            fontSize: "20px",
            fontFamily: DEFAULT_FONT,
          })
          .setOrigin(0, 0.5);

        // Resource name and amount
        const text = this.scene.add
          .text(50, yPosition, `${resource.name}: 0`, {
            fontSize: "16px",
            color: "#ffffff",
            fontFamily: DEFAULT_FONT,
          })
          .setOrigin(0, 0.5);

        this.resourceDisplays.set(resource.type, text);
        this.container.add([emoji, text]);

        yPosition += 25;
      } else {
        // Group other resources by category
        const category = resource.category;
        if (!category) {
          console.error(`Resource ${resource.type} has no category`);
          return;
        }
        if (!resourcesByCategory.has(category)) {
          resourcesByCategory.set(category, []);
        }
        resourcesByCategory.get(category)?.push(resource.type);
      }
    });

    // Now add category headers with expand/collapse buttons
    resourcesByCategory.forEach((resourceTypes, category) => {
      // Create category container
      const categoryContainer = this.scene.add.container(0, yPosition);
      this.categoryContainers.set(category, categoryContainer);

      // Create clickable background for the entire row
      const rowBackground = this.scene.add
        .rectangle(0, 0, 200, 25, 0x000000, 0) // Full width, transparent by default
        .setOrigin(0, 0.5)
        .setInteractive({ useHandCursor: true })
        .on("pointerover", () => rowBackground.setFillStyle(0x666666, 0.7))
        .on("pointerout", () => rowBackground.setFillStyle(0x000000, 0)) // Transparent on pointer out
        .on("pointerdown", () => this.toggleCategory(category));

      // Category header with total count (will be updated later)
      const headerText = this.scene.add
        .text(20, 0, `${category}: 0`, {
          fontSize: "16px",
          color: "#ffffff",
          fontStyle: "bold",
          fontFamily: DEFAULT_FONT,
        })
        .setOrigin(0, 0.5);

      // Expand/collapse button (moved to the right)
      const expandButton = this.scene.add
        .text(180, 0, "+", {
          fontSize: "16px",
          color: "#ffffff",
          fontFamily: DEFAULT_FONT,
        })
        .setOrigin(1, 0.5);

      categoryContainer.add([rowBackground, headerText, expandButton]);

      // Add resource items (initially hidden)
      let resourceY = 25; // Start below header
      resourceTypes.forEach((resourceType) => {
        const resource = ResourceManager.getResource(resourceType);
        if (resource) {
          // Resource emoji instead of icon
          const emoji = this.scene.add
            .text(20, resourceY, resource.emoji, {
              fontSize: "20px",
              fontFamily: DEFAULT_FONT,
            })
            .setOrigin(0, 0.5)
            .setVisible(false); // Initially hidden

          // Resource name and amount
          const text = this.scene.add
            .text(50, resourceY, `${resource.name}: 0`, {
              fontSize: "16px",
              color: "#ffffff",
              fontFamily: DEFAULT_FONT,
            })
            .setOrigin(0, 0.5)
            .setVisible(false); // Initially hidden

          this.resourceDisplays.set(resourceType, text);
          categoryContainer.add([emoji, text]);

          resourceY += 25;
        }
      });

      this.container.add(categoryContainer);
      yPosition += 30; // Move to next category position
    });

    // Update the display initially
    this.update();
  }

  private toggleCategory(category: string) {
    const isExpanded = this.categoryStates.get(category) || false;
    this.categoryStates.set(category, !isExpanded);

    const container = this.categoryContainers.get(category);
    if (container && container.length >= 3) {
      // Update expand/collapse button text
      const expandButton = container.getAt(2) as Phaser.GameObjects.Text;
      if (expandButton) {
        expandButton.setText(isExpanded ? "+" : "-");
      }

      // Show/hide resource items
      for (let i = 3; i < container.length; i++) {
        const gameObject = container.getAt(
          i
        ) as Phaser.GameObjects.GameObject & {
          setVisible: (visible: boolean) => void;
        };
        if (gameObject && typeof gameObject.setVisible === "function") {
          gameObject.setVisible(!isExpanded);
        }
      }

      // Adjust positions of subsequent categories
      this.updateCategoryPositions();
    }
  }

  private updateCategoryPositions() {
    // Dynamically calculate starting position based on number of top-level resources
    const topLevelResourcesCount = TOP_LEVEL_RESOURCES.length;
    let yPosition = 15 + topLevelResourcesCount * 25; // Initial offset + height per resource

    // Adjust positions based on expanded/collapsed state
    this.categoryContainers.forEach((container, category) => {
      if (container) {
        container.setY(yPosition);

        const isExpanded = this.categoryStates.get(category) || false;
        const resourceCount = (container.length - 3) / 2; // Subtract header, button, and row background, divide by 2 (icon + text)

        // Move to next category position
        yPosition += 30; // Header height
        if (isExpanded) {
          yPosition += resourceCount * 25; // Add height for visible resources
        }
      }
    });

    // Adjust panel height
    if (this.container && this.container.length > 0) {
      const panel = this.container.getAt(0) as Phaser.GameObjects.Rectangle;
      if (panel && typeof panel.height !== "undefined") {
        panel.height = Math.max(200, yPosition + 10);
      }
    }
  }

  private handleInventoryChanged(inventory: any) {
    this.updateResourceDisplays(inventory);
    this.updateCategoryTotals(inventory);
  }

  private updateResourceDisplays(inventory: any) {
    // Update individual resource displays
    inventory.forEach((item: any) => {
      const display = this.resourceDisplays.get(item.type);
      if (display) {
        const resource = ResourceManager.getResource(item.type);
        if (resource) {
          // Add safety check to ensure the text object is valid before updating
          if (display.scene && display.active) {
            try {
              display.setText(`${resource.name}: ${item.amount}`);
            } catch (error) {
              console.warn(
                `Error updating resource display for ${resource.name}:`,
                error
              );
            }
          }
        }
      }
    });
  }

  private updateCategoryTotals(inventory: any) {
    // Update category totals
    this.categoryContainers.forEach((container, category) => {
      // Make sure container has at least 2 elements before trying to access index 1
      if (container && container.length > 1) {
        const headerText = container.getAt(1) as Phaser.GameObjects.Text;

        // Add null check before calling setText
        if (headerText && headerText.scene && headerText.active) {
          try {
            // Calculate total for this category
            let categoryTotal = 0;
            inventory.forEach((item: any) => {
              // Skip top level resources since they're shown separately
              if (TOP_LEVEL_RESOURCES.includes(item.type)) {
                return;
              }

              const resource = ResourceManager.getResource(item.type);
              if (resource && resource.category === category) {
                categoryTotal += item.amount;
              }
            });

            // Update the header text with the category total
            headerText.setText(`${category.toUpperCase()} (${categoryTotal})`);
          } catch (error) {
            console.warn(
              `Error updating category total for ${category}:`,
              error
            );
          }
        }
      }
    });
  }

  update() {
    // This method is still called from the scene's update loop,
    // but we don't need to do anything here anymore as we're using events
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
}
