import Phaser from "phaser";
import { Enemy } from "../entities/enemies/Enemy";
import { Alien } from "../entities/enemies/Alien";
import { HealthBarRenderer } from "../interfaces/Health";
import { NUM_INITIAL_ENEMIES } from "../constants";

/**
 * EnemyManager handles all enemy-related functionality
 * including creation, spawning, and management
 */
export class EnemyManager {
  private scene: Phaser.Scene;
  private enemies: Enemy[] = [];
  private spawnPoint: Phaser.Math.Vector2;
  private healthBarRenderer: HealthBarRenderer;
  private defaultSpawnPoint: Phaser.Math.Vector2;
  private initialized: boolean = false;

  constructor(
    scene: Phaser.Scene,
    enemies: Enemy[],
    spawnPoint: Phaser.Math.Vector2,
    healthBarRenderer: HealthBarRenderer
  ) {
    this.scene = scene;
    this.enemies = enemies;
    this.spawnPoint = spawnPoint;
    this.healthBarRenderer = healthBarRenderer;

    // Set a default spawn point in the center of the screen
    this.defaultSpawnPoint = new Phaser.Math.Vector2(
      scene.cameras.main.width / 2,
      scene.cameras.main.height / 2
    );

    // Mark as initialized
    this.initialized = true;
  }

  /**
   * Updates the spawn point
   */
  public updateSpawnPoint(spawnPoint: Phaser.Math.Vector2): void {
    this.spawnPoint = spawnPoint;
  }

  /**
   * Creates enemies
   */
  public createEnemies(count: number = NUM_INITIAL_ENEMIES): void {
    // Check if initialized
    if (!this.initialized) {
      console.error("EnemyManager is not initialized!");
      return;
    }

    try {
      // Use the spawn point if it's set, otherwise use the default
      const spawnX = this.spawnPoint?.x || this.defaultSpawnPoint.x;
      const spawnY = this.spawnPoint?.y || this.defaultSpawnPoint.y;

      console.log(
        `Creating ${count} aliens at spawn point (${spawnX}, ${spawnY})`
      );

      // Create aliens for the raid
      for (let i = 0; i < count; i++) {
        // Add randomness to alien positions instead of a perfect circle
        const angle = (i / count) * Math.PI * 2 + (Math.random() * 0.5 - 0.25); // Add random angle variation
        const minDistance = 100; // Minimum distance from spawn point
        const maxDistance = Math.min(300, count * 30); // Scale max distance with raid size
        const distance =
          minDistance + Math.random() * (maxDistance - minDistance); // Random distance

        const x = spawnX + Math.cos(angle) * distance;
        const y = spawnY + Math.sin(angle) * distance;

        // Create alien with increased speed for raids
        const alien = new Alien(
          this.scene,
          x,
          y,
          80, // health
          120 + Math.random() * 30 // randomized speed between 120-150
        );

        // Add health bar to the alien
        const healthBar = this.healthBarRenderer.createHealthBar(
          alien as any, // Type cast to bypass type checking
          -30
        );
        alien.setHealthBar(healthBar);

        // Force the alien to immediately look for targets
        if (typeof alien.update === "function") {
          alien.update(this.scene.time.now, 16); // Call update once to initialize
        }

        this.enemies.push(alien);
      }

      console.log(`Successfully created ${count} aliens`);

      // Update gameState.enemies
      (window as any).gameState.enemies = this.enemies;
    } catch (error) {
      console.error("Error creating enemies:", error);
    }
  }

  /**
   * Updates enemies
   */
  public updateEnemies(time: number, delta: number): void {
    if (!this.initialized) return;

    // Filter out any destroyed enemies
    this.enemies = this.enemies.filter((enemy) => {
      // Check if the enemy is valid (has a sprite and is alive)
      const isValid =
        enemy &&
        typeof enemy.getSprite === "function" &&
        typeof enemy.isAlive === "function" &&
        enemy.isAlive();

      if (!isValid) {
        console.log("Removing invalid enemy from update loop");
      }

      return isValid;
    });

    // Update remaining valid enemies
    this.enemies.forEach((enemy) => {
      try {
        enemy.update(time, delta);
        // Health bar updates are already handled in the enemy's update method
      } catch (error) {
        console.error("Error updating enemy:", error);
      }
    });

    // Update gameState.enemies reference
    (window as any).gameState.enemies = this.enemies;
  }

  /**
   * Updates the references to enemies
   */
  public updateReferences(enemies: Enemy[]): void {
    this.enemies = enemies;
  }
}
