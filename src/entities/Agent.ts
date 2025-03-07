import * as Phaser from "phaser";
import { DustEffects } from "../effects/DustEffects";
import { ShadowEffects } from "../effects/ShadowEffects";
import { DUST_COLOR, TILE_SIZE } from "../constants";
import { HasHealth, HealthBarRenderer } from "../interfaces/Health";
import { Tool, ToolType } from "./tools";

// Base Agent class for all entities with health (player, robots, enemies)
export abstract class Agent implements HasHealth {
  protected scene: Phaser.Scene;
  protected sprite: Phaser.Physics.Arcade.Sprite | Phaser.GameObjects.Container;
  protected health: number;
  protected maxHealth: number;
  protected dustEffects: DustEffects | null = null;
  protected shadowEffects: ShadowEffects | null = null;
  protected healthBar: Phaser.GameObjects.Container | null = null;
  protected equippedTool: Tool | null = null;
  protected lastFireTime: number = 0;
  protected fireRate: number = 150; // milliseconds between shots

  // Shield properties
  protected shield: number = 0;
  protected maxShield: number = 0;
  protected shieldActive: boolean = false;
  protected shieldEffect: Phaser.GameObjects.Ellipse | null = null;
  protected shieldColor: number = 0x0088ff; // Default blue shield color
  protected shieldVisibilityTimer: number = 0;
  protected shieldVisibilityDuration: number = 300; // ms to show shield after hit

  constructor(
    scene: Phaser.Scene,
    sprite: Phaser.Physics.Arcade.Sprite | Phaser.GameObjects.Container,
    maxHealth: number = 100
  ) {
    this.scene = scene;
    this.sprite = sprite;
    this.maxHealth = maxHealth;
    this.health = maxHealth;
  }

  // Initialize dust effects for the agent
  protected initDustEffects(
    customOptions: Partial<{
      dustColor: number;
      dustSize: number;
      dustAlpha: number;
      dustCount: number;
      dustInterval: number;
      dustLifetime: number;
      movementDustColor: number;
      movementDustSize: number;
      movementDustAlpha: number;
      movementDustCount: number;
    }> = {}
  ): void {
    const options = {
      dustColor: DUST_COLOR,
      dustSize: 5,
      dustAlpha: 0.6,
      dustCount: 10,
      dustInterval: 80,
      dustLifetime: 900,
      movementDustColor: DUST_COLOR,
      movementDustSize: 4,
      movementDustAlpha: 0.7,
      movementDustCount: 8,
      ...customOptions,
    };

    this.dustEffects = new DustEffects(this.scene, this.sprite, options);
  }

  // Initialize shadow effects for the agent
  protected initShadowEffects(
    customOptions: Partial<{
      shadowColor: number;
      shadowAlpha: number;
      shadowScale: number;
      shadowOffsetX: number;
      shadowOffsetY: number;
      shadowTexture: string;
      debug: boolean;
    }> = {}
  ): void {
    const options = {
      shadowColor: 0x000000,
      shadowAlpha: 0.2,
      shadowScale: 4.0,
      shadowOffsetX: 0,
      shadowOffsetY: TILE_SIZE / 2,
      debug: false,
      ...customOptions,
    };

    this.shadowEffects = new ShadowEffects(this.scene, this.sprite, options);
  }

  // Initialize shield for the agent
  public initShield(maxShield: number, shieldColor: number = 0x0088ff): void {
    this.maxShield = maxShield;
    this.shield = maxShield;
    this.shieldActive = true;
    this.shieldColor = shieldColor;

    // Create shield visual effect
    this.createShieldEffect();

    // Update health bar if it exists to show shield
    if (this.healthBar) {
      const healthBarRenderer = new HealthBarRenderer(this.scene);
      healthBarRenderer.updateHealthBar(this.healthBar, this);
    }
  }

  // Create visual shield effect
  private createShieldEffect(): void {
    if (this.shieldEffect) {
      this.shieldEffect.destroy();
    }

    // Get sprite dimensions
    let width = 64;
    let height = 64;

    if (this.sprite instanceof Phaser.Physics.Arcade.Sprite) {
      width = this.sprite.displayWidth;
      height = this.sprite.displayHeight;
    } else if (this.sprite instanceof Phaser.GameObjects.Container) {
      // Estimate size for container
      width = 64;
      height = 64;
    }

    // Create ellipse for shield effect
    this.shieldEffect = this.scene.add.ellipse(
      0,
      0,
      width * 1.4,
      height * 1.4,
      this.shieldColor,
      0.2
    );
    this.shieldEffect.setStrokeStyle(2, this.shieldColor, 0.8);

    // Set depth to be higher than sprite (sprite depth is typically 10)
    this.shieldEffect.setDepth(15);

    // Initially invisible until taking damage
    this.shieldEffect.setVisible(false);

    // Update shield position
    this.updateShieldPosition();
  }

