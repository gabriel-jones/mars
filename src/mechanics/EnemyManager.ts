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

      // Create a few aliens for testing
      for (let i = 0; i < count; i++) {
        // Random position away from spawn point
        const x = spawnX + Phaser.Math.Between(-500, 500);
        const y = spawnY + Phaser.Math.Between(-500, 500);

        // Create alien
        const alien = new Alien(this.scene, x, y);

        // Add health bar to the alien
        const healthBar = this.healthBarRenderer.createHealthBar(
          alien as any, // Type cast to bypass type checking
          -30
        );
        alien.setHealthBar(healthBar);

        this.enemies.push(alien);
      }

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

    this.enemies.forEach((enemy) => {
      enemy.update(time, delta);
      // Health bar updates are already handled in the enemy's update method
    });
  }

  /**
   * Updates the references to enemies
   */
  public updateReferences(enemies: Enemy[]): void {
    this.enemies = enemies;
  }
}
