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
      speed,
      maxHealth,
      attackRange,
      attackDamage,
      attackCooldown,
      300
    );

    // Set a random starting point for the hover effect
    this.hoverOffset = Math.random() * Math.PI * 2;

    // Set up the sprite for proper collision detection
    if (this.sprite instanceof Phaser.Physics.Arcade.Sprite) {
      this.sprite.setDisplaySize(TILE_SIZE, TILE_SIZE);
      this.sprite.setSize(TILE_SIZE * 0.8, TILE_SIZE * 0.8); // Slightly smaller hitbox than visual size

      // Check if body exists before accessing its properties
      if (this.sprite.body) {
        this.sprite.body.setOffset(TILE_SIZE * 0.1, TILE_SIZE * 0.1); // Center the hitbox

        // Make sure the physics body is enabled
        this.sprite.body.enable = true;

        console.log(`Alien physics body enabled: ${this.sprite.body.enable}`);
        console.log(
          `Alien physics body dimensions: ${this.sprite.body.width}x${this.sprite.body.height}`
        );
      } else {
        console.error("Alien sprite body is null or undefined!");
      }

      console.log(`Alien created at ${x}, ${y} with physics body enabled`);
    } else {
      console.error("Failed to create Alien sprite as Arcade.Sprite!");
    }

    // Create and equip a raygun
    this.raygun = new Tool(ToolType.RAYGUN, "Alien Raygun", scene, "raygun");
    this.equipTool(this.raygun);

    // Set a random initial burst time
    this.lastBurstTime = scene.time.now - Math.random() * this.burstCooldown;

    // Randomly decide if this alien has a shield (30% chance)
    this.hasShieldEquipped = Math.random() < 0.3;

    // Initialize shield for aliens with red color if they have one
    if (this.hasShieldEquipped) {
      this.initShield(40, 0xff0088); // Red shield for aliens
    }
  }

  public update(time: number, delta: number): void {
    // Skip update if alien is dead
    if (!this.isAlive()) return;

    // Find the closest target (player or robot)
    this.findClosestTarget();

    // Log the current state occasionally
    if (Math.random() < 0.01) {
      console.log(
        `Alien state: ${this.enemyState}, has target: ${!!this
          .target}, has tool: ${!!this.equippedTool}, attack range: ${
          this.attackRange
        }`
      );
    }

    // Call the parent update method
    super.update(time, delta);

    // Add hover effect only if alive
    if (this.isAlive() && this.enemyState !== EnemyState.DEAD) {
      this.applyHoverEffect(time);

      // Update tool position and rotation
      this.updateToolPosition();

      // Update shield position
      this.updateShieldPosition();

      // If in attack state and has a target, try to fire more aggressively
      if (this.enemyState === EnemyState.ATTACKING && this.target) {
        // Try to fire at the target
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
  }

  // Override the abstract attackTarget method from Enemy class
  protected attackTarget(): void {
    // Use the tryToFireAtTarget method which uses the raygun tool
    this.tryToFireAtTarget(this.scene.time.now);

    // Log that the alien is attacking
    if (this.target) {
      console.log(
        `Alien attacking target at (${this.target.x}, ${this.target.y})`
      );
    }
  }

  // Try to fire the raygun at the target
  private tryToFireAtTarget(time: number): void {
    if (!this.target || !this.equippedTool) {
      console.log(
        `Alien can't fire: ${!this.target ? "No target" : "No equipped tool"}`
      );
      return;
    }

    console.log(
      `Alien firing raygun at target (${this.target.x}, ${this.target.y})`
    );

    // Calculate angle to target
    const spriteX = (this.sprite as Phaser.Physics.Arcade.Sprite).x;
    const spriteY = (this.sprite as Phaser.Physics.Arcade.Sprite).y;
    const angle = Phaser.Math.Angle.Between(
      spriteX,
      spriteY,
      this.target.x,
      this.target.y
    );

    // Update tool rotation to face the target
    if (this.equippedTool) {
      this.equippedTool.setRotation(angle);
    }

    // Check if enough time has passed since the last burst
    if (time - this.lastBurstTime >= this.burstCooldown) {
      // Start a new burst
      this.burstCount = 0;
      this.lastBurstTime = time;
    }

    // Check if we're in the middle of a burst and if enough time has passed since the last shot
    if (
      this.burstCount < this.maxBurstCount &&
      time - this.lastBurstTime - this.burstCount * this.burstDelay >=
        this.burstDelay
    ) {
      // Calculate distance to target for accuracy adjustment
      const distance = Phaser.Math.Distance.Between(
        spriteX,
        spriteY,
        this.target.x,
        this.target.y
      );

      // Reduce imprecision at closer ranges
      const adjustedImprecision = Math.min(
        this.imprecisionFactor,
        this.imprecisionFactor * (distance / this.attackRange)
      );

      // Add some randomness to the target position (less randomness at closer ranges)
      const targetX =
        this.target.x + (Math.random() - 0.5) * adjustedImprecision;
      const targetY =
        this.target.y + (Math.random() - 0.5) * adjustedImprecision;

      // Fire the tool
      this.fireTool(targetX, targetY);

      // Increment the burst count
      this.burstCount++;
    }
  }

  // Override the updateToolPosition method to position the tool correctly
  protected updateToolPosition(): void {
    if (!this.equippedTool) return;

    const spriteX = (this.sprite as Phaser.Physics.Arcade.Sprite).x;
    const spriteY = (this.sprite as Phaser.Physics.Arcade.Sprite).y;

    // Show the tool at the alien's position
    this.equippedTool.show(spriteX, spriteY, false); // Pass false for isPlayer

    // If we have a target, update the laser pointer
    if (this.target) {
      this.equippedTool.updateLaserPointer(
        spriteX,
        spriteY,
        this.target.x,
        this.target.y,
        false // Pass false for isPlayer
      );
    }
  }

  // Apply a hovering effect to make the UFO float up and down
  private applyHoverEffect(time: number): void {
    // Calculate vertical offset based on time
    const verticalOffset =
      Math.sin(time * this.hoverSpeed + this.hoverOffset) * this.hoverAmplitude;

    // Apply the offset to the sprite's y position
    const sprite = this.sprite as Phaser.Physics.Arcade.Sprite;

    // Check if sprite.body exists before accessing it
    if (sprite.body) {
      const currentVelocity = sprite.body.velocity;

      // Only apply the hover effect if the UFO is not moving too fast
      if (Math.abs(currentVelocity.y) < 50) {
        // Add a small vertical velocity component for the hover effect
        // This won't override the main movement velocity, just add to it
        sprite.body.velocity.y += verticalOffset / 10;
      }
    }
  }

  // Get the enemy name
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
    // Clean up shield effect
    this.cleanupShieldEffect();

    // Call parent onDeath
    super.onDeath();
  }
}
