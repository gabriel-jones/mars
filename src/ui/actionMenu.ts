import Phaser from "phaser";
import {
  BuildingType,
  BUILDING_DEFINITIONS,
  BuildingManager,
} from "../data/buildings";
import { ResourceManager, ResourceType } from "../data/resources";
import { BuildingPlacer } from "../mechanics/buildingPlacer";
import { Starship, StarshipState } from "../entities/starship";
import { LandingPad } from "../entities/buildings/LandingPad";
import { DEFAULT_FONT } from "../constants";

interface ButtonConfig {
  text: string;
  x: number;
  y: number;
  onClick: () => void;
  icon?: string; // Optional icon key
}

// Define the robot info interface
export interface RobotInfo {
  name: string;
  type: string;
  state: string;
  carrying: string;
}

// Define the starship info interface
export interface StarshipInfo {
  id: number;
  name: string;
  type: string;
  state: StarshipState;
  inventory: { [key in ResourceType]?: number };
  location: string;
  robotsToDeliver: number;
}

// Define menu types
type MenuType = "construction" | "robots" | "starships" | "none";

export class ActionMenu {
  private scene: Phaser.Scene;
  private buildButton: Phaser.GameObjects.Container;
  private robotsButton: Phaser.GameObjects.Container;
  private starshipsButton: Phaser.GameObjects.Container;
  private buildButtonBg: Phaser.GameObjects.Rectangle;
  private buildButtonBorder: Phaser.GameObjects.Rectangle;

  // Menu panels
  private constructionPanel: Phaser.GameObjects.Container;
  private robotsPanel: Phaser.GameObjects.Container;
  private starshipsPanel: Phaser.GameObjects.Container;

  // State tracking
  private activeMenu: MenuType = "none";
  private isBulldozeModeActive: boolean = false;
  private buildingPlacer: BuildingPlacer;

  // Public properties for panel state
  public get isRobotsPanelOpen(): boolean {
    return this.activeMenu === "robots";
  }

  public get isStarshipsPanelOpen(): boolean {
    return this.activeMenu === "starships";
  }

  constructor(
    scene: Phaser.Scene,
    map: Phaser.Tilemaps.Tilemap,
    onItemPlaced: (itemName: string, x: number, y: number) => void
  ) {
    this.scene = scene;

    // Create the building placer
    this.buildingPlacer = new BuildingPlacer(scene, map, onItemPlaced);

    // Add keyboard listener for Escape key
    if (this.scene.input && this.scene.input.keyboard) {
      this.scene.input.keyboard.on("keydown-ESC", () => {
        if (this.isBulldozeModeActive) {
          this.toggleBulldozeMode(false);
        } else if (this.activeMenu !== "none") {
          this.closeAllMenus();
        }
      });
    }

    // Create buttons with fixed position - now centered at the bottom
    const buttonSpacing = 160; // Increase spacing between buttons
    const buttonY = this.scene.cameras.main.height - 50;

    // Build button
    this.buildButton = this.createButton({
      text: "BUILD",
      x: this.scene.cameras.main.width / 2 - buttonSpacing,
      y: buttonY,
      onClick: () => this.toggleMenu("construction"),
      icon: "build-mini",
    });
    this.buildButton.setScrollFactor(0);

    // Robots button
    this.robotsButton = this.createButton({
      text: "ROBOTS",
      x: this.scene.cameras.main.width / 2,
      y: buttonY,
      onClick: () => this.toggleMenu("robots"),
      icon: "optimus-mini",
    });
    this.robotsButton.setScrollFactor(0);

    // Starships button
    this.starshipsButton = this.createButton({
      text: "SHIPS",
      x: this.scene.cameras.main.width / 2 + buttonSpacing,
      y: buttonY,
      onClick: () => this.toggleMenu("starships"),
      icon: "starship-mini",
    });
    this.starshipsButton.setScrollFactor(0);

    // Create panels
    this.constructionPanel = this.createConstructionPanel();
    this.constructionPanel.setScrollFactor(0);
    this.constructionPanel.setVisible(false);

    this.robotsPanel = this.createRobotsPanel();
    this.robotsPanel.setScrollFactor(0);
    this.robotsPanel.setVisible(false);

    this.starshipsPanel = this.createStarshipsPanel();
    this.starshipsPanel.setScrollFactor(0);
    this.starshipsPanel.setVisible(false);

    // Set high depth to ensure UI is on top
    this.buildButton.setDepth(1000);
    this.robotsButton.setDepth(1000);
    this.starshipsButton.setDepth(1000);
    this.constructionPanel.setDepth(1000);
    this.robotsPanel.setDepth(1000);
    this.starshipsPanel.setDepth(1000);
  }

