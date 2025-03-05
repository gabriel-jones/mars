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
    placementType: PlacementType.RangeSelect,
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
  habitatId?: string;
  tiles?: { x: number; y: number }[];
}

// Store for all placed buildings
export class BuildingManager {
  private static buildings: Building[] = [];
  private static nextHabitatId: number = 1;

  static addBuilding(building: Building): void {
    // Generate a unique ID for habitats
    if (building.type === "habitat" && !building.habitatId) {
      building.habitatId = `habitat-${this.nextHabitatId++}`;
    }

    this.buildings.push(building);
    console.log(
      `Building added: ${building.type} at (${building.position.x}, ${
        building.position.y
      })${
        building.size
          ? ` with size ${building.size.width}x${building.size.height}`
          : ""
      }${building.tiles ? ` with ${building.tiles.length} tiles` : ""}`
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
      // For habitats with tiles array
      if (building.tiles) {
        return building.tiles.some((tile) => tile.x === x && tile.y === y);
      }

      // For single-tile buildings
      if (!building.size) {
        return building.position.x === x && building.position.y === y;
      }

      // For range-based buildings (legacy support)
      const startX = building.position.x;
      const startY = building.position.y;
      const endX = startX + (building.size.width - 1);
      const endY = startY + (building.size.height - 1);

      return x >= startX && x <= endX && y >= startY && y <= endY;
    });
  }

  static isTileOccupied(x: number, y: number): boolean {
    return this.buildings.some((building) => {
      // For habitats with tiles array
      if (building.tiles) {
        return building.tiles.some((tile) => tile.x === x && tile.y === y);
      }

      // For single-tile buildings
      if (!building.size) {
        return building.position.x === x && building.position.y === y;
      }

      // For range-based buildings (legacy support)
      const startX = building.position.x;
      const startY = building.position.y;
      const endX = startX + (building.size.width - 1);
      const endY = startY + (building.size.height - 1);

      return x >= startX && x <= endX && y >= startY && y <= endY;
    });
  }

  static getAdjacentHabitat(x: number, y: number): Building | undefined {
    // Check if any habitat is adjacent to the given tile
    return this.buildings.find((building) => {
      if (building.type !== "habitat" || !building.tiles) {
        return false;
      }

      // Check if any tile in the habitat is adjacent to the given tile
      return building.tiles.some(
        (tile) =>
          // Check all 4 adjacent tiles
          (Math.abs(tile.x - x) === 1 && tile.y === y) ||
          (Math.abs(tile.y - y) === 1 && tile.x === x)
      );
    });
  }

  static expandHabitat(
    habitatId: string,
    newTiles: { x: number; y: number }[]
  ): boolean {
    const habitat = this.buildings.find(
      (building) =>
        building.type === "habitat" && building.habitatId === habitatId
    );

    if (!habitat || !habitat.tiles) {
      return false;
    }

    // Add new tiles to the habitat
    habitat.tiles.push(...newTiles);

    console.log(
      `Habitat ${habitatId} expanded with ${newTiles.length} new tiles. Total: ${habitat.tiles.length} tiles`
    );
    return true;
  }
}
