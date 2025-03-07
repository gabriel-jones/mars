import Phaser from "phaser";
import { MAP_HEIGHT, MAP_WIDTH, TILE_SIZE } from "./constants";
import PerlinNoise from "phaser3-rex-plugins/plugins/perlin.js";

// Resource richness map
let resourceRichnessMap: number[][] = [];
// Perlin noise instance
let perlinNoise: PerlinNoise;

const RESOURCE_RICHNESS = {
  LOW: 0.0, // 0.0 - 0.6
  MEDIUM: 0.5, // 0.6 - 0.8
  HIGH: 0.7, // 0.8 - 1.0
} as const;

// Generate a resource richness map using Perlin noise
function generateResourceRichnessMap(
  width: number,
  height: number,
  scene: Phaser.Scene
): number[][] {
  const map: number[][] = [];

  // Create Perlin noise instance if it doesn't exist
  if (!perlinNoise) {
    perlinNoise = new PerlinNoise();
    // Random seed for the noise
    const seed = Math.floor(Math.random() * 1000);
    perlinNoise.setSeed(seed);
  }

  // Scale for the noise (smaller = larger features)
  const scaleX = 0.05;
  const scaleY = 0.05;

  // Random offset to make the pattern different each time
  const offsetX = Math.random() * 1000;
  const offsetY = Math.random() * 1000;

  for (let y = 0; y < height; y++) {
    map[y] = [];
    for (let x = 0; x < width; x++) {
      // Use Perlin noise to generate a value between -1 and 1
      const nx = (x + offsetX) * scaleX;
      const ny = (y + offsetY) * scaleY;

      // Get noise value and normalize to 0-1 range
      const noise = perlinNoise.perlin2(nx, ny);
      map[y][x] = (noise + 1) / 2;
    }
  }

  // Smooth the map to create more natural-looking regions
  return smoothMap(map, 1);
}

// Helper function to smooth the resource map
function smoothMap(map: number[][], passes: number): number[][] {
  const height = map.length;
  const width = map[0].length;

  // Create a copy of the map to work with
  let result = map.map((row) => [...row]);

  for (let pass = 0; pass < passes; pass++) {
    const tempMap = result.map((row) => [...row]);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let count = 0;

        // Average with neighboring cells
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;

            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              sum += tempMap[ny][nx];
              count++;
            }
          }
        }

        // Update the cell with the average
        result[y][x] = sum / count;
      }
    }
  }

  return result;
}

// Get resource richness at a specific world position
export function getResourceRichnessAt(
  x: number,
  y: number,
  debug: boolean = false
): number {
  // Convert world coordinates to tile coordinates
  const tileX = Math.floor(x / TILE_SIZE);
  const tileY = Math.floor(y / TILE_SIZE);

  // Check if coordinates are within the map
  if (
    resourceRichnessMap &&
    tileY >= 0 &&
    tileY < resourceRichnessMap.length &&
    tileX >= 0 &&
    resourceRichnessMap[tileY] &&
    tileX < resourceRichnessMap[tileY].length
  ) {
    const richness = resourceRichnessMap[tileY][tileX];
    return richness;
  }

  // Return default value if out of bounds
  return 0.5;
}

// Get noise value at a specific tile position
function getNoiseValueAtTile(tileX: number, tileY: number): number {
  // Create Perlin noise instance if it doesn't exist
  if (!perlinNoise) {
    perlinNoise = new PerlinNoise();
    // Random seed for the noise
    const seed = Math.floor(Math.random() * 1000);
    perlinNoise.setSeed(seed);
  }

  // Scale for the noise (smaller = larger features)
  const scaleX = 0.05;
  const scaleY = 0.05;

  // Random offset to make the pattern different each time
  const offsetX = Math.random() * 1000;
  const offsetY = Math.random() * 1000;

  // Use Perlin noise to generate a value between -1 and 1
  const nx = (tileX + offsetX) * scaleX;
  const ny = (tileY + offsetY) * scaleY;

  // Return the raw noise value (-1 to 1)
  return perlinNoise.perlin2(nx, ny);
}

// Get the resource richness at a specific tile position
export function getResourceRichnessAtTile(
  tileX: number,
  tileY: number
): number {
  // Use the noise value at this position to determine resource richness
  const noiseValue = getNoiseValueAtTile(tileX, tileY);

  // Scale the noise value to a resource richness between 0 and 1
  return Math.max(0, Math.min(1, (noiseValue + 1) / 2));
}

// Create and fill the terrain map
export function createTerrain(scene: Phaser.Scene) {
  // Create a simple tilemap for collision and game logic
  const map = scene.make.tilemap({
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    tileWidth: TILE_SIZE,
    tileHeight: TILE_SIZE,
  });

  // Create a tileset using the terrain-low texture
  const tileset = map.addTilesetImage("terrain-low", "terrain-low");
  if (!tileset) {
    throw new Error("Failed to create tileset");
  }

  // Create a blank ground layer
  const groundLayer = map.createBlankLayer("ground", tileset);
  if (!groundLayer) {
    throw new Error("Failed to create ground layer");
  }

  // Fill the ground layer with tiles for collision
  groundLayer.fill(0);

  // Make the ground layer invisible since we'll use sprites for visuals
  groundLayer.setVisible(false);

  // Generate resource richness map
  resourceRichnessMap = generateResourceRichnessMap(
    map.width,
    map.height,
    scene
  );

  // Create terrain sprites based on resource richness
  const terrainContainer = scene.add.container(0, 0);
  terrainContainer.setDepth(-10);

  // Draw the terrain based on our resource richness map
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const worldX = x * TILE_SIZE;
      const worldY = y * TILE_SIZE;

      // Get resource richness value
      const richness = resourceRichnessMap[y][x];

      // Determine which texture to use based on richness
      let textureName;

      if (richness > RESOURCE_RICHNESS.HIGH) {
        textureName = "terrain-high";
      } else if (richness > RESOURCE_RICHNESS.MEDIUM) {
        textureName = "terrain-medium";
      } else {
        textureName = "terrain-low";
      }

      // Create a sprite for this tile
      const sprite = scene.add
        .sprite(worldX + TILE_SIZE / 2, worldY + TILE_SIZE / 2, textureName)
        .setDisplaySize(TILE_SIZE, TILE_SIZE);

      // Add the sprite to the container
      terrainContainer.add(sprite);
    }
  }

  return { map, groundLayer };
}
