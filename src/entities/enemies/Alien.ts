import * as Phaser from "phaser";
import { Enemy, EnemyState } from "./Enemy";
import { TILE_SIZE } from "../../constants";
import { Tool, ToolType } from "../tools";
import { Robot } from "../robots/Robot";
import { HealthBarRenderer } from "../../interfaces/Health";

export class Alien extends Enemy {
  private hoverOffset: number = 0;
  private hoverSpeed: number = 0.05;
  private hoverAmplitude: number = 10;
  private raygun: Tool | null = null;
  private burstCount: number = 0;
  private maxBurstCount: number = 3;
  private burstDelay: number = 200; // ms between shots in a burst
  private burstCooldown: number = 3000; // ms between bursts
  private lastBurstTime: number = 0;
  private imprecisionFactor: number = 50; // pixels of random deviation
  private hasShieldEquipped: boolean = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    maxHealth: number = 80,
    speed: number = 70,
    attackRange: number = 400,
    attackDamage: number = 15,
    attackCooldown: number = 500
  ) {
    super(
      scene,
      x,
      y,
      "alien",
      maxHealth,
      speed,
      attackRange,
      attackDamage,
      attackCooldown
    );

    // Create the physics body for the alien
    if (this.sprite instanceof Phaser.Physics.Arcade.Sprite) {
      try {
        // Enable physics on the sprite
        scene.physics.world.enable(this.sprite);

        // Set up the physics body
        if (this.sprite.body) {
          // Set a circular body for better collision detection
          (this.sprite.body as Phaser.Physics.Arcade.Body).setCircle(
            this.sprite.width / 3,
            this.sprite.width / 3,
            this.sprite.height / 3
          );
        } else {
          console.error("Alien sprite body is null or undefined!");
        }
      } catch (error) {
        console.error("Failed to create Alien sprite as Arcade.Sprite!");
      }
    }

    // Create the raygun tool
    this.raygun = new Tool(ToolType.RAYGUN, "Alien Raygun", scene, "raygun");
    this.equippedTool = this.raygun;

    // Create hover effect using a tween
    this.createHoverEffect();

    // Set a random starting point for the hover effect
    this.hoverOffset = Math.random() * Math.PI * 2;

    // Set a random initial burst time
    this.lastBurstTime = scene.time.now - Math.random() * this.burstCooldown;

    // Randomly decide if this alien has a shield (30% chance)
    this.hasShieldEquipped = Math.random() < 0.3;

    // Initialize shield for aliens with red color if they have one
    if (this.hasShieldEquipped) {
      this.initShield(40, 0xff0088); // Red shield for aliens
    }
  }

  private createHoverEffect(): void {
    if (this.sprite) {
      // Store the initial position
      const initialY = this.sprite.y;

      // Create a tween that moves the sprite up and down
      this.scene.tweens.add({
        targets: this.sprite,
        y: {
          value: initialY + this.hoverAmplitude,
          ease: "Sine.easeInOut",
        },
        duration: 1500,
        yoyo: true,
        repeat: -1,
      });
    }
  }

  public update(time: number, delta: number): void {
    // Call the parent update method
    super.update(time, delta);

    // Update the raygun position
    this.updateToolPosition();

    // Try to fire at the target if in attacking state
    if (this.enemyState === EnemyState.ATTACKING && this.target) {
      this.tryToFireAtTarget(time);
    }

    // Slowly recharge shield over time (0.25 points per second) if shield is equipped
    if (this.hasShield() && this.getCurrentShield() < this.getMaxShield()) {
      this.rechargeShield(delta / 4000); // Quarter the rate of player

      // Update health bar to reflect shield changes
      if (this.healthBar) {
        const healthBarRenderer = new HealthBarRenderer(this.scene);
        healthBarRenderer.updateHealthBar(this.healthBar, this);
      }
    }
  }

  protected attackTarget(): void {
    // Aliens attack by firing their raygun
    // The actual firing is handled in tryToFireAtTarget
  }

  private tryToFireAtTarget(time: number): void {
    // Only fire if we have a raygun and a target
    if (!this.raygun || !this.target) return;

    // Check if cooldown has passed
    if (time - this.lastAttackTime >= this.attackCooldown) {
      // Fire the raygun
      this.raygun.fire(false); // Pass false for isPlayer

      // Increment burst count
      this.burstCount++;

      // Reset attack time
      this.lastAttackTime = time;

      // If we've fired the maximum number of shots in this burst, add a longer cooldown
      if (this.burstCount >= this.maxBurstCount) {
        this.lastAttackTime = time + this.burstCooldown - this.attackCooldown;
        this.burstCount = 0;
      }
    }
  }

  protected updateToolPosition(): void {
    if (!this.equippedTool || !this.target) return;

    // Position the tool at the alien's position
    this.equippedTool.updatePosition(this.sprite.x, this.sprite.y);

    // Calculate angle to target
    const angle = Phaser.Math.Angle.Between(
      this.sprite.x,
      this.sprite.y,
      this.target.x,
      this.target.y
    );

    // Set the tool's rotation
    this.equippedTool.setRotation(angle);

    // Update the laser pointer
    this.equippedTool.updateLaserPointer(
      this.sprite.x,
      this.sprite.y,
      this.target.x,
      this.target.y,
      false // Pass false for isPlayer
    );
  }

  public getEnemyName(): string {
    return "Alien";
  }

  // Override the destroy method to clean up the raygun
  public destroy(): void {
    // Call the parent destroy method
    super.destroy();
  }

  // Override onDeath to clean up shield
  protected onDeath(): void {
    // Remove shield if it exists
    if (this.hasShieldEquipped) {
      this.cleanupShieldEffect();
    }

    // Call the parent onDeath method
    super.onDeath();
  }
}
