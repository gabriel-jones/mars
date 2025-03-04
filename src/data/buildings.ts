// Define building IDs as a string literal union type
export type BuildingType =
  | "solar-panel"
  | "oxygen-generator"
  | "water-extractor"
  | "habitat";

import { ResourceType } from "./resources";

// Define a type-safe structure for building definitions
export interface BuildMenuItem {
  buildingType: BuildingType;
  name: string;
  cost: {
    type: ResourceType;
    amount: number;
  }[];
}

// Define the building definitions
export const BUILDING_DEFINITIONS: BuildMenuItem[] = [
  {
    buildingType: "solar-panel",
    name: "Solar Panel",
    cost: [
      { type: "iron", amount: 20 },
      { type: "water", amount: 5 },
    ],
  },
  {
    buildingType: "oxygen-generator",
    name: "Oxygen Generator",
    cost: [
      { type: "iron", amount: 15 },
      { type: "water", amount: 10 },
    ],
  },
  {
    buildingType: "water-extractor",
    name: "Water Extractor",
    cost: [{ type: "iron", amount: 25 }],
  },
  {
    buildingType: "habitat",
    name: "Habitat",
    cost: [
      { type: "iron", amount: 30 },
      { type: "oxygen", amount: 15 },
      { type: "water", amount: 15 },
    ],
  },
];

// Or as an enum
// export enum BuildingId {
//   SolarPanel = 'solar-panel',
//   OxygenGenerator = 'oxygen-generator',
//   WaterExtractor = 'water-extractor',
//   Habitat = 'habitat'
// }

export interface Building {
  type: BuildingType;
  displayName: string;
  position: {
    x: number;
    y: number;
  };
  placedAt: number; // timestamp
}

// Store for all placed buildings
export class BuildingManager {
  private static buildings: Building[] = [];

  static addBuilding(building: Building): void {
    this.buildings.push(building);
    console.log(
      `Building added: ${building.type} at (${building.position.x}, ${building.position.y})`
    );
  }

  static getBuildings(): Building[] {
    return this.buildings;
  }

  static getBuildingsByType(type: BuildingType): Building[] {
    return this.buildings.filter((building) => building.type === type);
  }

  static getBuildingAt(x: number, y: number): Building | undefined {
    return this.buildings.find(
      (building) => building.position.x === x && building.position.y === y
    );
  }

  static isTileOccupied(x: number, y: number): boolean {
    return this.buildings.some(
      (building) => building.position.x === x && building.position.y === y
    );
  }
}