  // Update shield position to follow the agent
  protected updateShieldPosition(): void {
    if (!this.shieldEffect || !this.shieldActive) return;

    const pos = this.getPosition();
    this.shieldEffect.setPosition(pos.x, pos.y);

    // Check if shield should be visible based on timer
    const currentTime = this.scene.time.now;
    const showShield =
      this.shield > 0 && currentTime < this.shieldVisibilityTimer;

    if (showShield) {
      // Make shield visible with pulse effect
      this.shieldEffect.setVisible(true);

      // Calculate fade based on time remaining
      const timeRemaining = this.shieldVisibilityTimer - currentTime;
      const alpha = Math.min(0.7, timeRemaining / 100); // Fade out as timer expires

      this.shieldEffect.setAlpha(alpha);

      // Pulse effect
      const pulseFactor = 0.1;
      const pulseSpeed = 2;
      const time = currentTime / 1000;
      const pulse = 1 + pulseFactor * Math.sin(pulseSpeed * time);

      this.shieldEffect.setScale(pulse, pulse);
    } else {
      // Hide shield if inactive, depleted, or timer expired
      this.shieldEffect.setVisible(false);
    }
  }

  // Get the current position of the agent
  protected getPosition(): { x: number; y: number } {
    if (this.sprite instanceof Phaser.Physics.Arcade.Sprite) {
      return { x: this.sprite.x, y: this.sprite.y };
    } else if (this.sprite instanceof Phaser.GameObjects.Container) {
      return { x: this.sprite.x, y: this.sprite.y };
    }
    return { x: 0, y: 0 };
  }

  // Get the current health - renamed to match HasHealth interface
  public getCurrentHealth(): number {
    return this.health;
  }

  // Get the maximum health - already matches HasHealth interface
  public getMaxHealth(): number {
    return this.maxHealth;
  }

  // Set the health - added to match HasHealth interface
  public setHealth(value: number): void {
    this.health = Math.max(0, Math.min(value, this.maxHealth));

    // Check if agent is dead
    if (this.health <= 0) {
      this.onDeath();
    }
  }

  // Take damage - renamed to match HasHealth interface
  public damage(amount: number): void {
    // If shield is active, damage shield first
    if (this.shieldActive && this.shield > 0) {
      this.damageShield(amount);
      return;
    }

    // Otherwise damage health
    this.health = Math.max(0, this.health - amount);

    // Check if agent is dead
    if (this.health <= 0) {
      this.onDeath();
    }

    // Update health bar if it exists
    if (this.healthBar) {
      const healthBarRenderer = new HealthBarRenderer(this.scene);
      healthBarRenderer.updateHealthBar(this.healthBar, this);
    }
  }

  // Heal the agent - already matches HasHealth interface
  public heal(amount: number): void {
    this.health = Math.min(this.maxHealth, this.health + amount);

    // Update health bar if it exists
    if (this.healthBar) {
      const healthBarRenderer = new HealthBarRenderer(this.scene);
      healthBarRenderer.updateHealthBar(this.healthBar, this);
    }
  }

  // Check if the agent is alive - already matches HasHealth interface
  public isAlive(): boolean {
    return this.health > 0;
  }

  // Shield-related methods from HasHealth interface
  public hasShield(): boolean {
    return this.shieldActive;
  }

  public getMaxShield(): number {
    return this.maxShield;
  }

  public getCurrentShield(): number {
    return this.shield;
  }

  public setShield(value: number): void {
    this.shield = Math.max(0, Math.min(value, this.maxShield));
  }

  public damageShield(amount: number): void {
    // Only process if shield is active
    if (!this.shieldActive) return;

    const previousShield = this.shield;
    this.shield = Math.max(0, this.shield - amount);

    // Show shield effect when taking damage
    this.shieldVisibilityTimer =
      this.scene.time.now + this.shieldVisibilityDuration;

    // If shield is depleted, apply remaining damage to health
    if (previousShield > 0 && this.shield === 0) {
      const remainingDamage = amount - previousShield;
      if (remainingDamage > 0) {
        this.health = Math.max(0, this.health - remainingDamage);

        // Check if agent is dead
        if (this.health <= 0) {
          this.onDeath();
        }
      }
    }

    // Update health bar if it exists
    if (this.healthBar) {
      const healthBarRenderer = new HealthBarRenderer(this.scene);
      healthBarRenderer.updateHealthBar(this.healthBar, this);
    }
  }

  public rechargeShield(amount: number): void {
    if (this.shieldActive) {
      this.shield = Math.min(this.maxShield, this.shield + amount);

      // Update health bar if it exists
      if (this.healthBar) {
        const healthBarRenderer = new HealthBarRenderer(this.scene);
        healthBarRenderer.updateHealthBar(this.healthBar, this);
      }
    }
  }

  // Get the sprite or container
  public getSprite():
    | Phaser.Physics.Arcade.Sprite
    | Phaser.GameObjects.Container {
    return this.sprite;
  }

