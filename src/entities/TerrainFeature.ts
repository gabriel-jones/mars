import * as Phaser from "phaser";
import { TILE_SIZE } from "../constants";

// Enum for different types of terrain features
export enum TerrainFeatureType {
  IceDeposit = "ice-deposit",
  // Add more terrain feature types here as needed
}

export class TerrainFeature extends Phaser.GameObjects.Container {
  private featureType: TerrainFeatureType;
  private sprite: Phaser.GameObjects.Sprite;
  private pulseEffect: Phaser.Tweens.Tween;
  private label: Phaser.GameObjects.Text;
  public tileX: number;
  public tileY: number;
  private static featuresByTile: Map<string, TerrainFeature> = new Map();

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    featureType: TerrainFeatureType
  ) {
    // Snap to tile grid
    const tileX = Math.floor(x / TILE_SIZE);
    const tileY = Math.floor(y / TILE_SIZE);
    const snappedX = tileX * TILE_SIZE + TILE_SIZE / 2;
    const snappedY = tileY * TILE_SIZE + TILE_SIZE / 2;

    super(scene, snappedX, snappedY);

    this.tileX = tileX;
    this.tileY = tileY;
    this.featureType = featureType;

    // Check if a terrain feature already exists at this tile
    const tileKey = `${tileX},${tileY}`;
    if (TerrainFeature.featuresByTile.has(tileKey)) {
      // If a feature exists, don't create a new one
      this.destroy();
      return;
    }

    // Register this feature in the tile map
    TerrainFeature.featuresByTile.set(tileKey, this);

    // Create the visual representation based on feature type
    if (featureType === TerrainFeatureType.IceDeposit) {
      // Create ice deposit visual using the texture
      this.sprite = scene.add
        .sprite(0, 0, "ice-deposit")
        .setOrigin(0.5)
        .setDepth(0)
        .setDisplaySize(TILE_SIZE, TILE_SIZE);
      this.add(this.sprite);

      // Add a label showing the feature type
      this.label = scene.add
        .text(0, 30, "Ice Deposit", {
          fontSize: "11px",
          color: "#FFFFFF",
          align: "center",
        })
        .setOrigin(0.5);
      this.add(this.label);
    }

    // Add physics to the terrain feature
    scene.physics.world.enable(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCircle(20); // Set collision radius
    body.setBounce(0); // No bounce since we want them to stay in place
    body.setImmovable(true); // Make immovable to prevent pushing
    body.setVelocity(0, 0);

    scene.add.existing(this);
  }

  public getFeatureType(): TerrainFeatureType {
    return this.featureType;
  }

  public getTilePosition(): { x: number; y: number } {
    return { x: this.tileX, y: this.tileY };
  }

  // Override the destroy method to ensure proper cleanup
  public override destroy(fromScene?: boolean): void {
    // Clean up the label if it exists
    if (this.label && this.label.active) {
      this.label.destroy();
      this.label = null as any;
    }

    // Clean up the sprite if it exists
    if (this.sprite && this.sprite.active) {
      this.sprite.destroy();
      this.sprite = null as any;
    }

    // Stop any active tweens
    if (this.pulseEffect) {
      this.pulseEffect.stop();
      this.pulseEffect.remove();
      this.pulseEffect = null as any;
    }

    // Remove from the features map
    const tileKey = `${this.tileX},${this.tileY}`;
    TerrainFeature.featuresByTile.delete(tileKey);

    // Call the parent destroy method
    super.destroy(fromScene);
  }

  // Static method to get a terrain feature at a specific tile
  public static getFeatureAtTile(
    tileX: number,
    tileY: number
  ): TerrainFeature | undefined {
    return TerrainFeature.featuresByTile.get(`${tileX},${tileY}`);
  }

  // Static method to check if a tile has a terrain feature
  public static hasTileFeature(tileX: number, tileY: number): boolean {
    return TerrainFeature.featuresByTile.has(`${tileX},${tileY}`);
  }

  // Static method to check if a tile has a specific terrain feature type
  public static hasTileFeatureType(
    tileX: number,
    tileY: number,
    featureType: TerrainFeatureType
  ): boolean {
    const feature = TerrainFeature.featuresByTile.get(`${tileX},${tileY}`);
    return feature?.getFeatureType() === featureType;
  }

  // Static method to get all terrain features
  public static getAllFeatures(): TerrainFeature[] {
    const features: TerrainFeature[] = [];
    TerrainFeature.featuresByTile.forEach((feature) => {
      features.push(feature);
    });
    return features;
  }
}
