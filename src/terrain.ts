import Phaser from "phaser";
import { TILE_SIZE } from "./constants";

// Create a mars terrain tileset programmatically
export function createMarsTileset(scene: Phaser.Scene): void {
  // Create a texture atlas for our mars tiles
  const graphics = scene.make.graphics({ x: 0, y: 0 });

  // Use a muted, background-friendly Mars color
  const baseColor = 0xc97c5e; // Muted terracotta (main color)
  const dustColor = 0xb66c50; // Lighter color for dust specks

  // Create 10 different dust pattern tiles
  for (let tileIndex = 0; tileIndex < 10; tileIndex++) {
    // Position in the tileset
    const tileX = (tileIndex % 5) * TILE_SIZE;
    const tileY = Math.floor(tileIndex / 5) * TILE_SIZE;

    // Create a unique dust pattern for each tile
    createRandomDustyMarsTile(graphics, tileX, tileY, baseColor, dustColor);
  }

  // Generate a texture from the graphics object (5x2 tiles)
  graphics.generateTexture("marsTileset", TILE_SIZE * 5, TILE_SIZE * 2);
  graphics.destroy();
}

// Helper function to create a Mars tile with random dust specks
function createRandomDustyMarsTile(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  baseColor: number,
  dustColor: number
): void {
  // Fill with base color
  graphics.fillStyle(baseColor);
  graphics.fillRect(x, y, TILE_SIZE, TILE_SIZE);

  // Add random dust specks as larger pixels
  graphics.fillStyle(dustColor);

  // Random number of dust specks for this tile pattern
  const numSpecks = Phaser.Math.Between(0, 10); // Reduced count to balance larger size

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
  const numClusters = Phaser.Math.Between(0, 2); // Reduced count to balance larger size

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

  // Add the tileset - this is a tileset with 10 different frames
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

  // Fill the map with randomly selected tiles from our 10 patterns
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      // Randomly select one of the 10 tile patterns (0-9)
      const tileIndex = Phaser.Math.Between(0, 9);
      groundLayer.putTileAt(tileIndex, x, y);
    }
  }

  return { map, groundLayer };
}
