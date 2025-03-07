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

interface ButtonConfig {
  text: string;
  x: number;
  y: number;
  onClick: () => void;
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
    const buttonSpacing = 120;
    const buttonY = this.scene.cameras.main.height - 50;

    // Build button
    this.buildButton = this.createButton({
      text: "BUILD",
      x: this.scene.cameras.main.width / 2 - buttonSpacing,
      y: buttonY,
      onClick: () => this.toggleMenu("construction"),
    });
    this.buildButton.setScrollFactor(0);

    // Robots button
    this.robotsButton = this.createButton({
      text: "ROBOTS",
      x: this.scene.cameras.main.width / 2,
      y: buttonY,
      onClick: () => this.toggleMenu("robots"),
    });
    this.robotsButton.setScrollFactor(0);

    // Starships button
    this.starshipsButton = this.createButton({
      text: "SHIPS",
      x: this.scene.cameras.main.width / 2 + buttonSpacing,
      y: buttonY,
      onClick: () => this.toggleMenu("starships"),
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

    // Button background
    const buttonBg = this.scene.add
      .rectangle(0, 0, 120, 40, 0x444444)
      .setOrigin(0.5);

    // Button border
    const buttonBorder = this.scene.add
      .rectangle(0, 0, 124, 44, 0x888888)
      .setOrigin(0.5)
      .setStrokeStyle(2, 0xffffff);

    // Button text
    const buttonText = this.scene.add
      .text(0, 0, config.text, {
        fontSize: "20px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    // Add all elements to the container
    button.add([buttonBorder, buttonBg, buttonText]);

    // Make the button interactive with a specific hit area
    button.setInteractive(
      new Phaser.Geom.Rectangle(-60, -20, 120, 40),
      Phaser.Geom.Rectangle.Contains
    );

    // Add hover effects
    button.on("pointerover", () => {
      buttonBg.setFillStyle(0x666666);
      buttonBorder.setStrokeStyle(3, 0xffffff);
    });

    button.on("pointerout", () => {
      // Only reset if not the active button
      if (
        (config.text === "BUILD" && this.activeMenu !== "construction") ||
        (config.text === "ROBOTS" && this.activeMenu !== "robots") ||
        (config.text === "SHIPS" && this.activeMenu !== "starships")
      ) {
        buttonBg.setFillStyle(0x444444);
        buttonBorder.setStrokeStyle(2, 0xffffff);
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
    const maxItemsPerRow = 4; // Reduced from 8 to make items larger
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
    this.activeMenu = "none";

    // Reset button highlights
    this.resetButtonHighlights();
  }

  // Highlight a button to show it's active
  private highlightButton(button: Phaser.GameObjects.Container): void {
    // Reset all buttons first
    this.resetButtonHighlights();

    // Get the background of the button (first child is border, second is background)
    const buttonBg = button.getAt(1) as Phaser.GameObjects.Rectangle;
    const buttonBorder = button.getAt(0) as Phaser.GameObjects.Rectangle;
    const buttonText = button.getAt(2) as Phaser.GameObjects.Text;

    if (buttonBg && buttonBorder && buttonText) {
      // More distinct active button style
      buttonBg.setFillStyle(0x336633); // Darker green background
      buttonBorder.setStrokeStyle(3, 0x88ff88); // Brighter green border
      buttonText.setColor("#ffffff"); // White text

      // Add a glow effect
      buttonText.setShadow(0, 0, "#88ff88", 8, true, true);
    }
  }

  // Reset all button highlights
  private resetButtonHighlights(): void {
    [this.buildButton, this.robotsButton, this.starshipsButton].forEach(
      (button) => {
        const buttonBg = button.getAt(1) as Phaser.GameObjects.Rectangle;
        const buttonBorder = button.getAt(0) as Phaser.GameObjects.Rectangle;
        const buttonText = button.getAt(2) as Phaser.GameObjects.Text;

        if (buttonBg && buttonBorder && buttonText) {
          buttonBg.setFillStyle(0x444444);
          buttonBorder.setStrokeStyle(2, 0xffffff);
          buttonText.setColor("#ffffff");
          buttonText.setShadow(0, 0, "transparent", 0);
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
          color: "#cccccc",
        })
        .setOrigin(0.5);

      contentContainer.add(noStarshipsText);
      return;
    }

    // Create a scrollable container for starship entries
    const listContainer = this.scene.add.container(0, 0);
    const panelWidth = 600;
    const panelHeight = 400;
    const listY = -panelHeight / 2 + 70; // Start below the title

    // Add starship entries
    starships.forEach((starship, index) => {
      const entryHeight = 80;
      const entryY = listY + index * entryHeight;

      // Create entry background
      const entryBg = this.scene.add
        .rectangle(0, entryY, panelWidth - 40, entryHeight - 10, 0x444444)
        .setOrigin(0.5, 0);

      // Add starship image
      const starshipImage = this.scene.add
        .image(-panelWidth / 2 + 50, entryY + entryHeight / 2, "starship")
        .setScale(0.4); // Use scale instead of display size to maintain aspect ratio

      // Add starship name
      const starshipName = this.scene.add
        .text(-panelWidth / 2 + 100, entryY + 20, starship.name, {
          fontSize: "18px",
          color: "#ffffff",
          fontStyle: "bold",
        })
        .setOrigin(0, 0.5);

      // Add starship status
      const starshipStatus = this.scene.add
        .text(
          -panelWidth / 2 + 100,
          entryY + 45,
          `Status: ${starship.state} (${starship.location})`,
          {
            fontSize: "14px",
            color: "#cccccc",
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
        .text(-panelWidth / 2 + 100, entryY + 65, inventoryText, {
          fontSize: "14px",
          color: "#aaffaa",
          wordWrap: { width: panelWidth - 150 },
        })
        .setOrigin(0, 0.5);

      listContainer.add([
        entryBg,
        starshipImage,
        starshipName,
        starshipStatus,
        carryingText,
      ]);
    });

    contentContainer.add(listContainer);
  }

  // Get all starships from landing pads
  private getStarships(): StarshipInfo[] {
    // Get all landing pads
    const landingPads = BuildingManager.getBuildingsByType("landing-pad");

    // Get starships from landing pads
    const starships: StarshipInfo[] = [];

    // Find all landing pad buildings in the scene
    const buildings = this.scene.children.list.filter(
      (child) => child instanceof LandingPad
    ) as LandingPad[];

    // For each landing pad, get the starship
    buildings.forEach((landingPad, index) => {
      const starship = landingPad.getStarship();
      if (starship) {
        starships.push({
          id: index + 1,
          name: `Starship ${index + 1}`,
          type: "starship",
          state: starship.getState(),
          inventory: starship.getInventory(),
          location: this.getStarshipLocation(starship),
        });
      }
    });

    return starships;
  }

  // Get the location of a starship based on its state
  private getStarshipLocation(starship: Starship): string {
    const state = starship.getState();

    switch (state) {
      case StarshipState.LANDED:
        return "Mars Surface";
      case StarshipState.TAKING_OFF:
        return "Leaving Mars";
      case StarshipState.FLYING:
        return "In Transit";
      case StarshipState.LANDING:
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
