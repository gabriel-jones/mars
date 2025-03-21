import Phaser from "phaser";
import { ResourceType } from "../../data/resources";
import { MiningDrone } from "../robots";
import { MainScene } from "../../scenes/MainScene";
import { Building } from "./Building";
import { TILE_SIZE, DEFAULT_FONT } from "../../constants";
import { getResourceRichnessAt } from "../../terrain";
import { DEPTH } from "../../depth";

export const MINING_RADIUS = 3;

export class MiningStation extends Building {
  private miningArea: Phaser.Geom.Rectangle;
  private miningAreaVisual: Phaser.GameObjects.Rectangle;
  private miningYieldText: Phaser.GameObjects.Text;
  private linkedDrone: MiningDrone | null = null;
  private resourceType: ResourceType = "regolith"; // Default resource type
  private miningYield: number; // Store the mining yield

  // Static preview objects for placement
  private static previewRect: Phaser.GameObjects.Rectangle | null = null;
  private static previewText: Phaser.GameObjects.Text | null = null;

  // Static method to calculate mining yield based on position
  public static calculateMiningYieldAt(
    x: number,
    y: number
  ): {
    miningYield: number;
    avgRichness: number;
    baseYield: number;
    richnessMultiplier: number;
  } {
    // Calculate based on number of tiles rather than pixels
    const tileCount = Math.pow(MINING_RADIUS * 2 + 1, 2); // Number of tiles in the area
    const baseYield = Math.floor(tileCount / 2); // 1 per 2 tiles

    // Calculate average resource richness in the mining area
    let totalRichness = 0;
    let samplesCount = 0;

    // Sample points within the mining area
    const miningAreaSize = (MINING_RADIUS * 2 + 1) * TILE_SIZE;
    const startX = x - miningAreaSize / 2;
    const startY = y - miningAreaSize / 2;

    // Sample every tile center in the mining area
    for (let tileY = 0; tileY < MINING_RADIUS * 2 + 1; tileY++) {
      for (let tileX = 0; tileX < MINING_RADIUS * 2 + 1; tileX++) {
        const worldX = startX + (tileX + 0.5) * TILE_SIZE;
        const worldY = startY + (tileY + 0.5) * TILE_SIZE;

        totalRichness += getResourceRichnessAt(worldX, worldY);
        samplesCount++;
      }
    }

    // Calculate average richness (0-1 range)
    const avgRichness = samplesCount > 0 ? totalRichness / samplesCount : 0.5;

    // Scale yield based on richness (0.5-2.0 multiplier)
    const richnessMultiplier = 0.5 + avgRichness * 1.5;

    // Apply richness multiplier to base yield
    const miningYield = Math.max(1, Math.floor(baseYield * richnessMultiplier));

    return { miningYield, avgRichness, baseYield, richnessMultiplier };
  }

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "mining-station");

    // Clean up any preview objects that might exist
    MiningStation.cleanupPreview();

    // Calculate mining area size in pixels
    const miningAreaSize = (MINING_RADIUS * 2 + 1) * TILE_SIZE; // Add 1 to include the center tile fully

    // Create the mining area
    this.miningArea = new Phaser.Geom.Rectangle(
      x - miningAreaSize / 2,
      y - miningAreaSize / 2,
      miningAreaSize,
      miningAreaSize
    );

    // Calculate the mining yield once when the station is created
    this.miningYield = this.calculateMiningYield();

    // Create visual representation of the mining area with color based on richness
    const avgRichness = this.getAverageRichness();
    let areaColor = 0x000000;
    let areaAlpha = 0.1;

    // // Color based on richness
    // if (avgRichness > 0.8) {
    //   // Very high richness - orange/red
    //   areaColor = 0xf56e42;
    //   areaAlpha = 0.15;
    // } else if (avgRichness > 0.6) {
    //   // High richness - medium orange
    //   areaColor = 0xe67e5d;
    //   areaAlpha = 0.12;
    // } else {
    //   // Low richness - standard
    //   areaColor = 0x000000;
    //   areaAlpha = 0.1;
    // }

    this.miningAreaVisual = this.scene.add.rectangle(
      0,
      0, // Relative to container
      miningAreaSize,
      miningAreaSize,
      areaColor,
      areaAlpha
    );
    this.miningAreaVisual.setStrokeStyle(1, areaColor, 0.3);
    this.add(this.miningAreaVisual);

    // Add mining yield text
    this.miningYieldText = scene.add.text(
      0,
      miningAreaSize / 2 + 20,
      `Yield: ${this.miningYield} ${this.resourceType}/min`,
      {
        fontSize: "12px",
        color: "#ffffff",
        padding: { x: 3, y: 2 },
        fontFamily: DEFAULT_FONT,
      }
    );
    this.miningYieldText.setOrigin(0.5, 0.5);
    this.add(this.miningYieldText);

    // Create a mining drone
    this.createMiningDrone();
  }

  // Static method to show a preview during placement
  public static showPlacementPreview(
    scene: Phaser.Scene,
    x: number,
    y: number,
    isValid: boolean
  ): void {
    // Clean up any existing preview
    this.cleanupPreview();

    // Calculate mining area size in pixels
    const previewSize = (MINING_RADIUS * 2 + 1) * TILE_SIZE; // Add 1 to include the center tile fully

    // Use the shared calculation method
    const { miningYield, avgRichness } = this.calculateMiningYieldAt(x, y);

    // Determine color based on richness
    let previewColor = isValid ? 0x00ff00 : 0xff0000;
    let previewAlpha = 0.2;
    let textColor = "#ffffff";

    // if (isValid) {
    //   // Only show richness colors if placement is valid
    //   if (avgRichness > 0.8) {
    //     // Very high richness - orange/red with green outline
    //     previewColor = 0xf56e42;
    //     previewAlpha = 0.25;
    //     textColor = "#ffcc00"; // Gold text for very rich areas
    //   } else if (avgRichness > 0.6) {
    //     // High richness - medium orange with green outline
    //     previewColor = 0xe67e5d;
    //     previewAlpha = 0.2;
    //   }
    // }

    // Create a new preview rectangle
    this.previewRect = scene.add.rectangle(
      x,
      y,
      previewSize,
      previewSize,
      previewColor,
      previewAlpha
    );
    this.previewRect.setStrokeStyle(2, isValid ? 0x00ff00 : 0xff0000);
    this.previewRect.setDepth(DEPTH.BUILDING);

    // Create a preview text
    this.previewText = scene.add.text(
      x,
      y + previewSize / 2 + 20,
      `Estimated Yield: ${miningYield} regolith/min`,
      {
        fontSize: "12px",
        color: textColor,
        padding: { x: 5, y: 2 },
        fontFamily: DEFAULT_FONT,
      }
    );
    this.previewText.setOrigin(0.5);
    this.previewText.setDepth(DEPTH.BUILDING + 1);
  }

  // Static method to clean up the preview
  public static cleanupPreview(): void {
    if (this.previewRect) {
      this.previewRect.destroy();
      this.previewRect = null;
    }
    if (this.previewText) {
      this.previewText.destroy();
      this.previewText = null;
    }
  }

  protected getBuildingName(): string {
    return "Mining Station";
  }

  private createMiningDrone(): void {
    // Create a mining drone near the station
    const droneX = this.x + 30; // Offset slightly from the station
    const droneY = this.y + 30;

    // Create the mining drone with a reference to this mining station
    this.linkedDrone = new MiningDrone(
      this.scene,
      droneX,
      droneY,
      this // Pass the mining station as a reference
    );

    // Set the resource type to mine
    this.linkedDrone.setResourceType(this.resourceType);

    // Add the drone to the scene's robot arrays
    const mainScene = this.scene as MainScene;
    mainScene.robotManager.addRobot(this.linkedDrone);
  }

  // Calculate the mining yield based on the area and resource richness
  private calculateMiningYield(): number {
    // Use the shared static method
    const { miningYield } = MiningStation.calculateMiningYieldAt(
      this.x,
      this.y
    );
    return miningYield;
  }

  // Get the average resource richness in the mining area
  private getAverageRichness(): number {
    // Use the shared static method
    const { avgRichness } = MiningStation.calculateMiningYieldAt(
      this.x,
      this.y
    );
    return avgRichness;
  }

  public setResourceType(type: ResourceType): void {
    this.resourceType = type;
    if (this.linkedDrone) {
      this.linkedDrone.setResourceType(type);
    }

    // Update the yield text with the stored yield value
    this.miningYieldText.setText(
      `Yield: ${this.miningYield} ${this.resourceType}/min`
    );
  }

  public update(): void {
    super.update();

    // Periodically update the mining yield (every 5 seconds)
    if (this.scene.time.now % 5000 < 20) {
      this.miningYield = this.calculateMiningYield();

      // Update the mining yield text
      if (this.miningYieldText) {
        this.miningYieldText.setText(
          `Yield: ${this.miningYield} ${this.resourceType}/min`
        );
      }
    }

    // Update the linked drone if it exists
    if (this.linkedDrone) {
      this.linkedDrone.update(this.scene.time.now, this.scene.game.loop.delta);
    }
  }

  // Getter for mining yield
  public getMiningYield(): number {
    return this.miningYield;
  }

  // Getter for resource type
  public getResourceType(): ResourceType {
    return this.resourceType;
  }
}
