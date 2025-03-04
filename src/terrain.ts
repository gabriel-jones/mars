import Phaser from "phaser";
import { TILE_SIZE } from "./config";

// Create a mars terrain tileset programmatically
export function createMarsTileset(scene: Phaser.Scene): void {
  // Create a texture atlas for our mars tiles
  const graphics = scene.make.graphics({ x: 0, y: 0 });

  // Create base Mars tile (index 0)
  createBaseTile(graphics, 0, 0, 0xc87137, 0xb25d29);

  // Create darker variation (index 1)
  createBaseTile(graphics, TILE_SIZE, 0, 0xc87137, 0xa04d19);

  // Create lighter variation (index 2)
  createBaseTile(graphics, TILE_SIZE * 2, 0, 0xc87137, 0xc87137);

  // Generate a texture from the graphics object
  graphics.generateTexture("marsTileset", TILE_SIZE * 3, TILE_SIZE);
  graphics.destroy();
}

// Helper function to create a basic Mars tile with random speckles at a specific position
function createBaseTile(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  baseColor: number,
  speckleColor: number
): void {
  // Fill with base color
  graphics.fillStyle(baseColor);
  graphics.fillRect(x, y, TILE_SIZE, TILE_SIZE);

  // Add some variation/texture to the tile
  graphics.fillStyle(speckleColor);
  for (let i = 0; i < 10; i++) {
    const speckleX = Phaser.Math.Between(5, TILE_SIZE - 5) + x;
    const speckleY = Phaser.Math.Between(5, TILE_SIZE - 5) + y;
    const size = Phaser.Math.Between(3, 8);
    graphics.fillRect(speckleX, speckleY, size, size);
  }
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

  // Fill the map with random tiles
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const tileType = Phaser.Math.Between(0, 100);

      // Use different indices from our tileset
      if (tileType < 70) {
        groundLayer.putTileAt(0, x, y); // Regular tile (index 0)
      } else if (tileType < 85) {
        groundLayer.putTileAt(1, x, y); // Dark tile (index 1)
      } else {
        groundLayer.putTileAt(2, x, y); // Light tile (index 2)
      }
    }
  }

  return { map, groundLayer };
}
