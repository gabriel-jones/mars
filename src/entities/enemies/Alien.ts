import * as Phaser from "phaser";
import { Enemy, EnemyState } from "./Enemy";
import { TILE_SIZE } from "../../constants";

export class Alien extends Enemy {
  private hoverOffset: number = 0;
  private hoverSpeed: number = 0.05;
  private hoverAmplitude: number = 10;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    maxHealth: number = 80,
    speed: number = 70,
    attackRange: number = 120,
    attackDamage: number = 15,
    attackCooldown: number = 1500
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
      200 // Preferred shooting distance - aliens will stop 200 pixels away from target
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
      }

      console.log(`Alien created at ${x}, ${y} with physics body enabled`);
    }
  }

  public update(time: number, delta: number): void {
    // Call the parent update method
    super.update(time, delta);

    // Add hover effect only if alive
    if (this.isAlive() && this.enemyState !== EnemyState.DEAD) {
      this.applyHoverEffect(time);
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
}
