import * as Phaser from "phaser";
import { Enemy, EnemyState } from "./Enemy";
import { TILE_SIZE } from "../../constants";
import { Tool, ToolType } from "../tools";
import { Robot } from "../robots/Robot";
import { HealthBarRenderer } from "../../interfaces/Health";
import { DEPTH } from "../../depth";
import { ENEMY_IMPRECISION_FACTOR } from "../../constants";

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
  private imprecisionFactor: number = ENEMY_IMPRECISION_FACTOR; // pixels of random deviation
  private hasShieldEquipped: boolean = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    maxHealth: number = 80,
    speed: number = 120, // Increased speed to make aliens more aggressive
    attackRange: number = 450,
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
      attackCooldown,
      200, // Reduced preferredShootingDistance to make aliens get closer
      600 // maxShootingRange - aliens cannot shoot beyond this distance
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
        console.error("Failed to create Alien sprite as Arcade.Sprite!", error);
      }
    } else {
      console.error("Alien sprite is not an Arcade.Sprite!");
    }

    // Initialize last position to current position to avoid immediate stuck detection
    this.lastPosition = { x: x, y: y };

    // Create the raygun tool
    this.raygun = new Tool(ToolType.RAYGUN, "Alien Raygun", scene, "raygun");
    this.equippedTool = this.raygun;

    // Ensure the raygun is visible
    if (this.raygun) {
      // Calculate initial hand position
      const handPosition = this.calculateHandPosition(0);
      this.raygun.show(handPosition.x, handPosition.y, false);
    }

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

    // Immediately start looking for targets
    this.findClosestTarget();

    // Force into attacking state to make aliens more aggressive
    this.enemyState = EnemyState.ATTACKING;
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

    // Update hover effect
    this.updateHoverEffect();

    // Update tool position
    this.updateToolPosition();

    // Try to find a target if we don't have one
    if (!this.target) {
      this.findClosestTarget();
      console.log("Alien looking for target");
    }

    // Always try to fire at target if we have one
    if (this.target) {
      // Ensure we're always trying to fire if we have a target
      this.tryToFireAtTarget(time);

      // Log target information for debugging
      console.log(
        `Alien targeting: (${this.target.x}, ${this.target.y}), state: ${this.enemyState}`
      );
    }

    // If we're stuck in the same position for too long, try to move randomly
    // Only check if stuck if the sprite and body exist
    if (this.sprite && (this.sprite as Phaser.Physics.Arcade.Sprite).body) {
      this.checkIfStuck(delta);
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
    // Directly call tryToFireAtTarget to ensure aliens shoot
    this.tryToFireAtTarget(this.scene.time.now);

    // Log that we're attempting to attack
    console.log(`Alien attackTarget called, attempting to fire raygun`);
  }

  // Calculate the position of the alien's hand based on the angle to target
  private calculateHandPosition(angle: number): { x: number; y: number } {
    if (!this.sprite) {
      return { x: 0, y: 0 };
    }

    // Determine which side to place the weapon based on the angle
    const normalizedAngle = Phaser.Math.Angle.Normalize(angle);
    const isRightSide =
      normalizedAngle > Math.PI * 0.5 && normalizedAngle < Math.PI * 1.5;

    // Offset from center (distance from alien center to hand)
    const handOffset = 30;

    // Calculate the hand position based on which side the weapon should be on
    let handX, handY;
    if (isRightSide) {
      // Place on right side (90 degrees offset from facing direction)
      handX = this.sprite.x + Math.cos(angle + Math.PI / 2) * handOffset;
      handY = this.sprite.y + Math.sin(angle + Math.PI / 2) * handOffset;
    } else {
      // Place on left side (270 degrees offset from facing direction)
      handX = this.sprite.x + Math.cos(angle - Math.PI / 2) * handOffset;
      handY = this.sprite.y + Math.sin(angle - Math.PI / 2) * handOffset;
    }

    return { x: handX, y: handY };
  }

  protected updateToolPosition(): void {
    if (!this.equippedTool || !this.sprite) return;

    // If we don't have a target, hide the tool and return
    if (!this.target) {
      this.equippedTool.hide();
      return;
    }

    // Calculate angle to target
    const angle = Phaser.Math.Angle.Between(
      this.sprite.x,
      this.sprite.y,
      this.target.x,
      this.target.y
    );

    // Get the hand position
    const handPosition = this.calculateHandPosition(angle);

    // Position the tool at the calculated hand position
    this.equippedTool.updatePosition(handPosition.x, handPosition.y);

    // Set the tool's rotation
    this.equippedTool.setRotation(angle);

    // Flip the tool sprite if facing left
    // The sprite is facing right by default, so flip if angle is in left hemisphere
    const shouldFlip = Math.abs(angle) > Math.PI / 2;
    this.equippedTool.setFlipX(shouldFlip);

    // Always show the raygun when in attacking state and we have a target
    if (this.enemyState === EnemyState.ATTACKING) {
      this.equippedTool.show(handPosition.x, handPosition.y, false);

      // Update the laser pointer to show targeting
      if (this.target) {
        this.equippedTool.updateLaserPointer(
          handPosition.x,
          handPosition.y,
          this.target.x,
          this.target.y,
          false // Pass false for isPlayer
        );
      }
    } else {
      this.equippedTool.hide();
    }
  }

  private tryToFireAtTarget(time: number): void {
    // Only fire if we have a raygun and a target
    if (!this.raygun || !this.target || !this.sprite) {
      console.log("Alien not firing: no raygun or target");
      return;
    }

    // Calculate distance to target
    const distance = Phaser.Math.Distance.Between(
      this.sprite.x,
      this.sprite.y,
      this.target.x,
      this.target.y
    );

    // Only fire if within maximum shooting range
    if (distance > this.maxShootingRange) {
      console.log(
        `Alien not firing: target beyond maximum shooting range (${distance.toFixed(
          2
        )}/${this.maxShootingRange})`
      );
      return;
    }

    // Check if cooldown has passed
    const cooldownPassed = time - this.lastAttackTime >= this.attackCooldown;
    if (!cooldownPassed) {
      console.log(
        `Alien waiting for cooldown: ${time - this.lastAttackTime}/${
          this.attackCooldown
        }`
      );
      return;
    }

    // We're ready to fire!
    console.log(
      `Alien firing at target at (${this.target.x}, ${
        this.target.y
      }), distance: ${distance.toFixed(2)}`
    );

    // Calculate angle to target
    const angle = Phaser.Math.Angle.Between(
      this.sprite.x,
      this.sprite.y,
      this.target.x,
      this.target.y
    );

    // Get the hand position
    const handPosition = this.calculateHandPosition(angle);

    // Make sure the raygun is visible before firing
    this.raygun.show(handPosition.x, handPosition.y, false);

    // Fire the raygun directly
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

  public getEnemyName(): string {
    return "Alien";
  }

  // Override the destroy method to clean up the raygun
  public destroy(): void {
    // Hide the raygun before destroying
    if (this.equippedTool) {
      this.equippedTool.hide();
    }

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

  // Track position to detect if stuck
  private lastPosition = { x: 0, y: 0 };
  private stuckTime = 0;
  private stuckThreshold = 2000; // 2 seconds

  // Check if the alien is stuck in the same position
  private checkIfStuck(delta: number): void {
    // Ensure sprite exists
    if (!this.sprite) {
      return;
    }

    const currentX = this.sprite.x;
    const currentY = this.sprite.y;

    // Calculate distance moved since last check
    const distanceMoved = Phaser.Math.Distance.Between(
      currentX,
      currentY,
      this.lastPosition.x,
      this.lastPosition.y
    );

    // If barely moved, increment stuck time
    if (distanceMoved < 1) {
      this.stuckTime += delta;

      // If stuck for too long, apply a random movement
      if (this.stuckTime > this.stuckThreshold) {
        const randomAngle = Math.random() * Math.PI * 2;
        const velocityX = Math.cos(randomAngle) * this.speed;
        const velocityY = Math.sin(randomAngle) * this.speed;

        // Get the sprite with proper type
        const sprite = this.sprite as Phaser.Physics.Arcade.Sprite;

        // Check if sprite and body exist before setting velocity
        if (sprite && sprite.body) {
          sprite.setVelocity(velocityX, velocityY);
          console.log(
            "Unstuck alien by applying random velocity:",
            velocityX,
            velocityY
          );
        } else {
          console.warn("Cannot set velocity: sprite or body is undefined");
        }

        // Reset stuck time
        this.stuckTime = 0;
      }
    } else {
      // Reset stuck time if moving
      this.stuckTime = 0;
    }

    // Update last position
    this.lastPosition = { x: currentX, y: currentY };
  }

  // Update the hover effect each frame
  private updateHoverEffect(): void {
    // Update hover offset
    this.hoverOffset += this.hoverSpeed;

    // Apply hover effect to sprite
    if (this.sprite) {
      const hoverY = Math.sin(this.hoverOffset) * this.hoverAmplitude;
      this.sprite.setY(this.sprite.y + hoverY - this.sprite.displayHeight / 2);
    }
  }
}
