// Define building IDs as a string literal union type
export type BuildingType =
  | "habitat"
  | "solar-panel"
  | "miner-drone"
  | "ice-drill";

import { ResourceType } from "./resources";
import { ResourceNodeType } from "../entities/resourceNode";

// Define a type-safe structure for building definitions
export interface BuildMenuItem {
  buildingType: BuildingType;
  name: string;
  cost: {
    type: ResourceType;
    amount: number;
  }[];
  placementRequirements?: {
    onlyOn?: ResourceNodeType[];
  };
}

// Define the building definitions
export const BUILDING_DEFINITIONS: BuildMenuItem[] = [
  {
    buildingType: "habitat",
    name: "Habitat",
    cost: [
      { type: "silicon", amount: 100 },
      { type: "iron", amount: 25 },
    ],
  },
  {
    buildingType: "solar-panel",
    name: "Solar Panel",
    cost: [
      { type: "silicon", amount: 50 },
      { type: "aluminium", amount: 15 },
    ],
  },
  {
    buildingType: "miner-drone",
    name: "Miner Drone",
    cost: [{ type: "iron", amount: 50 }],
  },
  {
    buildingType: "ice-drill",
    name: "Ice Drill",
    cost: [
      { type: "iron", amount: 50 },
      { type: "titanium", amount: 10 },
    ],
    placementRequirements: {
      onlyOn: [ResourceNodeType.IceDeposit],
    },
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
  size?: { width: number; height: number };
  placementRequirements?: {
    onlyOn?: ResourceNodeType[];
  };
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
