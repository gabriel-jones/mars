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
import { TerrainFeatureType } from "../entities/TerrainFeature";
import { gameState } from "../state";
import { TILE_SIZE } from "../constants";
import { MiningStation, MINING_RADIUS } from "../entities/buildings";
import { TerrainFeature } from "../entities/TerrainFeature";

export class BuildingPlacer {
  private scene: Phaser.Scene;
  private map: Phaser.Tilemaps.Tilemap;
  private selectedItem: BuildingType | null = null;
  private placementSprite: Phaser.GameObjects.Sprite | null = null;
  private placementValid: boolean = false;
  private instructionText: Phaser.GameObjects.Text | null = null;
  private onItemPlaced: (itemName: string, x: number, y: number) => void;
  private lastPlacementTime: number = 0;
  private canPlace: boolean = false;
  private rangeStartTile: { x: number; y: number } | null = null;
  private rangeEndTile: { x: number; y: number } | null = null;
  private rangePreview: Phaser.GameObjects.Rectangle | null = null;
  private selectedBuildingDef: BuildMenuItem | null = null;
  private pointerWasDown: boolean = false;
  private bulldozeMode: boolean = false;
  private bulldozeSprite: Phaser.GameObjects.Sprite | null = null;

  constructor(
    scene: Phaser.Scene,
    map: Phaser.Tilemaps.Tilemap,
    onItemPlaced: (itemName: string, x: number, y: number) => void
  ) {
    this.scene = scene;
    this.map = map;
    this.onItemPlaced = onItemPlaced;

    // Add keyboard listener for Escape key
    if (this.scene.input && this.scene.input.keyboard) {
      this.scene.input.keyboard.on("keydown-ESC", () => {
        if (this.bulldozeMode) {
          this.exitBulldozeMode();
        } else if (this.selectedItem) {
          this.cancelPlacement();
        }
      });
    }
  }