  private createButton(config: ButtonConfig): Phaser.GameObjects.Container {
    // Create container for the button
    const button = this.scene.add.container(config.x, config.y);

    // Button width - make it wider if there's an icon
    const buttonWidth = config.icon ? 150 : 130;

    // Button background
    const buttonBg = this.scene.add
      .rectangle(0, 0, buttonWidth, 40, 0x444444)
      .setOrigin(0.5)
      .setName("buttonBg");

    // Button border
    const buttonBorder = this.scene.add
      .rectangle(0, 0, buttonWidth + 4, 44, 0x888888)
      .setOrigin(0.5)
      .setStrokeStyle(2, 0xffffff)
      .setName("buttonBorder");

    // Add elements to the container
    button.add([buttonBorder, buttonBg]);

    // Add icon if provided
    if (config.icon) {
      const icon = this.scene.add
        .image(-55, 0, config.icon)
        .setDisplaySize(24, 24) // Set a consistent size for the icon
        .setName("buttonIcon");
      button.add(icon);
    }

    // Button text - adjust position if icon is present
    const textX = config.icon ? 10 : 0; // Move text to the right if icon is present
    const buttonText = this.scene.add
      .text(textX, 0, config.text, {
        fontSize: "20px",
        color: "#ffffff",
        fontStyle: "bold",
        fontFamily: DEFAULT_FONT,
      })
      .setOrigin(0.5)
      .setName("buttonText");

    // Add text to the container
    button.add(buttonText);

    // Make the button interactive with a specific hit area
    button.setInteractive(
      new Phaser.Geom.Rectangle(-buttonWidth / 2, -20, buttonWidth, 40),
      Phaser.Geom.Rectangle.Contains
    );

    // Add hover effects
    button.on("pointerover", () => {
      const bg = button.getByName("buttonBg") as Phaser.GameObjects.Rectangle;
      const border = button.getByName(
        "buttonBorder"
      ) as Phaser.GameObjects.Rectangle;
      if (bg && border) {
        bg.setFillStyle(0x666666);
        border.setStrokeStyle(3, 0xffffff);
      }
    });

    button.on("pointerout", () => {
      // Only reset if not the active button
      if (
        (config.text === "BUILD" && this.activeMenu !== "construction") ||
        (config.text === "ROBOTS" && this.activeMenu !== "robots") ||
        (config.text === "SHIPS" && this.activeMenu !== "starships")
      ) {
        const bg = button.getByName("buttonBg") as Phaser.GameObjects.Rectangle;
        const border = button.getByName(
          "buttonBorder"
        ) as Phaser.GameObjects.Rectangle;
        if (bg && border) {
          bg.setFillStyle(0x444444);
          border.setStrokeStyle(2, 0xffffff);
        }
      }
    });

    // Add click handler using pointerup instead of pointerdown
    // This ensures the click is only registered when the button is released
    button.on("pointerup", config.onClick);

    // Store references to background and border if this is the build button
    if (config.text === "BUILD") {
      this.buildButtonBg = buttonBg;
      this.buildButtonBorder = buttonBorder;
    }

    return button;
  }

  // Generic method to create a panel with consistent styling
  private createPanel(
    title: string,
    width: number,
    height: number
  ): {
    panel: Phaser.GameObjects.Container;
    contentContainer: Phaser.GameObjects.Container;
  } {
    const panelX = this.scene.cameras.main.width / 2;
    const panelY = this.scene.cameras.main.height - 300;

    // Create container for the panel
    const panel = this.scene.add.container(panelX, panelY);

    // Panel background with border
    const panelBg = this.scene.add
      .rectangle(0, 0, width, height, 0x333333, 0.9)
      .setOrigin(0.5)
      .setStrokeStyle(2, 0x888888);

    panel.add(panelBg);

    // Panel title
    const panelTitle = this.scene.add
      .text(0, -height / 2 + 25, title, {
        fontSize: "24px",
        color: "#ffffff",
        fontStyle: "bold",
        fontFamily: DEFAULT_FONT,
      })
      .setOrigin(0.5);

    panel.add(panelTitle);

    // Create a separate container for the close button
    const closeButtonContainer = this.scene.add.container(0, 0);

    // Position the close button at the top-right corner of the panel
    const closeButtonX = width / 2 - 20; // Right edge of panel with some padding
    const closeButtonY = -height / 2 + 20; // Top edge of panel with some padding

    // Create a visible background for the close button
    const closeButtonBg = this.scene.add
      .circle(closeButtonX, closeButtonY, 15, 0x555555)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => closeButtonBg.setFillStyle(0x777777))
      .on("pointerout", () => closeButtonBg.setFillStyle(0x555555))
      .on("pointerdown", () => this.closeAllMenus());

    // Add an X to the close button
    const closeButtonText = this.scene.add
      .text(closeButtonX, closeButtonY, "X", {
        fontSize: "16px",
        color: "#ffffff",
        fontFamily: DEFAULT_FONT,
      })
      .setOrigin(0.5);

    closeButtonContainer.add([closeButtonBg, closeButtonText]);
    panel.add(closeButtonContainer);

    // Create a container for the content
    const contentContainer = this.scene.add.container(0, 0);
    panel.add(contentContainer);

