import Phaser from "phaser";
import {
  Building,
  BuildingManager,
  BuildingType,
  BUILDING_DEFINITIONS,
} from "../data/buildings";
import { ResourceManager } from "../data/resources";
import { ResourceNodeType } from "../entities/resourceNode";
import { gameState } from "../state";
import { TILE_SIZE } from "../config";

interface ButtonConfig {
  text: string;
  x: number;
  y: number;
  onClick: () => void;
}

interface PlacementPreview extends Phaser.GameObjects.Rectangle {
  iconText?: Phaser.GameObjects.Text;
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

    // Remove the manual click detection in update() since we're now using Phaser's event system
    // The buttons will handle their own clicks through the pointerup events
  }

  private isPlacementValid(tileX: number, tileY: number): boolean {
    // Check if the tile is already occupied
    if (BuildingManager.isTileOccupied(tileX, tileY)) {
      return false;
    }

    // Get the selected building definition
    const selectedItemDef = BUILDING_DEFINITIONS.find(
      (item) => item.buildingType === this.selectedItem
    );

    if (!selectedItemDef) return false;

    // Check placement requirements if they exist
    if (
      selectedItemDef.placementRequirements &&
      selectedItemDef.placementRequirements.onlyOn
    ) {
      // Check if this tile has an ice deposit
      const tileHasIceDeposit =
        gameState.tileData &&
        gameState.tileData[`${tileX},${tileY}`] &&
        gameState.tileData[`${tileX},${tileY}`].hasIceDeposit;

      // If the building requires an ice deposit but the tile doesn't have one
      if (
        selectedItemDef.placementRequirements.onlyOn.includes(
          ResourceNodeType.IceDeposit
        ) &&
        !tileHasIceDeposit
      ) {
        return false;
      }
    }

    // Check if the tile is a valid ground tile
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

  createBuildingButton(key: string, building: any): void {
    // ... existing code ...

    const button = this.scene.add.container(/* your button creation code */);

    button.on("pointerdown", () => {
      // ... existing code ...

      // Add placement preview that follows the mouse
      const preview = this.scene.add.rectangle(
        0,
        0,
        40,
        40,
        0xffffff,
        0.5
      ) as PlacementPreview;
      if (building.icon) {
        const iconText = this.scene.add.text(0, 0, building.icon, {
          fontSize: "20px",
        });
        iconText.setOrigin(0.5);
        // Group the preview and icon
        preview.iconText = iconText;
      }

      // Handle mouse movement for placement preview
      this.scene.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
        preview.setPosition(pointer.x, pointer.y);
        if (preview.iconText) {
          preview.iconText.setPosition(pointer.x, pointer.y);
        }

        // Check placement requirements
        if (
          building.placementRequirement &&
          !building.placementRequirement(this.scene, pointer.x, pointer.y)
        ) {
          preview.setFillStyle(0xff0000, 0.5); // Red if can't place
        } else {
          preview.setFillStyle(0x00ff00, 0.5); // Green if can place
        }
      });

      // Handle placement
      this.scene.input.once("pointerdown", (pointer: Phaser.Input.Pointer) => {
        // Check if we can place the building here
        if (
          !building.placementRequirement ||
          building.placementRequirement(this.scene, pointer.x, pointer.y)
        ) {
          // ... existing placement code ...

          // Call onPlace if it exists
          if (building.onPlace) {
            building.onPlace(this.scene, pointer.x, pointer.y);
          }
        }

        // Clean up preview
        preview.destroy();
        if (preview.iconText) {
          preview.iconText.destroy();
        }
        this.scene.input.off("pointermove");
      });
    });

    // ... existing code ...
  }
}
