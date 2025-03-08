import { BuildingManager, BuildingType } from "../data/buildings";
import { ResourceManager } from "../data/resources";
import { SolarPanel } from "../entities/buildings/SolarPanel";
import { gameState } from "../state";

/**
 * Energy consumption rates for different building types (energy units per second)
 */
export const ENERGY_CONSUMPTION_RATES: Partial<Record<BuildingType, number>> = {
  habitat: 4,
  "mining-station": 16,
  "ice-drill": 20,
  "regolith-processor": 32,
  "grow-zone": 8,
  "solar-panel": -8, // Negative value means it produces energy
};

/**
 * EnergyManager handles all energy-related functionality
 * including production, consumption, and management
 */
export class EnergyManager {
  private static lastUpdateTime: number = 0;
  private static energyProduction: number = 0;
  private static energyConsumption: number = 0;
  private static energyBalance: number = 0;
  private static energyUpdateInterval: number = 1000; // Update energy every second

  /**
   * Initialize the energy manager
   */
  static initialize(): void {
    console.log("EnergyManager.initialize() called");

    // Check current energy amount
    const currentEnergy = ResourceManager.getResourceAmount("energy");
    console.log("Current energy amount:", currentEnergy);

    // Verify energy was added
    const newEnergy = ResourceManager.getResourceAmount("energy");
    console.log("New energy amount after initialization:", newEnergy);

    // Log the current inventory
    console.log(
      "Current inventory after initialization:",
      ResourceManager.getInventory()
    );

    // Reset the last update time to the current time
    this.lastUpdateTime = Date.now();

    // Calculate initial energy values
    this.recalculateEnergyValues();
  }

  /**
   * Update energy production and consumption
   * @param time Current game time
   */
  static update(time: number): void {
    // Only update energy at the specified interval
    if (time - this.lastUpdateTime < this.energyUpdateInterval) {
      return;
    }

    // Recalculate energy values
    this.recalculateEnergyValues();

    // Update energy resource
    const energyChangePerSecond = this.energyBalance;
    const energyChange =
      (energyChangePerSecond * this.energyUpdateInterval) / 1000;

    // Log energy update
    console.log(`Updating energy by ${energyChange.toFixed(2)} units`);

    // Get current energy before update
    const beforeEnergy = ResourceManager.getResourceAmount("energy");

    // Add energy (could be negative if consumption > production)
    ResourceManager.addResource("energy", energyChange);

    // Get energy after update
    const afterEnergy = ResourceManager.getResourceAmount("energy");
    console.log(
      `Energy changed from ${beforeEnergy.toFixed(2)} to ${afterEnergy.toFixed(
        2
      )}`
    );

    // Update last update time
    this.lastUpdateTime = time;

    // Log energy status
    console.log(
      `Energy status: Production=${this.energyProduction.toFixed(
        1
      )}, Consumption=${this.energyConsumption.toFixed(
        1
      )}, Balance=${this.energyBalance.toFixed(1)}`
    );
  }

  /**
   * Recalculate energy production, consumption, and balance
   * This should be called whenever buildings are added or removed
   */
  static recalculateEnergyValues(): void {
    // Calculate energy production from solar panels
    this.calculateEnergyProduction();

    // Calculate energy consumption from buildings
    this.calculateEnergyConsumption();

    // Calculate energy balance
    this.energyBalance = this.energyProduction - this.energyConsumption;

    console.log(
      `Energy recalculated: Production=${this.energyProduction.toFixed(
        1
      )}, Consumption=${this.energyConsumption.toFixed(
        1
      )}, Balance=${this.energyBalance.toFixed(1)}`
    );
  }

  /**
   * Calculate energy production from all sources
   */
  private static calculateEnergyProduction(): void {
    let totalProduction = 0;

    // Get all solar panels
    const solarPanels = BuildingManager.getBuildingsByType("solar-panel");

    // Sum up energy production from all solar panels
    for (const building of solarPanels) {
      // Calculate based on size
      const width = building.tileWidth || 1;
      const height = building.tileHeight || 1;
      const panelProduction = width * height * 10; // 10 energy per tile
      totalProduction += panelProduction;
    }

    this.energyProduction = totalProduction;
  }

  /**
   * Calculate energy consumption from all buildings
   */
  private static calculateEnergyConsumption(): void {
    let totalConsumption = 0;

    // Get all buildings
    const buildings = BuildingManager.getBuildings();

    // Sum up energy consumption from all buildings
    for (const building of buildings) {
      // Skip solar panels as they produce energy
      if (building.type === "solar-panel") continue;

      // Get consumption rate for this building type
      const consumptionRate = ENERGY_CONSUMPTION_RATES[building.type] || 0;

      // For buildings with variable size, scale consumption by size
      if (building.tileWidth && building.tileHeight) {
        totalConsumption +=
          consumptionRate * building.tileWidth * building.tileHeight;
      } else {
        totalConsumption += consumptionRate;
      }
    }

    this.energyConsumption = totalConsumption;
  }

  /**
   * Get current energy production rate
   */
  static getEnergyProduction(): number {
    return this.energyProduction;
  }

  /**
   * Get current energy consumption rate
   */
  static getEnergyConsumption(): number {
    return this.energyConsumption;
  }

  /**
   * Get current energy balance (production - consumption)
   */
  static getEnergyBalance(): number {
    return this.energyBalance;
  }

  /**
   * Check if there is enough energy for a specific operation
   * @param amount Amount of energy needed
   */
  static hasEnoughEnergy(amount: number): boolean {
    return ResourceManager.getResourceAmount("energy") >= amount;
  }

  /**
   * Use energy for a specific operation
   * @param amount Amount of energy to use
   */
  static useEnergy(amount: number): boolean {
    return ResourceManager.useResource("energy", amount);
  }
}
