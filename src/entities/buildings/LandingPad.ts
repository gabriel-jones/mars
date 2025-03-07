import Phaser from "phaser";
import { Building } from "./Building";
import { TILE_SIZE } from "../../constants";
import { Starship } from "../starship";
import { BuildingManager } from "../../data/buildings";

export class LandingPad extends Building {
  private starship: Starship;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    tileWidth: number = 4,
    tileHeight: number = 4
  ) {
    // Align to tile grid
    const tileX = Math.floor(x / TILE_SIZE);
    const tileY = Math.floor(y / TILE_SIZE);
    const alignedX = tileX * TILE_SIZE + (tileWidth * TILE_SIZE) / 2;
    const alignedY = tileY * TILE_SIZE + (tileHeight * TILE_SIZE) / 2;

    super(scene, alignedX, alignedY, "landing-pad", tileWidth, tileHeight);

    // Create the landing pad sprite
    this.sprite.setTexture("landingpad");
    this.sprite.setDisplaySize(TILE_SIZE * tileWidth, TILE_SIZE * tileHeight);

    // Create a starship for this landing pad
    this.starship = new Starship(scene, alignedX, alignedY);

    // Register with building manager
    BuildingManager.addBuilding({
      type: "landing-pad",
      displayName: "Starship Landing Pad",
      position: {
        x: alignedX,
        y: alignedY,
      },
      placedAt: Date.now(),
      tileWidth: tileWidth,
      tileHeight: tileHeight,
      tiles: this.calculateTiles(tileX, tileY, tileWidth, tileHeight),
    });

    console.log(
      `Created landing pad with starship at (${alignedX}, ${alignedY})`
    );
  }

  private calculateTiles(
    tileX: number,
    tileY: number,
    width: number,
    height: number
  ): { x: number; y: number }[] {
    const tiles: { x: number; y: number }[] = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        tiles.push({ x: tileX + x, y: tileY + y });
      }
    }

    return tiles;
  }

  public update(time: number, delta: number): void {
    // Update the starship
    this.starship.update();
  }

  public getStarship(): Starship {
    return this.starship;
  }

  public getStarshipInventory(): { [key: string]: number } {
    return this.starship.getInventory();
  }

  public destroy(): void {
    // Destroy the starship
    this.starship.destroy();

    // Remove from building manager
    BuildingManager.removeBuilding(this.x, this.y);

    // Call parent destroy method
    super.destroy();
  }

  protected getBuildingName(): string {
    return "Starship Landing Pad";
  }
}
