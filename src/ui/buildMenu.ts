import Phaser from "phaser";
import { BuildingType, BUILDING_DEFINITIONS } from "../data/buildings";
import { ResourceManager } from "../data/resources";
import { BuildingPlacer } from "../mechanics/buildingPlacer";

interface ButtonConfig {
  text: string;
  x: number;
  y: number;
  onClick: () => void;
}

export class BuildMenu {
  private scene: Phaser.Scene;
  private buildButton: Phaser.GameObjects.Container;
  private buttonB: Phaser.GameObjects.Container;
  private bulldozeButton: Phaser.GameObjects.Container;
  private buildButtonBg: Phaser.GameObjects.Rectangle;
  private buildButtonBorder: Phaser.GameObjects.Rectangle;
  private bulldozeButtonBg: Phaser.GameObjects.Rectangle;
  private bulldozeButtonBorder: Phaser.GameObjects.Rectangle;
  private constructionPanel: Phaser.GameObjects.Container;
  private isConstructionPanelOpen: boolean = false;
  private buildingPlacer: BuildingPlacer;
  private isBulldozeModeActive: boolean = false;

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
        } else if (this.isConstructionPanelOpen) {
          this.toggleConstructionPanel(false);
        }
      });
    }

    // Create buttons with fixed position
    this.buildButton = this.createButton({
      text: "BUILD",
      x: this.scene.cameras.main.width / 2 - 75,
      y: this.scene.cameras.main.height - 50,
      onClick: () => this.toggleConstructionPanel(),
    });
    this.buildButton.setScrollFactor(0);

    this.bulldozeButton = this.createButton({
      text: "BULLDOZE",
      x: this.scene.cameras.main.width / 2 + 75,
      y: this.scene.cameras.main.height - 50,
      onClick: () => this.toggleBulldozeMode(),
    });
    this.bulldozeButton.setScrollFactor(0);

    this.buttonB = this.createButton({
      text: "ROBOTS",
      x: this.scene.cameras.main.width / 2 + 225,
      y: this.scene.cameras.main.height - 50,
      onClick: () => console.log("robots button clicked!"),
    });
    this.buttonB.setScrollFactor(0);

    this.createConstructionPanel();
    this.constructionPanel.setScrollFactor(0);

    // Set high depth to ensure UI is on top
    this.buildButton.setDepth(1000);
    this.bulldozeButton.setDepth(1000);
    this.buttonB.setDepth(1000);
    this.constructionPanel.setDepth(1000);
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
      buttonBg.setFillStyle(0x444444);
      buttonBorder.setStrokeStyle(2, 0xffffff);
    });

    // Add click handler using pointerup instead of pointerdown
    // This ensures the click is only registered when the button is released
    button.on("pointerup", config.onClick);

    // Store references to background and border if this is the build button
    if (config.text === "BUILD") {
      this.buildButtonBg = buttonBg;
      this.buildButtonBorder = buttonBorder;
    } else if (config.text === "BULLDOZE") {
      this.bulldozeButtonBg = buttonBg;
      this.bulldozeButtonBorder = buttonBorder;
    }

    return button;
  }

  private createConstructionPanel() {
    // Position the panel above the build button, but not too high
    const panelX = this.scene.cameras.main.width / 2;
    const panelY = this.scene.cameras.main.height - 200; // Adjusted to be slightly lower

    // Create container for the panel
    this.constructionPanel = this.scene.add
      .container(panelX, panelY)
      .setVisible(false);

    // Calculate dynamic panel size based on number of items
    const maxItemsPerRow = 4; // Reduced from 8 to make items larger
    const itemSize = 150; // Increased from 90 to make items larger
    const itemPadding = 10;
    const itemsCount = BUILDING_DEFINITIONS.length;
    const itemsPerRow = Math.min(itemsCount, maxItemsPerRow);
    const rows = Math.ceil(itemsCount / maxItemsPerRow);

    // Calculate panel dimensions
    const panelWidth = (itemSize + itemPadding) * itemsPerRow + itemPadding;
    const panelHeight = (itemSize + itemPadding) * rows + 50; // Extra space for close button

    // Panel background with border - dynamically sized
    const panelBg = this.scene.add
      .rectangle(0, 0, panelWidth, panelHeight, 0x333333, 0.9)
      .setOrigin(0.5)
      .setStrokeStyle(2, 0x888888);

    this.constructionPanel.add(panelBg);

    // Calculate starting position for items
    const startX = -(panelWidth / 2) + itemSize / 2 + itemPadding;
    const startY = -(panelHeight / 2) + itemSize / 2 + itemPadding;

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
      this.constructionPanel.add(itemContainer);
    });

    // Create a separate container for the close button
    const closeButtonContainer = this.scene.add.container(0, 0);

    // Position the close button at the top-right corner of the panel
    const closeButtonX = panelWidth / 2; // Right edge of panel
    const closeButtonY = -panelHeight / 2; // Top edge of panel

    // Create a visible background for the close button - smaller size
    const closeButtonBg = this.scene.add
      .rectangle(closeButtonX, closeButtonY, 30, 30, 0x333333)
      .setOrigin(0.5)
      .setStrokeStyle(1, 0x888888);

    // Add close button text - smaller font
    const closeButton = this.scene.add
      .text(closeButtonX, closeButtonY, "X", {
        fontSize: "18px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    // Create an invisible hit area that's larger than the visible button
    // This will capture clicks even if they're slightly outside the visible button
    const hitArea = this.scene.add
      .rectangle(closeButtonX, closeButtonY, 60, 60, 0x000000, 0)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    // Make the hit area handle all interactions
    hitArea
      .on("pointerup", () => this.toggleConstructionPanel(false))
      .on("pointerover", () => {
        // Add highlight effect when hovering
        closeButtonBg.setFillStyle(0x555555);
        closeButtonBg.setStrokeStyle(2, 0xffffff);
      })
      .on("pointerout", () => {
        // Remove highlight effect when not hovering
        closeButtonBg.setFillStyle(0x333333);
        closeButtonBg.setStrokeStyle(1, 0x888888);
      })
      .setDepth(300); // Very high depth to ensure it captures all clicks

    // Add all elements to the container
    closeButtonContainer.add([closeButtonBg, closeButton, hitArea]);

    // Add the close button container to the construction panel
    this.constructionPanel.add(closeButtonContainer);

    // Set the depth of the close button container
    closeButtonContainer.setDepth(200);

    // Make sure the panel is on top of other elements
    this.constructionPanel.setDepth(100);
  }

  private toggleConstructionPanel(forceState?: boolean) {
    // Exit bulldoze mode if it's active
    if (this.isBulldozeModeActive) {
      this.toggleBulldozeMode(false);
    }

    this.isConstructionPanelOpen =
      forceState !== undefined ? forceState : !this.isConstructionPanelOpen;

    this.constructionPanel.setVisible(this.isConstructionPanelOpen);

    // Bring to top when visible
    if (this.isConstructionPanelOpen) {
      this.constructionPanel.setDepth(100);
      this.buildButtonBg.setFillStyle(0x666666);
      this.buildButtonBorder.setStrokeStyle(3, 0xffffff);
    } else {
      this.buildButtonBg.setFillStyle(0x444444);
      this.buildButtonBorder.setStrokeStyle(2, 0xffffff);

      // Cancel placement if panel is closed
      this.buildingPlacer.cancelPlacement();
    }
  }

  private toggleBulldozeMode(forceState?: boolean) {
    // Close construction panel if it's open
    if (this.isConstructionPanelOpen) {
      this.toggleConstructionPanel(false);
    }

    this.isBulldozeModeActive =
      forceState !== undefined ? forceState : !this.isBulldozeModeActive;

    if (this.isBulldozeModeActive) {
      // Enter bulldoze mode
      this.buildingPlacer.enterBulldozeMode();

      // Highlight the bulldoze button
      this.bulldozeButtonBg.setFillStyle(0x666666);
      this.bulldozeButtonBorder.setStrokeStyle(3, 0xff0000);
    } else {
      // Exit bulldoze mode
      this.buildingPlacer.exitBulldozeMode();

      // Reset bulldoze button appearance
      this.bulldozeButtonBg.setFillStyle(0x444444);
      this.bulldozeButtonBorder.setStrokeStyle(2, 0xffffff);
    }
  }

  private selectConstructionItem(buildingType: BuildingType) {
    // Close the construction panel
    this.toggleConstructionPanel(false);

    // Delegate to the building placer
    this.buildingPlacer.selectBuildingType(buildingType);
  }

  update() {
    // Delegate update to the building placer
    this.buildingPlacer.update();
  }
}
