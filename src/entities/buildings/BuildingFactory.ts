import Phaser from "phaser";
import { BuildingType, BUILDING_DEFINITIONS } from "../../data/buildings";
import { Building } from "./Building";
import { MiningStation } from "./MiningStation";
import { Habitat } from "./Habitat";
import { SolarPanel } from "./SolarPanel";
import { IceDrill } from "./IceDrill";
import { RegolithProcessor } from "./RegolithProcessor";
import { Blueprint } from "./Blueprint";

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
    // Get the building definition to access tileSize
    const buildingDef = BUILDING_DEFINITIONS.find(
      (def) => def.buildingType === buildingType
    );

    // Default tile size is 1x1
    const tileWidth = buildingDef?.tileSize?.width || 1;
    const tileHeight = buildingDef?.tileSize?.height || 1;

    switch (buildingType) {
      case "mining-station":
        return new MiningStation(scene, x, y);

      case "habitat":
        const habitatId = options.habitatId || `habitat-${Date.now()}`;
        const width = options.width || tileWidth;
        const height = options.height || tileHeight;
        return new Habitat(scene, x, y, width, height, habitatId);

      case "solar-panel":
        const panelWidth = options.width || tileWidth;
        const panelHeight = options.height || tileHeight;
        return new SolarPanel(scene, x, y, panelWidth, panelHeight);

      case "ice-drill":
        return new IceDrill(scene, x, y, tileWidth, tileHeight);

      case "regolith-processor":
        return new RegolithProcessor(scene, x, y, tileWidth, tileHeight);

      default:
        // Create a generic building with the appropriate tile size
        return new Building(scene, x, y, buildingType, tileWidth, tileHeight);
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
    const tileWidth = buildingDef?.tileSize?.width || 1;
    const tileHeight = buildingDef?.tileSize?.height || 1;

    // Create a blueprint with the appropriate tile size
    return new Blueprint(scene, x, y, buildingType, tileWidth, tileHeight);
  }
}
