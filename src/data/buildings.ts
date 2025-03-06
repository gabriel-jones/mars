// Define building IDs as a string literal union type
export type BuildingType =
  | "habitat"
  | "solar-panel"
  | "mining-station"
  | "ice-drill"
  | "regolith-processor";

import { ResourceType } from "./resources";
import { TerrainFeatureType } from "../entities/TerrainFeature";
import { gameState } from "../state";
import { TILE_SIZE } from "../constants";

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
  tileSize?: {
    width: number;
    height: number;
  };
  placementType: PlacementType;
  locationType: LocationType;
  placementRequirements?: {
    onlyOn?: TerrainFeatureType[];
  };
  buildEffort?: number; // Time in ms needed to build this building
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
    buildEffort: 10000, // 10 seconds to build
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
    buildEffort: 5000, // 5 seconds to build
  },
  {
    buildingType: "mining-station",
    name: "Mining Station",
    cost: [{ type: "iron", amount: 50 }],
    placementType: PlacementType.SingleTile,
    locationType: LocationType.Outside,
    buildEffort: 8000, // 8 seconds to build
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
      onlyOn: [TerrainFeatureType.IceDeposit],
    },
    buildEffort: 12000, // 12 seconds to build
  },
  {
    buildingType: "regolith-processor",
    name: "Regolith Processor",
    cost: [
      { type: "iron", amount: 75 },
      { type: "silicon", amount: 30 },
    ],
    tileSize: {
      width: 2,
      height: 2,
    },
    placementType: PlacementType.SingleTile,
    locationType: LocationType.Outside,
    buildEffort: 15000, // 15 seconds to build
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
    onlyOn?: TerrainFeatureType[];
  };
  habitatId?: string;
  tiles?: { x: number; y: number }[];
  tileWidth?: number; // Width in tiles
  tileHeight?: number; // Height in tiles
  isBlueprint?: boolean; // Whether this is a blueprint or a completed building
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

    // Update gameState.buildings to keep it in sync
    gameState.buildings = this.buildings;

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

  // Check if a mining area would overlap with existing mining stations
  static wouldMiningAreaOverlap(x: number, y: number, radius: number): boolean {
    // Get all mining stations
    const miningStations = this.buildings.filter(
      (building) => building.type === "mining-station"
    );

    // If there are no mining stations, there can't be any overlap
    if (miningStations.length === 0) {
      return false;
    }

    // Calculate the size of a mining area in tiles
    const miningAreaSizeInTiles = radius * 2 + 1;
    // Convert to world coordinates (pixels)
    const miningAreaSize = miningAreaSizeInTiles * TILE_SIZE;

    // Calculate the bounds of the new mining area
    const newMiningAreaLeft = x - miningAreaSize / 2;
    const newMiningAreaTop = y - miningAreaSize / 2;
    const newMiningAreaRight = newMiningAreaLeft + miningAreaSize;
    const newMiningAreaBottom = newMiningAreaTop + miningAreaSize;

    console.log(
      `New mining area bounds: (${newMiningAreaLeft}, ${newMiningAreaTop}) to (${newMiningAreaRight}, ${newMiningAreaBottom})`
    );

    // Check if the new mining area overlaps with any existing mining station's area
    return miningStations.some((station) => {
      // Convert tile coordinates to world coordinates if needed
      let stationX = station.position.x;
      let stationY = station.position.y;

      // If the position is in tile coordinates, convert to world coordinates
      if (stationX < 100 && stationY < 100) {
        // Likely tile coordinates
        stationX = stationX * TILE_SIZE + TILE_SIZE / 2;
        stationY = stationY * TILE_SIZE + TILE_SIZE / 2;
      }

      // Calculate the bounds of the existing mining station's area
      const existingMiningAreaLeft = stationX - miningAreaSize / 2;
      const existingMiningAreaTop = stationY - miningAreaSize / 2;
      const existingMiningAreaRight = existingMiningAreaLeft + miningAreaSize;
      const existingMiningAreaBottom = existingMiningAreaTop + miningAreaSize;

      console.log(
        `Existing mining area at (${stationX}, ${stationY}) bounds: (${existingMiningAreaLeft}, ${existingMiningAreaTop}) to (${existingMiningAreaRight}, ${existingMiningAreaBottom})`
      );

      // Check for rectangle overlap
      // For adjacent placement, we need to check if the rectangles are strictly overlapping
      // This allows mining areas to be placed right next to each other (sharing an edge)
      const overlaps =
        newMiningAreaLeft < existingMiningAreaRight &&
        newMiningAreaRight > existingMiningAreaLeft &&
        newMiningAreaTop < existingMiningAreaBottom &&
        newMiningAreaBottom > existingMiningAreaTop;

      if (overlaps) {
        console.log(`Mining area overlap detected!`);
      }

      return overlaps;
    });
  }

  static removeBuilding(x: number, y: number): Building | undefined {
    // Find the building at the given position
    const building = this.getBuildingAt(x, y);

    if (!building) {
      return undefined;
    }

    // Remove the building from the array
    const index = this.buildings.findIndex((b) => b === building);
    if (index !== -1) {
      this.buildings.splice(index, 1);

      // Update gameState.buildings to keep it in sync
      gameState.buildings = this.buildings;

      console.log(
        `Building removed: ${building.type} at (${building.position.x}, ${building.position.y})`
      );

      return building;
    }

    return undefined;
  }
}
