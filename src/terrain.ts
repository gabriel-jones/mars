import Phaser from "phaser";
import { TILE_SIZE } from "./constants";
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

// Create a mars terrain tileset programmatically
export function createMarsTileset(scene: Phaser.Scene): void {
  // Create a texture atlas for our mars tiles
  const graphics = scene.make.graphics({ x: 0, y: 0 });

  // Define a color palette for different richness levels
  const colorPalette = {
    // Base colors - darker for higher richness
    baseLow: 0xc97c5e, // Muted terracotta (standard color)
    baseMedium: 0xc17456, // Slightly darker base for medium richness
    baseHigh: 0xb06a4c, // Darker terracotta for high richness, less orange more brown
    // Dust colors
    low: 0xb66c50, // Lighter color for dust specks in low-richness areas
    medium: 0xd88c6e, // Medium richness
    high: 0xe67e5d, // High richness
    veryHigh: 0xf56e42, // Very high richness (more orange/red)
  };

  // Create 15 different dust pattern tiles with varying resource richness
  // 0-4: Low richness
  // 5-9: Medium richness
  // 10-14: High richness
  for (let tileIndex = 0; tileIndex < 15; tileIndex++) {
    // Position in the tileset
    const tileX = (tileIndex % 5) * TILE_SIZE;
    const tileY = Math.floor(tileIndex / 5) * TILE_SIZE;

    // Determine richness level, base color, dust color, and speck multiplier
    let baseColor, dustColor, speckMultiplier;

    if (tileIndex < 5) {
      // Low richness
      baseColor = colorPalette.baseLow;
      dustColor = colorPalette.low;
      speckMultiplier = 1;
    } else if (tileIndex < 10) {
      // Medium richness
      baseColor = colorPalette.baseMedium;
      dustColor = colorPalette.medium;
      speckMultiplier = 1.5;
    } else {
      // High richness
      baseColor = colorPalette.baseHigh;
      dustColor = colorPalette.high;
      speckMultiplier = 2;
    }

    // Create a unique dust pattern for each tile
    createRandomDustyMarsTile(
      graphics,
      tileX,
      tileY,
      baseColor,
      dustColor,
      speckMultiplier
    );
  }

  // Generate a texture from the graphics object (5x3 tiles)
  graphics.generateTexture("marsTileset", TILE_SIZE * 5, TILE_SIZE * 3);
  graphics.destroy();
}

