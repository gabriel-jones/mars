import Phaser from "phaser";
import {
  Building,
  BuildingManager,
  BuildingType,
  BUILDING_DEFINITIONS,
  PlacementType,
  BuildMenuItem,
} from "../data/buildings";
import { ResourceManager } from "../data/resources";
import { ResourceNodeType } from "../entities/resourceNode";
import { gameState } from "../state";
import { TILE_SIZE } from "../constants";

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
  private rangeStartTile: { x: number; y: number } | null = null;
  private rangeEndTile: { x: number; y: number } | null = null;
  private rangePreview: Phaser.GameObjects.Rectangle | null = null;
  private selectedBuildingDef: BuildMenuItem | null = null;
  private pointerWasDown: boolean = false;

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
      text: "ROBOTS",
      x: this.scene.cameras.main.width / 2 + 150,
      y: this.scene.cameras.main.height - 50,
      onClick: () => console.log("robots button clicked!"),
    });
    this.buttonB.setScrollFactor(0);

    this.createConstructionPanel();
    this.constructionPanel.setScrollFactor(0);

    // Set high depth to ensure UI is on top
    this.buildButton.setDepth(1000);
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

    // Find the building definition
    this.selectedBuildingDef =
      BUILDING_DEFINITIONS.find((item) => item.buildingType === buildingType) ||
      null;

    if (!this.selectedBuildingDef) return;

    // Clean up any existing placement objects
    this.cleanupPlacementObjects();

    // Handle different placement types
    if (this.selectedBuildingDef.placementType === PlacementType.RangeSelect) {
      console.log("Setting up range selection for", buildingType);
      this.setupRangeSelection();

      // Verify the range preview was created
      if (!this.rangePreview) {
        console.error(
          "Failed to create range preview in selectConstructionItem"
        );
      }
    } else {
      this.setupSingleTilePlacement();
    }

    // Add instruction text based on placement type
    const instructionMessage =
      this.selectedBuildingDef.placementType === PlacementType.RangeSelect
        ? "Click and drag to select area. Press ESC to cancel."
        : "Click to place. Press ESC to cancel.";

    this.instructionText = this.scene.add
      .text(this.scene.cameras.main.width / 2, 50, instructionMessage, {
        fontSize: "18px",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(100);

    // Prevent immediate placement by setting a flag and adding a delay
    this.canPlace = false;
    this.lastPlacementTime = this.scene.time.now;

    // Add a slightly longer delay for range selection to prevent accidental selection
    if (this.selectedBuildingDef.placementType === PlacementType.RangeSelect) {
      this.scene.time.delayedCall(300, () => {
        // Only set canPlace to true if we're still in placement mode
        if (this.selectedItem) {
          this.canPlace = true;
        }
      });
    }

    // Add ESC key for canceling placement
    const escKey = this.scene.input.keyboard!.addKey("ESC");
    escKey.once("down", () => {
      this.cancelPlacement();
    });
  }

  private setupSingleTilePlacement() {
    // Create a placement sprite that follows the cursor
    this.placementSprite = this.scene.add
      .sprite(0, 0, this.selectedItem!)
      .setAlpha(0.7)
      .setDisplaySize(TILE_SIZE, TILE_SIZE);
  }

  private setupRangeSelection() {
    // Clean up any existing preview first
    if (this.rangePreview) {
      this.rangePreview.destroy();
      this.rangePreview = null;
    }

    // Create a new range preview
    return this.ensureRangePreviewExists();
  }

  private ensureRangePreviewExists(): boolean {
    if (!this.rangePreview) {
      console.log("Range preview doesn't exist, creating it");
      try {
        // For range selection, we'll use a rectangle to show the selected area
        this.rangePreview = this.scene.add
          .rectangle(0, 0, TILE_SIZE, TILE_SIZE, 0x00ff00, 0.3)
          .setStrokeStyle(2, 0xffffff)
          .setOrigin(0, 0)
          .setAlpha(0.5)
          .setDepth(100); // Make sure it's visible above other elements

        console.log("Range preview created successfully:", this.rangePreview);
        return true;
      } catch (error) {
        console.error("Error creating range preview:", error);
        return false;
      }
    }
    return true;
  }

  private cleanupPlacementObjects() {
    if (this.placementSprite) {
      this.placementSprite.destroy();
      this.placementSprite = null;
    }

    if (this.rangePreview) {
      this.rangePreview.destroy();
      this.rangePreview = null;
    }

    if (this.instructionText) {
      this.instructionText.destroy();
      this.instructionText = null;
    }

    this.rangeStartTile = null;
    this.rangeEndTile = null;
  }

  private cancelPlacement() {
    this.cleanupPlacementObjects();
    this.selectedItem = null;
    this.selectedBuildingDef = null;
  }

  update() {
    if (!this.selectedItem || !this.selectedBuildingDef) return;

    // Get the current pointer position in world coordinates
    const worldPoint = this.scene.input.activePointer.positionToCamera(
      this.scene.cameras.main
    ) as Phaser.Math.Vector2;

    // Convert world position to tile position
    const tileX = this.map.worldToTileX(worldPoint.x)!;
    const tileY = this.map.worldToTileY(worldPoint.y)!;

    // Handle different placement types
    if (this.selectedBuildingDef.placementType === PlacementType.RangeSelect) {
      this.updateRangeSelection(tileX, tileY, worldPoint);
    } else {
      this.updateSingleTilePlacement(tileX, tileY, worldPoint);
    }

    // Enable placement after a delay
    if (!this.canPlace && this.scene.time.now - this.lastPlacementTime > 500) {
      this.canPlace = true;
      // Initialize pointer state when we're ready to place
      this.pointerWasDown = this.scene.input.activePointer.isDown;
    }
  }

  private updateSingleTilePlacement(
    tileX: number,
    tileY: number,
    worldPoint: Phaser.Math.Vector2
  ) {
    if (!this.placementSprite) return;

    // Convert to world coordinates (snapped to grid)
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

  private updateRangeSelection(
    tileX: number,
    tileY: number,
    worldPoint: Phaser.Math.Vector2
  ) {
    // Make absolutely sure we have a range preview
    if (!this.ensureRangePreviewExists()) {
      console.error("Failed to create range preview, aborting update");
      return;
    }

    // Get the current pointer state
    const pointerIsDown = this.scene.input.activePointer.isDown;

    try {
      // If not dragging, just show a single tile preview
      if (!pointerIsDown && !this.rangeStartTile) {
        const worldX = this.map.tileToWorldX(tileX)!;
        const worldY = this.map.tileToWorldY(tileY)!;

        // Safely update the preview position and size
        if (this.rangePreview) {
          this.rangePreview.setPosition(worldX, worldY);
          this.rangePreview.width = TILE_SIZE;
          this.rangePreview.height = TILE_SIZE;
        }

        // Check if placement is valid at this position
        this.placementValid = this.isPlacementValid(tileX, tileY);

        // Check if we're adjacent to an existing habitat
        const adjacentHabitat = BuildingManager.getAdjacentHabitat(
          tileX,
          tileY
        );
        const isExpandingHabitat = adjacentHabitat !== undefined;

        // Update preview color based on validity
        if (this.rangePreview) {
          if (this.placementValid) {
            // Use a different color if we're expanding an existing habitat
            if (isExpandingHabitat) {
              this.rangePreview.setStrokeStyle(2, 0x00ffff); // Cyan for expansion
              this.rangePreview.setFillStyle(0x00ffff, 0.3);
            } else {
              this.rangePreview.setStrokeStyle(2, 0x00ff00); // Green for new habitat
              this.rangePreview.setFillStyle(0x00ff00, 0.3);
            }
          } else {
            this.rangePreview.setStrokeStyle(2, 0xff0000);
            this.rangePreview.setFillStyle(0xff0000, 0.3);
          }
        }
      }

      // Handle range selection start - only start when pointer is down AND we've waited a bit
      if (pointerIsDown && !this.rangeStartTile && this.canPlace) {
        this.rangeStartTile = { x: tileX, y: tileY };
        console.log("Range selection started at", tileX, tileY);
      }

      // Update current end position while dragging
      if (pointerIsDown && this.rangeStartTile) {
        this.rangeEndTile = { x: tileX, y: tileY };

        // Calculate the rectangle dimensions
        const startX = Math.min(this.rangeStartTile.x, this.rangeEndTile.x);
        const startY = Math.min(this.rangeStartTile.y, this.rangeEndTile.y);
        const width = Math.abs(this.rangeEndTile.x - this.rangeStartTile.x) + 1;
        const height =
          Math.abs(this.rangeEndTile.y - this.rangeStartTile.y) + 1;

        // Update the preview rectangle
        const worldX = this.map.tileToWorldX(startX)!;
        const worldY = this.map.tileToWorldY(startY)!;

        // Safely update the preview
        if (this.rangePreview) {
          this.rangePreview.setPosition(worldX, worldY);
          this.rangePreview.width = width * TILE_SIZE;
          this.rangePreview.height = height * TILE_SIZE;
        }

        // Check if the entire range is valid
        this.placementValid = this.isRangePlacementValid(
          startX,
          startY,
          width,
          height
        );

        // Check if we're adjacent to an existing habitat
        let isExpandingHabitat = false;
        for (let x = startX; x < startX + width; x++) {
          for (let y = startY; y < startY + height; y++) {
            const adjacentHabitat = BuildingManager.getAdjacentHabitat(x, y);
            if (adjacentHabitat) {
              isExpandingHabitat = true;
              break;
            }
          }
          if (isExpandingHabitat) break;
        }

        // Update preview color based on validity
        if (this.rangePreview) {
          if (this.placementValid) {
            // Use a different color if we're expanding an existing habitat
            if (isExpandingHabitat) {
              this.rangePreview.setStrokeStyle(2, 0x00ffff); // Cyan for expansion
              this.rangePreview.setFillStyle(0x00ffff, 0.3);
            } else {
              this.rangePreview.setStrokeStyle(2, 0x00ff00); // Green for new habitat
              this.rangePreview.setFillStyle(0x00ff00, 0.3);
            }
          } else {
            this.rangePreview.setStrokeStyle(2, 0xff0000);
            this.rangePreview.setFillStyle(0xff0000, 0.3);
          }
        }
      }

      // Handle range selection end - detect when pointer was down and is now up
      if (
        this.pointerWasDown &&
        !pointerIsDown &&
        this.rangeStartTile &&
        this.rangeEndTile
      ) {
        console.log("Mouse released, attempting to place habitat");

        // Calculate final dimensions
        const startX = Math.min(this.rangeStartTile.x, this.rangeEndTile.x);
        const startY = Math.min(this.rangeStartTile.y, this.rangeEndTile.y);
        const width = Math.abs(this.rangeEndTile.x - this.rangeStartTile.x) + 1;
        const height =
          Math.abs(this.rangeEndTile.y - this.rangeStartTile.y) + 1;

        // Check if the placement is valid one more time
        this.placementValid = this.isRangePlacementValid(
          startX,
          startY,
          width,
          height
        );

        if (this.placementValid) {
          console.log("Placement valid, placing habitat");
          this.placeHabitat(startX, startY, width, height);
        } else {
          console.log("Placement invalid, not placing habitat");
        }

        // Reset range selection
        this.rangeStartTile = null;
        this.rangeEndTile = null;
      }

      // Update the pointer state for the next frame
      this.pointerWasDown = pointerIsDown;
    } catch (error) {
      console.error("Error in updateRangeSelection:", error);
      // Try to recover by recreating the range preview
      this.setupRangeSelection();
    }
  }

  private isRangePlacementValid(
    startX: number,
    startY: number,
    width: number,
    height: number
  ): boolean {
    // Check if any tile in the range is invalid
    for (let x = startX; x < startX + width; x++) {
      for (let y = startY; y < startY + height; y++) {
        if (!this.isPlacementValid(x, y)) {
          return false;
        }
      }
    }
    return true;
  }

  private placeHabitat(
    startX: number,
    startY: number,
    width: number,
    height: number
  ) {
    console.log("placeHabitat called with", startX, startY, width, height);

    if (!this.selectedItem || !this.selectedBuildingDef) {
      console.log("No selected item or building def");
      return;
    }

    if (!this.placementValid) {
      console.log("Placement not valid");
      return;
    }

    // Check if player has enough resources
    if (!ResourceManager.hasResources(this.selectedBuildingDef.cost)) {
      console.log("Not enough resources");

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

    console.log("All checks passed, placing habitat");

    // Use the resources
    this.selectedBuildingDef.cost.forEach((cost) => {
      ResourceManager.useResource(cost.type, cost.amount);
    });

    // Calculate world position for the top-left corner
    const worldX = this.map.tileToWorldX(startX)! + TILE_SIZE / 2;
    const worldY = this.map.tileToWorldY(startY)! + TILE_SIZE / 2;

    // Create a new building record
    const building: Building = {
      type: this.selectedItem,
      displayName: this.selectedBuildingDef.name,
      position: {
        x: startX,
        y: startY,
      },
      size: {
        width: width,
        height: height,
      },
      placedAt: Date.now(),
    };

    // Add to building manager
    BuildingManager.addBuilding(building);
    console.log("Building added to BuildingManager");

    // Call the callback to handle the actual placement in the main scene
    this.onItemPlaced(this.selectedItem, worldX, worldY);
    console.log("onItemPlaced callback called");

    // Emit the event
    this.scene.events.emit("habitatPlaced", { startX, startY, width, height });
    console.log("habitatPlaced event emitted");

    // Clean up placement mode
    this.cancelPlacement();
    console.log("Placement canceled/reset");
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
}
