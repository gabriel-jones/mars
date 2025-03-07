import Phaser from "phaser";
import { Blueprint } from "../entities/buildings/Blueprint";
import { Building } from "../entities/buildings/Building";
import { BuildingType } from "../data/buildings";
import { HealthBarRenderer } from "../interfaces/Health";

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

    // Create a blueprint for the building
    const buildingType = itemName as BuildingType;
    const blueprint = new Blueprint(this.scene, x, y, buildingType);

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

    // Create a new building
    const building = new Building(
      this.scene,
      blueprint.x,
      blueprint.y,
      buildingType
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
