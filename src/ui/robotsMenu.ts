import Phaser from "phaser";
import { DEFAULT_FONT } from "../constants";
import { CloseButton } from "./closeButton";
import { HealthBarRenderer } from "../interfaces/Health";
import { ResourceType, RESOURCE_DEFINITIONS } from "../data/resources";
import { DEPTH } from "../depth";

export interface RobotInfo {
  name: string;
  type: string;
  state: string;
  carrying: string;
  carryingType?: ResourceType; // Added to get the resource type for emoji
  // Added fields for enhanced display
  health: number;
  maxHealth: number;
  shield?: number;
  maxShield?: number;
  inventory?: { [key in ResourceType]?: number };
  equippedTool?: string;
  availableTools?: string[];
}

export class RobotsMenu {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private background: Phaser.GameObjects.Rectangle;
  private titleText: Phaser.GameObjects.Text;
  private closeButton: CloseButton;
  private contentContainer: Phaser.GameObjects.Container;
  private listContainer: Phaser.GameObjects.Container;
  private noRobotsText: Phaser.GameObjects.Text;
  private healthBarRenderer: HealthBarRenderer;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = this.scene.add.container(0, 0);
    this.container.setVisible(false);
    this.container.setDepth(DEPTH.UI);
    this.container.setScrollFactor(0);

    // Create health bar renderer
    this.healthBarRenderer = new HealthBarRenderer(this.scene);

    // Customize health bar size for the menu
    this.healthBarRenderer.setSize(80, 8);