  // Set the health bar for the agent
  public setHealthBar(healthBar: Phaser.GameObjects.Container): void {
    this.healthBar = healthBar;

    // Update health bar position and visibility immediately
    this.updateHealthBarPosition();
  }

  // Get the health bar
  public getHealthBar(): Phaser.GameObjects.Container | null {
    return this.healthBar;
  }

  // Update the position of the health bar to follow the agent
  protected updateHealthBarPosition(): void {
    if (this.healthBar) {
      const pos = this.getPosition();
      this.healthBar.setPosition(pos.x, pos.y - 30); // Position above the agent

      // Update health bar visibility based on health status
      const healthBarRenderer = new HealthBarRenderer(this.scene);
      healthBarRenderer.updateHealthBar(this.healthBar, this);
    }
  }

  // Equip a tool
  public equipTool(tool: Tool): void {
    // Unequip current tool if any
    if (this.equippedTool) {
      this.equippedTool.hide();
    }

    this.equippedTool = tool;

    // Update tool position
    this.updateToolPosition();
  }

  // Get the equipped tool
  public getEquippedTool(): Tool | null {
    return this.equippedTool;
  }

  // Update tool position based on agent position
  protected updateToolPosition(): void {
    if (!this.equippedTool) return;

    const spriteX =
      this.sprite instanceof Phaser.GameObjects.Container
        ? this.sprite.x
        : (this.sprite as Phaser.Physics.Arcade.Sprite).x;

    const spriteY =
      this.sprite instanceof Phaser.GameObjects.Container
        ? this.sprite.y
        : (this.sprite as Phaser.Physics.Arcade.Sprite).y;

    // Show the tool at the agent's position
    this.equippedTool.show(spriteX, spriteY);
  }

  // Fire the equipped tool
  public fireTool(
    targetX: number,
    targetY: number,
    isPlayer: boolean = false
  ): void {
    if (!this.equippedTool || !this.isAlive()) return;

    const currentTime = this.scene.time.now;

    // Make sure the laser pointer is updated with the target position
    // This ensures the tool knows where to aim
    const spriteX =
      this.sprite instanceof Phaser.GameObjects.Container
        ? this.sprite.x
        : (this.sprite as Phaser.Physics.Arcade.Sprite).x;

    const spriteY =
      this.sprite instanceof Phaser.GameObjects.Container
        ? this.sprite.y
        : (this.sprite as Phaser.Physics.Arcade.Sprite).y;

    // Update the laser pointer to the target position
    this.equippedTool.updateLaserPointer(
      spriteX,
      spriteY,
      targetX,
      targetY,
      isPlayer
    );

    // Check if the weapon can fire based on its burst logic
    if (this.equippedTool.canFire(currentTime)) {
      // Update the burst state
      this.equippedTool.updateBurstState(currentTime);

      // Fire the tool
      this.equippedTool.fire(isPlayer);
    }
  }

  // Update dust effects
  protected updateDustEffects(time: number): void {
    if (this.dustEffects) {
      this.dustEffects.update(time);
    }
  }

  // Update shadow effects
  protected updateShadowEffects(): void {
    if (this.shadowEffects) {
      this.shadowEffects.update();
    }
  }

  // Clean up dust effects
  protected cleanupDustEffects(): void {
    if (this.dustEffects) {
      this.dustEffects.destroy();
      this.dustEffects = null;
    }
  }

  // Clean up shadow effects
  protected cleanupShadowEffects(): void {
    if (this.shadowEffects) {
      this.shadowEffects.destroy();
      this.shadowEffects = null;
    }
  }

  // Clean up shield effect
  protected cleanupShieldEffect(): void {
    if (this.shieldEffect) {
      this.shieldEffect.destroy();
      this.shieldEffect = null;
    }
  }

  // Destroy the agent
  public destroy(): void {
    // Clean up shield effect
    this.cleanupShieldEffect();

    // Clean up dust effects
    this.cleanupDustEffects();
    this.cleanupShadowEffects();

    // Clean up health bar
    if (this.healthBar) {
      this.healthBar.destroy();
      this.healthBar = null;
    }

    // Clean up equipped tool
    if (this.equippedTool) {
      this.equippedTool.destroy();
      this.equippedTool = null;
    }

    // Destroy the sprite
    if (this.sprite) {
      this.sprite.destroy();
    }
  }

  // For backward compatibility
  public getHealth(): number {
    return this.getCurrentHealth();
  }

  // For backward compatibility
  public takeDamage(amount: number): void {
    // Directly modify health instead of calling damage to avoid recursion
    this.health = Math.max(0, this.health - amount);

    // Check if agent is dead
    if (this.health <= 0) {
      this.onDeath();
    }
  }

  // Abstract method to be implemented by subclasses
  protected abstract onDeath(): void;

  // Abstract method for updating the agent
  public abstract update(time: number, delta: number): void;
}