// Helper function to create a Mars tile with random dust specks
function createRandomDustyMarsTile(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  baseColor: number,
  dustColor: number,
  speckMultiplier: number = 1
): void {
  // Fill with base color
  graphics.fillStyle(baseColor);
  graphics.fillRect(x, y, TILE_SIZE, TILE_SIZE);

  // Add subtle darker patches for higher richness areas
  if (speckMultiplier > 1) {
    // Add darker patches to indicate resource concentration
    const darkerColor = Phaser.Display.Color.ValueToColor(baseColor).darken(
      10 * (speckMultiplier - 1)
    ).color;

    graphics.fillStyle(darkerColor);

    // Number of patches increases with richness
    const numPatches = Math.floor(speckMultiplier * 2);

    for (let i = 0; i < numPatches; i++) {
      const patchX = Phaser.Math.Between(4, TILE_SIZE - 12) + x;
      const patchY = Phaser.Math.Between(4, TILE_SIZE - 12) + y;
      const patchSize = Phaser.Math.Between(6, 12);
      const alpha = Phaser.Math.FloatBetween(0.2, 0.4);

      graphics.setAlpha(alpha);
      graphics.fillRect(patchX, patchY, patchSize, patchSize);
    }
  }

  // Add random dust specks as larger pixels
  graphics.fillStyle(dustColor);

  // Random number of dust specks for this tile pattern
  const numSpecks = Phaser.Math.Between(5, 15) * speckMultiplier; // More specks for rich areas

  // Dust specks with varying opacity
  for (let i = 0; i < numSpecks; i++) {
    const pixelX = Phaser.Math.Between(0, TILE_SIZE - 6) + x;
    const pixelY = Phaser.Math.Between(0, TILE_SIZE - 6) + y;
    const pixelSize = Phaser.Math.Between(3, 5); // Increased pixel size
    const alpha = Phaser.Math.FloatBetween(0.15, 0.35); // Increased opacity

    graphics.setAlpha(alpha);
    // Draw larger pixels
    graphics.fillRect(pixelX, pixelY, pixelSize, pixelSize);
  }

  // Random number of clusters for this tile pattern
  const numClusters = Phaser.Math.Between(0, 3) * speckMultiplier; // More clusters for rich areas

  // Add clusters of larger pixels for subtle variation
  for (let i = 0; i < numClusters; i++) {
    const centerX = Phaser.Math.Between(8, TILE_SIZE - 12) + x;
    const centerY = Phaser.Math.Between(8, TILE_SIZE - 12) + y;
    const alpha = Phaser.Math.FloatBetween(0.2, 0.3); // Increased opacity

    graphics.setAlpha(alpha);

    // Create a cluster of larger pixels
    const clusterSize = Phaser.Math.Between(2, 4);
    for (let j = 0; j < clusterSize; j++) {
      const offsetX = Phaser.Math.Between(-3, 3);
      const offsetY = Phaser.Math.Between(-3, 3);
      const pixelSize = Phaser.Math.Between(4, 6); // Increased cluster pixel size
      graphics.fillRect(
        centerX + offsetX,
        centerY + offsetY,
        pixelSize,
        pixelSize
      );
    }
  }

  // For higher richness areas (speckMultiplier > 1), add special visual elements
  if (speckMultiplier > 1) {
    // Add veins or streaks for resource-rich areas
    const numVeins = Math.floor(speckMultiplier * 2); // 3 veins for medium, 4 for high richness

    for (let i = 0; i < numVeins; i++) {
      const startX = Phaser.Math.Between(5, TILE_SIZE - 5) + x;
      const startY = Phaser.Math.Between(5, TILE_SIZE - 5) + y;
      const length = Phaser.Math.Between(5, 10);
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const veinWidth = Phaser.Math.FloatBetween(1, 2);

      // Higher alpha for more visible veins
      const alpha = Phaser.Math.FloatBetween(0.3, 0.5);
      graphics.setAlpha(alpha);

      // Draw the vein
      graphics.lineStyle(veinWidth, dustColor);
      graphics.beginPath();
      graphics.moveTo(startX, startY);
      graphics.lineTo(
        startX + Math.cos(angle) * length,
        startY + Math.sin(angle) * length
      );
      graphics.strokePath();
    }

    // For very rich areas (speckMultiplier >= 2), add small glints
    // if (speckMultiplier >= 2) {
    //   // Add a subtle color overlay to indicate very rich areas
    //   graphics.fillStyle(0xf56e42); // Orange-red color
    //   graphics.setAlpha(0.1); // Very subtle
    //   graphics.fillRect(x, y, TILE_SIZE, TILE_SIZE);

    //   // Add more prominent glints
    //   const numGlints = Phaser.Math.Between(3, 6); // Increased number of glints

    //   for (let i = 0; i < numGlints; i++) {
    //     const glintX = Phaser.Math.Between(5, TILE_SIZE - 5) + x;
    //     const glintY = Phaser.Math.Between(5, TILE_SIZE - 5) + y;
    //     const glintSize = Phaser.Math.Between(1, 3); // Slightly larger glints

    //     // Bright glint
    //     graphics.setAlpha(0.8); // More visible
    //     graphics.fillStyle(0xffffff); // White glint
    //     graphics.fillRect(glintX, glintY, glintSize, glintSize);

    //     // Add a subtle glow effect around some glints
    //     if (i % 2 === 0) {
    //       // Only for some glints
    //       graphics.setAlpha(0.3);
    //       graphics.fillStyle(0xffcc00); // Yellow-orange glow
    //       graphics.fillRect(
    //         glintX - 1,
    //         glintY - 1,
    //         glintSize + 2,
    //         glintSize + 2
    //       );
    //     }
    //   }
    // }
  }

  // Reset alpha
  graphics.setAlpha(1);
}

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

    if (debug) {
      console.log(
        `Resource richness at (${x}, ${y}) [tile ${tileX}, ${tileY}]: ${richness.toFixed(
          2
        )}`
      );

      // Describe the richness level
      if (richness > RESOURCE_RICHNESS.HIGH) {
        console.log("Very high richness area (orange/red terrain)");
      } else if (richness > RESOURCE_RICHNESS.MEDIUM) {
        console.log("High richness area (medium orange terrain)");
      } else {
        console.log("Low richness area (standard terrain)");
      }
    }

    return richness;
  }

  // Return default value if out of bounds
  return 0.5;
}

// Create and fill the terrain map
export function createTerrain(scene: Phaser.Scene) {
  // Create a tilemap
  const map = scene.make.tilemap({
    width: 100,
    height: 100,
    tileWidth: TILE_SIZE,
    tileHeight: TILE_SIZE,
  });

  // Add the tileset - this is a tileset with 15 different frames
  const tileset = map.addTilesetImage(
    "marsTileset",
    "marsTileset",
    TILE_SIZE,
    TILE_SIZE,
    0,
    0,
    0
  )!;

  // Create the ground layer with our tileset
  const groundLayer = map.createBlankLayer("ground", tileset)!;

  // Generate resource richness map
  resourceRichnessMap = generateResourceRichnessMap(
    map.width,
    map.height,
    scene
  );

  // Fill the map with tiles based on resource richness
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const richness = resourceRichnessMap[y][x];

      // Determine tile index based on richness
      let tileIndex;

      if (richness > RESOURCE_RICHNESS.HIGH) {
        // Very high richness - use tiles 10-14
        tileIndex = 10 + Phaser.Math.Between(0, 4);
      } else if (richness > RESOURCE_RICHNESS.MEDIUM) {
        // High richness - use tiles 5-9
        tileIndex = 5 + Phaser.Math.Between(0, 4);
      } else {
        // Low richness - use tiles 0-4
        tileIndex = Phaser.Math.Between(0, 4);
      }

      groundLayer.putTileAt(tileIndex, x, y);
    }
  }

  return { map, groundLayer };
}
