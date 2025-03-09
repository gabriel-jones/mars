import * as Phaser from "phaser";
import { EnemyManager } from "./EnemyManager";
import {
  MAP_WIDTH,
  MAP_HEIGHT,
  TILE_SIZE,
  INITIAL_RAID_INTERVAL,
  INITIAL_RAID_SIZE,
  RAID_SIZE_MULTIPLIER,
  MAX_RAID_SIZE,
  RAID_WARNING_TIME,
} from "../constants";
import { DEPTH } from "../depth";

/**
 * RaidManager handles spawning groups of aliens that attack the base
 * Raids grow in size as the game progresses
 */
export class RaidManager {
  private scene: Phaser.Scene;
  private enemyManager: EnemyManager;
  private nextRaidTime: number = 0;
  private raidInterval: number = INITIAL_RAID_INTERVAL;
  private initialRaidSize: number = INITIAL_RAID_SIZE;
  private raidCounter: number = 0; // Count of raids that have occurred
  private raidSizeMultiplier: number = RAID_SIZE_MULTIPLIER;
  private maxRaidSize: number = MAX_RAID_SIZE;
  private raidCorners: Phaser.Math.Vector2[] = []; // Possible raid spawn locations
  private lastRaidCorner: number = -1; // Index of the last corner used for a raid
  private raidWarningText: Phaser.GameObjects.Text | null = null;
  private raidWarningTime: number = RAID_WARNING_TIME;
  private nextRaidWarningTime: number = 0;
  private isRaidWarningActive: boolean = false;

  constructor(scene: Phaser.Scene, enemyManager: EnemyManager) {
    this.scene = scene;
    this.enemyManager = enemyManager;

    // Initialize raid corners (the four corners of the map)
    this.initializeRaidCorners();

    // Set the first raid time (start with a longer delay for the first raid)
    this.nextRaidTime = scene.time.now + this.raidInterval * 1.5;
    this.nextRaidWarningTime = this.nextRaidTime - this.raidWarningTime;

    console.log(`RaidManager initialized at time ${scene.time.now}`);
    console.log(
      `First raid scheduled for ${this.nextRaidTime} (in ${
        (this.raidInterval * 1.5) / 1000
      } seconds)`
    );
    console.log(
      `First warning at ${this.nextRaidWarningTime} (in ${
        (this.nextRaidTime - this.raidWarningTime - scene.time.now) / 1000
      } seconds)`
    );
  }

  /**
   * Initialize the possible raid spawn locations (corners of the map)
   */
  private initializeRaidCorners(): void {
    const margin = 5 * TILE_SIZE; // 5 tiles from the edge

    // Top-left corner
    this.raidCorners.push(new Phaser.Math.Vector2(margin, margin));

    // Top-right corner
    this.raidCorners.push(
      new Phaser.Math.Vector2(MAP_WIDTH * TILE_SIZE - margin, margin)
    );

    // Bottom-left corner
    this.raidCorners.push(
      new Phaser.Math.Vector2(margin, MAP_HEIGHT * TILE_SIZE - margin)
    );

    // Bottom-right corner
    this.raidCorners.push(
      new Phaser.Math.Vector2(
        MAP_WIDTH * TILE_SIZE - margin,
        MAP_HEIGHT * TILE_SIZE - margin
      )
    );
  }

  /**
   * Update method called every frame
   */
  public update(time: number, delta: number): void {
    // Log raid timing info every 30 seconds for debugging
    if (time % 30000 < delta) {
      console.log(
        `Raid debug: Current time: ${time}, Next raid time: ${this.nextRaidTime}, Next warning time: ${this.nextRaidWarningTime}, Interval: ${this.raidInterval}`
      );
      console.log(
        `Time until next raid: ${
          Math.max(0, this.nextRaidTime - time) / 1000
        } seconds`
      );
    }

    // Check if it's time to show a raid warning
    if (!this.isRaidWarningActive && time >= this.nextRaidWarningTime) {
      console.log(`Showing raid warning at time ${time}`);
      this.showRaidWarning();
    }

    // Check if it's time for a raid
    if (time >= this.nextRaidTime) {
      console.log(`Spawning raid at time ${time}`);
      this.spawnRaid();

      // Set the next raid time
      this.nextRaidTime = time + this.raidInterval;
      this.nextRaidWarningTime = this.nextRaidTime - this.raidWarningTime;
      console.log(
        `Next raid scheduled for ${this.nextRaidTime}, warning at ${this.nextRaidWarningTime}`
      );
    }

    // Update the raid warning text position if it exists
    if (this.raidWarningText && this.raidWarningText.active) {
      // Make the text pulse by changing its scale
      const pulseFactor = 1 + 0.1 * Math.sin(time / 200);
      this.raidWarningText.setScale(pulseFactor);
    }
  }