    return { panel, contentContainer };
  }

  private createConstructionPanel(): Phaser.GameObjects.Container {
    const { panel, contentContainer } = this.createPanel(
      "CONSTRUCTION",
      600,
      400
    );

    // Calculate dynamic panel size based on number of items
    const maxItemsPerRow = 5; // Reduced from 8 to make items larger
    const itemSize = 150; // Increased from 90 to make items larger
    const itemPadding = 10;
    const itemsCount = BUILDING_DEFINITIONS.length;
    const itemsPerRow = Math.min(itemsCount, maxItemsPerRow);
    const rows = Math.ceil(itemsCount / maxItemsPerRow);

    // Calculate panel dimensions
    const panelWidth = 600;
    const panelHeight = 400;

    // Calculate starting position for items
    const startX = -(panelWidth / 2) + itemSize / 2 + itemPadding;
    const startY = -(panelHeight / 2) + itemSize / 2 + itemPadding + 50; // Extra space for title

    // Add building items
    BUILDING_DEFINITIONS.forEach((item, index) => {
      const row = Math.floor(index / maxItemsPerRow);
      const col = index % maxItemsPerRow;
      const x = startX + col * (itemSize + itemPadding);
      const y = startY + row * (itemSize + itemPadding);

      // Item container
      const itemContainer = this.scene.add.container(x, y);

      // Item background with hover effect - square
      const itemBg = this.scene.add
        .rectangle(0, 0, itemSize, itemSize, 0x555555)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on("pointerover", () => {
          itemBg.setFillStyle(0x777777);
          itemBg.setStrokeStyle(2, 0xffffff);
        })
        .on("pointerout", () => {
          itemBg.setFillStyle(0x555555);
          itemBg.setStrokeStyle(0);
        })
        .on("pointerdown", () =>
          this.selectConstructionItem(item.buildingType)
        );

      // Item image with fixed display size
      const itemImage = this.scene.add
        .image(0, -40, item.buildingType) // Adjusted Y position
        .setOrigin(0.5)
        .setDisplaySize(48, 48); // Increased from 32x32

      // Item text - increased font size and adjusted position
      const itemText = this.scene.add
        .text(0, 0, item.name, {
          // Adjusted Y position
          fontSize: "16px", // Increased from 12px
          color: "#ffffff",
        })
        .setOrigin(0.5);

      // Add resource cost text - adjusted positions and increased spacing
      const costTexts: Phaser.GameObjects.Text[] = [];
      item.cost.forEach((cost, costIndex) => {
        const resource = ResourceManager.getResource(cost.type);
        if (resource) {
          const costText = this.scene.add
            .text(
              0,
              25 + costIndex * 20, // Increased Y spacing between cost items
              `${resource.name}: ${cost.amount}`,
              {
                fontSize: "14px", // Increased from 10px
                color: "#cccccc",
              }
            )
            .setOrigin(0.5);
          costTexts.push(costText);
        }
      });

      itemContainer.add([itemBg, itemImage, itemText, ...costTexts]);
      contentContainer.add(itemContainer);
    });

    // Add bulldoze button at the end of the list
    // Calculate position for the bulldoze button (next row if needed)
    const totalItems = BUILDING_DEFINITIONS.length;
    const bulldozeRow = Math.floor(totalItems / maxItemsPerRow);
    const bulldozeCol = totalItems % maxItemsPerRow;
    const bulldozeX = startX + bulldozeCol * (itemSize + itemPadding);
    const bulldozeY = startY + bulldozeRow * (itemSize + itemPadding);

    // Create bulldoze container
    const bulldozeContainer = this.scene.add.container(bulldozeX, bulldozeY);

    // Bulldoze background
    const bulldozeBg = this.scene.add
      .rectangle(0, 0, itemSize, itemSize, 0x555555)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => {
        bulldozeBg.setFillStyle(0x777777);
        bulldozeBg.setStrokeStyle(2, 0xff0000);
      })
      .on("pointerout", () => {
        if (!this.isBulldozeModeActive) {
          bulldozeBg.setFillStyle(0x555555);
          bulldozeBg.setStrokeStyle(0);
        }
      })
      .on("pointerdown", () => this.toggleBulldozeMode());

    // Bulldoze icon
    const bulldozeIcon = this.scene.add
      .image(0, -40, "bulldozer")
      .setOrigin(0.5)
      .setDisplaySize(48, 48);

    // Bulldoze text
    const bulldozeText = this.scene.add
      .text(0, 0, "BULLDOZE", {
        fontSize: "16px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    // Bulldoze description
    const bulldozeDesc = this.scene.add
      .text(0, 25, "Remove buildings", {
        fontSize: "14px",
        color: "#ff9999",
      })
      .setOrigin(0.5);

    bulldozeContainer.add([
      bulldozeBg,
      bulldozeIcon,
      bulldozeText,
      bulldozeDesc,
    ]);
    contentContainer.add(bulldozeContainer);

    return panel;
  }

  private createRobotsPanel(): Phaser.GameObjects.Container {
    const { panel, contentContainer } = this.createPanel(
      "ROBOTS MANAGEMENT",
      600,
      400
    );

    // Add a message for when there are no robots
    const noRobotsText = this.scene.add
      .text(0, 0, "No robots available", {
        fontSize: "18px",
        color: "#cccccc",
      })
      .setOrigin(0.5);

    contentContainer.add(noRobotsText);

    return panel;
  }

  private createStarshipsPanel(): Phaser.GameObjects.Container {
    const { panel, contentContainer } = this.createPanel(
      "STARSHIPS MANAGEMENT",
      600,
      400
    );

    // Add a message for when there are no starships
    const noStarshipsText = this.scene.add
      .text(0, 0, "No starships available", {
        fontSize: "18px",
        color: "#cccccc",
      })
      .setOrigin(0.5);

    contentContainer.add(noStarshipsText);

    return panel;
  }

  // Toggle a specific menu
  private toggleMenu(menuType: MenuType): void {
    // If this menu is already active, close it
    if (this.activeMenu === menuType) {
      this.closeAllMenus();
      return;
    }

    // Clean up animations if starships panel was open
    if (this.activeMenu === "starships") {
      this.cleanupStarshipAnimations();
    }

    // Close any open menu
    this.closeAllMenus();

    // Open the requested menu
    this.activeMenu = menuType;

    if (menuType === "construction") {
      this.constructionPanel.setVisible(true);
      this.highlightButton(this.buildButton);
    } else if (menuType === "robots") {
      this.robotsPanel.setVisible(true);
      this.updateRobotsList();
      this.highlightButton(this.robotsButton);
    } else if (menuType === "starships") {
      this.starshipsPanel.setVisible(true);
      this.updateStarshipsList();
      this.highlightButton(this.starshipsButton);
    }
  }

  // Close all menus
  private closeAllMenus(): void {
    this.constructionPanel.setVisible(false);
    this.robotsPanel.setVisible(false);
    this.starshipsPanel.setVisible(false);

    // Clean up animations if starships panel was open
    if (this.activeMenu === "starships") {
      this.cleanupStarshipAnimations();
    }

    this.activeMenu = "none";

    // Reset button highlights
    this.resetButtonHighlights();
  }

  // Clean up starship animations to prevent memory leaks
  private cleanupStarshipAnimations(): void {
    // Find all tweens related to starship visualizations and stop them
    const tweens = this.scene.tweens.getTweens();

    for (const tween of tweens) {
      // Check if the tween target is part of a starship visualization
      const target = tween.targets[0] as any;
      if (
        target &&
        ((target.name && target.name === "starship") ||
          (target.name && target.name === "engine-flame") ||
          (target.type &&
            target.type === "Container" &&
            target.name &&
            target.name.includes("starship")))
      ) {
        tween.stop();
        tween.remove();
      }
    }
  }

  // Highlight a button to show it's active
  private highlightButton(button: Phaser.GameObjects.Container): void {
    // Reset all buttons first
    this.resetButtonHighlights();

    try {
      // Get the elements by name
      const buttonBorder = button.getByName(
        "buttonBorder"
      ) as Phaser.GameObjects.Rectangle;
      const buttonBg = button.getByName(
        "buttonBg"
      ) as Phaser.GameObjects.Rectangle;
      const buttonText = button.getByName("buttonText");

      // Update background and border
      if (buttonBg && buttonBorder) {
        // More distinct active button style
        buttonBg.setFillStyle(0x336633); // Darker green background
        buttonBorder.setStrokeStyle(3, 0x88ff88); // Brighter green border
      }

      // Always recreate the text to avoid setColor issues
      if (buttonText) {
        // Get the text properties
        const oldText = buttonText.text || "";
        const oldX = buttonText.x || 0;
        const oldY = buttonText.y || 0;

        // Remove the old text
        button.remove(buttonText, true);

        // Create new text with white color and glow effect
        const newText = this.scene.add
          .text(oldX, oldY, oldText, {
            fontSize: "20px",
            color: "#ffffff",
            fontStyle: "bold",
          })
          .setOrigin(0.5)
          .setName("buttonText");

        // Add shadow/glow effect
        newText.setShadow(0, 0, "#88ff88", 8, true, true);

        // Add the new text to the button
        button.add(newText);
      }
    } catch (error) {
      console.error("Error highlighting button:", error);
    }
  }

  // Reset all button highlights
  private resetButtonHighlights(): void {
    [this.buildButton, this.robotsButton, this.starshipsButton].forEach(
      (button) => {
        try {
          // Find elements by name
          const buttonBorder = button.getByName(
            "buttonBorder"
          ) as Phaser.GameObjects.Rectangle;
          const buttonBg = button.getByName(
            "buttonBg"
          ) as Phaser.GameObjects.Rectangle;
          const buttonText = button.getByName("buttonText");

          // Reset background and border
          if (buttonBg && buttonBorder) {
            buttonBg.setFillStyle(0x444444);
            buttonBorder.setStrokeStyle(2, 0xffffff);
          }

          // Always recreate the text to avoid setColor issues
          if (buttonText) {
            // Get the text properties
            const oldText = buttonText.text || "";
            const oldX = buttonText.x || 0;
            const oldY = buttonText.y || 0;

            // Remove the old text
            button.remove(buttonText, true);

            // Create new text with white color
            const newText = this.scene.add
              .text(oldX, oldY, oldText, {
                fontSize: "20px",
                color: "#ffffff",
                fontStyle: "bold",
              })
              .setOrigin(0.5)
              .setName("buttonText");

            // Add the new text to the button
            button.add(newText);
          }
        } catch (error) {
          console.error("Error resetting button:", error);
        }
      }
    );
  }

  private toggleBulldozeMode(forceState?: boolean): void {
    // If a state is forced, use that, otherwise toggle
    const newState =
      forceState !== undefined ? forceState : !this.isBulldozeModeActive;

    // Close any open menu if activating bulldoze mode
    if (newState && this.activeMenu !== "none") {
      this.closeAllMenus();
    }

    this.isBulldozeModeActive = newState;

    // Use the correct methods for bulldoze mode
    if (newState) {
      this.buildingPlacer.enterBulldozeMode();

      // Highlight the bulldoze item in the construction panel
      if (this.constructionPanel.visible) {
        const contentContainer = this.constructionPanel.getAt(
          3
        ) as Phaser.GameObjects.Container;
        // The bulldoze container is the last item in the content container
        const bulldozeContainer = contentContainer.getAt(
          contentContainer.length - 1
        ) as Phaser.GameObjects.Container;
        const bulldozeBg = bulldozeContainer.getAt(
          0
        ) as Phaser.GameObjects.Rectangle;

        if (bulldozeBg) {
          bulldozeBg.setFillStyle(0x883333);
          bulldozeBg.setStrokeStyle(3, 0xff0000);
        }
      }
    } else {
      this.buildingPlacer.exitBulldozeMode();

      // Reset the bulldoze item in the construction panel
      if (this.constructionPanel.visible) {
        const contentContainer = this.constructionPanel.getAt(
          3
        ) as Phaser.GameObjects.Container;
        // The bulldoze container is the last item in the content container
        const bulldozeContainer = contentContainer.getAt(
          contentContainer.length - 1
        ) as Phaser.GameObjects.Container;
        const bulldozeBg = bulldozeContainer.getAt(
          0
        ) as Phaser.GameObjects.Rectangle;

        if (bulldozeBg) {
          bulldozeBg.setFillStyle(0x555555);
          bulldozeBg.setStrokeStyle(0);
        }
      }
    }
  }

  private selectConstructionItem(buildingType: BuildingType): void {
    // Close the construction panel
    this.toggleMenu("none");

    // Tell the building placer to select this building type
    this.buildingPlacer.selectBuildingType(buildingType);
  }

  public updateRobotsList(robots: RobotInfo[] = []): void {
    // Only update if the robots panel is visible
    if (this.activeMenu !== "robots") return;

    // Get the content container (the 4th child of the panel)
    const contentContainer = this.robotsPanel.getAt(
      3
    ) as Phaser.GameObjects.Container;

    // Clear existing robot entries
    contentContainer.removeAll(true);

    if (robots.length === 0) {
      // Show the "No robots available" message
      const noRobotsText = this.scene.add
        .text(0, 0, "No robots available", {
          fontSize: "18px",
          color: "#cccccc",
        })
        .setOrigin(0.5);

      contentContainer.add(noRobotsText);
      return;
    }

    // Create a scrollable container for robot entries
    const listContainer = this.scene.add.container(0, 0);
    const panelWidth = 600;
    const panelHeight = 400;
    const listY = -panelHeight / 2 + 70; // Start below the title

    // Add robot entries
    robots.forEach((robot, index) => {
      const entryHeight = 80;
      const entryY = listY + index * entryHeight;

      // Create entry background
      const entryBg = this.scene.add
        .rectangle(0, entryY, panelWidth - 40, entryHeight - 10, 0x444444)
        .setOrigin(0.5, 0);

      // Add robot image
      const robotImage = this.scene.add
        .image(-panelWidth / 2 + 50, entryY + entryHeight / 2, robot.type)
        .setDisplaySize(48, 48);

      // Add robot name
      const robotName = this.scene.add
        .text(-panelWidth / 2 + 100, entryY + 20, robot.name, {
          fontSize: "18px",
          color: "#ffffff",
          fontStyle: "bold",
        })
        .setOrigin(0, 0.5);

      // Add robot status
      const robotStatus = this.scene.add
        .text(-panelWidth / 2 + 100, entryY + 45, `Status: ${robot.state}`, {
          fontSize: "14px",
          color: "#cccccc",
        })
        .setOrigin(0, 0.5);

      // Add carried resource info if applicable
      let carryingText;
      if (robot.carrying) {
        carryingText = this.scene.add
          .text(
            panelWidth / 2 - 150,
            entryY + entryHeight / 2,
            `Carrying: ${robot.carrying}`,
            {
              fontSize: "14px",
              color: "#aaffaa",
            }
          )
          .setOrigin(0, 0.5);
      } else {
        carryingText = this.scene.add
          .text(
            panelWidth / 2 - 150,
            entryY + entryHeight / 2,
            "Carrying: Nothing",
            {
              fontSize: "14px",
              color: "#cccccc",
            }
          )
          .setOrigin(0, 0.5);
      }

      listContainer.add([
        entryBg,
        robotImage,
        robotName,
        robotStatus,
        carryingText,
      ]);
    });

    contentContainer.add(listContainer);
  }

  public updateStarshipsList(): void {
    // Only update if the starships panel is visible
    if (this.activeMenu !== "starships") return;

    // Get all starships
    const starships = this.getStarships();

    // Get the content container (the 4th child of the panel)
    const contentContainer = this.starshipsPanel.getAt(
      3
    ) as Phaser.GameObjects.Container;

    // Clear existing starship entries
    contentContainer.removeAll(true);

    if (starships.length === 0) {
      // Show the "No starships available" message
      const noStarshipsText = this.scene.add
        .text(0, 0, "No starships available", {
          fontSize: "18px",
          color: "#ffffff",
          fontStyle: "bold",
        })
        .setOrigin(0.5, 0);
      contentContainer.add(noStarshipsText);
      return;
    }

    // Create a scrollable container for starship entries
    const listContainer = this.scene.add.container(0, 0);
    const panelWidth = 600;
    const panelHeight = 400;
    const entryHeight = 80; // Reduced from 100 to 80
    const listY = -panelHeight / 2 + 70; // Start below the title

    // Add starship entries
    starships.forEach((starship, index) => {
      const entryY = listY + index * (entryHeight + 10); // Reduced spacing between entries

      // Create entry background
      const entryBg = this.scene.add
        .rectangle(0, entryY, panelWidth - 40, entryHeight, 0x444444)
        .setOrigin(0.5, 0);

      // Create a container for the starship visualization - moved further left and made smaller
      const shipContainer = this.scene.add.container(
        -panelWidth / 2 + 40,
        entryY + entryHeight / 2 - 10 // Move up to avoid overlap with orbital diagram
      );
      shipContainer.name = `starship-container-${index}`;
      shipContainer.setScale(0.5); // Reduced from 0.7 to make it even smaller

      // Create a separate container for the orbital diagram
      const orbitContainer = this.scene.add.container(
        -panelWidth / 2 + 40,
        entryY + entryHeight / 2 + 15 // Position below the starship
      );
      orbitContainer.name = `orbit-container-${index}`;

      // Add starship image with appropriate state-based styling
      const starshipImage = this.scene.add
        .image(0, 0, "starship")
        .setScale(0.03)
        .setOrigin(0.5, 0.5);
      starshipImage.name = "starship";

      shipContainer.add(starshipImage);

      // Add engine flame with proper size and position - coming from bottom of ship
      const engineFlame = this.scene.add
        .image(0, 15, "engine-flame")
        .setScale(0.04)
        .setOrigin(0.5, 0)
        .setVisible(false);
      engineFlame.name = "engine-flame";

      shipContainer.add(engineFlame);

      // Set up the starship visualization based on its state
      let targetRotation = 0;
      let flameVisible = false;
      let flameScale = 0.06;
      let flameAlpha = 0.8;
      let flameX = 0;
      let flameY = 20; // Position at bottom of ship
      let startRotation = 0; // Starting rotation for animation
      let endRotation = 0; // Ending rotation for animation
      let shouldAnimate = false; // Flag to determine if we should animate

      // Use string comparison for state to avoid TypeScript errors
      const state = starship.state as unknown as string;

      switch (state) {
        case "mars_landed":
          targetRotation = 0; // Vertical
          flameVisible = false; // No flame when landed
          break;

        case "mars_takeoff":
          startRotation = 0; // Start vertical (0 degrees)
          endRotation = Math.PI / 2; // End horizontal (90 degrees)
          targetRotation = startRotation; // Start at vertical position
          flameVisible = true; // Flame visible during takeoff
          flameScale = 0.08;
          flameAlpha = 1;
          shouldAnimate = true; // Enable animation
          break;

        case "mars_orbit":
        case "earth_orbit":
          targetRotation = Math.PI / 2; // 90 degrees (horizontal)
          flameVisible = false; // No flame when in orbit
          flameScale = 0.06;
          flameAlpha = 0.9;
          // Define position for consistency
          flameX = -20; // Position at left side when horizontal
          flameY = 0;
          break;

        case "mars_to_earth":
        case "earth_to_mars":
          targetRotation = Math.PI / 2; // Horizontal
          flameVisible = true; // Flame visible during transfer
          flameScale = 0.08;
          flameAlpha = 1;
          // Define position for consistency
          flameX = -20; // Position at left side when horizontal
          flameY = 0;
          break;

        case "mars_landing":
          startRotation = Math.PI / 2; // Start horizontal (90 degrees)
          endRotation = 0; // End vertical (0 degrees)
          targetRotation = startRotation; // Start at horizontal position
          flameVisible = true; // Flame visible during landing
          flameScale = 0.08;
          flameAlpha = 1;
          shouldAnimate = true; // Enable animation
          break;
      }

      // Apply initial rotation to starship - ONLY if we're not animating
      if (!shouldAnimate) {
        starshipImage.setRotation(targetRotation);
      } else {
        // For animation states, explicitly set the starting rotation
        starshipImage.setRotation(startRotation);
      }

      // Helper function to calculate flame position based on rotation
      const updateFlamePosition = (rotation: number) => {
        // For vertical ship (0 degrees), flame is at bottom (0, 20)
        // For horizontal ship (90 degrees), flame is at left (-20, 0)
        // For angles in between, use trigonometry to position correctly

        // Calculate the angle in radians (0 to PI/2)
        const normalizedRotation = Math.min(Math.PI / 2, Math.max(0, rotation));

        // Calculate flame position
        const flameOffsetX = -Math.sin(normalizedRotation) * 20;
        const flameOffsetY = Math.cos(normalizedRotation) * 20;

        return { x: flameOffsetX, y: flameOffsetY };
      };

      // Update flame position based on ship rotation
      if (state === "mars_landed") {
        flameX = 0;
        flameY = 20;
      } else if (state === "mars_takeoff" || state === "mars_landing") {
        const flamePos = updateFlamePosition(startRotation);
        flameX = flamePos.x;
        flameY = flamePos.y;
      } else if (
        state === "mars_orbit" ||
        state === "earth_orbit" ||
        state === "mars_to_earth" ||
        state === "earth_to_mars"
      ) {
        flameX = -20;
        flameY = 0;
      }

      // Set flame properties
      engineFlame.setPosition(flameX, flameY);
      engineFlame.setScale(flameScale);
      engineFlame.setAlpha(flameAlpha);
      engineFlame.setVisible(flameVisible);

      // Add rotation animation for taking off and landing
      if (shouldAnimate) {
        console.log(
          `Starting animation for ${state} from ${startRotation} to ${endRotation}`
        );

        // Animate rotation from start to end
        this.scene.tweens.add({
          targets: starshipImage,
          rotation: { from: startRotation, to: endRotation },
          duration: 3000, // 3 seconds for animation
          ease: "Cubic.easeInOut",
          repeat: 0, // Don't repeat - just animate once
          yoyo: false, // Don't go back and forth
          onUpdate: (tween) => {
            // Update flame position and rotation to match ship rotation
            const currentRotation = starshipImage.rotation;

            // Calculate flame position using helper function
            const flamePos = updateFlamePosition(currentRotation);
            engineFlame.setPosition(flamePos.x, flamePos.y);

            // Debug log to verify animation is running
            if (Math.random() < 0.01) {
              // Only log occasionally
              console.log(
                `Animation progress: ${tween.progress.toFixed(
                  2
                )}, rotation = ${currentRotation.toFixed(2)}`
              );
            }
          },
        });
      }

      // Add subtle animation to make the visualization more dynamic
      if (flameVisible) {
        // Animate the flame with more dramatic pulsing
        this.scene.tweens.add({
          targets: engineFlame,
          scaleX: { from: flameScale * 0.8, to: flameScale * 1.3 },
          scaleY: { from: flameScale * 0.8, to: flameScale * 1.3 },
          alpha: { from: flameAlpha * 0.7, to: flameAlpha * 1.2 },
          duration: 400,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      }

      // Add subtle hover animation to the starship
      if (
        state === "mars_orbit" ||
        state === "earth_orbit" ||
        state === "mars_to_earth" ||
        state === "earth_to_mars"
      ) {
        this.scene.tweens.add({
          targets: shipContainer,
          y: shipContainer.y + 1,
          duration: 1000,
          ease: "Sine.easeInOut",
          yoyo: true,
          repeat: -1,
        });
      }

      // Add orbit path visualization for flying state - in a separate container
      if (
        state === "mars_orbit" ||
        state === "earth_orbit" ||
        state === "mars_to_earth" ||
        state === "earth_to_mars"
      ) {
        // Create a simplified orbit indicator instead of a full path
        const orbitIndicator = this.scene.add.graphics();
        orbitIndicator.lineStyle(2, 0x3498db, 0.8);

        // Draw a simple arc to represent orbit
        const orbitRadius = 20;
        orbitIndicator.beginPath();
        orbitIndicator.arc(0, 0, orbitRadius, 0, Math.PI, true);
        orbitIndicator.strokePath();

        // Add a dot to represent the planet (Mars or Earth)
        let planetColor = 0xe67e22; // Default to Mars (orange)

        // Determine if we're dealing with Earth or Mars
        if (state === "earth_orbit" || state === "earth_to_mars") {
          planetColor = 0x2ecc71; // Green for Earth
        }

        // Create a separate graphics object for the planet to ensure proper filling
        const planetGraphics = this.scene.add.graphics();
        planetGraphics.fillStyle(planetColor, 1);
        planetGraphics.fillCircle(0, orbitRadius, 4);
        planetGraphics.lineStyle(1, 0xffffff, 0.5);
        planetGraphics.strokeCircle(0, orbitRadius, 4);
        orbitContainer.add(planetGraphics);

        // Add a position indicator dot on the orbit path
        let orbitPosition = Math.PI * 0.5; // Default to middle

        // Set position based on state
        if (state === "mars_takeoff") {
          orbitPosition = Math.PI * 0.8; // Near the start of the arc
        } else if (state === "mars_to_earth") {
          orbitPosition = Math.PI * 0.2; // Near the end of the arc (leaving Mars)
        } else if (state === "earth_to_mars") {
          orbitPosition = Math.PI * 0.8; // Near the start of the arc (leaving Earth)
        } else if (state === "mars_landing") {
          orbitPosition = Math.PI * 0.2; // Near the end of the arc
        }

        const posX = Math.cos(orbitPosition) * orbitRadius;
        const posY = Math.sin(orbitPosition) * orbitRadius;

        // Create a more visible position indicator with glow effect
        const dotSize = 3;
        const glowSize = 5;

        // Add glow effect
        const glowDot = this.scene.add.circle(
          posX,
          posY,
          glowSize,
          0xffffff,
          0.3
        );

        // Add main position dot
        const positionDot = this.scene.add.circle(
          posX,
          posY,
          dotSize,
          0xffffff,
          1
        );

        orbitContainer.add(orbitIndicator);
        orbitContainer.add(glowDot);
        orbitContainer.add(positionDot);
      }

      // Add starship name and status on the same line to save space
      const starshipName = this.scene.add
        .text(
          -panelWidth / 2 + 100, // Moved from 80 to 100
          entryY + 15,
          `${starship.name} - ${starship.state} (${starship.location})`,
          {
            fontSize: "16px",
            color: "#ffffff",
            fontStyle: "bold",
          }
        )
        .setOrigin(0, 0.5);

      // Format inventory for display
      let inventoryText = "Inventory: ";
      if (Object.keys(starship.inventory).length > 0) {
        inventoryText += Object.entries(starship.inventory)
          .map(([resource, amount]) => `${resource}: ${amount}`)
          .join(", ");
      } else {
        inventoryText += "Empty";
      }

      // Add inventory info
      const carryingText = this.scene.add
        .text(-panelWidth / 2 + 100, entryY + 40, inventoryText, {
          fontSize: "14px",
          color: "#aaffaa",
          wordWrap: { width: panelWidth - 140 }, // Adjusted for new position
        })
        .setOrigin(0, 0.5);

      // Add robot delivery info
      const robotDeliveryText = this.scene.add
        .text(
          -panelWidth / 2 + 100,
          entryY + 65,
          `Next delivery: ${starship.robotsToDeliver || 2} Optimus robots`,
          {
            fontSize: "14px",
            color: "#00ffff",
            wordWrap: { width: panelWidth - 140 }, // Adjusted for new position
          }
        )
        .setOrigin(0, 0.5);

      // Add all elements to the list container
      const elements = [
        entryBg,
        shipContainer,
        orbitContainer, // Add the orbit container separately
        starshipName,
        carryingText,
        robotDeliveryText,
      ];

      listContainer.add(elements);
    });

    contentContainer.add(listContainer);
  }

  // Get all starships from landing pads
  private getStarships(): StarshipInfo[] {
    // Get all landing pads
    const mainScene = this.scene as any;
    const landingPads = mainScene.buildings.filter(
      (b: any) => b.getBuildingType && b.getBuildingType() === "landing-pad"
    );

    // Get starships from landing pads
    const starships: StarshipInfo[] = [];
    landingPads.forEach((landingPad: any, index: number) => {
      // For each landing pad, get the starship
      if (landingPad.getStarship) {
        const starship = landingPad.getStarship();
        if (starship) {
          starships.push({
            id: index,
            name: `Starship ${index + 1}`,
            type: "starship",
            state: starship.getState(),
            inventory: starship.getInventory(),
            location: this.getStarshipLocation(starship),
            robotsToDeliver: starship.getRobotsToDeliver
              ? starship.getRobotsToDeliver()
              : 2, // Use getter method
          });
        }
      }
    });

    return starships;
  }

  // Get the location of a starship based on its state
  private getStarshipLocation(starship: Starship): string {
    const state = starship.getState() as string;

    switch (state) {
      case "mars_landed":
        return "Mars Surface";
      case "mars_takeoff":
        return "Leaving Mars";
      case "mars_orbit":
        return "Mars Orbit";
      case "mars_to_earth":
        return "Mars → Earth";
      case "earth_orbit":
        return "Earth Orbit";
      case "earth_to_mars":
        return "Earth → Mars";
      case "mars_landing":
        return "Approaching Mars";
      default:
        return "Unknown";
    }
  }

  update(): void {
    // Delegate update to the building placer
    this.buildingPlacer.update();
  }
}
