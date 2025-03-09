import Phaser from "phaser";
import {
  BuildingType,
  BUILDING_DEFINITIONS,
  PlacementType,
} from "../../data/buildings";
import { Building } from "./Building";
import { MiningStation } from "./MiningStation";
import { Habitat } from "./Habitat";
import { IceDrill } from "./IceDrill";
import { RegolithProcessor } from "./RegolithProcessor";
import { LandingPad } from "./LandingPad";
import { GrowZone } from "./GrowZone";
import { Blueprint } from "./Blueprint";
import { TILE_SIZE } from "../../constants";
import { SolarPanel } from "./SolarPanel";
import { InventoryZone } from "./InventoryZone";
import { Turret } from "./Turret";

export class BuildingFactory {
  /**
   * Creates a building based on its type
   * @param scene The Phaser scene
   * @param x X position
   * @param y Y position
   * @param buildingType The type of building to create
   * @param options Additional options for the building
   * @returns The created building
   */
  public static createBuilding(
    scene: Phaser.Scene,
    x: number,
    y: number,
    buildingType: BuildingType,
    options: any = {}
  ): Building {
    // Get the building definition to access tileSize and hasInventory
    const buildingDef = BUILDING_DEFINITIONS.find(
      (def) => def.buildingType === buildingType
    );

    // Default tile size is 1x1
    const tileWidth = buildingDef?.tileSize?.width || 1;
    const tileHeight = buildingDef?.tileSize?.height || 1;

    // Default hasInventory is false
    const hasInventory = buildingDef?.hasInventory || false;

    switch (buildingType) {
      case "mining-station":
        return new MiningStation(scene, x, y);

      case "habitat":
        const habitatId = options.habitatId || `habitat-${Date.now()}`;
        const width = options.width || tileWidth;
        const height = options.height || tileHeight;
        console.log(`Creating Habitat with dimensions: ${width}x${height}`);
        return new Habitat(scene, x, y, width, height, habitatId);

      case "ice-drill":
        return new IceDrill(scene, x, y, tileWidth, tileHeight);

      case "regolith-processor":
        return new RegolithProcessor(scene, x, y, tileWidth, tileHeight);

      case "landing-pad":
        return new LandingPad(scene, x, y, tileWidth, tileHeight);

      case "grow-zone":
        const growZoneWidth = options.width || tileWidth;
        const growZoneHeight = options.height || tileHeight;
        console.log(
          `Creating GrowZone with dimensions: ${growZoneWidth}x${growZoneHeight}`
        );

        // Create a new GrowZone with the specified dimensions
        const growZone = new GrowZone(
          scene,
          x,
          y,
          growZoneWidth,
          growZoneHeight
        );

        // Log the created GrowZone
        console.log(
          `Created GrowZone with ${growZone.getTiles().length} tiles`
        );

        return growZone;

      case "solar-panel":
        const panelWidth = options.width || tileWidth;
        const panelHeight = options.height || tileHeight;
        console.log(
          `Creating SolarPanel with dimensions: ${panelWidth}x${panelHeight}`
        );

        // Create a new SolarPanel instance
        // We need to use dynamic import to avoid circular dependencies
        try {
          // Try to use the SolarPanel class if it's available
          const SolarPanel = (window as any).SolarPanelClass;
          if (SolarPanel) {
            console.log(
              `Using SolarPanelClass with dimensions: ${panelWidth}x${panelHeight}`
            );
            return new SolarPanel(scene, x, y, panelWidth, panelHeight);
          }
        } catch (error) {
          console.error("Failed to create SolarPanel:", error);
        }

        // Fallback to a generic building
        console.log(
          `Falling back to generic building for SolarPanel with dimensions: ${panelWidth}x${panelHeight}`
        );
        return new Building(
          scene,
          x,
          y,
          "solar-panel",
          panelWidth,
          panelHeight,
          hasInventory
        );

      case "turret":
        return new Turret(scene, x, y, tileWidth, tileHeight);

      case "inventory-zone":
        const inventoryWidth = options.width || tileWidth;
        const inventoryHeight = options.height || tileHeight;
        console.log(
          `Creating InventoryZone with dimensions: ${inventoryWidth}x${inventoryHeight}`
        );

        // Create a new InventoryZone with the specified dimensions
        const inventoryZone = new InventoryZone(
          scene,
          x,
          y,
          inventoryWidth,
          inventoryHeight
        );

        console.log(
          `Created InventoryZone at (${x}, ${y}) with dimensions ${inventoryWidth}x${inventoryHeight}`
        );

        return inventoryZone;

      default:
        // Create a generic building with the appropriate tile size and hasInventory
        return new Building(
          scene,
          x,
          y,
          buildingType,
          tileWidth,
          tileHeight,
          hasInventory
        );
    }
  }

