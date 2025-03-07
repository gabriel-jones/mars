// Define building IDs as a string literal union type
export type BuildingType =
  | "habitat"
  | "solar-panel"
  | "mining-station"
  | "ice-drill"
  | "regolith-processor"
  | "landing-pad"
  | "grow-zone"
  | "inventory-zone";

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
  hasInventory?: boolean; // Whether this building type can have inventory
}

// Define the building definitions
export const BUILDING_DEFINITIONS: BuildMenuItem[] = [
  {
    buildingType: "habitat",
    name: "Habitat",
    cost: [
      { type: "silicon", amount: 4 },
      { type: "iron", amount: 4 },
    ],
    placementType: PlacementType.RangeSelect,
    locationType: LocationType.Outside,
    buildEffort: 10000, // 10 seconds to build
    hasInventory: true, // Habitats can store resources
  },
  {
    buildingType: "solar-panel",
    name: "Solar Panel",
    cost: [
      { type: "silicon", amount: 8 },
      { type: "aluminium", amount: 4 },
    ],
    placementType: PlacementType.RangeSelect,
    locationType: LocationType.Outside,
    buildEffort: 5000, // 5 seconds to build
    hasInventory: false,
  },
  {
    buildingType: "mining-station",
    name: "Mining Station",
    cost: [{ type: "iron", amount: 64 }],
    placementType: PlacementType.SingleTile,
    locationType: LocationType.Outside,
    buildEffort: 8000, // 8 seconds to build
    hasInventory: true, // Mining stations can store resources
  },
  {
    buildingType: "ice-drill",
    name: "Ice Drill",
    cost: [
      { type: "iron", amount: 64 },
      { type: "titanium", amount: 4 },
    ],
    placementType: PlacementType.SingleTile,
    locationType: LocationType.Outside,
    placementRequirements: {
      onlyOn: [TerrainFeatureType.IceDeposit],
    },
    buildEffort: 12000, // 12 seconds to build
    hasInventory: true, // Ice drills can store resources
  },
  {
    buildingType: "regolith-processor",
    name: "Regolith Processor",
    cost: [
      { type: "iron", amount: 64 },
      { type: "silicon", amount: 32 },
    ],
    tileSize: {
      width: 2,
      height: 2,
    },
    placementType: PlacementType.SingleTile,
    locationType: LocationType.Outside,
    buildEffort: 15000, // 15 seconds to build
    hasInventory: true, // Regolith processors can store resources
  },
  {
    buildingType: "landing-pad",
    name: "Landing Pad",
    cost: [
      { type: "silicon", amount: 256 },
      { type: "iron", amount: 256 },
      { type: "aluminium", amount: 64 },
      { type: "magnesium", amount: 64 },
      { type: "titanium", amount: 32 },
    ],
    tileSize: {
      width: 4,
      height: 4,
    },
    placementType: PlacementType.SingleTile,
    locationType: LocationType.Outside,
    buildEffort: 20000, // 20 seconds to build
    hasInventory: true, // Landing pads can store resources (via starship)
  },
  {
    buildingType: "grow-zone",
    name: "Grow Zone",
    cost: [{ type: "iron", amount: 8 }],
    placementType: PlacementType.RangeSelect,
    locationType: LocationType.Both, // Can be placed anywhere
    buildEffort: 1000, // 1 seconds to build
    hasInventory: true, // Grow zones can store resources (seeds and harvested crops)
  },
  {
    buildingType: "inventory-zone",
    name: "Inventory Zone",
    cost: [{ type: "silicon", amount: 4 }],
    placementType: PlacementType.RangeSelect,
    locationType: LocationType.Both, // Can be placed anywhere
    buildEffort: 5000, // 5 seconds to build
    hasInventory: true, // Inventory zones are specifically for storing resources
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
  inventory?: { [key in ResourceType]?: number }; // Optional inventory for buildings
  hasInventory?: boolean; // Flag to indicate if this building type can have inventory
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

    // Check if this expansion connects with any other habitats
    // If so, merge them
    this.checkAndMergeHabitats(habitat);

    console.log(
      `Habitat ${habitatId} expanded with ${newTiles.length} new tiles. Total: ${habitat.tiles.length} tiles`
    );
    return true;
  }

  /**
   * Checks if a habitat overlaps with any other habitats and merges them if needed
   * @param habitat The habitat to check for merges
   */
  static checkAndMergeHabitats(habitat: Building): void {
    if (!habitat || habitat.type !== "habitat" || !habitat.tiles) {
      return;
    }

    // Create a set of all tile positions in this habitat for quick lookup
    const habitatTileSet = new Set(habitat.tiles.map((t) => `${t.x},${t.y}`));

    // Find all other habitats that might be adjacent to this one
    const adjacentHabitats = this.buildings.filter(
      (b) =>
        b !== habitat &&
        b.type === "habitat" &&
        b.tiles &&
        b.habitatId !== habitat.habitatId
    );

    // Track habitats that need to be merged
    const habitatsToMerge: Building[] = [];

    // Check each habitat for adjacency
    for (const otherHabitat of adjacentHabitats) {
      // Check if any tile in the other habitat is adjacent to any tile in this habitat
      const isAdjacent = otherHabitat.tiles!.some((otherTile) => {
        // Check if this tile is adjacent to any tile in our habitat
        return habitat.tiles!.some(
          (tile) =>
            // Check all 4 adjacent positions
            (Math.abs(tile.x - otherTile.x) === 1 && tile.y === otherTile.y) ||
            (Math.abs(tile.y - otherTile.y) === 1 && tile.x === otherTile.x)
        );
      });

      if (isAdjacent) {
        habitatsToMerge.push(otherHabitat);
      }
    }

    // If we found habitats to merge
    if (habitatsToMerge.length > 0) {
      console.log(
        `Merging ${habitatsToMerge.length} habitats with ${habitat.habitatId}`
      );

      // Merge all the habitats into this one
      for (const otherHabitat of habitatsToMerge) {
        // Add all tiles from the other habitat to this one
        habitat.tiles.push(...otherHabitat.tiles!);

        // Remove the other habitat from the buildings array
        const index = this.buildings.findIndex((b) => b === otherHabitat);
        if (index !== -1) {
          this.buildings.splice(index, 1);
        }

        // Emit an event that can be caught by the scene to update visuals
        if (typeof window !== "undefined") {
          const event = new CustomEvent("habitatMerged", {
            detail: {
              primaryHabitatId: habitat.habitatId,
              mergedHabitatId: otherHabitat.habitatId,
            },
          });
          window.dispatchEvent(event);
        }
      }

      // Remove duplicate tiles
      habitat.tiles = Array.from(
        new Map(
          habitat.tiles.map((tile) => [`${tile.x},${tile.y}`, tile])
        ).values()
      );

      // Update gameState.buildings to keep it in sync
      gameState.buildings = this.buildings;
    }
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

  /**
   * Removes a tile from a habitat
   * @param x The x coordinate of the tile to remove
   * @param y The y coordinate of the tile to remove
   * @returns The updated habitat or undefined if no habitat was found
   */
  static removeTileFromHabitat(x: number, y: number): Building | undefined {
    // Find the habitat that contains this tile
    const habitat = this.buildings.find(
      (building) =>
        building.type === "habitat" &&
        building.tiles &&
        building.tiles.some((tile) => tile.x === x && tile.y === y)
    );

    if (!habitat || !habitat.tiles) {
      return undefined;
    }

    // Remove the tile from the habitat
    habitat.tiles = habitat.tiles.filter(
      (tile) => !(tile.x === x && tile.y === y)
    );

    // If the habitat is now empty, remove it entirely
    if (habitat.tiles.length === 0) {
      this.removeBuilding(habitat.position.x, habitat.position.y);
      return undefined;
    }

    // Check if removing this tile has split the habitat into disconnected parts
    const connectedGroups = this.findConnectedTileGroups(habitat.tiles);

    if (connectedGroups.length > 1) {
      // The habitat has been split into multiple disconnected parts
      console.log(
        `Habitat ${habitat.habitatId} split into ${connectedGroups.length} parts`
      );

      // Keep the first group in the original habitat
      habitat.tiles = connectedGroups[0];

      // Create new habitats for the other groups
      for (let i = 1; i < connectedGroups.length; i++) {
        const newHabitatTiles = connectedGroups[i];

        // Calculate the position for the new habitat (center of the tiles)
        const avgX = Math.floor(
          newHabitatTiles.reduce((sum, tile) => sum + tile.x, 0) /
            newHabitatTiles.length
        );
        const avgY = Math.floor(
          newHabitatTiles.reduce((sum, tile) => sum + tile.y, 0) /
            newHabitatTiles.length
        );

        // Create a new habitat
        const newHabitat: Building = {
          type: "habitat",
          displayName: "Habitat",
          position: {
            x: avgX,
            y: avgY,
          },
          placedAt: Date.now(),
          habitatId: `habitat-${this.nextHabitatId++}`,
          tiles: newHabitatTiles,
        };

        // Add the new habitat
        this.addBuilding(newHabitat);

        // Emit an event that can be caught by the scene to update visuals
        if (typeof window !== "undefined") {
          const event = new CustomEvent("habitatSplit", {
            detail: {
              originalHabitatId: habitat.habitatId,
              newHabitatId: newHabitat.habitatId,
            },
          });
          window.dispatchEvent(event);
        }
      }
    }

    // Update gameState.buildings to keep it in sync
    gameState.buildings = this.buildings;

    return habitat;
  }

  /**
   * Finds groups of connected tiles in a habitat
   * @param tiles The tiles to check
   * @returns An array of connected tile groups
   */
  private static findConnectedTileGroups(
    tiles: { x: number; y: number }[]
  ): { x: number; y: number }[][] {
    if (!tiles || tiles.length === 0) {
      return [];
    }

    // Create a set of all tile positions for quick lookup
    const tileSet = new Set(tiles.map((t) => `${t.x},${t.y}`));

    // Create a set to track visited tiles
    const visited = new Set<string>();

    // Array to hold all connected groups
    const groups: { x: number; y: number }[][] = [];

    // For each tile, if not visited, start a new connected group
    for (const tile of tiles) {
      const tileKey = `${tile.x},${tile.y}`;

      if (!visited.has(tileKey)) {
        // Start a new group with this tile
        const group: { x: number; y: number }[] = [];

        // Use a queue for breadth-first search
        const queue: { x: number; y: number }[] = [tile];

        while (queue.length > 0) {
          const currentTile = queue.shift()!;
          const currentKey = `${currentTile.x},${currentTile.y}`;

          // Skip if already visited
          if (visited.has(currentKey)) {
            continue;
          }

          // Mark as visited and add to current group
          visited.add(currentKey);
          group.push(currentTile);

          // Check all 4 adjacent tiles
          const adjacentPositions = [
            { x: currentTile.x + 1, y: currentTile.y },
            { x: currentTile.x - 1, y: currentTile.y },
            { x: currentTile.x, y: currentTile.y + 1 },
            { x: currentTile.x, y: currentTile.y - 1 },
          ];

          for (const pos of adjacentPositions) {
            const posKey = `${pos.x},${pos.y}`;

            // If this adjacent position is in our tile set and not visited, add to queue
            if (tileSet.has(posKey) && !visited.has(posKey)) {
              queue.push(pos);
            }
          }
        }

        // Add this connected group to our groups array
        groups.push(group);
      }
    }

    return groups;
  }
}