  selectBuildingType(buildingType: BuildingType) {
    // Exit bulldoze mode if it was active
    if (this.bulldozeMode) {
      this.exitBulldozeMode();
    }

    this.selectedItem = buildingType;

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
        console.error("Failed to create range preview in selectBuildingType");
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
    } else {
      this.scene.time.delayedCall(100, () => {
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
    // Get the building definition to access tileSize
    const buildingDef = BUILDING_DEFINITIONS.find(
      (item) => item.buildingType === this.selectedItem
    );

    if (!buildingDef) return;

    // Get the tile size of the building
    const tileWidth = buildingDef.tileSize?.width || 1;
    const tileHeight = buildingDef.tileSize?.height || 1;

    // Create a placement sprite that follows the cursor
    this.placementSprite = this.scene.add
      .sprite(0, 0, this.selectedItem!)
      .setAlpha(0.7)
      .setDisplaySize(TILE_SIZE * tileWidth, TILE_SIZE * tileHeight)
      .setOrigin(0.5, 0.5); // Center the sprite
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
    // Clean up the placement sprite
    if (this.placementSprite) {
      this.placementSprite.destroy();
      this.placementSprite = null;
    }

    // Clean up the instruction text
    if (this.instructionText) {
      this.instructionText.destroy();
      this.instructionText = null;
    }

    // Clean up the range preview
    if (this.rangePreview) {
      this.rangePreview.destroy();
      this.rangePreview = null;
    }

    // Clean up mining station preview
    if (this.selectedItem === "mining-station") {
      MiningStation.cleanupPreview();
    }

    // Reset range selection
    this.rangeStartTile = null;
    this.rangeEndTile = null;
  }

  cancelPlacement() {
    // Exit bulldoze mode if active
    if (this.bulldozeMode) {
      this.exitBulldozeMode();
      return;
    }

    // Clean up any mining station preview
    if (this.selectedItem === "mining-station") {
      MiningStation.cleanupPreview();
    }

    this.cleanupPlacementObjects();
    this.selectedItem = null;
    this.selectedBuildingDef = null;
  }

  update() {
    // Handle bulldoze mode
    if (this.bulldozeMode) {
      this.updateBulldozeMode();
      return;
    }

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
    if (!this.placementSprite || !this.selectedItem) return;

    // Get the building definition to access tileSize
    const buildingDef = BUILDING_DEFINITIONS.find(
      (item) => item.buildingType === this.selectedItem
    );

    if (!buildingDef) return;

    // Get the tile size of the building
    const tileWidth = buildingDef.tileSize?.width || 1;
    const tileHeight = buildingDef.tileSize?.height || 1;

    // Get the top-left corner of the tile
    const tileTopLeft = this.map.tileToWorldXY(tileX, tileY);
    if (!tileTopLeft) return;

    // For multi-tile buildings, we need to position the sprite so that its center
    // is at the center of the area covered by the building, but the mouse is at the top-left tile
    const offsetX = ((tileWidth - 1) * TILE_SIZE) / 2;
    const offsetY = ((tileHeight - 1) * TILE_SIZE) / 2;

    // Position the sprite with the top-left corner at the mouse position
    // and the center offset based on the building's size
    this.placementSprite.setPosition(
      tileTopLeft.x + TILE_SIZE / 2 + offsetX,
      tileTopLeft.y + TILE_SIZE / 2 + offsetY
    );

    // Check if placement is valid
    this.placementValid = this.isPlacementValid(tileX, tileY);

    // Update the sprite tint based on validity
    this.placementSprite.setTint(this.placementValid ? 0x00ff00 : 0xff0000);

    // Special handling for mining station - show mining area preview
    if (this.selectedItem === "mining-station") {
      // Check specifically for mining area overlap
      let miningAreaOverlap = false;
      if (this.placementValid) {
        // Only check for overlap if other placement conditions are valid
        const centerX = tileTopLeft.x + TILE_SIZE / 2;
        const centerY = tileTopLeft.y + TILE_SIZE / 2;
        miningAreaOverlap = BuildingManager.wouldMiningAreaOverlap(
          centerX,
          centerY,
          MINING_RADIUS
        );
      }

      // If there's a mining area overlap, set placementValid to false
      if (miningAreaOverlap) {
        this.placementValid = false;

        // Show a message that mining areas can't overlap
        if (
          !this.instructionText ||
          this.instructionText.text !==
            "Mining areas cannot overlap! Adjacent placement is allowed."
        ) {
          if (this.instructionText) {
            this.instructionText.destroy();
          }

          this.instructionText = this.scene.add
            .text(
              this.scene.cameras.main.width / 2,
              100,
              "Mining areas cannot overlap! Adjacent placement is allowed.",
              {
                fontSize: "18px",
                color: "#ff0000",
                backgroundColor: "#000000",
                padding: { x: 10, y: 5 },
              }
            )
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(100);

          // Fade out and destroy after 3 seconds
          this.scene.tweens.add({
            targets: this.instructionText,
            alpha: 0,
            duration: 1000,
            delay: 2000,
            onComplete: () => {
              if (this.instructionText) {
                this.instructionText.destroy();
                this.instructionText = null;
              }
            },
          });
        }
      }

      MiningStation.showPlacementPreview(
        this.scene,
        tileTopLeft.x + TILE_SIZE / 2,
        tileTopLeft.y + TILE_SIZE / 2,
        this.placementValid
      );
    }

    // Handle click to place the building
    const pointer = this.scene.input.activePointer;
    if (
      pointer.isDown &&
      this.canPlace &&
      this.placementValid &&
      this.scene.time.now - this.lastPlacementTime > 300
    ) {
      // Use the exact same position as the preview
      const exactX = tileTopLeft.x + TILE_SIZE / 2 + offsetX;
      const exactY = tileTopLeft.y + TILE_SIZE / 2 + offsetY;

      this.placeConstructionItem(tileX, tileY, exactX, exactY);
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

    // Get the building definition to access minimum tileSize
    const buildingDef = BUILDING_DEFINITIONS.find(
      (item) => item.buildingType === this.selectedItem
    );

    if (!buildingDef) return;

    // Get the minimum tile size of the building (default to 1x1)
    const minTileWidth = buildingDef.tileSize?.width || 1;
    const minTileHeight = buildingDef.tileSize?.height || 1;

    // Get the current pointer state
    const pointerIsDown = this.scene.input.activePointer.isDown;

    try {
      // If not dragging, just show a single tile preview with minimum size
      if (!pointerIsDown && !this.rangeStartTile) {
        const worldX = this.map.tileToWorldX(tileX)!;
        const worldY = this.map.tileToWorldY(tileY)!;

        // Safely update the preview position and size
        if (this.rangePreview) {
          this.rangePreview.setPosition(worldX, worldY);
          this.rangePreview.width = TILE_SIZE * minTileWidth;
          this.rangePreview.height = TILE_SIZE * minTileHeight;
          this.rangePreview.setOrigin(0, 0); // Set origin to top-left
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

    // We no longer check if player has enough resources or deduct them
    // Resources will be delivered to the blueprint by robots

    console.log("All checks passed, placing habitat blueprint");

    // Calculate world position for the top-left corner
    const worldX = this.map.tileToWorldX(startX)! + TILE_SIZE / 2;
    const worldY = this.map.tileToWorldY(startY)! + TILE_SIZE / 2;

    // Generate all tile positions for the habitat
    const habitatTiles: { x: number; y: number }[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        habitatTiles.push({ x: startX + x, y: startY + y });
      }
    }

    // Check if we're adjacent to an existing habitat
    let adjacentHabitat: Building | undefined;
    for (const tile of habitatTiles) {
      adjacentHabitat = BuildingManager.getAdjacentHabitat(tile.x, tile.y);
      if (adjacentHabitat) {
        break;
      }
    }

    if (adjacentHabitat && adjacentHabitat.habitatId) {
      // We're expanding an existing habitat
      console.log(`Expanding habitat ${adjacentHabitat.habitatId}`);

      // Create a new building record for the expansion (as a blueprint)
      const expansionBlueprint: Building = {
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
        tiles: habitatTiles,
        placedAt: Date.now(),
        isBlueprint: true, // Mark as blueprint
        habitatId: `expansion-${adjacentHabitat.habitatId}-${Date.now()}`,
      };

      // Add the expansion blueprint to the building manager
      BuildingManager.addBuilding(expansionBlueprint);

      // Call the callback to handle the actual placement in the main scene
      this.onItemPlaced("blueprint-" + this.selectedItem, worldX, worldY);

      // Emit the event for the expansion blueprint
      this.scene.events.emit("habitatExpansionPlaced", {
        startX,
        startY,
        width,
        height,
        expansionId: expansionBlueprint.habitatId,
        targetHabitatId: adjacentHabitat.habitatId,
        tiles: habitatTiles,
      });

      // We'll expand the habitat when the blueprint is completed
    } else {
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
        tiles: habitatTiles,
        placedAt: Date.now(),
        isBlueprint: true, // Mark as blueprint
      };

      // Add to building manager
      BuildingManager.addBuilding(building);
      console.log("Building blueprint added to BuildingManager");

      // Call the callback to handle the actual placement in the main scene
      // We pass 'blueprint-' + this.selectedItem to indicate this is a blueprint
      this.onItemPlaced("blueprint-" + this.selectedItem, worldX, worldY);
      console.log("onItemPlaced callback called for blueprint");

      // Emit the event
      this.scene.events.emit("habitatPlaced", {
        startX,
        startY,
        width,
        height,
      });
      console.log("habitatPlaced event emitted");
    }

    // Clean up placement mode
    this.cancelPlacement();
    console.log("Placement canceled/reset");
  }

  private isPlacementValid(tileX: number, tileY: number): boolean {
    if (!this.selectedItem) return false;

    // Find the building definition
    const buildingDef = BUILDING_DEFINITIONS.find(
      (item) => item.buildingType === this.selectedItem
    );

    if (!buildingDef) return false;

    // Get the tile size of the building
    const tileWidth = buildingDef.tileSize?.width || 1;
    const tileHeight = buildingDef.tileSize?.height || 1;

    // Check if all tiles are valid ground tiles
    for (let x = tileX; x < tileX + tileWidth; x++) {
      for (let y = tileY; y < tileY + tileHeight; y++) {
        // Get the tile at this position
        const tile = this.map.getTileAt(x, y);

        // If there's no tile, it's not valid
        if (!tile) {
          return false;
        }

        // Check if the tile is already occupied
        if (BuildingManager.isTileOccupied(x, y)) {
          return false;
        }
      }
    }

    // For mining stations, check if the mining area would overlap with existing mining stations
    if (this.selectedItem === "mining-station") {
      // Convert tile coordinates to world coordinates
      const tileCenter = this.map.tileToWorldXY(tileX, tileY);
      if (!tileCenter) return false;

      const worldX = tileCenter.x + TILE_SIZE / 2;
      const worldY = tileCenter.y + TILE_SIZE / 2;

      console.log(
        `Checking mining area overlap at world coordinates: (${worldX}, ${worldY})`
      );

      // Check for mining area overlap using the MINING_RADIUS constant from MiningStation
      if (
        BuildingManager.wouldMiningAreaOverlap(worldX, worldY, MINING_RADIUS)
      ) {
        console.log(`Mining area overlap detected in isPlacementValid`);
        return false;
      }
    }

    // Check if the building has specific placement requirements
    if (buildingDef.placementRequirements?.onlyOn) {
      // Use TerrainFeature's static methods to check for features at this tile
      const hasRequiredFeature = buildingDef.placementRequirements.onlyOn.some(
        (requiredType) => {
          return TerrainFeature.hasTileFeatureType(tileX, tileY, requiredType);
        }
      );

      if (!hasRequiredFeature) {
        return false;
      }
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

    // Find the building definition
    const buildingDef = BUILDING_DEFINITIONS.find(
      (item) => item.buildingType === this.selectedItem
    );

    if (!buildingDef) return;

    // Get the tile size of the building
    const tileWidth = buildingDef.tileSize?.width || 1;
    const tileHeight = buildingDef.tileSize?.height || 1;

    // We no longer check if player has enough resources or deduct them
    // Resources will be delivered to the blueprint by robots

    // Clean up any mining station preview
    if (this.selectedItem === "mining-station") {
      MiningStation.cleanupPreview();
    }

    // Get the top-left corner of the tile
    const tileTopLeft = this.map.tileToWorldXY(tileX, tileY);
    if (!tileTopLeft) return;

    // For multi-tile buildings, we need to position the sprite so that its center
    // is at the center of the area covered by the building, but the mouse is at the top-left tile
    const offsetX = ((tileWidth - 1) * TILE_SIZE) / 2;
    const offsetY = ((tileHeight - 1) * TILE_SIZE) / 2;

    // Calculate the exact position where the preview is shown
    const exactX = tileTopLeft.x + TILE_SIZE / 2 + offsetX;
    const exactY = tileTopLeft.y + TILE_SIZE / 2 + offsetY;

    // Call the callback to create a blueprint at the exact position of the preview
    // We pass 'blueprint-' + this.selectedItem to indicate this is a blueprint
    this.onItemPlaced("blueprint-" + this.selectedItem, exactX, exactY);

    // Create an array of tiles that this building occupies
    const occupiedTiles = [];
    for (let x = tileX; x < tileX + tileWidth; x++) {
      for (let y = tileY; y < tileY + tileHeight; y++) {
        occupiedTiles.push({ x, y });
      }
    }

    // Add to building manager with a special blueprint flag
    BuildingManager.addBuilding({
      type: this.selectedItem,
      displayName: buildingDef.name,
      position:
        this.selectedItem === "mining-station"
          ? { x: exactX, y: exactY } // Store world coordinates for mining stations
          : { x: tileX, y: tileY }, // Store tile coordinates for other buildings
      placedAt: Date.now(),
      size: { width: tileWidth, height: tileHeight },
      tiles: occupiedTiles,
      placementRequirements: buildingDef.placementRequirements,
      tileWidth: tileWidth,
      tileHeight: tileHeight,
      isBlueprint: true, // Mark as blueprint
    });

    // Clean up placement objects
    this.cleanupPlacementObjects();

    // Reset selection
    this.selectedItem = null;
    this.selectedBuildingDef = null;
  }

  enterBulldozeMode() {
    // Cancel any ongoing placement
    this.cancelPlacement();

    // Set bulldoze mode
    this.bulldozeMode = true;

    // Create bulldoze cursor sprite
    this.bulldozeSprite = this.scene.add.sprite(0, 0, "bulldozer");
    this.bulldozeSprite.setOrigin(0.5);
    this.bulldozeSprite.setAlpha(0.8);
    this.bulldozeSprite.setScale(0.5);
    this.bulldozeSprite.setDepth(100);

    // Add instruction text
    this.instructionText = this.scene.add
      .text(
        this.scene.cameras.main.width / 2,
        50,
        "Click on a building to remove it (ESC to cancel)",
        {
          fontSize: "18px",
          color: "#ff0000",
          backgroundColor: "#00000088",
          padding: { x: 10, y: 5 },
        }
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(100);
  }

  exitBulldozeMode() {
    this.bulldozeMode = false;

    // Clean up bulldoze sprite
    if (this.bulldozeSprite) {
      this.bulldozeSprite.destroy();
      this.bulldozeSprite = null;
    }

    // Clean up instruction text
    if (this.instructionText) {
      this.instructionText.destroy();
      this.instructionText = null;
    }

    // Clean up range preview
    if (this.rangePreview) {
      this.rangePreview.destroy();
      this.rangePreview = null;
    }
  }

  private updateBulldozeMode() {
    const pointer = this.scene.input.activePointer;
    const worldPoint = pointer.positionToCamera(
      this.scene.cameras.main
    ) as Phaser.Math.Vector2;

    // Convert world coordinates to tile coordinates
    const tileXY = this.map.worldToTileXY(worldPoint.x, worldPoint.y);

    // Update bulldoze sprite position
    if (this.bulldozeSprite) {
      this.bulldozeSprite.setPosition(worldPoint.x, worldPoint.y);
    }

    // Check if there's a valid tile position
    if (!tileXY) {
      return;
    }

    const tileX = tileXY.x;
    const tileY = tileXY.y;

    // Check if there's a building at this position
    const building = BuildingManager.getBuildingAt(tileX, tileY);

    // Update bulldoze sprite appearance based on whether there's a building
    if (this.bulldozeSprite) {
      if (building) {
        this.bulldozeSprite.setTint(0xff0000); // Red tint when over a building

        // Create a red tile highlight if it doesn't exist
        if (!this.rangePreview) {
          // Get the building's size
          const width = building.tileWidth || 1;
          const height = building.tileHeight || 1;

          // Get the top-left corner of the building
          let startX = tileX;
          let startY = tileY;

          // If the building has tiles array, find the top-left corner
          if (building.tiles && building.tiles.length > 0) {
            const minX = Math.min(...building.tiles.map((t) => t.x));
            const minY = Math.min(...building.tiles.map((t) => t.y));
            startX = minX;
            startY = minY;
          } else if (building.size) {
            // For legacy buildings with size property
            startX = building.position.x;
            startY = building.position.y;
          }

          // Get the tile at the top-left corner
          const tile = this.map.getTileAt(startX, startY);
          if (tile && tile.pixelX !== undefined && tile.pixelY !== undefined) {
            const worldX = tile.pixelX;
            const worldY = tile.pixelY;

            // Create a rectangle that covers the entire building
            this.rangePreview = this.scene.add.rectangle(
              worldX + (width * TILE_SIZE) / 2,
              worldY + (height * TILE_SIZE) / 2,
              width * TILE_SIZE,
              height * TILE_SIZE,
              0xff0000,
              0.3
            );
            this.rangePreview.setStrokeStyle(2, 0xff0000);
            this.rangePreview.setDepth(10);
          }
        } else {
          // Update the position of the existing highlight
          // Get the building's size
          const width = building.tileWidth || 1;
          const height = building.tileHeight || 1;

          // Get the top-left corner of the building
          let startX = tileX;
          let startY = tileY;

          // If the building has tiles array, find the top-left corner
          if (building.tiles && building.tiles.length > 0) {
            const minX = Math.min(...building.tiles.map((t) => t.x));
            const minY = Math.min(...building.tiles.map((t) => t.y));
            startX = minX;
            startY = minY;
          } else if (building.size) {
            // For legacy buildings with size property
            startX = building.position.x;
            startY = building.position.y;
          }

          const tile = this.map.getTileAt(startX, startY);
          if (tile && tile.pixelX !== undefined && tile.pixelY !== undefined) {
            this.rangePreview.setPosition(
              tile.pixelX + (width * TILE_SIZE) / 2,
              tile.pixelY + (height * TILE_SIZE) / 2
            );
            this.rangePreview.setSize(width * TILE_SIZE, height * TILE_SIZE);
            this.rangePreview.setVisible(true);
          }
        }
      } else {
        this.bulldozeSprite.setTint(0xffffff); // Normal color otherwise
        // Hide the highlight if there's no building
        if (this.rangePreview) {
          this.rangePreview.setVisible(false);
        }
      }
    }

    // Handle click to remove building
    if (pointer.isDown && !this.pointerWasDown) {
      if (building) {
        // Check if this is a habitat
        if (building.type === "habitat" && building.tiles) {
          // For habitats, we just remove the specific tile
          const updatedHabitat = BuildingManager.removeTileFromHabitat(
            tileX,
            tileY
          );

          // If the habitat was updated (not completely removed), we need to update its visual
          if (updatedHabitat) {
            // Emit an event that the scene can listen for to update the habitat visual
            this.scene.events.emit("habitatUpdated", {
              habitatId: updatedHabitat.habitatId,
            });

            // Show success message
            const successText = this.scene.add
              .text(
                this.scene.cameras.main.width / 2,
                100,
                "Habitat tile removed!",
                {
                  fontSize: "24px",
                  color: "#00ff00",
                }
              )
              .setOrigin(0.5)
              .setScrollFactor(0)
              .setDepth(100);

            // Fade out and destroy after 2 seconds
            this.scene.tweens.add({
              targets: successText,
              alpha: 0,
              duration: 1000,
              delay: 1000,
              onComplete: () => {
                successText.destroy();
              },
            });
          }
        } else {
          // For other buildings, remove the entire building
          // Get the building's visual representation from the scene
          const buildingSprites = this.scene.children.getAll().filter((obj) => {
            // Check if it's a sprite or container at the building's position
            if (
              obj instanceof Phaser.GameObjects.Sprite ||
              obj instanceof Phaser.GameObjects.Container
            ) {
              // For buildings with world coordinates
              if (building.type === "mining-station") {
                return (
                  Math.abs(obj.x - building.position.x) < TILE_SIZE / 2 &&
                  Math.abs(obj.y - building.position.y) < TILE_SIZE / 2
                );
              }

              // For buildings with tile coordinates
              const worldX =
                this.map.tileToWorldX(building.position.x)! + TILE_SIZE / 2;
              const worldY =
                this.map.tileToWorldY(building.position.y)! + TILE_SIZE / 2;

              return (
                Math.abs(obj.x - worldX) < TILE_SIZE / 2 &&
                Math.abs(obj.y - worldY) < TILE_SIZE / 2
              );
            }
            return false;
          });

          // Remove all building sprites found
          buildingSprites.forEach((sprite) => {
            sprite.destroy();
          });

          // Remove the building from the manager
          const removedBuilding = BuildingManager.removeBuilding(tileX, tileY);

          if (removedBuilding) {
            // Show success message
            const successText = this.scene.add
              .text(
                this.scene.cameras.main.width / 2,
                100,
                "Building removed!",
                {
                  fontSize: "24px",
                  color: "#00ff00",
                }
              )
              .setOrigin(0.5)
              .setScrollFactor(0)
              .setDepth(100);

            // Fade out and destroy after 2 seconds
            this.scene.tweens.add({
              targets: successText,
              alpha: 0,
              duration: 1000,
              delay: 1000,
              onComplete: () => {
                successText.destroy();
              },
            });
          }
        }
      }
    }

    this.pointerWasDown = pointer.isDown;
  }
}
