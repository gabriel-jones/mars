import Phaser from "phaser";
import { ResourceManager, ResourceType } from "../data/resources";

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
  }
  // Get emoji for resource type
  private getResourceEmoji(type: ResourceType): string {
    switch (type) {
      // Life Support
      case "oxygen":
        return "🅾️";
      case "water":
        return "💧";
      // Elements
      case "silicon":
        return "🧱";
      case "sulphur":
        return "🟡";
      // Metals
      case "iron":
        return "🔘";
      case "aluminium":
        return "🔩";
      case "magnesium":
        return "✨";
      case "calcium":
        return "⚪️";
      case "titanium":
        return "⚫️";
      case "potassium":
        return "🧪";
      case "sodium":
        return "🧂";
      // Food
      case "carrots":
        return "🥕";
      case "tomatoes":
        return "🍅";
      case "potatoes":
        return "🥔";
      case "beans":
        return "🫘";
      default:
        return "❓";
    }
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
      if (
        resource.type === "oxygen" ||
        resource.type === "water" ||
        resource.type === "iron" ||
        resource.type === "silicon"
      ) {
        // Resource emoji instead of icon
        const emoji = this.scene.add
          .text(20, yPosition, this.getResourceEmoji(resource.type), {
            fontSize: "20px",
          })
          .setOrigin(0, 0.5);

        // Resource name and amount
        const text = this.scene.add
          .text(50, yPosition, `${resource.name}: 0`, {
            fontSize: "16px",
            color: "#ffffff",
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
        })
        .setOrigin(0, 0.5);

      // Expand/collapse button (moved to the right)
      const expandButton = this.scene.add
        .text(180, 0, "+", {
          fontSize: "16px",
          color: "#ffffff",
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
            .text(20, resourceY, this.getResourceEmoji(resourceType), {
              fontSize: "20px",
            })
            .setOrigin(0, 0.5)
            .setVisible(false); // Initially hidden

          // Resource name and amount
          const text = this.scene.add
            .text(50, resourceY, `${resource.name}: 0`, {
              fontSize: "16px",
              color: "#ffffff",
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
    if (container) {
      // Update expand/collapse button text
      const expandButton = container.getAt(2) as Phaser.GameObjects.Text;
      expandButton.setText(isExpanded ? "+" : "-");

      // Show/hide resource items
      for (let i = 3; i < container.length; i++) {
        const gameObject = container.getAt(
          i
        ) as Phaser.GameObjects.GameObject & {
          setVisible: (visible: boolean) => void;
        };
        if (gameObject) {
          gameObject.setVisible(!isExpanded);
        }
      }

      // Adjust positions of subsequent categories
      this.updateCategoryPositions();
    }
  }

  private updateCategoryPositions() {
    // Adjust starting position based on number of standalone resources (now 4 instead of 2)
    let yPosition = 115; // Start after Oxygen, Water, Iron, and Silicon (15 + 4*25)

    // Adjust positions based on expanded/collapsed state
    this.categoryContainers.forEach((container, category) => {
      container.setY(yPosition);

      const isExpanded = this.categoryStates.get(category) || false;
      const resourceCount = (container.length - 3) / 2; // Subtract header, button, and row background, divide by 2 (icon + text)

      // Move to next category position
      yPosition += 30; // Header height
      if (isExpanded) {
        yPosition += resourceCount * 25; // Add height for visible resources
      }
    });

    // Adjust panel height
    const panel = this.container.getAt(0) as Phaser.GameObjects.Rectangle;
    panel.height = Math.max(200, yPosition + 10);
  }

  update() {
    const inventory = ResourceManager.getInventory();

    // Update individual resource displays
    inventory.forEach((item) => {
      const display = this.resourceDisplays.get(item.type);
      if (display) {
        const resource = ResourceManager.getResource(item.type);
        if (resource) {
          display.setText(`${resource.name}: ${item.amount}`);
        }
      }
    });

    // Update category totals
    this.categoryContainers.forEach((container, category) => {
      const headerText = container.getAt(1) as Phaser.GameObjects.Text;

      // Calculate total for this category
      let categoryTotal = 0;
      inventory.forEach((item) => {
        // Skip silicon and iron since they're shown separately
        if (item.type === "silicon" || item.type === "iron") {
          return;
        }

        const resource = ResourceManager.getResource(item.type);
        if (resource && resource.category === category) {
          categoryTotal += item.amount;
        }
      });

      // Update header text with total
      headerText.setText(`${category}: ${categoryTotal}`);
    });
  }
}
