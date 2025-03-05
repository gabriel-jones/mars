import Phaser from "phaser";
import { BuildingType } from "../../data/buildings";
import { Building } from "./Building";
import { MiningStation } from "./MiningStation";
import { Habitat } from "./Habitat";
import { SolarPanel } from "./SolarPanel";
import { IceDrill } from "./IceDrill";
import { RegolithProcessor } from "./RegolithProcessor";

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
    switch (buildingType) {
      case "mining-station":
        return new MiningStation(scene, x, y);

      case "habitat":
        const habitatId = options.habitatId || `habitat-${Date.now()}`;
        const width = options.width || 2;
        const height = options.height || 2;
        return new Habitat(scene, x, y, width, height, habitatId);

      case "solar-panel":
        const panelWidth = options.width || 1;
        const panelHeight = options.height || 1;
        return new SolarPanel(scene, x, y, panelWidth, panelHeight);

      case "ice-drill":
        return new IceDrill(scene, x, y);

      case "regolith-processor":
        return new RegolithProcessor(scene, x, y);

      default:
        // Create a generic building if no specific type is matched
        return new Building(scene, x, y, buildingType);
    }
  }
}
