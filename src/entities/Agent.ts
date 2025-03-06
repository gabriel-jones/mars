import * as Phaser from "phaser";
import { DustEffects } from "../effects/DustEffects";
import { ShadowEffects } from "../effects/ShadowEffects";
import { DUST_COLOR, TILE_SIZE } from "../constants";

// Base Agent class for all entities with health (player, robots, enemies)
export abstract class Agent {
  protected scene: Phaser.Scene;
  protected sprite: Phaser.Physics.Arcade.Sprite | Phaser.GameObjects.Container;
  protected health: number;
  protected maxHealth: number;
  protected dustEffects: DustEffects | null = null;
  protected shadowEffects: ShadowEffects | null = null;

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

  // Get the current health
  public getHealth(): number {
    return this.health;
  }

  // Get the maximum health
  public getMaxHealth(): number {
    return this.maxHealth;
  }

  // Take damage
  public takeDamage(amount: number): void {
    this.health = Math.max(0, this.health - amount);

    // Check if agent is dead
    if (this.health <= 0) {
      this.onDeath();
    }
  }

  // Heal the agent
  public heal(amount: number): void {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  // Check if the agent is alive
  public isAlive(): boolean {
    return this.health > 0;
  }

  // Get the sprite or container
  public getSprite():
    | Phaser.Physics.Arcade.Sprite
    | Phaser.GameObjects.Container {
    return this.sprite;
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

  // Clean up all resources
  public destroy(): void {
    this.cleanupDustEffects();
    this.cleanupShadowEffects();

    // Destroy the sprite if it's not already part of a container
    if (this.sprite instanceof Phaser.Physics.Arcade.Sprite) {
      this.sprite.destroy();
    } else if (this.sprite instanceof Phaser.GameObjects.Container) {
      this.sprite.destroy();
    }
  }

  // Abstract method to be implemented by subclasses
  protected abstract onDeath(): void;

  // Abstract method for updating the agent
  public abstract update(time: number, delta: number): void;
}