  /**
   * Creates a blueprint for a building
   * @param scene The Phaser scene
   * @param x X position
   * @param y Y position
   * @param buildingType The type of building to create a blueprint for
   * @param options Additional options for the blueprint
   * @returns The created blueprint
   */
  public static createBlueprint(
    scene: Phaser.Scene,
    x: number,
    y: number,
    buildingType: BuildingType,
    options: any = {}
  ): Blueprint {
    // Get the building definition to access tileSize
    const buildingDef = BUILDING_DEFINITIONS.find(
      (def) => def.buildingType === buildingType
    );

    // Default tile size is 1x1
    const tileWidth = options.width || buildingDef?.tileSize?.width || 1;
    const tileHeight = options.height || buildingDef?.tileSize?.height || 1;

    if (buildingDef?.placementType === PlacementType.RangeSelect) {
      console.log(
        `Creating ${buildingType} blueprint with dimensions: ${tileWidth}x${tileHeight}`
      );
    }

    // Create a blueprint with the appropriate tile size and options
    const blueprint = new Blueprint(
      scene,
      x,
      y,
      buildingType,
      tileWidth,
      tileHeight,
      options
    );

    // For range selection buildings, we need to create a tiled preview
    if (buildingDef?.placementType === PlacementType.RangeSelect) {
      // Hide the default sprite
      blueprint.getSprite().setVisible(false);

      // Calculate the tile grid position of the building center
      const tileGridX = Math.floor(x / TILE_SIZE);
      const tileGridY = Math.floor(y / TILE_SIZE);

      // Calculate the top-left corner of the building in world coordinates
      // For range select buildings, we want to align with the top-left corner
      // instead of centering the building on the cursor position
      const alignedTopLeftX = tileGridX * TILE_SIZE;
      const alignedTopLeftY = tileGridY * TILE_SIZE;

      // Position the container at the top-left corner relative to the center of the building
      const containerX = alignedTopLeftX - x;
      const containerY = alignedTopLeftY - y;

      // Create a container for the tiled preview
      const tilesContainer = scene.add.container(containerX, containerY);
      blueprint.add(tilesContainer);

      // Create a tile for each position in the building
      for (let row = 0; row < tileHeight; row++) {
        for (let col = 0; col < tileWidth; col++) {
          // Position each tile at its center point within the tile cell
          const tileX = col * TILE_SIZE + TILE_SIZE / 2;
          const tileY = row * TILE_SIZE + TILE_SIZE / 2;

          // Create a visual representation for this tile
          if (buildingType === "solar-panel") {
            // For solar panels, use the solar-panel texture instead of rectangles
            const tileSprite = scene.add.sprite(tileX, tileY, "solar-panel");
            tileSprite.setDisplaySize(TILE_SIZE, TILE_SIZE);
            tileSprite.setAlpha(0.7);
            tileSprite.setTint(0x0088ff); // Blue tint for blueprint
            tilesContainer.add(tileSprite);
          } else {
            // For other buildings, use sprites
            const tileSprite = scene.add.sprite(tileX, tileY, buildingType);
            tileSprite.setDisplaySize(TILE_SIZE, TILE_SIZE);
            tileSprite.setAlpha(0.7);
            tileSprite.setTint(0x0088ff); // Blue tint for blueprint
            tilesContainer.add(tileSprite);
          }
        }
      }

      // Add a border around the entire building
      const graphics = scene.add.graphics();
      graphics.lineStyle(2, 0x0088ff, 0.7);
      graphics.strokeRect(
        0, // Start at 0,0 relative to the container
        0,
        tileWidth * TILE_SIZE,
        tileHeight * TILE_SIZE
      );
      blueprint.add(graphics);

      // Add tile grid lines
      const gridGraphics = scene.add.graphics();
      gridGraphics.lineStyle(1, 0x0088ff, 0.5);

      // Draw vertical grid lines
      for (let col = 0; col <= tileWidth; col++) {
        const x = col * TILE_SIZE;
        gridGraphics.lineBetween(x, 0, x, tileHeight * TILE_SIZE);
      }

      // Draw horizontal grid lines
      for (let row = 0; row <= tileHeight; row++) {
        const y = row * TILE_SIZE;
        gridGraphics.lineBetween(0, y, tileWidth * TILE_SIZE, y);
      }

      blueprint.add(gridGraphics);

      // Move the building name label to the top of the building
      // instead of being centered
      const label = blueprint.getLabel();
      if (label) {
        label.setPosition((tileWidth * TILE_SIZE) / 2, -10);
      }
    }

    return blueprint;
  }
}
