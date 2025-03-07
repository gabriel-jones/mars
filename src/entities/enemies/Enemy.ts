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
  protected healthBar: Phaser.GameObjects.Graphics; // Health bar graphics
  protected currentTile: { x: number; y: number } = { x: 0, y: 0 };

  // Static map to track occupied tiles
  private static occupiedTiles: Map<string, Enemy> = new Map();

  // Tile size for grid movement
  private static readonly TILE_SIZE: number = 64; // Match your game's tile size

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

    // Call the parent constructor first
    super(scene, sprite, maxHealth);

    // Ensure the physics body is properly set up
    if (sprite.body) {
      // Set a proper hitbox for the enemy
      sprite.body.setSize(sprite.width * 0.8, sprite.height * 0.8);
      sprite.body.setOffset(sprite.width * 0.1, sprite.height * 0.1);

      // Disable debug visualization
      sprite.body.debugShowBody = false;
    }

    // Add isEnemy property to the sprite for collision detection
    (sprite as any).isEnemy = true;
    (sprite as any).enemyType = enemyType;

    // Store a reference to the Enemy instance on the sprite
    (sprite as any).enemyInstance = this;

    // Set enemy properties
    this.enemyType = enemyType;
    this.enemyState = EnemyState.IDLE;
    this.speed = speed;
    this.attackRange = attackRange;
    this.attackDamage = attackDamage;
    this.attackCooldown = attackCooldown;
    this.preferredShootingDistance = preferredShootingDistance;

    // Initialize current tile position
    this.currentTile = {
      x: Math.floor(x / Enemy.TILE_SIZE),
      y: Math.floor(y / Enemy.TILE_SIZE),
    };

    // Register this enemy's position in the occupied tiles map
    const tileKey = `${this.currentTile.x},${this.currentTile.y}`;
    Enemy.occupiedTiles.set(tileKey, this);

    // Add a label showing the enemy type
    this.label = scene.add
      .text(x, y - 40, this.getEnemyName(), {
        fontSize: "14px",
        color: "#FF0000",
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(5);

    // Create health bar
    this.healthBar = scene.add.graphics();
    this.healthBar.setDepth(5);
    this.updateHealthBar();

    // Add state text (but make it invisible since we're using health bar)
    this.stateText = scene.add
      .text(x, y - 25, "", {
        fontSize: "12px",
        color: "#FF0000",
        align: "center",
      })
      .setAlpha(0)
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

    // Update the position of the label and health bar to follow the enemy
    const spriteX = (this.sprite as Phaser.Physics.Arcade.Sprite).x;
    const spriteY = (this.sprite as Phaser.Physics.Arcade.Sprite).y;
    this.label.setPosition(spriteX, spriteY - 40);

    // Update health bar position
    this.updateHealthBar();

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

  // Check if a tile is occupied by another enemy
  private static isTileOccupied(
    tileX: number,
    tileY: number,
    excludeEnemy: Enemy
  ): boolean {
    const tileKey = `${tileX},${tileY}`;
    if (!Enemy.occupiedTiles.has(tileKey)) {
      return false;
    }

    // Check if the tile is occupied by a different enemy
    return Enemy.occupiedTiles.get(tileKey) !== excludeEnemy;
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

    // Calculate the current tile position
    const newTileX = Math.floor(enemyX / Enemy.TILE_SIZE);
    const newTileY = Math.floor(enemyY / Enemy.TILE_SIZE);

    // Check if the enemy has moved to a new tile
    if (newTileX !== this.currentTile.x || newTileY !== this.currentTile.y) {
      // Remove from old tile
      const oldTileKey = `${this.currentTile.x},${this.currentTile.y}`;
      Enemy.occupiedTiles.delete(oldTileKey);

      // Update current tile
      this.currentTile = { x: newTileX, y: newTileY };

      // Register in new tile
      const newTileKey = `${newTileX},${newTileY}`;
      Enemy.occupiedTiles.set(newTileKey, this);
    }

    // Only move if we're further than the preferred shooting distance
    if (distance > this.preferredShootingDistance) {
      // Calculate direction to target
      const angle = Phaser.Math.Angle.Between(enemyX, enemyY, targetX, targetY);

      // Calculate the next position
      const nextX = enemyX + Math.cos(angle) * this.speed * (delta / 1000);
      const nextY = enemyY + Math.sin(angle) * this.speed * (delta / 1000);

      // Calculate the next tile
      const nextTileX = Math.floor(nextX / Enemy.TILE_SIZE);
      const nextTileY = Math.floor(nextY / Enemy.TILE_SIZE);

      // Check if the next tile is different from the current tile and is occupied
      if (
        (nextTileX !== this.currentTile.x ||
          nextTileY !== this.currentTile.y) &&
        Enemy.isTileOccupied(nextTileX, nextTileY, this)
      ) {
        // The next tile is occupied, try to find an alternative path
        // For simplicity, just stop moving for now
        (this.sprite as Phaser.Physics.Arcade.Sprite).setVelocity(0, 0);
      } else {
        // The path is clear, proceed normally
        const velocityX = Math.cos(angle) * this.speed;
        const velocityY = Math.sin(angle) * this.speed;

        // Apply velocity
        (this.sprite as Phaser.Physics.Arcade.Sprite).setVelocity(
          velocityX,
          velocityY
        );
      }
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

  // Update the health bar
  protected updateHealthBar(): void {
    if (!this.healthBar) return;

    const spriteX = (this.sprite as Phaser.Physics.Arcade.Sprite).x;
    const spriteY = (this.sprite as Phaser.Physics.Arcade.Sprite).y;

    // Clear previous drawing
    this.healthBar.clear();

    // Health bar dimensions
    const width = 40;
    const height = 6;
    const x = spriteX - width / 2;
    const y = spriteY + 25; // Position below the enemy

    // Background (gray)
    this.healthBar.fillStyle(0x333333, 0.8);
    this.healthBar.fillRect(x, y, width, height);

    // Calculate health percentage
    const healthPercentage = Math.max(0, this.health / this.maxHealth);

    // Health bar color based on health percentage
    let color;
    if (healthPercentage > 0.6) {
      color = 0x00ff00; // Green
    } else if (healthPercentage > 0.3) {
      color = 0xffff00; // Yellow
    } else {
      color = 0xff0000; // Red
    }

    // Health bar (colored)
    this.healthBar.fillStyle(color, 1);
    this.healthBar.fillRect(x, y, width * healthPercentage, height);

    // Border (white)
    this.healthBar.lineStyle(1, 0xffffff, 0.8);
    this.healthBar.strokeRect(x, y, width, height);
  }

  // Update state text (now just updates the health bar)
  protected updateStateText(): void {
    this.updateHealthBar();
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

  // Clean up resources
  public destroy(): void {
    console.log(`Destroying enemy: ${this.getEnemyName()}`);

    // Clean up dust effects
    this.cleanupDustEffects();

    // Clean up shadow effects
    this.cleanupShadowEffects();

    // Remove from occupied tiles map
    const tileKey = `${this.currentTile.x},${this.currentTile.y}`;
    Enemy.occupiedTiles.delete(tileKey);

    // Remove the label
    if (this.label) {
      this.label.destroy();
    }

    // Remove the state text
    if (this.stateText) {
      this.stateText.destroy();
    }

    // Remove the health bar
    if (this.healthBar) {
      this.healthBar.destroy();
    }

    // Remove the sprite
    if (this.sprite) {
      this.sprite.destroy();
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
    console.log(
      `${this.getEnemyName()} taking ${amount} damage. Current health: ${
        this.health
      }`
    );

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

    // Update health bar
    this.updateHealthBar();

    console.log(
      `Enemy ${this.getEnemyName()} (${
        this.enemyType
      }) took ${amount} damage. Health: ${this.health}/${this.maxHealth}`
    );

    // Log if enemy died from this damage
    if (this.health <= 0) {
      console.log(`${this.getEnemyName()} died from damage`);
    }
  }
}
