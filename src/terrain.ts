import Phaser from "phaser";
import { TILE_SIZE } from "./config";

// Create a mars terrain tileset programmatically
export function createMarsTileset(scene: Phaser.Scene): void {
  // Create a texture atlas for our mars tiles
  const graphics = scene.make.graphics({ x: 0, y: 0 });

  // Use a more muted, background-friendly Mars color palette
  const baseColor = 0xc97c5e; // Muted terracotta (main color)
  const lightColor = 0xd48c6e; // Slightly lighter terracotta
  const mediumColor = 0xb86c50; // Slightly darker terracotta
  const darkColor = 0xa65c40; // Darker terracotta for accents

  // Create base Mars tile (index 0)
  createBaseTile(graphics, 0, 0, baseColor, mediumColor);

  // Create darker variation (index 1)
  createBaseTile(graphics, TILE_SIZE, 0, mediumColor, darkColor);

  // Create lighter variation (index 2)
  createBaseTile(graphics, TILE_SIZE * 2, 0, lightColor, baseColor);

  // Create subtle rocky variation (index 3)
  createSubtleRockyTile(graphics, 0, TILE_SIZE, baseColor, darkColor);

  // Create gentle crater variation (index 4)
  createGentleCraterTile(
    graphics,
    TILE_SIZE,
    TILE_SIZE,
    baseColor,
    mediumColor
  );

  // Create subtle dune variation (index 5)
  createSubtleDuneTile(
    graphics,
    TILE_SIZE * 2,
    TILE_SIZE,
    baseColor,
    lightColor
  );

  // Generate a texture from the graphics object
  graphics.generateTexture("marsTileset", TILE_SIZE * 3, TILE_SIZE * 2);
  graphics.destroy();
}

// Helper function to create a basic Mars tile with subtle texture
function createBaseTile(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  baseColor: number,
  accentColor: number
): void {
  // Fill with base color
  graphics.fillStyle(baseColor);
  graphics.fillRect(x, y, TILE_SIZE, TILE_SIZE);

  // Add very subtle noise texture
  graphics.fillStyle(accentColor);
  graphics.setAlpha(0.1); // Reduced from 0.15 for even subtler texture

  // Create a more organic pattern with small dots
  for (let i = 0; i < 25; i++) {
    const speckleX = Phaser.Math.Between(0, TILE_SIZE) + x;
    const speckleY = Phaser.Math.Between(0, TILE_SIZE) + y;
    const size = Phaser.Math.Between(1, 2);
    graphics.fillCircle(speckleX, speckleY, size);
  }

  // Add a few slightly larger areas for texture variation
  graphics.setAlpha(0.15);
  for (let i = 0; i < 3; i++) {
    const dustX = Phaser.Math.Between(5, TILE_SIZE - 5) + x;
    const dustY = Phaser.Math.Between(5, TILE_SIZE - 5) + y;
    const size = Phaser.Math.Between(8, 15);
    graphics.fillCircle(dustX, dustY, size);
  }

  graphics.setAlpha(1.0);
}

// Create a subtle rocky tile with small, low-contrast rocks
function createSubtleRockyTile(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  baseColor: number,
  rockColor: number
): void {
  // Create base tile first
  createBaseTile(graphics, x, y, baseColor, baseColor);

  // Add subtle rocks
  graphics.fillStyle(rockColor);
  graphics.setAlpha(0.2); // Reduced from 0.25 for subtler rocks

  // Create a cluster pattern rather than evenly distributed rocks
  const clusterX = x + Phaser.Math.Between(TILE_SIZE / 4, (TILE_SIZE * 3) / 4);
  const clusterY = y + Phaser.Math.Between(TILE_SIZE / 4, (TILE_SIZE * 3) / 4);

  for (let i = 0; i < 5; i++) {
    // Cluster the rocks together
    const distance = Phaser.Math.Between(5, 15);
    const angle = Phaser.Math.Between(0, 360) * (Math.PI / 180);

    const rockX = clusterX + Math.cos(angle) * distance;
    const rockY = clusterY + Math.sin(angle) * distance;
    const size = Phaser.Math.Between(2, 5);

    graphics.fillCircle(rockX, rockY, size);
  }

  graphics.setAlpha(1.0);
}

