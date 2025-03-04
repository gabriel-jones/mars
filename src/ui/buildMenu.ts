import Phaser from "phaser";
import {
  Building,
  BuildingManager,
  BuildingType,
  BUILDING_DEFINITIONS,
} from "../data/buildings";
import { TILE_SIZE } from "../main";
import { ResourceManager, ResourceType } from "../data/resources";

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
  private buildButtonBg: Phaser.GameObjects.Rectangle;
  private buildButtonBorder: Phaser.GameObjects.Rectangle;
  private constructionPanel: Phaser.GameObjects.Container;
  private isConstructionPanelOpen: boolean = false;
  private selectedItem: BuildingType | null = null;
  private placementSprite: Phaser.GameObjects.Sprite | null = null;
  private placementValid: boolean = false;
  private instructionText: Phaser.GameObjects.Text | null = null;
  private onItemPlaced: (itemName: string, x: number, y: number) => void;
  private map: Phaser.Tilemaps.Tilemap;
  private lastPlacementTime: number = 0;
  private canPlace: boolean = false;
  private container: Phaser.GameObjects.Container;
  private uiCamera: Phaser.Cameras.Scene2D.Camera;

  constructor(
    scene: Phaser.Scene,
    map: Phaser.Tilemaps.Tilemap,
    onItemPlaced: (itemName: string, x: number, y: number) => void
  ) {
    this.scene = scene;
    this.map = map;
    this.onItemPlaced = onItemPlaced;

    // Create buttons with fixed position
    this.buildButton = this.createButton({
      text: "BUILD",
      x: this.scene.cameras.main.width / 2,
      y: this.scene.cameras.main.height - 50,
      onClick: () => this.toggleConstructionPanel(),
    });
    this.buildButton.setScrollFactor(0);

    this.buttonB = this.createButton({
      text: "BUTTON B",
      x: this.scene.cameras.main.width / 2 + 150,
      y: this.scene.cameras.main.height - 50,
      onClick: () => console.log("Button B clicked!"),
    });
    this.buttonB.setScrollFactor(0);

    this.createConstructionPanel();
    this.constructionPanel.setScrollFactor(0);

    // Set high depth to ensure UI is on top
    this.buildButton.setDepth(1000);
    this.buttonB.setDepth(1000);
    this.constructionPanel.setDepth(1000);
  }

  private createUIElements() {
    // Create a container for UI elements
    this.container = this.scene.add.container(0, 0);

    // Create buttons
    this.buildButton = this.createButton({
      text: "BUILD",
      x: this.scene.cameras.main.width / 2,
      y: this.scene.cameras.main.height - 50,
      onClick: () => this.toggleConstructionPanel(),
    });

    this.buttonB = this.createButton({
      text: "BUTTON B",
      x: this.scene.cameras.main.width / 2 + 150,
      y: this.scene.cameras.main.height - 50,
      onClick: () => console.log("Button B clicked!"),
    });

    this.createConstructionPanel();

    // Add all UI elements to the container
    this.container.add([
      this.buildButton,
      this.buttonB,
      this.constructionPanel,
    ]);

    // Make sure UI elements are only visible to the UI camera
    this.container.setDepth(1000);

    // Make the main camera ignore the UI container
    this.scene.cameras.main.ignore(this.container);

    // Make sure the UI camera can see the UI container
    this.uiCamera.ignore([]); // Clear any ignores
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

    // Add click handler
    button.on("pointerdown", config.onClick);

    // Store references to background and border if this is the build button
    if (config.text === "BUILD") {
      this.buildButtonBg = buttonBg;
      this.buildButtonBorder = buttonBorder;
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
    const maxItemsPerRow = 8;
    const itemSize = 90; // Square items
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
        .setInteractive()
        .on("pointerover", () => itemBg.setFillStyle(0x777777))
        .on("pointerout", () => itemBg.setFillStyle(0x555555))
        .on("pointerdown", () =>
          this.selectConstructionItem(item.buildingType)
        );

      // Item image with fixed display size
      const itemImage = this.scene.add
        .image(0, -15, item.buildingType)
        .setOrigin(0.5)
        .setDisplaySize(32, 32);

      // Item text
      const itemText = this.scene.add
        .text(0, 15, item.name, {
          fontSize: "12px",
          color: "#ffffff",
        })
        .setOrigin(0.5);

      // Add resource cost text
      const costTexts: Phaser.GameObjects.Text[] = [];
      item.cost.forEach((cost, costIndex) => {
        const resource = ResourceManager.getResource(cost.type);
        if (resource) {
          const costText = this.scene.add
            .text(
              0,
              30 + costIndex * 12,
              `${resource.displayName}: ${cost.amount}`,
              {
                fontSize: "10px",
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

    // Add close button - adjusted position for dynamic panel
    const closeButton = this.scene.add
      .text(panelWidth / 2 - 20, -panelHeight / 2 + 15, "X", {
        fontSize: "18px",
        color: "#ffffff",
        backgroundColor: "#555555",
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => closeButton.setBackgroundColor("#777777"))
      .on("pointerout", () => closeButton.setBackgroundColor("#555555"))
      .on("pointerdown", () => this.toggleConstructionPanel(false));

    this.constructionPanel.add(closeButton);

    // Make sure the panel is on top of other elements
    this.constructionPanel.setDepth(100);
  }

  private toggleConstructionPanel(forceState?: boolean) {
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
      if (this.placementSprite) {
        this.cancelPlacement();
      }
    }
  }

  private selectConstructionItem(buildingType: BuildingType) {
    this.selectedItem = buildingType;
    this.toggleConstructionPanel(false);

    // Create placement sprite
    if (this.placementSprite) {
      this.placementSprite.destroy();
    }

    // Create a placement sprite that follows the cursor
    this.placementSprite = this.scene.add
      .sprite(0, 0, buildingType)
      .setAlpha(0.7)
      .setDisplaySize(TILE_SIZE, TILE_SIZE);

    // Add instruction text
    this.instructionText = this.scene.add
      .text(
        this.scene.cameras.main.width / 2,
        50,
        "Click to place. Press ESC to cancel.",
        { fontSize: "18px", color: "#ffffff" }
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(100);

    // Prevent immediate placement by setting a flag
    this.canPlace = false;
    this.lastPlacementTime = this.scene.time.now;

    // Add ESC key for canceling placement
    const escKey = this.scene.input.keyboard!.addKey("ESC");
    escKey.once("down", () => {
      this.cancelPlacement();
    });
  }

  private cancelPlacement() {
    if (this.placementSprite) {
      this.placementSprite.destroy();
      this.placementSprite = null;
    }

    if (this.instructionText) {
      this.instructionText.destroy();
      this.instructionText = null;
    }

    this.selectedItem = null;
  }

  update() {
    // Update placement sprite position if active
    if (this.placementSprite && this.selectedItem) {
      // Get the current pointer position in world coordinates
      const worldPoint = this.scene.input.activePointer.positionToCamera(
        this.scene.cameras.main
      ) as Phaser.Math.Vector2;

      // Convert world position to tile position
      const tileX = this.map.worldToTileX(worldPoint.x)!;
      const tileY = this.map.worldToTileY(worldPoint.y)!;

      // Convert back to world coordinates (snapped to grid)
      const snappedX = this.map.tileToWorldX(tileX)! + TILE_SIZE / 2;
      const snappedY = this.map.tileToWorldY(tileY)! + TILE_SIZE / 2;

      // Update the placement sprite position
      this.placementSprite.setPosition(snappedX, snappedY);

      // Check if placement is valid at this position
      this.placementValid = this.isPlacementValid(tileX, tileY);

      // Update sprite appearance based on validity
      if (this.placementValid) {
        this.placementSprite.setTint(0xffffff);
      } else {
        this.placementSprite.setTint(0xff0000);
      }

      // Enable placement after a delay
      if (
        !this.canPlace &&
        this.scene.time.now - this.lastPlacementTime > 500
      ) {
        this.canPlace = true;
      }

      // Check if player clicks to place the item
      if (
        this.canPlace &&
        this.placementValid &&
        !this.isConstructionPanelOpen &&
        this.scene.input.activePointer.isDown &&
        this.scene.input.activePointer.getDuration() < 100
      ) {
        this.placeConstructionItem(tileX, tileY, snappedX, snappedY);
        this.lastPlacementTime = this.scene.time.now;
      }
    }

    // Check for clicks on UI elements
    if (
      this.scene.input.activePointer.isDown &&
      this.scene.input.activePointer.getDuration() < 100
    ) {
      const pointer = this.scene.input.activePointer;

      // Check if clicking on the build button
      if (this.isPointInButton(pointer, this.buildButton)) {
        this.toggleConstructionPanel();
      }

      // Check if clicking on the construction panel
      if (this.isConstructionPanelOpen) {
        // Check close button
        const closeButtonBounds = {
          x: this.constructionPanel.x + this.constructionPanel.width / 2 - 20,
          y: this.constructionPanel.y - this.constructionPanel.height / 2 + 15,
          width: 30,
          height: 30,
        };

        if (
          pointer.x >= closeButtonBounds.x - closeButtonBounds.width / 2 &&
          pointer.x <= closeButtonBounds.x + closeButtonBounds.width / 2 &&
          pointer.y >= closeButtonBounds.y - closeButtonBounds.height / 2 &&
          pointer.y <= closeButtonBounds.y + closeButtonBounds.height / 2
        ) {
          this.toggleConstructionPanel(false);
        }

        // Check item clicks
        // ... similar code for each item ...
      }
    }
  }

  private isPlacementValid(tileX: number, tileY: number): boolean {
    // Check if the tile is already occupied
    if (BuildingManager.isTileOccupied(tileX, tileY)) {
      return false;
    }

    // Add more validation as needed (e.g., check if tile is buildable)
    // For example, check if the tile is a valid ground tile
    const tile = this.map.getTileAt(tileX, tileY);
    if (!tile) {
      return false;
    }

    return true;
  }

  private placeConstructionItem(
    tileX: number,
    tileY: number,
    worldX: number,
    worldY: number
  ) {
    if (!this.selectedItem || !this.placementValid) return;

    const selectedItemDef = BUILDING_DEFINITIONS.find(
      (item) => item.buildingType === this.selectedItem
    );

    if (!selectedItemDef) return;

    // Check if player has enough resources
    if (!ResourceManager.hasResources(selectedItemDef.cost)) {
      // Show error message
      const errorText = this.scene.add
        .text(this.scene.cameras.main.width / 2, 100, "Not enough resources!", {
          fontSize: "18px",
          color: "#ff0000",
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(100);

      // Remove error message after 2 seconds
      this.scene.time.delayedCall(2000, () => {
        errorText.destroy();
      });

      return;
    }

    // Use the resources
    selectedItemDef.cost.forEach((cost) => {
      ResourceManager.useResource(cost.type, cost.amount);
    });

    // Create a new building record
    const building: Building = {
      type: this.selectedItem,
      displayName: selectedItemDef.name,
      position: {
        x: tileX,
        y: tileY,
      },
      placedAt: Date.now(),
    };

    // Add to building manager
    BuildingManager.addBuilding(building);

    // Call the callback to handle the actual placement in the main scene
    this.onItemPlaced(this.selectedItem, worldX, worldY);

    // Clean up placement mode
    this.scene.events.emit("itemPlaced");
    this.cancelPlacement();
  }

  private isPointInButton(
    pointer: Phaser.Input.Pointer,
    button: Phaser.GameObjects.Container
  ): boolean {
    return (
      pointer.x >= button.x - 60 &&
      pointer.x <= button.x + 60 &&
      pointer.y >= button.y - 20 &&
      pointer.y <= button.y + 20
    );
  }
}
