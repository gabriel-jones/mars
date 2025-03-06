import * as Phaser from "phaser";
import { TILE_SIZE, ROBOT_VELOCITY, DUST_COLOR } from "../../constants";
import { ResourceNode } from "../resourceNode";
import { DustEffects } from "../../effects/DustEffects";
import { Agent } from "../Agent";

// Robot states
export enum RobotState {
  IDLE = "idle",
  MOVING = "moving",
  WORKING = "working",
  RETURNING = "returning",
  CARRYING = "carrying",
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
      .setDisplaySize(TILE_SIZE, TILE_SIZE)
      .setDepth(5);
    container.add(sprite);

    // Add a label showing the robot type
    this.label = scene.add
      .text(0, -40, this.getRobotName(), {
        fontSize: "14px",
        color: "#FFFFFF",
        align: "center",
      })
      .setOrigin(0.5);
    container.add(this.label);

    // Add state text
    this.stateText = scene.add
      .text(0, -25, "IDLE", {
        fontSize: "12px",
        color: "#FFFFFF",
        align: "center",
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

    // Add to scene
    scene.add.existing(container);
  }

  // Abstract methods to be implemented by subclasses
  protected abstract getRobotNameInternal(): string;
  public abstract update(time: number, delta: number): void;

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

    // Update state
    this.robotState = RobotState.MOVING;
    this.updateStateText();

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
    this.stateText.setText(this.robotState.toUpperCase());
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

    // Stop dust effects
    if (this.dustEffects) {
      this.dustEffects.stop();
      this.dustEffects.stopMovementDust();
    }

    // Clean up shadow effects
    this.cleanupShadowEffects();

    // Stop movement
    this.stopMoving();

    // Set alpha to indicate destruction
    this.container.setAlpha(0.5);

    // You might want to trigger an explosion effect or animation here
  }

  // Destroy the robot
  public destroy(fromScene?: boolean): void {
    // Clean up dust effects
    this.cleanupDustEffects();

    // Clean up shadow effects
    this.cleanupShadowEffects();

    // Clean up carried resource
    this.clearCarriedResource();

    // Remove from scene
    if (this.container) {
      this.container.destroy();
    }
  }

  // Get robot state
  public getRobotState(): string {
    return this.robotState;
  }

  // Get carried resource
  public getCarriedResource(): ResourceNode | null {
    return this.carriedResource;
  }

  // Get robot name
  public getRobotName(): string {
    return this.getRobotNameInternal();
  }
}
