import Phaser from "phaser";
import { DEPTH } from "../depth";

/**
 * Interface for entities that have health
 */
export interface HasHealth {
  getMaxHealth(): number;
  getCurrentHealth(): number;
  setHealth(value: number): void;
  damage(amount: number): void;
  heal(amount: number): void;
  isAlive(): boolean;
  // Shield-related methods
  hasShield(): boolean;
  getMaxShield(): number;
  getCurrentShield(): number;
  setShield(value: number): void;
  damageShield(amount: number): void;
  rechargeShield(amount: number): void;
}

/**
 * Class to render health bars for entities
 */
export class HealthBarRenderer {
  private scene: Phaser.Scene;
  private barWidth: number = 40;
  private barHeight: number = 6;
  private padding: number = 2;
  private borderWidth: number = 1;
  private barSpacing: number = 2; // Space between health and shield bars

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Create a health bar container for an entity
   * @param entity The entity to create a health bar for
   * @param offsetY Vertical offset from the entity's position
   * @returns A container with the health bar
   */
  public createHealthBar(
    entity: Phaser.GameObjects.GameObject & HasHealth,
    offsetY: number = -20
  ): Phaser.GameObjects.Container {
    const container = this.scene.add.container(0, offsetY);

    // Set a high depth to ensure it's visible above other elements
    container.setDepth(DEPTH.HEALTH_BAR);

    // Create background (border) for health bar
    const background = this.scene.add.rectangle(
      0,
      0,
      this.barWidth + this.padding * 2,
      this.barHeight + this.padding * 2,
      0x000000,
      1
    );
    background.setOrigin(0.5, 0.5);
    background.setStrokeStyle(this.borderWidth, 0xffffff, 0.8);
    background.setName("background");

    // Create health bar (green)
    const healthBar = this.scene.add.rectangle(
      -this.barWidth / 2 + this.padding,
      0,
      this.barWidth,
      this.barHeight,
      0x00ff00, // Green by default
      1
    );
    healthBar.setOrigin(0, 0.5);
    healthBar.setName("healthBar");

    // Add elements to container (background and health bar)
    container.add([background, healthBar]);

    // Create shield bar (if entity has a shield) - positioned above health bar
    if (entity.hasShield()) {
      // Create background for shield bar
      const shieldBackground = this.scene.add.rectangle(
        0,
        -this.barHeight - this.barSpacing, // Position above health bar
        this.barWidth + this.padding * 2,
        this.barHeight + this.padding * 2,
        0x000000,
        1
      );
      shieldBackground.setOrigin(0.5, 0.5);
      shieldBackground.setStrokeStyle(this.borderWidth, 0xffffff, 0.8);
      shieldBackground.setName("shieldBackground");

      // Create shield bar
      const shieldBar = this.scene.add.rectangle(
        -this.barWidth / 2 + this.padding,
        -this.barHeight - this.barSpacing, // Position above health bar
        this.barWidth,
        this.barHeight,
        0x0088ff, // Blue shield color for default
        1
      );
      shieldBar.setOrigin(0, 0.5);
      shieldBar.setName("shieldBar");

      // Add shield elements to container
      container.add([shieldBackground, shieldBar]);
    }

    // Initially hide the container - will be shown only if needed
    container.setVisible(false);

    // Update the health bar initially
    this.updateHealthBar(container, entity);

    return container;
  }

  /**
   * Update a health bar based on the entity's current health
   * @param container The container with the health bar
   * @param entity The entity with health
   */
  public updateHealthBar(
    container: Phaser.GameObjects.Container,
    entity: HasHealth
  ): void {
    const healthBar = container.getByName(
      "healthBar"
    ) as Phaser.GameObjects.Rectangle;

    if (!healthBar) return;

    const healthPercent = entity.getCurrentHealth() / entity.getMaxHealth();
    healthBar.width = this.barWidth * healthPercent;

    // Change color based on health percentage
    if (healthPercent > 0.6) {
      healthBar.fillColor = 0x00ff00; // Green
    } else if (healthPercent > 0.3) {
      healthBar.fillColor = 0xffff00; // Yellow
    } else {
      healthBar.fillColor = 0xff0000; // Red
    }

    // Update shield bar if entity has a shield
    let hasActiveShield = false;
    if (entity.hasShield()) {
      const shieldBar = container.getByName(
        "shieldBar"
      ) as Phaser.GameObjects.Rectangle;

      if (shieldBar) {
        const shieldPercent = entity.getCurrentShield() / entity.getMaxShield();
        shieldBar.width = this.barWidth * shieldPercent;

        // Use red shield color for aliens, blue for others
        const isAlien =
          (entity as any).getEnemyName &&
          (entity as any).getEnemyName() === "Alien";
        shieldBar.fillColor = isAlien ? 0xff0088 : 0x0088ff; // Red for aliens, blue for others

        // Check if shield is active
        hasActiveShield = shieldPercent > 0;

        // Show/hide shield background based on shield amount
        const shieldBackground = container.getByName(
          "shieldBackground"
        ) as Phaser.GameObjects.Rectangle;

        if (shieldBackground) {
          shieldBackground.setVisible(hasActiveShield);
        }

        // Show/hide shield bar based on shield amount
        shieldBar.setVisible(hasActiveShield);
      }
    }

    // Check if health is full (using exact comparison with a small epsilon for floating point precision)
    const isFullHealth = Math.abs(healthPercent - 1) < 0.001;

    // Only show health bar if health is not full or if there's an active shield
    const shouldBeVisible = !isFullHealth || hasActiveShield;

    // Set visibility - force to false if health is full
    container.setVisible(shouldBeVisible);

    // Force alpha to 0 if health is full to ensure it's completely hidden
    if (!shouldBeVisible) {
      container.setAlpha(0);
    } else {
      container.setAlpha(1);
    }
  }

  /**
   * Set the size of the health bar
   * @param width Width of the health bar
   * @param height Height of the health bar
   */
  public setSize(width: number, height: number): void {
    this.barWidth = width;
    this.barHeight = height;
  }
}