// Create a gentle crater tile that blends better with surroundings
function createGentleCraterTile(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  baseColor: number,
  craterColor: number
): void {
  // Create base tile first
  createBaseTile(graphics, x, y, baseColor, baseColor);

  // Add a subtle crater
  const craterX = x + TILE_SIZE / 2;
  const craterY = y + TILE_SIZE / 2;
  const outerRadius = Phaser.Math.Between(TILE_SIZE / 5, TILE_SIZE / 3);

  // Create a gradient-like effect for the crater
  for (let r = outerRadius; r > 0; r -= 2) {
    const alpha = 0.1 + (outerRadius - r) * 0.01;
    graphics.fillStyle(craterColor);
    graphics.setAlpha(alpha);
    graphics.fillCircle(craterX, craterY, r);
  }

  graphics.setAlpha(1.0);
}

// Create a subtle dune tile with gentle transitions
function createSubtleDuneTile(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  baseColor: number,
  duneColor: number
): void {
  // Create base tile first
  createBaseTile(graphics, x, y, baseColor, baseColor);

  // Add subtle dune patterns
  graphics.fillStyle(duneColor);
  graphics.setAlpha(0.2);

  // Create organic, curved dune patterns
  for (let i = 0; i < TILE_SIZE; i += 3) {
    // Use a smoother sine wave with varying amplitude
    const waveHeight = Math.sin(i * 0.1) * 3 + Math.sin(i * 0.05) * 5 + 5;
    const startY = y + TILE_SIZE - waveHeight - Math.random() * 5;

    // Use circles instead of rectangles for a softer look
    for (let j = 0; j < waveHeight; j += 2) {
      const alpha = 0.2 - (j / waveHeight) * 0.15;
      graphics.setAlpha(alpha);
      graphics.fillCircle(x + i, startY + j, 2);
    }
  }

  graphics.setAlpha(1.0);
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

  // Add the tileset - this is a single tileset with multiple frames
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

  // Generate a noise map for more natural-looking terrain
  const noise = generateNoiseMap(map.width, map.height, 3); // Increased smoothing passes

  // Fill the map with tiles based on noise values
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const noiseValue = noise[y][x];

      // Use noise value to determine tile type with more gradual transitions
      if (noiseValue < 0.3) {
        groundLayer.putTileAt(0, x, y); // Base tile (most common)
      } else if (noiseValue < 0.5) {
        groundLayer.putTileAt(2, x, y); // Light tile
      } else if (noiseValue < 0.7) {
        groundLayer.putTileAt(1, x, y); // Medium tile
      } else if (noiseValue < 0.8) {
        groundLayer.putTileAt(5, x, y); // Dune tile
      } else if (noiseValue < 0.9) {
        groundLayer.putTileAt(3, x, y); // Rocky tile
      } else {
        groundLayer.putTileAt(4, x, y); // Crater tile (least common)
      }

      // Reduce the frequency of special features
      const specialFeature = Phaser.Math.Between(0, 200);
      if (specialFeature < 1) {
        groundLayer.putTileAt(4, x, y); // Crater (very rare)
      } else if (specialFeature < 3) {
        groundLayer.putTileAt(3, x, y); // Rocky (rare)
      }
    }
  }

  return { map, groundLayer };
}

// Generate a smoother noise map for more natural terrain
function generateNoiseMap(
  width: number,
  height: number,
  smoothingPasses: number = 1
): number[][] {
  const noise: number[][] = [];

  // Initialize with random values
  for (let y = 0; y < height; y++) {
    noise[y] = [];
    for (let x = 0; x < width; x++) {
      noise[y][x] = Math.random();
    }
  }

  let smoothedNoise = [...noise];

  // Apply multiple smoothing passes for more natural transitions
  for (let pass = 0; pass < smoothingPasses; pass++) {
    const tempNoise: number[][] = [];

    for (let y = 0; y < height; y++) {
      tempNoise[y] = [];
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let count = 0;

        // Use a larger neighborhood for smoother transitions
        for (
          let ny = Math.max(0, y - 2);
          ny <= Math.min(height - 1, y + 2);
          ny++
        ) {
          for (
            let nx = Math.max(0, x - 2);
            nx <= Math.min(width - 1, x + 2);
            nx++
          ) {
            // Weight by distance for more natural blending
            const weight =
              1 / (1 + Math.sqrt((nx - x) * (nx - x) + (ny - y) * (ny - y)));
            sum += smoothedNoise[ny][nx] * weight;
            count += weight;
          }
        }

        tempNoise[y][x] = sum / count;
      }
    }

    smoothedNoise = tempNoise;
  }

  return smoothedNoise;
}
