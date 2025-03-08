import * as Phaser from "phaser";
import {
  TILE_SIZE,
  ROBOT_VELOCITY,
  DUST_COLOR,
  DEFAULT_FONT,
  ROBOT_DETECTION_RANGE,
  ROBOT_ATTACK_RANGE,
  ROBOT_MAX_SHOOTING_RANGE,
  ROBOT_IMPRECISION_FACTOR,
  ROBOT_SCAN_INTERVAL,
  ROBOT_FIRE_RATE,
} from "../../constants";
import { ResourceNode } from "../resourceNode";
import { DustEffects } from "../../effects/DustEffects";
import { Agent } from "../Agent";
import { Tool, ToolType } from "../tools";
import { Enemy } from "../enemies/Enemy";
import { HealthBarRenderer } from "../../interfaces/Health";
import { DEPTH } from "../../depth";

// Robot states
export enum RobotState {
  IDLE = "idle",
  MOVING = "moving",
  WORKING = "working",
  RETURNING = "returning",
  CARRYING = "carrying",
  DEFENDING = "defending",
  WANDERING = "wandering",
}

// Robot types
export type RobotType = "optimus" | "mining-drone";

// Base Robot class
export abstract class Robot extends Agent {
  protected robotState: RobotState;
  protected target: Phaser.Math.Vector2 | null = null;
  protected homePosition: Phaser.Math.Vector2;
  protected speed: number;
  protected label: Phaser.GameObjects.Text;
  protected stateText: Phaser.GameObjects.Text;
  protected carriedResource: ResourceNode | null = null;
  protected carriedResourceSprite: Phaser.GameObjects.Text | null = null;
  protected container: Phaser.GameObjects.Container;
  protected assaultRifle: Tool | null = null;
  protected enemyTarget: Enemy | null = null;
  protected detectionRange: number = ROBOT_DETECTION_RANGE;
  protected attackRange: number = ROBOT_ATTACK_RANGE;
  protected maxShootingRange: number = ROBOT_MAX_SHOOTING_RANGE;
  protected imprecisionFactor: number = ROBOT_IMPRECISION_FACTOR;
  protected lastScanTime: number = 0;
  protected scanInterval: number = ROBOT_SCAN_INTERVAL;
  protected lastRobotFireTime: number = 0;
  protected robotFireRate: number = ROBOT_FIRE_RATE;
  protected healthBar: Phaser.GameObjects.Container | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    robotType: RobotType,
    speed: number = 100,
    maxHealth: number = 100
  ) {
    // Create the container for the robot
    const container = new Phaser.GameObjects.Container(scene, x, y);

    // Call the parent constructor with the container
    super(scene, container, maxHealth);

    // Store the container reference
    this.container = container;

    // Set home position
    this.homePosition = new Phaser.Math.Vector2(x, y);

    // Create the robot sprite
    const sprite = scene.add
      .sprite(0, 0, robotType)
      .setOrigin(0.5)
      .setDisplaySize(
        robotType === "optimus" ? TILE_SIZE * 1.25 : TILE_SIZE,
        robotType === "optimus" ? TILE_SIZE * 1.25 : TILE_SIZE
      )
      .setDepth(DEPTH.AGENT);
    sprite.setName("sprite");
    container.add(sprite);

    // Adjust label position based on robot type
    const labelOffset = robotType === "optimus" ? 50 : 40;

    // Add a label showing the robot type
    this.label = scene.add
      .text(0, labelOffset, this.getRobotName(), {
        fontSize: robotType === "optimus" ? "16px" : "14px",
        color: "#FFFFFF",
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
        fontFamily: DEFAULT_FONT,
      })
      .setOrigin(0.5);
    container.add(this.label);

    // Add state text with adjusted position
    this.stateText = scene.add
      .text(0, labelOffset + 15, "IDLE", {
        fontSize: "12px",
        color: "#FFFFFF",
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
        fontFamily: DEFAULT_FONT,
      })
      .setAlpha(0.75)
      .setOrigin(0.5);
    container.add(this.stateText);

    // Set initial state
    this.robotState = RobotState.IDLE;

    // Set movement speed
    this.speed = speed;

    // Add physics to the robot
    scene.physics.world.enable(container);
    const body = container.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(true);

    // Set a proper hitbox for the robot
    body.setSize(TILE_SIZE * 0.8, TILE_SIZE * 0.8);
    body.setOffset(-TILE_SIZE * 0.4, -TILE_SIZE * 0.4); // Center the hitbox

    // Initialize dust effects
    this.initDustEffects({
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
    });

    // Initialize shadow effects
    this.initShadowEffects();

    // Create assault rifle but don't equip it yet
    this.assaultRifle = new Tool(
      ToolType.ASSAULT_RIFLE,
      "Robot Rifle",
      scene,
      "assault-rifle"
    );

    // Create a health bar for the robot
    const mainScene = scene as any;
    if (mainScene.healthBarRenderer) {
      console.log("Creating health bar for robot");
      const healthBar = mainScene.healthBarRenderer.createHealthBar(
        this as any,
        -30
      );
      this.setHealthBar(healthBar);

      // Update the health bar immediately
      mainScene.healthBarRenderer.updateHealthBar(healthBar, this);
    } else {
      console.error("No healthBarRenderer found in scene");
    }

    // Add to scene
    scene.add.existing(container);
  }

  // Abstract methods to be implemented by subclasses
  protected abstract getRobotNameInternal(): string;
  public abstract update(time: number, delta: number): void;

  // Scan for nearby enemies
  protected scanForEnemies(time: number): void {
    // Only scan periodically to save performance
    if (time - this.lastScanTime < this.scanInterval) return;

    this.lastScanTime = time;

    // Visualize detection range (uncomment for debugging)
    // this.visualizeDetectionRange();

    // Get enemies from game state
    const gameState = (window as any).gameState;
    const enemies = gameState.enemies || [];

    if (enemies.length === 0) {
      // No enemies, return to normal state if defending
      if (this.robotState === RobotState.DEFENDING) {
        this.robotState = RobotState.IDLE;
        this.updateStateText();
        this.unequipWeapon();
      }
      return;
    }

    // Find the closest enemy
    let closestEnemy: Enemy | null = null;
    let closestDistance = Number.MAX_VALUE;

    for (const enemy of enemies) {
      if (!enemy || !enemy.isAlive()) continue;

      const enemySprite = enemy.getSprite();

      // Get enemy position
      let enemyX, enemyY;
      if (enemySprite instanceof Phaser.GameObjects.Container) {
        enemyX = enemySprite.x;
        enemyY = enemySprite.y;
      } else {
        enemyX = enemySprite.x;
        enemyY = enemySprite.y;
      }

      const distance = Phaser.Math.Distance.Between(
        this.container.x,
        this.container.y,
        enemyX,
        enemyY
      );

      if (distance < this.detectionRange && distance < closestDistance) {
        closestDistance = distance;
        closestEnemy = enemy;

        // Log when a new enemy is detected
        if (this.enemyTarget !== enemy) {
          console.log(
            `Robot detected enemy at distance ${distance.toFixed(2)}`
          );
        }
      }
    }

    // If we found a close enemy, switch to defending state
    if (closestEnemy) {
      this.enemyTarget = closestEnemy;

      // Only switch state if not already defending
      if (this.robotState !== RobotState.DEFENDING) {
        this.robotState = RobotState.DEFENDING;
        this.updateStateText();
        this.equipWeapon();
        console.log(`Robot switching to DEFENDING state, targeting enemy`);
      }

      // Get enemy position
      const enemySprite = closestEnemy.getSprite();
      let enemyX, enemyY;
      if (enemySprite instanceof Phaser.GameObjects.Container) {
        enemyX = enemySprite.x;
        enemyY = enemySprite.y;
      } else {
        enemyX = enemySprite.x;
        enemyY = enemySprite.y;
      }

      // Calculate distance to enemy
      const distance = Phaser.Math.Distance.Between(
        this.container.x,
        this.container.y,
        enemyX,
        enemyY
      );

      // If enemy is outside attack range but within detection range, move towards it
      if (distance > this.attackRange && distance < this.detectionRange) {
        // Calculate direction to enemy
        const angle = Phaser.Math.Angle.Between(
          this.container.x,
          this.container.y,
          enemyX,
          enemyY
        );

        // Calculate velocity
        const velocityX = Math.cos(angle) * this.speed;
        const velocityY = Math.sin(angle) * this.speed;

        // Apply velocity to move towards enemy
        const body = this.container.body as Phaser.Physics.Arcade.Body;
        body.setVelocity(velocityX, velocityY);

        // Log occasionally for debugging
        if (Math.random() < 0.01) {
          console.log(
            `Robot moving towards enemy, distance: ${distance.toFixed(2)}/${
              this.attackRange
            }`
          );
        }

        // Start dust effects for movement
        if (this.dustEffects) {
          this.dustEffects.start();
          this.dustEffects.startMovementDust();
        }
      } else if (distance <= this.attackRange) {
        // If within attack range, stop moving
        const body = this.container.body as Phaser.Physics.Arcade.Body;
        body.setVelocity(0, 0);

        // Stop dust effects when not moving
        if (this.dustEffects) {
          this.dustEffects.stop();
          this.dustEffects.stopMovementDust();
        }

        // Log occasionally for debugging
        if (Math.random() < 0.01) {
          console.log(
            `Robot in attack range, stopped moving, distance: ${distance.toFixed(
              2
            )}/${this.attackRange}`
          );
        }
      }
    } else if (this.robotState === RobotState.DEFENDING) {
      // No enemies in range, return to normal state
      this.robotState = RobotState.IDLE;
      this.updateStateText();
      this.unequipWeapon();
      this.enemyTarget = null;
      console.log(`Robot returning to IDLE state, no enemies in range`);

      // Stop moving
      const body = this.container.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(0, 0);

      // Stop dust effects when not moving
      if (this.dustEffects) {
        this.dustEffects.stop();
        this.dustEffects.stopMovementDust();
      }
    }
  }

  // Equip the assault rifle
  protected equipWeapon(): void {
    if (this.assaultRifle) {
      this.equipTool(this.assaultRifle);
    }
  }

  // Unequip the weapon
  protected unequipWeapon(): void {
    if (this.equippedTool) {
      this.equippedTool.hide();
      this.equippedTool = null;
    }
  }

  // Attack the enemy target
  protected attackEnemyTarget(time: number): void {
    if (!this.enemyTarget || !this.enemyTarget.isAlive() || !this.equippedTool)
      return;

    const enemySprite = this.enemyTarget.getSprite();
    if (!enemySprite || !enemySprite.active) return;

    // Get enemy position
    let enemyX, enemyY;
    if (enemySprite instanceof Phaser.GameObjects.Container) {
      enemyX = enemySprite.x;
      enemyY = enemySprite.y;
    } else {
      enemyX = enemySprite.x;
      enemyY = enemySprite.y;
    }

    // Calculate distance to enemy
    const distance = Phaser.Math.Distance.Between(
      this.container.x,
      this.container.y,
      enemyX,
      enemyY
    );

    // Only attack if within attack range AND maximum shooting range
    if (distance > this.attackRange || distance > this.maxShootingRange) {
      // Log occasionally for debugging
      if (Math.random() < 0.01) {
        console.log(
          `Robot not in attack range (${distance.toFixed(2)}/${
            this.attackRange
          }) or beyond max shooting range (${
            this.maxShootingRange
          }), not firing`
        );
      }
      return;
    }

    // Update tool position
    this.updateToolPosition();

    // Calculate angle to enemy
    const angle = Phaser.Math.Angle.Between(
      this.container.x,
      this.container.y,
      enemyX,
      enemyY
    );

    // Update tool rotation to face the enemy
    this.equippedTool.setRotation(angle);

    // Flip the tool sprite if facing left
    // The sprite is facing right by default, so flip if angle is in left hemisphere
    const shouldFlip = Math.abs(angle) > Math.PI / 2;
    this.equippedTool.setFlipX(shouldFlip);

    // Log targeting information for debugging
    if (Math.random() < 0.01) {
      // Only log occasionally to avoid spam
      console.log(
        `Robot targeting enemy at (${enemyX}, ${enemyY}) from (${this.container.x}, ${this.container.y})`
      );
      console.log(
        `Angle: ${angle}, Flipped: ${shouldFlip}, Distance: ${distance.toFixed(
          2
        )}/${this.attackRange}`
      );
    }

    // Add imprecision to the target position
    const imprecision = this.equippedTool.getImprecision();
    const targetX = enemyX + (Math.random() * 2 - 1) * imprecision;
    const targetY = enemyY + (Math.random() * 2 - 1) * imprecision;

    // Fire the tool using the Agent's fireTool method
    this.fireTool(targetX, targetY, false);
  }

  // Override updateToolPosition to position the tool correctly
  protected updateToolPosition(): void {
    if (!this.equippedTool) return;

    // Show the tool at the robot's position
    this.equippedTool.show(this.container.x, this.container.y, false); // Pass false for isPlayer

    // If we have an enemy target, update the laser pointer
    if (this.enemyTarget) {
      const enemySprite = this.enemyTarget.getSprite();
      if (!enemySprite || !enemySprite.active) return;

      // Get enemy position
      let enemyX, enemyY;
      if (enemySprite instanceof Phaser.GameObjects.Container) {
        enemyX = enemySprite.x;
        enemyY = enemySprite.y;
      } else {
        enemyX = enemySprite.x;
        enemyY = enemySprite.y;
      }

      this.equippedTool.updateLaserPointer(
        this.container.x,
        this.container.y,
        enemyX,
        enemyY,
        false // Pass false for isPlayer
      );
    }
  }

  // Move the robot to a target position
  protected moveToTarget(target: Phaser.Math.Vector2): void {
    // Set the target
    this.target = target;

    // Calculate direction to target
    const direction = new Phaser.Math.Vector2(
      target.x - this.container.x,
      target.y - this.container.y
    );

    // Normalize the direction vector
    direction.normalize();

    // Calculate velocity
    const velocityX = direction.x * this.speed;
    const velocityY = direction.y * this.speed;

    // Apply velocity to the container
    const body = this.container.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(velocityX, velocityY);

    // Update state if not defending
    if (this.robotState !== RobotState.DEFENDING) {
      this.robotState = RobotState.MOVING;
      this.updateStateText();
    }

    // Start dust effects
    if (this.dustEffects) {
      this.dustEffects.start();
      this.dustEffects.startMovementDust();
    }
  }

  // Called when the robot reaches its target
  protected onReachTarget(): void {
    // Override in subclasses
  }

  // Check if the robot has reached its target
  protected hasReachedTarget(): boolean {
    if (!this.target) return false;

    // Calculate distance to target
    const distance = Phaser.Math.Distance.Between(
      this.container.x,
      this.container.y,
      this.target.x,
      this.target.y
    );

    // Check if close enough to target
    return distance < 5;
  }

  // Stop the robot's movement
  protected stopMoving(): void {
    // Stop physics body
    const body = this.container.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);

    // Stop dust effects
    if (this.dustEffects) {
      this.dustEffects.stop();
      this.dustEffects.stopMovementDust();
    }
  }

  // Update the state text
  protected updateStateText(): void {
    // Check if stateText exists and is active
    if (!this.stateText || !this.stateText.active) {
      return;
    }

    try {
      // Show only the state, not health percentage
      this.stateText.setText(this.robotState.toUpperCase());

      // Set a neutral color for the state text
      this.stateText.setColor("#FFFFFF");
    } catch (error) {
      console.warn("Error updating robot state text:", error);
    }
  }

  // Return to home position
  protected returnHome(): void {
    this.moveToTarget(this.homePosition);
    this.robotState = RobotState.RETURNING;
    this.updateStateText();
  }

  // Set carried resource
  protected setCarriedResource(
    resource: ResourceNode | null,
    emoji: string = ""
  ): void {
    this.carriedResource = resource;

    // Remove existing carried resource sprite
    if (this.carriedResourceSprite) {
      this.carriedResourceSprite.destroy();
      this.carriedResourceSprite = null;
    }

    // If resource is provided, create a new sprite
    if (resource) {
      this.carriedResourceSprite = this.scene.add
        .text(0, 15, emoji, {
          fontSize: "24px",
        })
        .setOrigin(0.5);
      this.container.add(this.carriedResourceSprite);

      // Update state
      this.robotState = RobotState.CARRYING;
      this.updateStateText();
    }
  }

  // Clear carried resource
  protected clearCarriedResource(): void {
    this.carriedResource = null;

    // Remove carried resource sprite
    if (this.carriedResourceSprite) {
      this.carriedResourceSprite.destroy();
      this.carriedResourceSprite = null;
    }
  }

  // Update dust and shadow effects
  protected updateDustEffects(time: number): void {
    super.updateDustEffects(time);

    // Update shadow effects
    this.updateShadowEffects();
  }

  // Handle death
  protected onDeath(): void {
    console.log(`${this.getRobotName()} has been destroyed!`);

    // Clean up shield effect
    this.cleanupShieldEffect();

    // Stop dust effects
    if (this.dustEffects) {
      this.dustEffects.stop();
      this.dustEffects.stopMovementDust();
    }

    // Clean up shadow effects
    this.cleanupShadowEffects();

    // Hide any equipped tool
    this.unequipWeapon();

    // Stop movement
    this.stopMoving();

    // Clean up UI elements
    if (this.stateText && this.stateText.active) {
      this.stateText.destroy();
    }

    if (this.label && this.label.active) {
      this.label.destroy();
    }

    if (this.healthBar) {
      this.healthBar.destroy();
      this.healthBar = null;
    }

    // Make the robot invisible immediately
    if (this.container) {
      this.container.setVisible(false);
    }

    // Play death animation or effect
    this.showDestructionEffect();

    // Remove the robot from the RobotManager
    const mainScene = this.scene as any;
    if (mainScene.robotManager) {
      mainScene.robotManager.removeRobot(this);
    } else {
      // Fallback to the old method if robotManager is not available
      if (mainScene.robots) {
        const index = mainScene.robots.indexOf(this);
        if (index !== -1) {
          mainScene.robots.splice(index, 1);
        }
      }
    }

    // Schedule the robot to be destroyed after the destruction effect
    this.scene.time.delayedCall(1000, () => {
      // Make sure the container is destroyed
      if (this.container && this.container.active) {
        this.container.destroy();
      }

      // Call destroy to clean up any remaining resources
      this.destroy();
    });
  }

  // Create explosion effect
  private showDestructionEffect(): void {
    // Create explosion particles
    const particles = this.scene.add.particles(
      this.container.x,
      this.container.y,
      "flare",
      {
        speed: { min: 50, max: 150 },
        scale: { start: 0.4, end: 0 },
        lifespan: 800,
        blendMode: "ADD",
        tint: 0xff8800, // Orange for robots
        quantity: 15,
        emitting: false,
      }
    );

    // Explode once
    particles.explode(20);

    // Clean up particles after animation completes
    this.scene.time.delayedCall(1000, () => {
      particles.destroy();
    });
  }

  // Clean up resources
  public destroy(fromScene?: boolean): void {
    // Clean up dust effects
    this.cleanupDustEffects();

    // Clean up shadow effects
    this.cleanupShadowEffects();

    // Clean up assault rifle
    if (this.assaultRifle) {
      this.assaultRifle.destroy();
      this.assaultRifle = null;
    }

    // Clean up health bar
    if (this.healthBar) {
      this.healthBar.destroy();
      this.healthBar = null;
    }

    // Clean up UI elements if they still exist
    try {
      if (this.stateText && this.stateText.active) {
        this.stateText.destroy();
        // Set to undefined instead of null to avoid type errors
        (this.stateText as any) = undefined;
      }

      if (this.label && this.label.active) {
        this.label.destroy();
        // Set to undefined instead of null to avoid type errors
        (this.label as any) = undefined;
      }

      if (this.carriedResourceSprite && this.carriedResourceSprite.active) {
        this.carriedResourceSprite.destroy();
        this.carriedResourceSprite = null;
      }
    } catch (error) {
      console.warn("Error cleaning up robot UI elements:", error);
    }

    // Make sure the container is destroyed if it still exists
    if (this.container && this.container.active) {
      this.container.destroy();
      // Set to undefined instead of null to avoid type errors
      (this.container as any) = undefined;
    }

    // Call parent destroy method
    super.destroy();
  }

  // Get the robot's state
  public getRobotState(): string {
    return this.robotState;
  }

  // Get the carried resource
  public getCarriedResource(): ResourceNode | null {
    return this.carriedResource;
  }

  // Get the robot's name
  public getRobotName(): string {
    return this.getRobotNameInternal();
  }

  // Override the damage method to ensure robots can be damaged
  public damage(amount: number): void {
    console.log(
      `Robot taking ${amount} damage. Current health: ${this.health}`
    );

    // Call the parent damage method
    super.damage(amount);

    // Only update UI elements if the robot is still alive
    if (this.isAlive()) {
      // Update the state text if it exists and is active
      if (this.stateText && this.stateText.active) {
        this.updateStateText();
      }

      // Update the health bar if it exists
      if (this.healthBar) {
        const mainScene = this.scene as any;
        if (mainScene.healthBarRenderer) {
          mainScene.healthBarRenderer.updateHealthBar(this.healthBar, this);
        }
      }

      // If health is low, switch to defending state if not already
      if (
        this.health < this.maxHealth * 0.5 &&
        this.robotState !== RobotState.DEFENDING
      ) {
        this.robotState = RobotState.DEFENDING;
        this.scanForEnemies(this.scene.time.now); // Immediately scan for enemies
      }
    }
  }

  // Override setHealthBar to ensure the health bar is added to the scene, not the container
  public setHealthBar(healthBar: Phaser.GameObjects.Container): void {
    this.healthBar = healthBar;

    // Add the health bar directly to the scene, not to the container
    this.scene.add.existing(healthBar);

    // Set initial position and update visibility
    this.updateHealthBarPosition();

    // Set a high depth to ensure it's visible above other elements when needed
    this.healthBar.setDepth(DEPTH.HEALTH_BAR);

    console.log(`Health bar created for ${this.getRobotName()}`);
  }

  // Override updateHealthBarPosition to handle container-based sprites
  protected updateHealthBarPosition(): void {
    if (this.healthBar) {
      this.healthBar.setPosition(this.container.x, this.container.y - 30);

      // Update health bar visibility based on health status
      const mainScene = this.scene as any;
      if (mainScene.healthBarRenderer) {
        mainScene.healthBarRenderer.updateHealthBar(this.healthBar, this);
      } else {
        // Create a temporary renderer if one doesn't exist in the scene
        const healthBarRenderer = new HealthBarRenderer(this.scene);
        healthBarRenderer.updateHealthBar(this.healthBar, this);
      }
    }
  }

  // Update the health bar
  protected updateHealthBar(): void {
    if (this.healthBar) {
      // Update position
      this.updateHealthBarPosition();

      // No need to update appearance here as it's already done in updateHealthBarPosition
    }
  }

  // Override the abstract update method from Agent
  public update(time: number, delta: number): void {
    // Update dust and shadow effects
    this.updateDustEffects(time);
    this.updateShadowEffects();

    // Update shield position and visibility
    this.updateShieldPosition();
    this.updateShieldEffect(time);

    // Update health bar position
    this.updateHealthBarPosition();

    // Scan for enemies periodically
    if (time - this.lastScanTime >= this.scanInterval) {
      this.scanForEnemies(time);
      this.lastScanTime = time;
    }

    // If in defending state, attack enemy if we have one
    if (this.robotState === RobotState.DEFENDING && this.enemyTarget) {
      this.attackEnemyTarget(time);
    }

    // Slowly recharge shield over time (0.5 points per second) if shield is equipped
    if (this.hasShield() && this.getCurrentShield() < this.getMaxShield()) {
      this.rechargeShield(delta / 2000); // Half the rate of player
    }
  }
}
