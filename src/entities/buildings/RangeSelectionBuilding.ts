import Phaser from "phaser";
import { Building } from "./Building";
import { TILE_SIZE, DEFAULT_FONT } from "../../constants";
import { BuildingManager } from "../../data/buildings";
import { BuildingType } from "../../data/buildings";

/**
 * Base class for buildings that are placed using range selection.
 * This class handles tiling the building icon across the entire selected area.
 */
export abstract class RangeSelectionBuilding extends Building {
  protected tileSprites: Phaser.GameObjects.Sprite[] = [];
  protected tilesContainer: Phaser.GameObjects.Container;
  protected hasLoggedFirstUpdate: boolean = false;
  protected customRender: boolean = false; // Flag to indicate if the building uses custom rendering

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    buildingType: BuildingType,
    tileWidth: number,
    tileHeight: number,
    hasInventory: boolean = false,
    customRender: boolean = false
  ) {
    super(scene, x, y, buildingType, tileWidth, tileHeight, hasInventory);

    console.log(
      `Creating ${buildingType} at (${x}, ${y}) with dimensions ${tileWidth}x${tileHeight}`
    );

    this.customRender = customRender;

    // Hide the default sprite since we'll render individual tiles
    this.sprite.setVisible(false);

    // Calculate the tile grid position of the building center
    const tileGridX = Math.floor(x / TILE_SIZE);
    const tileGridY = Math.floor(y / TILE_SIZE);

    // Calculate the top-left corner of the building in world coordinates
    const alignedTopLeftX = tileGridX * TILE_SIZE;
    const alignedTopLeftY = tileGridY * TILE_SIZE;

    // Position the container at the top-left corner relative to the center of the building
    const containerX = alignedTopLeftX - x;
    const containerY = alignedTopLeftY - y;

    console.log(`  Tile grid position: (${tileGridX}, ${tileGridY})`);
    console.log(
      `  Aligned top-left corner: (${alignedTopLeftX}, ${alignedTopLeftY})`
    );
    console.log(`  Container position: (${containerX}, ${containerY})`);

    // Create the tiles container at the correct position
    this.tilesContainer = scene.add.container(containerX, containerY);
    this.add(this.tilesContainer);

    // Register with building manager
    const tileX = tileGridX - Math.floor(tileWidth / 2);
    const tileY = tileGridY - Math.floor(tileHeight / 2);

    console.log(`  Top-left tile position: (${tileX}, ${tileY})`);

    BuildingManager.addBuilding({
      type: buildingType,
      displayName: this.getBuildingName(),
      position: {
        x: x,
        y: y,
      },
      placedAt: Date.now(),
      tileWidth: tileWidth,
      tileHeight: tileHeight,
      tiles: this.calculateTiles(tileX, tileY, tileWidth, tileHeight),
      hasInventory: hasInventory,
    });

    // Initialize tiles if not using custom rendering
    if (!this.customRender) {
      this.initializeTiles();
    }

    // Make the building interactive
    this.setInteractive(
      new Phaser.Geom.Rectangle(
        containerX,
        containerY,
        tileWidth * TILE_SIZE,
        tileHeight * TILE_SIZE
      ),
      Phaser.Geom.Rectangle.Contains
    );

    // Add debug visualization
    this.addDebugVisualization(containerX, containerY);
  }

  /**
   * Calculate the tiles occupied by this building
   */
  protected calculateTiles(
    tileX: number,
    tileY: number,
    width: number,
    height: number
  ): { x: number; y: number }[] {
    const tiles: { x: number; y: number }[] = [];

    console.log(`Calculating tiles for building at (${this.x}, ${this.y}):`);
    console.log(`  Starting tile position: (${tileX}, ${tileY})`);
    console.log(`  Building dimensions: ${width}x${height} tiles`);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        tiles.push({ x: tileX + x, y: tileY + y });
      }
    }

    console.log(`  Total tiles calculated: ${tiles.length}`);
    console.log(`  First tile: (${tiles[0].x}, ${tiles[0].y})`);
    console.log(
      `  Last tile: (${tiles[tiles.length - 1].x}, ${
        tiles[tiles.length - 1].y
      })`
    );

    return tiles;
  }

  /**
   * Initialize the tiles for this building
   */
  protected initializeTiles(): void {
    // Clear existing tiles
    this.tileSprites = [];
    this.tilesContainer.removeAll(true);

    console.log(
      `Initializing ${this.buildingType} tiles: ${this.tileWidth}x${this.tileHeight} at (${this.x}, ${this.y})`
    );

    // Create a tile for each position in the building
    for (let row = 0; row < this.tileHeight; row++) {
      for (let col = 0; col < this.tileWidth; col++) {
        // Position each tile at its center point within the tile cell
        // The position is relative to the tilesContainer, which is already positioned at the top-left corner
        const tileX = col * TILE_SIZE + TILE_SIZE / 2;
        const tileY = row * TILE_SIZE + TILE_SIZE / 2;

        // Create sprite for this tile
        const tileSprite = this.createTileSprite(tileX, tileY, row, col);
        this.tilesContainer.add(tileSprite);
        this.tileSprites.push(tileSprite);

        // Log the tile creation
        if (row === 0 && col === 0) {
          console.log(
            `Created first tile at (${tileX}, ${tileY}) relative to container at (${this.tilesContainer.x}, ${this.tilesContainer.y})`
          );
          console.log(
            `First tile world position: (${
              this.x + this.tilesContainer.x + tileX
            }, ${this.y + this.tilesContainer.y + tileY})`
          );
        }
      }
    }

    console.log(
      `Created ${this.tileSprites.length} tiles for ${this.buildingType} at (${this.x}, ${this.y}) with dimensions ${this.tileWidth}x${this.tileHeight}`
    );
  }

  /**
   * Create a sprite for a tile at the given position
   * This can be overridden by subclasses to customize the appearance of tiles
   */
  protected createTileSprite(
    tileX: number,
    tileY: number,
    row: number,
    col: number
  ): Phaser.GameObjects.Sprite {
    const tileSprite = this.scene.add.sprite(tileX, tileY, this.buildingType);
    tileSprite.setDisplaySize(TILE_SIZE, TILE_SIZE);

    // Add debug text to show the row and column
    // Check for a debug flag in the scene or use a constant for debugging
    const isDebugMode = (this.scene as any).isDebugMode || false;
    if (isDebugMode) {
      const debugText = this.scene.add.text(tileX, tileY, `${row},${col}`, {
        fontSize: "10px",
        color: "#ffffff",
        backgroundColor: "#000000",
        fontFamily: DEFAULT_FONT,
      });
      debugText.setOrigin(0.5);
      this.tilesContainer.add(debugText);
    }

    return tileSprite;
  }

  /**
   * Add debug visualization to show the building's boundaries
   */
  protected addDebugVisualization(offsetX?: number, offsetY?: number): void {
    // If offsets weren't provided, calculate them
    if (offsetX === undefined || offsetY === undefined) {
      // Calculate the tile grid position of the building center
      const tileGridX = Math.round(this.x / TILE_SIZE);
      const tileGridY = Math.round(this.y / TILE_SIZE);

      // Calculate the top-left corner of the building in world coordinates
      const alignedTopLeftX = tileGridX * TILE_SIZE;
      const alignedTopLeftY = tileGridY * TILE_SIZE;

      console.log(
        `Building aligned top-left: (${alignedTopLeftX}, ${alignedTopLeftY}) for building at (${this.x}, ${this.y})`
      );

      // Calculate the offset from the building center to the aligned top-left corner
      offsetX = alignedTopLeftX - this.x;
      offsetY = alignedTopLeftY - this.y;
    }

    // Add a border around the entire building
    const graphics = this.scene.add.graphics();
    graphics.lineStyle(2, 0xff0000, 1);
    graphics.strokeRect(
      offsetX,
      offsetY,
      this.tileWidth * TILE_SIZE,
      this.tileHeight * TILE_SIZE
    );
    this.add(graphics);

    // Add tile grid lines
    const gridGraphics = this.scene.add.graphics();
    gridGraphics.lineStyle(1, 0xffff00, 0.5);

    // Draw vertical grid lines
    for (let col = 0; col <= this.tileWidth; col++) {
      const x = offsetX + col * TILE_SIZE;
      gridGraphics.lineBetween(
        x,
        offsetY,
        x,
        offsetY + this.tileHeight * TILE_SIZE
      );
    }

    // Draw horizontal grid lines
    for (let row = 0; row <= this.tileHeight; row++) {
      const y = offsetY + row * TILE_SIZE;
      gridGraphics.lineBetween(
        offsetX,
        y,
        offsetX + this.tileWidth * TILE_SIZE,
        y
      );
    }

    this.add(gridGraphics);

    // Add a marker at the center of the building
    const centerMarker = this.scene.add.graphics();
    centerMarker.lineStyle(2, 0x00ff00, 1);
    centerMarker.strokeCircle(0, 0, 5);
    this.add(centerMarker);
  }

  /**
   * Update method to be called by the scene
   */
  public update(time: number, delta: number): void {
    // Log the first update call
    if (!this.hasLoggedFirstUpdate) {
      console.log(
        `${this.buildingType} update called at (${this.x}, ${this.y}) with dimensions ${this.tileWidth}x${this.tileHeight}`
      );
      console.log(`${this.buildingType} has ${this.tileSprites.length} tiles`);
      this.hasLoggedFirstUpdate = true;
    }

    // Subclasses should override this method to add their own update logic
  }
}
