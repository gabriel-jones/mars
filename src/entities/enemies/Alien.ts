import * as Phaser from "phaser";
import { Enemy, EnemyState } from "./Enemy";
import { TILE_SIZE } from "../../constants";
import { Tool, ToolType } from "../tools";
import { Robot } from "../robots/Robot";
import { HealthBarRenderer } from "../../interfaces/Health";
import { DEPTH } from "../../depth";
import { ENEMY_IMPRECISION_FACTOR } from "../../constants";

export class Alien extends Enemy {
  private raygun: Tool | null = null;
  private burstCount: number = 0;
  private maxBurstCount: number = 3;
  private burstDelay: number = 200; // ms between shots in a burst
  private burstCooldown: number = 2000; // Reduced cooldown between bursts for more aggression
  private lastBurstTime: number = 0;
  private imprecisionFactor: number = ENEMY_IMPRECISION_FACTOR; // pixels of random deviation
  private hasShieldEquipped: boolean = false;
  private targetUpdateInterval: number = 500; // Update target more frequently
  private lastTargetUpdateTime: number = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    maxHealth: number = 80,
    speed: number = 150, // Increased speed to make aliens more aggressive
    attackRange: number = 450,
    attackDamage: number = 15,
    attackCooldown: number = 400 // Reduced cooldown for more frequent attacks
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
      250, // Preferred shooting distance - closer to targets
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
            this.sprite.width / 2.5, // Increased from width/3 for better collision
            this.sprite.width / 4, // Adjusted x offset
            this.sprite.height / 4 // Adjusted y offset
          );

          // Enable continuous collision detection
          (
            this.sprite.body as Phaser.Physics.Arcade.Body
          ).setCollideWorldBounds(true);
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

    // Set a random initial burst time
    this.lastBurstTime = scene.time.now - Math.random() * this.burstCooldown;

    // Randomly decide if this alien has a shield (30% chance)
    this.hasShieldEquipped = Math.random() < 0.3;

    // Initialize shield for aliens with red color if they have one
    if (this.hasShieldEquipped) {
      this.initShield(40, 0xff0088); // Red shield for aliens
    }

    // Make sure the sprite has the isEnemy flag for collision detection
    if (this.sprite) {
      (this.sprite as any).isEnemy = true;
      (this.sprite as any).enemyInstance = this;
    }

    // Find the closest target
    this.findClosestTarget();

    // Force into attacking state to make aliens more aggressive
    this.enemyState = EnemyState.ATTACKING;

    // Set initial target update time
    this.lastTargetUpdateTime = scene.time.now;
  }

  public update(time: number, delta: number): void {
    // First check if we're alive and have a sprite
    if (!this.isAlive() || !this.sprite) {
      return;
    }

    // Call the parent update method
    super.update(time, delta);

    // Get the current sprite position
    const spriteX = this.sprite.x;
    const spriteY = this.sprite.y;

    // CRITICAL: Update the label position
    if (this.label) {
      this.label.setPosition(spriteX, spriteY + 40);
      this.label.setVisible(true);
    }

    // CRITICAL: Update the state text position
    if (this.stateText) {
      this.stateText.setPosition(spriteX, spriteY + 55);
    }

    // CRITICAL: Update the health bar position
    if (this.healthBar) {
      this.healthBar.x = spriteX;
      this.healthBar.y = spriteY - 30;
      this.healthBar.setVisible(true);

      // Update health bar to reflect current health
      const healthBarRenderer = new HealthBarRenderer(this.scene);
      healthBarRenderer.updateHealthBar(this.healthBar, this);
    }

    // CRITICAL: Update the raygun position
    if (this.raygun) {
      // If we have a target, position the raygun correctly
      if (this.target) {
        // Calculate angle to target
        const angle = Phaser.Math.Angle.Between(
          spriteX,
          spriteY,
          this.target.x,
          this.target.y
        );

        // Get the hand position
        const handPosition = this.calculateHandPosition(angle);

        // Update the raygun position
        this.raygun.updatePosition(handPosition.x, handPosition.y);
        this.raygun.setRotation(angle);

        // Flip the raygun if facing left
        const shouldFlip = Math.abs(angle) > Math.PI / 2;
        this.raygun.setFlipX(shouldFlip);

        // Make sure the raygun is visible
        this.raygun.show(handPosition.x, handPosition.y, false);

        // Update the laser pointer
        this.raygun.updateLaserPointer(
          handPosition.x,
          handPosition.y,
          this.target.x,
          this.target.y,
          false
        );
      } else {
        // No target, hide the raygun
        this.raygun.hide();
      }
    }

    // Update shield position if we have one
    if (this.hasShield()) {
      this.updateShieldPosition();
    }

    // Regularly update target to ensure aliens are always pursuing the closest target
    if (time - this.lastTargetUpdateTime > this.targetUpdateInterval) {
      this.findClosestTarget();
      this.lastTargetUpdateTime = time;
    }

    // Always try to fire at target if we have one
    if (this.target) {
      // Ensure we're always trying to fire if we have a target
      this.tryToFireAtTarget(time);
    } else {
      // Always try to find a target if we don't have one
      this.findClosestTarget();
    }

    // If we're stuck in the same position for too long, try to move randomly
    // Only check if stuck if the sprite and body exist
    if (this.sprite && (this.sprite as Phaser.Physics.Arcade.Sprite).body) {
      this.checkIfStuck(delta);
    }

    // Slowly recharge shield over time (0.25 points per second) if shield is equipped
    if (this.hasShield() && this.getCurrentShield() < this.getMaxShield()) {
      this.rechargeShield(delta / 4000); // Quarter the rate of player
    }

    // Ensure we're always in attacking state when we have a target
    if (this.target && this.enemyState !== EnemyState.ATTACKING) {
      this.enemyState = EnemyState.ATTACKING;
    }
  }

  protected attackTarget(): void {
    // Aliens attack by firing their raygun
    // Directly call tryToFireAtTarget to ensure aliens shoot
    this.tryToFireAtTarget(this.scene.time.now);
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
    const handOffset = 20; // Reduced offset to keep raygun closer to alien

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
      return;
    }

    // Check if cooldown has passed
    const cooldownPassed = time - this.lastAttackTime >= this.attackCooldown;
    if (!cooldownPassed) {
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

  // Override findClosestTarget to prioritize the base and player
  protected findClosestTarget(): void {
    // Call the parent method to find initial targets
    super.findClosestTarget();

    // If we still don't have a target, force targeting the base
    if (!this.target) {
      // Get the base position from game state
      const gameState = (window as any).gameState;
      const base = gameState.base;

      if (base && base.position) {
        // Convert tile position to pixel position
        const baseX = base.position.x * TILE_SIZE + TILE_SIZE / 2;
        const baseY = base.position.y * TILE_SIZE + TILE_SIZE / 2;

        // Set the base as our target
        this.target = {
          x: baseX,
          y: baseY,
          active: true,
        } as any;

        // Ensure we're in attacking state
        this.enemyState = EnemyState.ATTACKING;
      }
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
  private stuckThreshold = 1000; // Reduced threshold to detect stuck aliens faster

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
        // If we have a target, try to move directly towards it with increased speed
        if (this.target) {
          const angle = Phaser.Math.Angle.Between(
            currentX,
            currentY,
            this.target.x,
            this.target.y
          );

          const velocityX = Math.cos(angle) * (this.speed * 2);
          const velocityY = Math.sin(angle) * (this.speed * 2);

          // Get the sprite with proper type
          const sprite = this.sprite as Phaser.Physics.Arcade.Sprite;

          // Check if sprite and body exist before setting velocity
          if (sprite && sprite.body) {
            sprite.setVelocity(velocityX, velocityY);
          }
        } else {
          // No target, use random movement
          const randomAngle = Math.random() * Math.PI * 2;
          const velocityX = Math.cos(randomAngle) * this.speed;
          const velocityY = Math.sin(randomAngle) * this.speed;

          // Get the sprite with proper type
          const sprite = this.sprite as Phaser.Physics.Arcade.Sprite;

          // Check if sprite and body exist before setting velocity
          if (sprite && sprite.body) {
            sprite.setVelocity(velocityX, velocityY);
          }
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

  // Ensure the raygun is properly initialized and visible
  private ensureRaygunInitialized(): void {
    if (!this.raygun || !this.sprite) {
      return;
    }

    // If we're in attacking state and have a target, make sure the raygun is visible
    if (this.enemyState === EnemyState.ATTACKING && this.target) {
      // Calculate angle to target
      const angle = Phaser.Math.Angle.Between(
        this.sprite.x,
        this.sprite.y,
        this.target.x,
        this.target.y
      );

      // Get the hand position
      const handPosition = this.calculateHandPosition(angle);

      // Make sure the raygun is visible
      this.raygun.show(handPosition.x, handPosition.y, false);
    }
  }
}
