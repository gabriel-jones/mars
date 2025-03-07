import Phaser from "phaser";
import { Building } from "../entities/buildings/Building";

/**
 * HabitatManager handles all habitat-related functionality
 * including placement, expansion, merging, and splitting
 */
export class HabitatManager {
  private scene: Phaser.Scene;
  private buildings: Building[] = [];

  constructor(scene: Phaser.Scene, buildings: Building[]) {
    this.scene = scene;
    this.buildings = buildings;
  }

  /**
   * Register all habitat-related event listeners
   */
  public registerEventListeners(): void {
    // Register Phaser event listeners
    this.scene.events.on("habitatPlaced", this.onHabitatPlaced, this);
    this.scene.events.on("habitatExpanded", this.onHabitatExpanded, this);
    this.scene.events.on("habitatUpdated", this.onHabitatUpdated, this);
    this.scene.events.on(
      "habitatExpansionPlaced",
      this.onHabitatExpansionPlaced,
      this
    );

    // Register window event listeners
    if (typeof window !== "undefined") {
      window.addEventListener("habitatMerged", this.handleHabitatMergedEvent);
      window.addEventListener("habitatSplit", this.handleHabitatSplitEvent);
    }
  }

  /**
   * Unregister all habitat-related event listeners
   */
  public unregisterEventListeners(): void {
    // Unregister Phaser event listeners
    this.scene.events.off("habitatPlaced", this.onHabitatPlaced, this);
    this.scene.events.off("habitatExpanded", this.onHabitatExpanded, this);
    this.scene.events.off("habitatUpdated", this.onHabitatUpdated, this);
    this.scene.events.off(
      "habitatExpansionPlaced",
      this.onHabitatExpansionPlaced,
      this
    );

    // Unregister window event listeners
    if (typeof window !== "undefined") {
      window.removeEventListener(
        "habitatMerged",
        this.handleHabitatMergedEvent
      );
      window.removeEventListener("habitatSplit", this.handleHabitatSplitEvent);
    }
  }

  // Event handler functions for window events
  private handleHabitatMergedEvent = (e: any): void => {
    this.onHabitatMerged(e.detail);
  };

  private handleHabitatSplitEvent = (e: any): void => {
    this.onHabitatSplit(e.detail);
  };

  /**
   * Handles the habitatPlaced event
   */
  public onHabitatPlaced(data: {
    startX: number;
    startY: number;
    width: number;
    height: number;
  }): void {
    console.log("Habitat placed event received", data);

    // Logic for handling habitat placement
    // This would be moved from MainScene
  }

  /**
   * Handles the habitatExpanded event
   */
  public onHabitatExpanded(data: {
    habitatId: string;
    newTiles: { x: number; y: number }[];
  }): void {
    console.log("Habitat expanded event received", data);

    // Find the habitat instance
    const habitatInstance = this.buildings.find(
      (b) =>
        b instanceof Building &&
        (b as any).getHabitatId &&
        (b as any).getHabitatId() === data.habitatId
    );

    if (!habitatInstance) {
      console.error(`Could not find habitat with ID ${data.habitatId}`);
      return;
    }

    // Update the tiles on the habitat instance
    if ((habitatInstance as any).addTiles) {
      (habitatInstance as any).addTiles(data.newTiles);
    }
  }

  /**
   * Handles the habitatUpdated event
   */
  public onHabitatUpdated(data: { habitatId: string }): void {
    console.log("Habitat updated event received", data);

    // Find the habitat instance
    const habitatInstance = this.buildings.find(
      (b) =>
        b instanceof Building &&
        (b as any).getHabitatId &&
        (b as any).getHabitatId() === data.habitatId
    );

    if (!habitatInstance) {
      console.error(`Could not find habitat with ID ${data.habitatId}`);
      return;
    }

    // Update the habitat instance
    if ((habitatInstance as any).updateHabitat) {
      (habitatInstance as any).updateHabitat();
    }
  }

