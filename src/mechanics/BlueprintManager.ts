import Phaser from "phaser";
import { Blueprint } from "../entities/buildings/Blueprint";
import { Building } from "../entities/buildings/Building";
import {
  BuildingType,
  BUILDING_DEFINITIONS,
  BuildingManager,
  Building as BuildingData,
} from "../data/buildings";
import { HealthBarRenderer } from "../interfaces/Health";
import { BuildingFactory } from "../entities/buildings/BuildingFactory";
import { TILE_SIZE } from "../constants";

/**
 * BlueprintManager handles all blueprint-related functionality
 * including placement, cancellation, and completion
 */
export class BlueprintManager {
  private scene: Phaser.Scene;
  private blueprints: Blueprint[] = [];
  private buildings: Building[] = [];
  private healthBarRenderer: HealthBarRenderer;

  constructor(
    scene: Phaser.Scene,
    blueprints: Blueprint[],
    buildings: Building[],
    healthBarRenderer: HealthBarRenderer
  ) {
    this.scene = scene;
    this.blueprints = blueprints;
    this.buildings = buildings;
    this.healthBarRenderer = healthBarRenderer;
  }

  /**
   * Handles item placement
   */
  public handleItemPlaced(itemName: string, x: number, y: number): void {
    console.log(`Item placed: ${itemName} at (${x}, ${y})`);

    // Check if this is a blueprint placement
    if (itemName.startsWith("blueprint-")) {
      // Extract the actual building type from the itemName
      const buildingType = itemName.replace("blueprint-", "") as BuildingType;

      // Get the building definition to access tileSize
      const buildingDef = BUILDING_DEFINITIONS.find(
        (def) => def.buildingType === buildingType
      );

      // Get the building data from the BuildingManager
      const buildingData = BuildingManager.getBuildings().find(
        (b: BuildingData) =>
          b.isBlueprint &&
          b.type === buildingType &&
          Math.abs(b.position.x * TILE_SIZE + TILE_SIZE / 2 - x) < 10 &&
          Math.abs(b.position.y * TILE_SIZE + TILE_SIZE / 2 - y) < 10
      );

      // Prepare options for the blueprint
      const options: any = {};

      // Set tile size from building definition or building data
      if (buildingDef?.tileSize) {
        options.width = buildingDef.tileSize.width;
        options.height = buildingDef.tileSize.height;
      } else if (buildingData?.size) {
        options.width = buildingData.size.width;
        options.height = buildingData.size.height;
      }

      // If this is a habitat, pass the habitat-specific data
      if (buildingType === "habitat" && buildingData) {
        options.habitatId = buildingData.habitatId;
        options.targetHabitatId = (buildingData as any).targetHabitatId;
        options.tiles = buildingData.tiles;

        console.log("Creating habitat blueprint with options:", options);
      }

      console.log(
        `Creating blueprint for ${buildingType} with options:`,
        options
      );

      // Use the BuildingFactory to create a blueprint
      const blueprint = BuildingFactory.createBlueprint(
        this.scene,
        x,
        y,
        buildingType,
        options
      );

      // Add health bar to the blueprint
      const healthBar = this.healthBarRenderer.createHealthBar(
        blueprint as any,
        -30
      );
      blueprint.setHealthBar(healthBar);

      // Add the blueprint to the blueprints array
      this.blueprints.push(blueprint);

      // Add the blueprint to the scene
      this.scene.add.existing(blueprint);
    } else {
      // Handle direct building placement (not a blueprint)
      const buildingType = itemName as BuildingType;

      // Get the building definition to access tileSize
      const buildingDef = BUILDING_DEFINITIONS.find(
        (def) => def.buildingType === buildingType
      );

      // Prepare options for the building
      const options: any = {};

      // Set tile size from building definition
      if (buildingDef?.tileSize) {
        options.width = buildingDef.tileSize.width;
        options.height = buildingDef.tileSize.height;
      }

      // Create the building
      const building = BuildingFactory.createBuilding(
        this.scene,
        x,
        y,
        buildingType,
        options
      );

      // Add health bar to the building
      const healthBar = this.healthBarRenderer.createHealthBar(
        building as any,
        -30
      );
      building.setHealthBar(healthBar);

      // Add the building to the buildings array
      this.buildings.push(building);

      // Add the building to the scene
      this.scene.add.existing(building);
    }
  }

  /**
   * Handles blueprint cancellation
   */
  public handleBlueprintCanceled(blueprint: Blueprint): void {
    console.log("Blueprint canceled");

    // Remove the blueprint from the blueprints array
    const index = this.blueprints.indexOf(blueprint);
    if (index !== -1) {
      this.blueprints.splice(index, 1);
    }

    // Destroy the blueprint
    blueprint.destroy();
  }

  /**
   * Updates blueprints
   */
  public updateBlueprints(time: number, delta: number): void {
    // Update all blueprints
    for (let i = this.blueprints.length - 1; i >= 0; i--) {
      const blueprint = this.blueprints[i];

      // Update the blueprint
      blueprint.update(time, delta);

      // Check if the blueprint is complete
      if ((blueprint as any).isComplete && (blueprint as any).isComplete()) {
        // Log the blueprint dimensions
        const dimensions = blueprint.getTileDimensions();
        console.log(
          `Blueprint completed: ${blueprint.buildingType} with dimensions: ${dimensions.width}x${dimensions.height}`
        );

        // Remove the blueprint from the blueprints array
        this.blueprints.splice(i, 1);

        // Create a building from the blueprint
        this.createBuildingFromBlueprint(blueprint);

        // Destroy the blueprint
        blueprint.destroy();
      }
    }
  }

  /**
   * Creates a building from a blueprint
   */
  private createBuildingFromBlueprint(blueprint: Blueprint): void {
    // Get the building type from the blueprint
    const buildingType = blueprint.buildingType;

    // Get the building definition to access tileSize
    const buildingDef = BUILDING_DEFINITIONS.find(
      (def) => def.buildingType === buildingType
    );

    // Prepare options for the building
    const options: any = {};

    // Set tile size from the blueprint
    const dimensions = blueprint.getTileDimensions();
    options.width = dimensions.width;
    options.height = dimensions.height;

    // If this is a habitat, pass the habitat-specific data
    if (buildingType === "habitat") {
      // Get the habitat ID from the blueprint
      const habitatId = (blueprint as any).habitatId;
      if (habitatId) {
        options.habitatId = habitatId;
      }

      // Get the habitat tiles from the blueprint
      const habitatTiles = (blueprint as any).habitatTiles;
      if (habitatTiles) {
        options.tiles = habitatTiles;
      }
    }

    console.log(
      `Creating building from blueprint for ${buildingType} with dimensions: ${options.width}x${options.height}`
    );

    // Use the BuildingFactory to create the appropriate building type
    const building = BuildingFactory.createBuilding(
      this.scene,
      blueprint.x,
      blueprint.y,
      buildingType,
      options
    );

    // Add health bar to the building
    const healthBar = this.healthBarRenderer.createHealthBar(
      building as any,
      -30
    );
    building.setHealthBar(healthBar);

    // Add the building to the buildings array
    this.buildings.push(building);

    // Add the building to the scene
    this.scene.add.existing(building);
  }

  /**
   * Updates the references to blueprints and buildings
   */
  public updateReferences(
    blueprints: Blueprint[],
    buildings: Building[]
  ): void {
    this.blueprints = blueprints;
    this.buildings = buildings;
  }
}
