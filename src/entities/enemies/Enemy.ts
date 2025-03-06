import * as Phaser from "phaser";
import { Agent } from "../Agent";
import { DUST_COLOR } from "../../constants";

// Enemy states
export enum EnemyState {
  IDLE = "idle",
  ATTACKING = "attacking",
  DEAD = "dead",
}

// Enemy types
export type EnemyType = "ufo" | "alien"; // Can be expanded with more enemy types

// Define a type for valid targets that have x, y properties and can be destroyed
interface TargetObject extends Phaser.GameObjects.GameObject {
  x: number;
  y: number;
  active: boolean;
}

// Base Enemy class
export abstract class Enemy extends Agent {
  protected enemyState: EnemyState;
  public enemyType: EnemyType;
  protected target: TargetObject | null = null;
  protected speed: number;
  protected attackRange: number;
  protected attackDamage: number;
  protected attackCooldown: number;
  protected lastAttackTime: number = 0;
  protected stateText: Phaser.GameObjects.Text;
  protected label: Phaser.GameObjects.Text;
  protected preferredShootingDistance: number; // Distance at which enemies prefer to stop and shoot
  public isEnemy: boolean = true; // Flag to identify this as an enemy for collision detection

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    enemyType: EnemyType,
    speed: number = 80,
    maxHealth: number = 100,
    attackRange: number = 100,
    attackDamage: number = 10,
    attackCooldown: number = 1000,
    preferredShootingDistance: number = 150 // Default preferred shooting distance
  ) {
    // Create the enemy sprite
    const sprite = scene.physics.add
      .sprite(x, y, enemyType)
      .setOrigin(0.5)
      .setDepth(5);

    // Call the parent constructor
    super(scene, sprite, maxHealth);

    // Set enemy properties
    this.enemyType = enemyType;
    this.enemyState = EnemyState.IDLE;
    this.speed = speed;
    this.attackRange = attackRange;
    this.attackDamage = attackDamage;
    this.attackCooldown = attackCooldown;
    this.preferredShootingDistance = preferredShootingDistance;

    // Add a label showing the enemy type
    this.label = scene.add
      .text(x, y - 40, this.getEnemyName(), {
        fontSize: "14px",
        color: "#FF0000",
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(5);

    // Add state text
    this.stateText = scene.add
      .text(x, y - 25, "IDLE", {
        fontSize: "12px",
        color: "#FF0000",
        align: "center",
      })
      .setAlpha(0.75)
      .setOrigin(0.5)
      .setDepth(5);

    // Initialize dust effects
    this.initDustEffects();

    // Initialize shadow effects
    this.initShadowEffects();
  }

  // Update the enemy
  public update(time: number, delta: number): void {
    if (!this.isAlive()) {
      return;
    }

    // Update shadow effects
    this.updateShadowEffects();

    // Update the position of the label and state text to follow the enemy
    const spriteX = (this.sprite as Phaser.Physics.Arcade.Sprite).x;
    const spriteY = (this.sprite as Phaser.Physics.Arcade.Sprite).y;
    this.label.setPosition(spriteX, spriteY - 40);
    this.stateText.setPosition(spriteX, spriteY - 25);

    // Update state text
    this.updateStateText();

    // Update dust effects
    this.updateDustEffects(time);

    // Handle different states
    switch (this.enemyState) {
      case EnemyState.IDLE:
        this.handleIdleState(time, delta);
        break;
      case EnemyState.ATTACKING:
        this.handleAttackingState(time, delta);
        break;
      case EnemyState.DEAD:
        // Do nothing when dead
        break;
    }
  }

  // Handle idle state
  protected handleIdleState(time: number, delta: number): void {
    // Find the closest target (player or robot)
    this.findClosestTarget();

    // If a target is found, switch to attacking state
    if (this.target) {
      this.enemyState = EnemyState.ATTACKING;
      this.updateStateText();

      // Start dust effects when moving
      if (this.dustEffects) {
        this.dustEffects.start();
        this.dustEffects.startMovementDust();
      }
    }
  }

  // Handle attacking state
  protected handleAttackingState(time: number, delta: number): void {
    // If no target or target is dead, go back to idle
    if (!this.target || !this.isTargetValid()) {
      this.target = null;
      this.enemyState = EnemyState.IDLE;
      this.updateStateText();

      // Stop dust effects when not moving
      if (this.dustEffects) {
        this.dustEffects.stop();
        this.dustEffects.stopMovementDust();
      }

      return;
    }

    // Move towards the target
    this.moveTowardsTarget(delta);

    // Check if in attack range
    if (this.isInAttackRange()) {
      // Attack if cooldown has passed
      if (time - this.lastAttackTime >= this.attackCooldown) {
        this.attackTarget();
        this.lastAttackTime = time;
      }
    }
  }

  // Find the closest target (player or robot)
  protected findClosestTarget(): void {
    // Get player and robots from game state
    const gameState = (window as any).gameState;
    const player = gameState.player;
    const robots = gameState.robots || [];

    let closestTarget: TargetObject | null = null;
    let closestDistance = Number.MAX_VALUE;

    // Check player
    if (player && player.active) {
      const distance = Phaser.Math.Distance.Between(
        (this.sprite as Phaser.Physics.Arcade.Sprite).x,
        (this.sprite as Phaser.Physics.Arcade.Sprite).y,
        player.x,
        player.y
      );

      if (distance < closestDistance) {
        closestDistance = distance;
        closestTarget = player as unknown as TargetObject;
      }
    }

    // Check robots
    for (const robot of robots) {
      if (!robot || !robot.getSprite || typeof robot.getSprite !== "function")
        continue;

      const robotSprite = robot.getSprite();
      if (!robotSprite || !robotSprite.active) continue;

      // Ensure the sprite has x and y properties
      if ("x" in robotSprite && "y" in robotSprite) {
        const distance = Phaser.Math.Distance.Between(
          (this.sprite as Phaser.Physics.Arcade.Sprite).x,
          (this.sprite as Phaser.Physics.Arcade.Sprite).y,
          robotSprite.x,
          robotSprite.y
        );

        if (distance < closestDistance) {
          closestDistance = distance;
          closestTarget = robotSprite as unknown as TargetObject;
        }
      }
    }

    this.target = closestTarget;
  }

  // Move towards the target
  protected moveTowardsTarget(delta: number): void {
    if (!this.target) return;

    const targetX = this.target.x;
    const targetY = this.target.y;
    const enemyX = (this.sprite as Phaser.Physics.Arcade.Sprite).x;
    const enemyY = (this.sprite as Phaser.Physics.Arcade.Sprite).y;

    // Calculate distance to target
    const distance = Phaser.Math.Distance.Between(
      enemyX,
      enemyY,
      targetX,
      targetY
    );

    // Only move if we're further than the preferred shooting distance
    if (distance > this.preferredShootingDistance) {
      // Calculate direction to target
      const angle = Phaser.Math.Angle.Between(enemyX, enemyY, targetX, targetY);

      // Calculate velocity based on angle
      const velocityX = Math.cos(angle) * this.speed;
      const velocityY = Math.sin(angle) * this.speed;

      // Apply velocity
      (this.sprite as Phaser.Physics.Arcade.Sprite).setVelocity(
        velocityX,
        velocityY
      );
    } else {
      // Stop moving when at preferred shooting distance
      (this.sprite as Phaser.Physics.Arcade.Sprite).setVelocity(0, 0);
    }
  }

  // Check if in attack range
  protected isInAttackRange(): boolean {
    if (!this.target) return false;

    const distance = Phaser.Math.Distance.Between(
      (this.sprite as Phaser.Physics.Arcade.Sprite).x,
      (this.sprite as Phaser.Physics.Arcade.Sprite).y,
      this.target.x,
      this.target.y
    );

    return distance <= this.attackRange;
  }

  // Attack the target
  protected attackTarget(): void {
    if (!this.target) return;

    // Get positions
    const enemyX = (this.sprite as Phaser.Physics.Arcade.Sprite).x;
    const enemyY = (this.sprite as Phaser.Physics.Arcade.Sprite).y;
    const targetX = this.target.x;
    const targetY = this.target.y;

    // Calculate angle to target
    const angle = Phaser.Math.Angle.Between(enemyX, enemyY, targetX, targetY);

    // Create a visual effect for the projectile
    const projectile = this.scene.add.graphics();
    projectile.fillStyle(0xff0000, 0.8); // Red color for enemy projectiles
    projectile.fillCircle(enemyX, enemyY, 5);
    projectile.setDepth(6);

    // Animate the projectile
    this.scene.tweens.add({
      targets: projectile,
      x: targetX - enemyX,
      y: targetY - enemyY,
      duration: 500,
      ease: "Linear",
      onUpdate: (tween) => {
        const progress = tween.progress;
        const currentX = enemyX + (targetX - enemyX) * progress;
        const currentY = enemyY + (targetY - enemyY) * progress;

        // Clear and redraw at new position
        projectile.clear();
        projectile.fillStyle(0xff0000, 0.8);
        projectile.fillCircle(currentX, currentY, 5);
      },
      onComplete: () => {
        // Remove the projectile
        projectile.destroy();

        // In the future, this will call the target's takeDamage method
        console.log(
          `${this.getEnemyName()} attacks for ${this.attackDamage} damage!`
        );
      },
    });
  }

  // Check if target is valid (still exists and is alive)
  protected isTargetValid(): boolean {
    return !!this.target && this.target.active;
  }

  // Update the state text
  protected updateStateText(): void {
    if (this.stateText) {
      this.stateText.setText(
        `${this.enemyState.toUpperCase()} (${this.health}/${this.maxHealth})`
      );
    }
  }

  // Handle death
  protected onDeath(): void {
    this.enemyState = EnemyState.DEAD;
    this.updateStateText();

    // Stop dust effects
    if (this.dustEffects) {
      this.dustEffects.stop();
      this.dustEffects.stopMovementDust();
    }

    // Stop movement
    (this.sprite as Phaser.Physics.Arcade.Sprite).setVelocity(0, 0);

    // Play death animation or effect (to be implemented)

    // Clean up shadow effects
    this.cleanupShadowEffects();

    // Remove after a delay
    this.scene.time.delayedCall(2000, () => {
      this.destroy();
    });
  }

  // Destroy the enemy
  public destroy(): void {
    // Clean up dust effects
    this.cleanupDustEffects();

    // Clean up shadow effects
    this.cleanupShadowEffects();

    // Remove text
    if (this.label) this.label.destroy();
    if (this.stateText) this.stateText.destroy();

    // Remove sprite
    if (this.sprite) {
      if (
        "destroy" in this.sprite &&
        typeof this.sprite.destroy === "function"
      ) {
        this.sprite.destroy();
      }
    }
  }

  // Get enemy state
  public getEnemyState(): EnemyState {
    return this.enemyState;
  }

  // Get enemy name (to be implemented by subclasses)
  public abstract getEnemyName(): string;

  // Take damage and show visual feedback
  public damage(amount: number): void {
    // Call the parent takeDamage method
    this.takeDamage(amount);

    // Show damage feedback (flash red or green based on enemy type)
    if (this.sprite instanceof Phaser.Physics.Arcade.Sprite) {
      // Use green tint for UFOs, red for others
      const tintColor = this.enemyType === "ufo" ? 0x00ff00 : 0xff0000;
      this.sprite.setTint(tintColor);

      // Reset tint after a short delay
      this.scene.time.delayedCall(100, () => {
        if (
          this.sprite instanceof Phaser.Physics.Arcade.Sprite &&
          this.isAlive()
        ) {
          this.sprite.clearTint();
        }
      });
    }

    // Update health display
    this.updateStateText();

    console.log(
      `Enemy ${this.getEnemyName()} (${
        this.enemyType
      }) took ${amount} damage. Health: ${this.health}/${this.maxHealth}`
    );
  }
}
