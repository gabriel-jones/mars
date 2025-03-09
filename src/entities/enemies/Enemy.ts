import * as Phaser from "phaser";
import { Agent } from "../Agent";
import { DUST_COLOR, RAYGUN_ATTACK_DAMAGE } from "../../constants";
import { HasHealth, HealthBarRenderer } from "../../interfaces/Health";
import { DEPTH } from "../../depth";
import { DustEffects } from "../../effects/DustEffects";
import {
  TILE_SIZE,
  ENEMY_PREFERRED_SHOOTING_DISTANCE,
  ENEMY_MAX_SHOOTING_RANGE,
} from "../../constants";

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
export abstract class Enemy extends Agent implements HasHealth {
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
  protected preferredShootingDistance: number =
    ENEMY_PREFERRED_SHOOTING_DISTANCE; // Distance at which enemies prefer to stop and shoot
  public isEnemy: boolean = true; // Flag to identify this as an enemy for collision detection
  protected currentTile: { x: number; y: number } = { x: 0, y: 0 };
  protected maxShootingRange: number = ENEMY_MAX_SHOOTING_RANGE; // Maximum distance at which the enemy can shoot

  // Static map to track occupied tiles
  private static occupiedTiles: Map<string, Enemy> = new Map();

  // Tile size for grid movement
  private static readonly TILE_SIZE: number = TILE_SIZE; // Match your game's tile size

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    enemyType: EnemyType,
    speed: number = 80,
    maxHealth: number = 100,
    attackRange: number = 100,
    attackDamage: number = RAYGUN_ATTACK_DAMAGE,
    attackCooldown: number = 1000,
    preferredShootingDistance: number = ENEMY_PREFERRED_SHOOTING_DISTANCE,
    maxShootingRange: number = ENEMY_MAX_SHOOTING_RANGE
  ) {
    // Call the parent constructor with the sprite and maxHealth
    super(
      scene,
      scene.physics.add
        .sprite(x, y, enemyType)
        .setDisplaySize(64, 64)
        .setDepth(DEPTH.AGENT),
      maxHealth
    );

    // Ensure the physics body is properly set up
    if (
      this.sprite instanceof Phaser.Physics.Arcade.Sprite &&
      this.sprite.body
    ) {
      // Set a proper hitbox for the enemy
      const body = this.sprite.body as Phaser.Physics.Arcade.Body;
      body.setSize(this.sprite.width * 0.8, this.sprite.height * 0.8);
      body.setOffset(this.sprite.width * 0.1, this.sprite.height * 0.1);

      // Disable debug visualization
      body.debugShowBody = false;
    }

    // Add isEnemy property to the sprite for collision detection
    (this.sprite as any).isEnemy = true;
    (this.sprite as any).enemyType = enemyType;

    // Store a reference to the Enemy instance on the sprite
    (this.sprite as any).enemyInstance = this;

    // Set enemy properties
    this.enemyType = enemyType;
    this.enemyState = EnemyState.IDLE;
    this.speed = speed;
    this.attackRange = attackRange;
    this.attackDamage = attackDamage;
    this.attackCooldown = attackCooldown;
    this.preferredShootingDistance = preferredShootingDistance;
    this.maxShootingRange = maxShootingRange;

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
      .text(x, y + 40, this.getEnemyName(), {
        fontSize: "14px",
        color: "#FF0000",
        align: "center",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        padding: { x: 4, y: 2 },
        shadow: {
          offsetX: 1,
          offsetY: 1,
          color: "#000000",
          blur: 2,
          fill: true,
        },
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.AGENT + 1); // Ensure label is above the sprite

    // Add state text (but make it invisible since we're using health bar)
    this.stateText = scene.add
      .text(x, y + 55, "", {
        fontSize: "12px",
        color: "#FF0000",
        align: "center",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        padding: { x: 4, y: 2 },
        shadow: {
          offsetX: 1,
          offsetY: 1,
          color: "#000000",
          blur: 2,
          fill: true,
        },
      })
      .setAlpha(0)
      .setOrigin(0.5)
      .setDepth(DEPTH.AGENT + 1); // Ensure stateText is above the sprite

    // Initialize dust effects
    this.initDustEffects();

    // Initialize shadow effects
    this.initShadowEffects();
  }

  // Update the enemy
  public update(time: number, delta: number): void {
    if (!this.isAlive() || !this.sprite) {
      console.warn(
        "Enemy is not alive or sprite is not set",
        this.isAlive(),
        this.sprite
      );
      return;
    }

    // Ensure physics body is enabled and properly set up
    this.ensurePhysicsBodyEnabled();

    // Update shadow effects
    this.updateShadowEffects();

    // Get the sprite with proper type
    const sprite = this.sprite as Phaser.Physics.Arcade.Sprite;

    // Check if sprite exists before accessing its properties
    if (sprite) {
      const spriteX = sprite.x;
      const spriteY = sprite.y;

      // Update the position of the label and health bar to follow the enemy
      this.label.setPosition(spriteX, spriteY + 40);
      this.stateText.setPosition(spriteX, spriteY + 55);

      // Update health bar position
      this.updateHealthBarPosition();

      // Update shield position and visibility
      this.updateShieldPosition();
      this.updateShieldEffect(time);
    }

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

  // Ensure physics body is enabled and properly set up
  private ensurePhysicsBodyEnabled(): void {
    if (!this.sprite) {
      return;
    }

    // Ensure the sprite has a physics body
    if (this.sprite instanceof Phaser.Physics.Arcade.Sprite) {
      const body = this.sprite.body as Phaser.Physics.Arcade.Body;

      // If the body exists, make sure it's enabled
      if (body) {
        body.enable = true;

        // Ensure the isEnemy property is set on the sprite for collision detection
        (this.sprite as any).isEnemy = true;
        (this.sprite as any).enemyInstance = this;

        // Make sure the body size is properly set
        body.setSize(this.sprite.width * 0.8, this.sprite.height * 0.8);
        body.setOffset(this.sprite.width * 0.1, this.sprite.height * 0.1);

        // Make sure the body is set to collide with world bounds
        body.setCollideWorldBounds(true);

        // Make sure the body has no bounce
        body.setBounce(0);

        // Make sure the body is not immovable
        body.setImmovable(false);
      }
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
    // If no target or target is dead, go back to idle and find a new target
    if (!this.target || !this.isTargetValid()) {
      this.target = null;
      this.enemyState = EnemyState.IDLE;
      this.updateStateText();

      // Stop dust effects when not moving
      if (this.dustEffects) {
        this.dustEffects.stop();
        this.dustEffects.stopMovementDust();
      }

      // Immediately try to find a new target
      this.findClosestTarget();
      return;
    }

    // Calculate distance to target
    const distance = Phaser.Math.Distance.Between(
      (this.sprite as Phaser.Physics.Arcade.Sprite).x,
      (this.sprite as Phaser.Physics.Arcade.Sprite).y,
      this.target.x,
      this.target.y
    );

    // Always try to attack the target regardless of distance
    // Attack if cooldown has passed
    if (time - this.lastAttackTime >= this.attackCooldown) {
      // Call the abstract attackTarget method that subclasses will implement
      this.attackTarget();
      this.lastAttackTime = time;
    }

    // Always move towards target if beyond preferred shooting distance
    if (distance > this.preferredShootingDistance) {
      // Start dust effects when moving
      if (this.dustEffects) {
        this.dustEffects.start();
        this.dustEffects.startMovementDust();
      }

      // Move towards the target
      this.moveTowardsTarget(delta);
    }
    // If closer than preferred shooting distance but not too close, stop and shoot
    else if (distance > this.preferredShootingDistance / 2) {
      // Stop movement if we're at optimal range
      (this.sprite as Phaser.Physics.Arcade.Sprite).setVelocity(0, 0);

      // Stop dust effects when not moving
      if (this.dustEffects) {
        this.dustEffects.stop();
        this.dustEffects.stopMovementDust();
      }
    }
    // If very close, back up slightly to maintain optimal shooting distance
    else {
      // Calculate angle away from target
      const angle = Phaser.Math.Angle.Between(
        this.target.x,
        this.target.y,
        (this.sprite as Phaser.Physics.Arcade.Sprite).x,
        (this.sprite as Phaser.Physics.Arcade.Sprite).y
      );

      // Move away slowly
      const backupSpeed = this.speed * 0.5;
      const sprite = this.sprite as Phaser.Physics.Arcade.Sprite;
      sprite.setVelocity(
        Math.cos(angle) * backupSpeed,
        Math.sin(angle) * backupSpeed
      );

      // Update sprite direction based on movement
      // When backing up, we want to face the target, not the direction of movement
      const targetAngle = Phaser.Math.Angle.Between(
        sprite.x,
        sprite.y,
        this.target.x,
        this.target.y
      );
      sprite.setFlipX(Math.cos(targetAngle) < 0);

      // Start dust effects when moving
      if (this.dustEffects) {
        this.dustEffects.start();
        this.dustEffects.startMovementDust();
      }
    }

    // Periodically re-evaluate targets to ensure we're pursuing the best target
    if (time % 500 < delta) {
      // Even more frequent target updates
      this.findClosestTarget();
    }
  }

  // Find the closest target (player or robot)
  protected findClosestTarget(): void {
    // Get player and robots from game state
    const gameState = (window as any).gameState;
    const player = gameState.player;
    const robots = gameState.robots || [];
    const buildings = gameState.buildings || [];
    const base = gameState.base;

    let closestTarget: TargetObject | null = null;
    let closestDistance = Number.MAX_VALUE;
    let targetType = "none";

    // Check player with high priority
    if (player && player.active) {
      const distance = Phaser.Math.Distance.Between(
        (this.sprite as Phaser.Physics.Arcade.Sprite).x,
        (this.sprite as Phaser.Physics.Arcade.Sprite).y,
        player.x,
        player.y
      );

      // Prioritize player significantly by applying a distance reduction factor
      const adjustedDistance = distance * 0.6; // 40% reduction to prioritize player

      if (adjustedDistance < closestDistance) {
        closestDistance = adjustedDistance;
        closestTarget = player as unknown as TargetObject;
        targetType = "player";
      }
    }

    // Check robots with medium priority
    if (robots && robots.length > 0) {
      for (const robot of robots) {
        if (!robot) {
          continue;
        }

        if (!robot.getSprite || typeof robot.getSprite !== "function") {
          continue;
        }

        // Check if robot is alive - use a more flexible approach
        let isRobotAlive = true;
        if (robot.health !== undefined && robot.health <= 0) {
          isRobotAlive = false;
        } else if (
          robot.isAlive &&
          typeof robot.isAlive === "function" &&
          !robot.isAlive()
        ) {
          isRobotAlive = false;
        }

        if (!isRobotAlive) {
          continue;
        }

        const robotSprite = robot.getSprite();
        if (!robotSprite || !robotSprite.active) {
          continue;
        }

        // Get the position of the robot sprite
        let robotX, robotY;

        if (robotSprite instanceof Phaser.GameObjects.Container) {
          robotX = robotSprite.x;
          robotY = robotSprite.y;
        } else {
          robotX = robotSprite.x;
          robotY = robotSprite.y;
        }

        const distance = Phaser.Math.Distance.Between(
          (this.sprite as Phaser.Physics.Arcade.Sprite).x,
          (this.sprite as Phaser.Physics.Arcade.Sprite).y,
          robotX,
          robotY
        );

        // Apply a slight priority to robots
        const adjustedDistance = distance * 0.8; // 20% reduction to prioritize robots

        if (adjustedDistance < closestDistance) {
          closestDistance = adjustedDistance;
          closestTarget = {
            x: robotX,
            y: robotY,
            active: true,
            robotInstance: robot,
          } as unknown as TargetObject;
          targetType = "robot";
        }
      }
    }

    // Check base as a target
    if (base && base.position) {
      // Convert tile position to pixel position
      const baseX = base.position.x * TILE_SIZE + TILE_SIZE / 2;
      const baseY = base.position.y * TILE_SIZE + TILE_SIZE / 2;

      const distance = Phaser.Math.Distance.Between(
        (this.sprite as Phaser.Physics.Arcade.Sprite).x,
        (this.sprite as Phaser.Physics.Arcade.Sprite).y,
        baseX,
        baseY
      );

      const adjustedDistance = distance * 0.75;

      if (adjustedDistance < closestDistance) {
        closestDistance = adjustedDistance;
        closestTarget = {
          x: baseX,
          y: baseY,
          active: true,
        } as unknown as TargetObject;
        targetType = "base";
      }
    }

    // Check buildings as fallback targets
    if (
      (!closestTarget || closestDistance > 800) && // Reduced from 1000 to make buildings more attractive targets
      buildings &&
      buildings.length > 0
    ) {
      for (const building of buildings) {
        if (!building || building.isBlueprint) {
          continue;
        }

        // Skip buildings that don't have a position
        if (
          !building.position ||
          typeof building.position.x !== "number" ||
          typeof building.position.y !== "number"
        ) {
          continue;
        }

        // Calculate building center position in pixels
        const buildingX = building.position.x * TILE_SIZE + TILE_SIZE / 2;
        const buildingY = building.position.y * TILE_SIZE + TILE_SIZE / 2;

        const distance = Phaser.Math.Distance.Between(
          (this.sprite as Phaser.Physics.Arcade.Sprite).x,
          (this.sprite as Phaser.Physics.Arcade.Sprite).y,
          buildingX,
          buildingY
        );

        // Buildings are lower priority than players and robots
        const adjustedDistance = distance * 1.1; // 10% increase to deprioritize buildings

        if (adjustedDistance < closestDistance) {
          closestDistance = adjustedDistance;
          closestTarget = {
            x: buildingX,
            y: buildingY,
            active: true,
          } as unknown as TargetObject;
          targetType = "building";
        }
      }
    }

    // Only change target if we found something or we already had a target that's now invalid
    if (closestTarget || !this.target || !this.isTargetValid()) {
      this.target = closestTarget;

      // If we found a target, switch to attacking state
      if (closestTarget && this.enemyState !== EnemyState.ATTACKING) {
        this.enemyState = EnemyState.ATTACKING;
      } else if (!closestTarget && this.enemyState === EnemyState.ATTACKING) {
        // If we lost our target, switch back to idle
        this.enemyState = EnemyState.IDLE;
      }
    }

    // If we still don't have a target, try to move towards the center of the map
    // This helps prevent enemies from getting stuck at the edges
    if (!this.target && this.enemyState === EnemyState.IDLE) {
      // Create a temporary target at the center of the map
      const mapWidth = (window as any).gameState.map?.widthInPixels || 3200;
      const mapHeight = (window as any).gameState.map?.heightInPixels || 3200;

      this.target = {
        x: mapWidth / 2,
        y: mapHeight / 2,
        active: true,
      } as TargetObject;

      // Set to attacking state to ensure movement towards center
      this.enemyState = EnemyState.ATTACKING;
    }
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

    // Get the sprite with proper type
    const sprite = this.sprite as Phaser.Physics.Arcade.Sprite;

    // Check if sprite and body exist
    if (!sprite || !sprite.body) {
      return;
    }

    // Calculate direction to target
    const angle = Phaser.Math.Angle.Between(enemyX, enemyY, targetX, targetY);

    sprite.setVelocity(
      Math.cos(angle) * this.speed,
      Math.sin(angle) * this.speed
    );

    // Update sprite direction based on movement
    sprite.setFlipX(Math.cos(angle) < 0);
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

    // Check if the target is within both the attack range and the maximum shooting range
    return distance <= this.attackRange && distance <= this.maxShootingRange;
  }

  // Update state text (now just updates the health bar)
  protected updateStateText(): void {
    this.updateHealthBarPosition();
  }

  // Handle death
  protected onDeath(): void {
    this.enemyState = EnemyState.DEAD;

    // Clean up shield effect
    this.cleanupShieldEffect();

    // Stop dust effects
    if (this.dustEffects) {
      this.dustEffects.stop();
      this.dustEffects.stopMovementDust();
    }

    // Stop movement - but check if sprite and body exist first
    if (this.sprite && (this.sprite as Phaser.Physics.Arcade.Sprite).body) {
      (this.sprite as Phaser.Physics.Arcade.Sprite).setVelocity(0, 0);
    }

    // Create explosion effect
    this.showDestructionEffect();

    // Hide the health bar immediately
    if (this.healthBar) {
      this.healthBar.setVisible(false);
    }

    // Clean up shadow effects
    this.cleanupShadowEffects();

    // Destroy immediately instead of waiting
    this.destroy();
  }

  // Create explosion effect
  private showDestructionEffect(): void {
    // Check if sprite exists before accessing its properties
    if (!this.sprite) {
      return;
    }

    const x = (this.sprite as Phaser.Physics.Arcade.Sprite).x;
    const y = (this.sprite as Phaser.Physics.Arcade.Sprite).y;

    // Create explosion particles
    const particles = this.scene.add.particles(x, y, "flare", {
      speed: { min: 50, max: 150 },
      scale: { start: 0.4, end: 0 },
      lifespan: 800,
      blendMode: "ADD",
      tint: this.enemyType === "ufo" ? 0x00ff00 : 0xff0000,
      quantity: 15,
      emitting: false,
    });

    // Explode once
    particles.explode(20);

    // Clean up particles after animation completes
    this.scene.time.delayedCall(1000, () => {
      particles.destroy();
    });
  }

  // Clean up resources
  public destroy(): void {
    // Clean up dust effects
    this.cleanupDustEffects();

    // Clean up shadow effects
    this.cleanupShadowEffects();

    // Destroy the equipped tool if it exists
    if (this.equippedTool) {
      this.equippedTool.destroy();
      this.equippedTool = null;
    }

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

    // Destroy the health bar if it exists
    if (this.healthBar) {
      this.healthBar.destroy();
      this.healthBar = null;
    }

    // Destroy the sprite if it exists
    if (this.sprite) {
      // Check if the sprite is already being destroyed
      if (!this.sprite.scene) {
        console.log("Sprite already destroyed or removed from scene");
      } else {
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
    // Directly modify health instead of calling takeDamage to avoid recursion
    this.health -= amount;

    // Check if health is below 0
    if (this.health <= 0) {
      this.health = 0;
      this.onDeath();
    }

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

    // Update health bar position
    this.updateHealthBarPosition();
  }

  // Check if target is valid (still exists and is alive)
  protected isTargetValid(): boolean {
    return !!this.target && this.target.active;
  }

  // Attack the target - abstract method to be implemented by subclasses
  protected abstract attackTarget(): void;

  // Override updateHealthBarPosition to ensure health bars are properly updated
  protected updateHealthBarPosition(): void {
    if (!this.healthBar || !this.sprite) {
      return;
    }

    // Get the sprite position
    const spriteX = this.sprite.x;
    const spriteY = this.sprite.y;

    // Position the health bar above the sprite
    this.healthBar.x = spriteX;
    this.healthBar.y = spriteY - 30; // Position above the sprite

    // Ensure the health bar is visible
    this.healthBar.setVisible(true);

    // Update health bar to reflect current health
    const healthBarRenderer = new HealthBarRenderer(this.scene);
    healthBarRenderer.updateHealthBar(this.healthBar, this);
  }
}