  /**
   * Show a warning that a raid is about to happen
   */
  private showRaidWarning(): void {
    this.isRaidWarningActive = true;

    // Create warning text
    this.raidWarningText = this.scene.add
      .text(
        this.scene.cameras.main.width / 2,
        100,
        "⚠️ ALIEN RAID INCOMING! ⚠️",
        {
          fontSize: "32px",
          color: "#FF0000",
          fontStyle: "bold",
          stroke: "#000000",
          strokeThickness: 4,
          shadow: {
            offsetX: 2,
            offsetY: 2,
            color: "#000000",
            blur: 4,
            stroke: true,
            fill: true,
          },
        }
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH.UI);

    // Add a countdown timer below the warning
    const countdownText = this.scene.add
      .text(
        this.scene.cameras.main.width / 2,
        150,
        `Prepare your defenses! Raid begins in ${Math.ceil(
          this.raidWarningTime / 1000
        )} seconds`,
        {
          fontSize: "18px",
          color: "#FFFFFF",
          fontStyle: "bold",
          stroke: "#000000",
          strokeThickness: 2,
        }
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH.UI);

    // Update the countdown every second
    const countdownEvent = this.scene.time.addEvent({
      delay: 1000,
      callback: () => {
        const secondsLeft = Math.ceil(
          (this.nextRaidTime - this.scene.time.now) / 1000
        );
        countdownText.setText(
          `Prepare your defenses! Raid begins in ${secondsLeft} seconds`
        );
      },
      callbackScope: this,
      loop: true,
    });

    // Make the text disappear after the warning time
    this.scene.time.delayedCall(this.raidWarningTime, () => {
      // Stop the countdown event
      countdownEvent.remove();

      // Destroy the texts
      if (this.raidWarningText) {
        this.raidWarningText.destroy();
        this.raidWarningText = null;
      }
      countdownText.destroy();

      this.isRaidWarningActive = false;
    });
  }

  /**
   * Spawn a raid of aliens
   */
  private spawnRaid(): void {
    // Calculate raid size based on raid counter with a more gradual progression
    let raidSize = Math.min(
      Math.floor(
        this.initialRaidSize *
          Math.pow(this.raidSizeMultiplier, this.raidCounter)
      ),
      this.maxRaidSize
    );

    // Choose a corner for the raid that's different from the last one
    let cornerIndex;
    do {
      cornerIndex = Math.floor(Math.random() * this.raidCorners.length);
    } while (
      cornerIndex === this.lastRaidCorner &&
      this.raidCorners.length > 1
    );

    this.lastRaidCorner = cornerIndex;
    const raidCorner = this.raidCorners[cornerIndex];

    // Update the enemy manager spawn point
    this.enemyManager.updateSpawnPoint(raidCorner);

    // Create the raid enemies
    this.enemyManager.createEnemies(raidSize);

    // // Force an update on all enemies to ensure they're properly initialized
    // const gameState = (window as any).gameState;
    // if (gameState && gameState.enemies) {
    //   gameState.enemies.forEach((enemy: any) => {
    //     if (enemy && typeof enemy.update === "function") {
    //       // Call update multiple times to ensure proper initialization
    //       for (let i = 0; i < 3; i++) {
    //         enemy.update(this.scene.time.now + i * 100, 16);
    //       }
    //     }
    //   });
    // }

    // Increment the raid counter
    this.raidCounter++;

    // Show a message about the raid
    this.showRaidMessage(raidSize, cornerIndex);

    console.log(
      `Raid #${this.raidCounter} spawned with ${raidSize} aliens at corner ${cornerIndex}`
    );
  }

  /**
   * Show a message about the raid that just started
   */
  private showRaidMessage(raidSize: number, cornerIndex: number): void {
    // Get the direction of the raid
    const directions = ["northwest", "northeast", "southwest", "southeast"];
    const direction = directions[cornerIndex];

    // Create a message
    const message = this.scene.add
      .text(
        this.scene.cameras.main.width / 2,
        200,
        `A group of ${raidSize} aliens is attacking from the ${direction}!`,
        {
          fontSize: "20px",
          color: "#FF9900",
          fontStyle: "bold",
          stroke: "#000000",
          strokeThickness: 3,
        }
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH.UI);

    // Make the message fade out after 5 seconds
    this.scene.tweens.add({
      targets: message,
      alpha: 0,
      duration: 2000,
      delay: 3000,
      onComplete: () => {
        message.destroy();
      },
    });
  }

  /**
   * Adjust raid difficulty based on player's defenses
   * This can be called when the player builds new defenses
   */
  public adjustRaidDifficulty(defensesCount: number): void {
    // Adjust raid interval based on defenses (more defenses = more frequent raids)
    this.raidInterval = INITIAL_RAID_INTERVAL; // 10 seconds between raids

    // Adjust raid size multiplier based on defenses (more gradual scaling)
    this.raidSizeMultiplier = 1.3 + defensesCount * 0.02;

    console.log(
      `Raid difficulty adjusted: interval=${this.raidInterval}ms, multiplier=${this.raidSizeMultiplier}`
    );
  }
}