    // Create the panel
    this.createPanel();
  }

  private createPanel(): void {
    const width = 600;
    const height = 400;
    const x = this.scene.cameras.main.width / 2;
    const y = this.scene.cameras.main.height - 300;

    // Create background
    this.background = this.scene.add.rectangle(
      0,
      0,
      width,
      height,
      0x333333,
      0.9
    );
    this.background.setStrokeStyle(2, 0x888888);
    this.container.add(this.background);

    // Create title
    this.titleText = this.scene.add.text(0, -height / 2 + 25, "ROBOTS", {
      fontSize: "24px",
      color: "#ffffff",
      fontStyle: "bold",
      fontFamily: DEFAULT_FONT,
    });
    this.titleText.setOrigin(0.5);
    this.container.add(this.titleText);

    // Create close button
    this.closeButton = new CloseButton(
      this.scene,
      width / 2 - 20,
      -height / 2 + 20,
      24,
      () => this.hide()
    );
    this.container.add(this.closeButton);

    // Create content container
    this.contentContainer = this.scene.add.container(0, 0);
    this.container.add(this.contentContainer);

    // Create list container
    this.listContainer = this.scene.add.container(0, 0);
    this.contentContainer.add(this.listContainer);

    // Create "no robots" text
    this.noRobotsText = this.scene.add.text(0, 0, "No robots available", {
      fontSize: "18px",
      color: "#888888",
      fontFamily: DEFAULT_FONT,
    });
    this.noRobotsText.setOrigin(0.5);
    this.noRobotsText.setVisible(false);
    this.contentContainer.add(this.noRobotsText);

    // Position the container
    this.container.setPosition(x, y);
  }

  public updateRobotsList(robots: RobotInfo[] = []): void {
    // Clear existing list
    this.listContainer.removeAll(true);

    // If no robots, show message
    if (robots.length === 0) {
      this.noRobotsText.setVisible(true);
      return;
    }

    // Hide "no robots" text
    this.noRobotsText.setVisible(false);

    // Create a scrollable container for robot entries
    const panelWidth = 560;
    const entryHeight = 80; // Increased height for more information
    const listY = -150; // Start below the title

    // Add robot entries
    robots.forEach((robot, index) => {
      const entryY = listY + index * (entryHeight + 10);

      // Create entry background
      const entryBg = this.scene.add.rectangle(
        0,
        entryY,
        panelWidth,
        entryHeight,
        0x444444
      );
      entryBg.setOrigin(0.5, 0);
      this.listContainer.add(entryBg);

      // Create robot icon based on type - with smaller size
      const iconKey =
        robot.type === "optimus" ? "optimus-mini" : "mining-drone";
      const robotIcon = this.scene.add.image(
        -panelWidth / 2 + 30,
        entryY + entryHeight / 2,
        iconKey
      );
      // Make the icon fit within the row height
      robotIcon.setDisplaySize(40, 40);
      this.listContainer.add(robotIcon);

      // Create robot name
      const nameText = this.scene.add.text(
        -panelWidth / 2 + 60,
        entryY + 15,
        robot.name,
        {
          fontSize: "16px",
          color: "#ffffff",
          fontStyle: "bold",
          fontFamily: DEFAULT_FONT,
        }
      );
      this.listContainer.add(nameText);

      // Create robot state
      const stateText = this.scene.add.text(
        -panelWidth / 2 + 60,
        entryY + 35,
        `State: ${robot.state}`,
        {
          fontSize: "14px",
          color: "#aaaaaa",
          fontFamily: DEFAULT_FONT,
        }
      );
      this.listContainer.add(stateText);

      // Create carrying info with emoji
      let carryingEmoji = "🔄"; // Default emoji (recycling symbol for nothing)
      if (robot.carryingType) {
        // Find the resource definition to get the emoji
        const resourceDef = RESOURCE_DEFINITIONS.find(
          (def) => def.type === robot.carryingType
        );
        if (resourceDef) {
          carryingEmoji = resourceDef.emoji;
        }
      }

      // Always show carrying info, with "Nothing" if not carrying
      const carryingText = this.scene.add.text(
        -panelWidth / 2 + 60,
        entryY + 55,
        `${carryingEmoji} Carrying: ${robot.carrying || "Nothing"}`,
        {
          fontSize: "14px",
          color: "#aaaaaa",
          fontFamily: DEFAULT_FONT,
        }
      );
      this.listContainer.add(carryingText);

      // Create health/shield bar
      const healthBarContainer = this.createHealthBar(
        robot,
        -panelWidth / 2 + 250,
        entryY + 25
      );
      this.listContainer.add(healthBarContainer);

      // Create tool icon and text
      if (robot.equippedTool && robot.equippedTool !== "None") {
        // Get the appropriate texture key based on the tool type
        let toolTextureKey = "assault-rifle"; // Default texture

        if (robot.equippedTool === "Assault Rifle") {
          toolTextureKey = "assault-rifle";
        } else if (robot.equippedTool === "Mining Tool") {
          toolTextureKey = "mining-tool"; // Assuming this texture exists
        } else if (robot.equippedTool === "Raygun") {
          toolTextureKey = "raygun";
        }

        // Create tool icon using the same sprite as in the tool inventory
        const toolIcon = this.scene.add.sprite(
          -panelWidth / 2 + 250,
          entryY + 55,
          toolTextureKey
        );

        // Set display size with proper aspect ratio for assault rifle
        if (toolTextureKey === "assault-rifle") {
          toolIcon.setDisplaySize(24, 24); // Square shape
        } else {
          toolIcon.setDisplaySize(24, 24); // Square for other tools
        }

        toolIcon.setOrigin(0.5);
        this.listContainer.add(toolIcon);

        // Create tool text
        const toolText = this.scene.add.text(
          -panelWidth / 2 + 270,
          entryY + 55,
          `Tool: ${robot.equippedTool}`,
          {
            fontSize: "14px",
            color: "#aaaaaa",
            fontFamily: DEFAULT_FONT,
          }
        );
        toolText.setOrigin(0, 0.5);
        this.listContainer.add(toolText);
      } else {
        // Show "No tool" if no tool equipped
        const toolText = this.scene.add.text(
          -panelWidth / 2 + 250,
          entryY + 55,
          "Tool: None",
          {
            fontSize: "14px",
            color: "#aaaaaa",
            fontFamily: DEFAULT_FONT,
          }
        );
        this.listContainer.add(toolText);
      }

      // Create inventory section if available
      if (robot.inventory && Object.keys(robot.inventory).length > 0) {
        const inventoryText = this.scene.add.text(
          panelWidth / 2 - 150,
          entryY + 15,
          "Inventory:",
          {
            fontSize: "14px",
            color: "#ffffff",
            fontFamily: DEFAULT_FONT,
          }
        );
        this.listContainer.add(inventoryText);

        // Display up to 3 inventory items with emojis
        let inventoryY = 35;
        Object.entries(robot.inventory)
          .slice(0, 3)
          .forEach(([resourceType, amount]) => {
            // Find the resource definition to get the emoji
            const resourceDef = RESOURCE_DEFINITIONS.find(
              (def) => def.type === resourceType
            );
            const emoji = resourceDef ? resourceDef.emoji : "❓";

            const itemText = this.scene.add.text(
              panelWidth / 2 - 150,
              entryY + inventoryY,
              `${emoji} ${resourceType}: ${amount}`,
              {
                fontSize: "12px",
                color: "#aaaaaa",
                fontFamily: DEFAULT_FONT,
              }
            );
            this.listContainer.add(itemText);
            inventoryY += 15;
          });
      }
    });
  }

  private createHealthBar(
    robot: RobotInfo,
    x: number,
    y: number
  ): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y);

    // Health bar background
    const healthBg = this.scene.add.rectangle(45, 0, 80, 10, 0x000000);
    healthBg.setStrokeStyle(1, 0xffffff);
    container.add(healthBg);

    // Health bar fill
    const healthPercent = robot.health / robot.maxHealth;
    const healthFill = this.scene.add.rectangle(
      5,
      0,
      80 * healthPercent,
      8,
      this.getHealthColor(healthPercent)
    );
    healthFill.setOrigin(0, 0.5);
    container.add(healthFill);

    // Round health values to ceiling integers
    const roundedHealth = Math.ceil(robot.health);
    const roundedMaxHealth = Math.ceil(robot.maxHealth);

    // Health text - moved closer to the bar
    const healthText = this.scene.add.text(
      90,
      0,
      `${roundedHealth}/${roundedMaxHealth}`,
      {
        fontSize: "12px",
        color: "#ffffff",
        fontFamily: DEFAULT_FONT,
      }
    );
    healthText.setOrigin(0, 0.5);
    container.add(healthText);

    // Add shield bar if robot has shield
    if (
      robot.shield !== undefined &&
      robot.maxShield !== undefined &&
      robot.maxShield > 0
    ) {
      // Shield bar background
      const shieldBg = this.scene.add.rectangle(45, 15, 80, 10, 0x000000);
      shieldBg.setStrokeStyle(1, 0xffffff);
      container.add(shieldBg);

      // Shield bar fill
      const shieldPercent = robot.shield / robot.maxShield;
      const shieldFill = this.scene.add.rectangle(
        5,
        15,
        80 * shieldPercent,
        8,
        0x0088ff // Blue for shield
      );
      shieldFill.setOrigin(0, 0.5);
      container.add(shieldFill);

      // Round shield values to ceiling integers
      const roundedShield = Math.ceil(robot.shield);
      const roundedMaxShield = Math.ceil(robot.maxShield);

      // Shield text - moved closer to the bar
      const shieldText = this.scene.add.text(
        90,
        15,
        `${roundedShield}/${roundedMaxShield}`,
        {
          fontSize: "12px",
          color: "#88ccff",
          fontFamily: DEFAULT_FONT,
        }
      );
      shieldText.setOrigin(0, 0.5);
      container.add(shieldText);
    }

    return container;
  }

  private getHealthColor(percent: number): number {
    if (percent > 0.6) return 0x00ff00; // Green
    if (percent > 0.3) return 0xffff00; // Yellow
    return 0xff0000; // Red
  }

  public show(): void {
    this.container.setVisible(true);
  }

  public hide(): void {
    this.container.setVisible(false);
  }

  public isVisible(): boolean {
    return this.container.visible;
  }

  public destroy(): void {
    this.container.destroy();
  }
}