  /**
   * Handles the habitatMerged event
   */
  public onHabitatMerged(data: {
    primaryHabitatId: string;
    mergedHabitatId: string;
  }): void {
    console.log("Habitat merged event received", data);

    // Find the primary habitat instance
    const primaryHabitatInstance = this.buildings.find(
      (b) =>
        b instanceof Building &&
        (b as any).getHabitatId &&
        (b as any).getHabitatId() === data.primaryHabitatId
    );

    // Find the merged habitat instance
    const mergedHabitatInstance = this.buildings.find(
      (b) =>
        b instanceof Building &&
        (b as any).getHabitatId &&
        (b as any).getHabitatId() === data.mergedHabitatId
    );

    if (!primaryHabitatInstance) {
      console.error(
        `Could not find primary habitat with ID ${data.primaryHabitatId}`
      );
      return;
    }

    if (!mergedHabitatInstance) {
      console.error(
        `Could not find merged habitat with ID ${data.mergedHabitatId}`
      );
      return;
    }

    // Get the tiles from the merged habitat
    const mergedHabitatData = (mergedHabitatInstance as any).getHabitatData
      ? (mergedHabitatInstance as any).getHabitatData()
      : null;

    if (!mergedHabitatData) {
      console.error(
        `Could not find merged habitat data with ID ${data.mergedHabitatId}`
      );
      return;
    }

    // Get the tiles from the primary habitat
    const primaryHabitatData = (primaryHabitatInstance as any).getHabitatData
      ? (primaryHabitatInstance as any).getHabitatData()
      : null;

    if (!primaryHabitatData) {
      console.error(
        `Could not find primary habitat data with ID ${data.primaryHabitatId}`
      );
      return;
    }

    // Update the tiles on the primary habitat instance
    if (primaryHabitatInstance instanceof Building) {
      (primaryHabitatInstance as any).setTiles(primaryHabitatData.tiles);
    }

    // Remove the merged habitat instance from our buildings array
    const index = this.buildings.indexOf(mergedHabitatInstance);
    if (index !== -1) {
      this.buildings.splice(index, 1);
    }

    // Destroy the merged habitat instance
    mergedHabitatInstance.destroy();

    // Update the buildings reference
    this.updateBuildings(this.buildings);
  }

  /**
   * Handles the habitatSplit event
   */
  public onHabitatSplit(data: {
    originalHabitatId: string;
    newHabitatId: string;
  }): void {
    console.log("Habitat split event received", data);

    // Find the original habitat instance
    const originalHabitatInstance = this.buildings.find(
      (b) =>
        b instanceof Building &&
        (b as any).getHabitatId &&
        (b as any).getHabitatId() === data.originalHabitatId
    );

    if (!originalHabitatInstance) {
      console.error(
        `Could not find original habitat with ID ${data.originalHabitatId}`
      );
      return;
    }

    // Update the original habitat instance
    if ((originalHabitatInstance as any).updateHabitat) {
      (originalHabitatInstance as any).updateHabitat();
    }

    // The new habitat should be created by the habitat system
    // and added to the buildings array automatically
  }

  /**
   * Handles the habitatExpansionPlaced event
   */
  public onHabitatExpansionPlaced(data: {
    startX: number;
    startY: number;
    width: number;
    height: number;
    expansionId: string;
    targetHabitatId: string;
    tiles: { x: number; y: number }[];
  }): void {
    console.log("Habitat expansion placed event received", data);

    // Find the target habitat instance
    const targetHabitatInstance = this.buildings.find(
      (b) =>
        b instanceof Building &&
        (b as any).getHabitatId &&
        (b as any).getHabitatId() === data.targetHabitatId
    );

    if (!targetHabitatInstance) {
      console.error(
        `Could not find target habitat with ID ${data.targetHabitatId}`
      );
      return;
    }

    // Update the target habitat instance
    if ((targetHabitatInstance as any).addExpansion) {
      (targetHabitatInstance as any).addExpansion(
        data.expansionId,
        data.tiles,
        data.startX,
        data.startY,
        data.width,
        data.height
      );
    }
  }

  /**
   * Updates the buildings reference
   */
  public updateBuildings(buildings: Building[]): void {
    this.buildings = buildings;
  }
}
