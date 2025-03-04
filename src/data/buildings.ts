// Define building IDs as a string literal union type
export type BuildingType =
  | "habitat"
  | "solar-panel"
  | "miner-drone"
  | "ice-drill";

import { ResourceType } from "./resources";
import { ResourceNodeType } from "../entities/resourceNode";

// Define placement types
export enum PlacementType {
  SingleTile, // Default placement on a single tile
  RangeSelect, // Drag to select a range (for habitat)
}

// Define location types
export enum LocationType {
  Outside, // Can only be placed outside (solar panels, etc.)
  Inside, // Can only be placed inside habitats (farms, etc.)
  Both, // Can be placed anywhere
}

// Define a type-safe structure for building definitions
export interface BuildMenuItem {
  buildingType: BuildingType;
  name: string;
  cost: {
    type: ResourceType;
    amount: number;
  }[];
  placementType: PlacementType;
  locationType: LocationType;
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
    placementType: PlacementType.RangeSelect,
    locationType: LocationType.Outside,
  },
  {
    buildingType: "solar-panel",
    name: "Solar Panel",
    cost: [
      { type: "silicon", amount: 50 },
      { type: "aluminium", amount: 15 },
    ],
    placementType: PlacementType.SingleTile,
    locationType: LocationType.Outside,
  },
  {
    buildingType: "miner-drone",
    name: "Miner Drone",
    cost: [{ type: "iron", amount: 50 }],
    placementType: PlacementType.SingleTile,
    locationType: LocationType.Outside,
  },
  {
    buildingType: "ice-drill",
    name: "Ice Drill",
    cost: [
      { type: "iron", amount: 50 },
      { type: "titanium", amount: 10 },
    ],
    placementType: PlacementType.SingleTile,
    locationType: LocationType.Outside,
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
  size?: { width: number; height: number }; // For range-selected buildings like habitats
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
      `Building added: ${building.type} at (${building.position.x}, ${
        building.position.y
      })${
        building.size
          ? ` with size ${building.size.width}x${building.size.height}`
          : ""
      }`
    );
  }

  static getBuildings(): Building[] {
    return this.buildings;
  }

  static getBuildingsByType(type: BuildingType): Building[] {
    return this.buildings.filter((building) => building.type === type);
  }

  static getBuildingAt(x: number, y: number): Building | undefined {
    return this.buildings.find((building) => {
      // For single-tile buildings
      if (!building.size) {
        return building.position.x === x && building.position.y === y;
      }

      // For range-based buildings (like habitats)
      const startX = building.position.x;
      const startY = building.position.y;
      const endX = startX + (building.size.width - 1);
      const endY = startY + (building.size.height - 1);

      return x >= startX && x <= endX && y >= startY && y <= endY;
    });
  }

  static isTileOccupied(x: number, y: number): boolean {
    return this.buildings.some((building) => {
      // For single-tile buildings
      if (!building.size) {
        return building.position.x === x && building.position.y === y;
      }

      // For range-based buildings (like habitats)
      const startX = building.position.x;
      const startY = building.position.y;
      const endX = startX + (building.size.width - 1);
      const endY = startY + (building.size.height - 1);

      return x >= startX && x <= endX && y >= startY && y <= endY;
    });
  }
}
