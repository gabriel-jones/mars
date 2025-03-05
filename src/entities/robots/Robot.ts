import * as Phaser from "phaser";
import { TILE_SIZE, ROBOT_VELOCITY } from "../../constants";

// Robot states
export enum RobotState {
  IDLE = "idle",
  MOVING = "moving",
  WORKING = "working",
  RETURNING = "returning",
}

// Robot types
export type RobotType = "optimus" | "mining-drone";

// Base Robot class
export abstract class Robot extends Phaser.GameObjects.Container {
  protected sprite: Phaser.GameObjects.Sprite;
  protected robotState: RobotState;
  protected target: Phaser.Math.Vector2 | null = null;
  protected homePosition: Phaser.Math.Vector2;
  protected speed: number;
  protected label: Phaser.GameObjects.Text;
  protected stateText: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    robotType: RobotType,
    speed: number = 100
  ) {
    super(scene, x, y);

    // Set home position
    this.homePosition = new Phaser.Math.Vector2(x, y);

    // Create the robot sprite
    this.sprite = scene.add
      .sprite(0, 0, robotType)
      .setOrigin(0.5)
      .setDisplaySize(TILE_SIZE, TILE_SIZE)
      .setDepth(5);
    this.add(this.sprite);

    // Add a label showing the robot type
    this.label = scene.add
      .text(0, -40, this.getRobotName(), {
        fontSize: "14px",
        color: "#FFFFFF",
        align: "center",
      })
      .setOrigin(0.5);
    this.add(this.label);

    // Add state text
    this.stateText = scene.add
      .text(0, -25, "IDLE", {
        fontSize: "12px",
        color: "#FFFFFF",
        align: "center",
      })
      .setAlpha(0.75)
      .setOrigin(0.5);
    this.add(this.stateText);

    // Set initial state
    this.robotState = RobotState.IDLE;

    // Set movement speed
    this.speed = speed;

    // Add physics to the robot
    scene.physics.world.enable(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(true);

    // Add to scene
    scene.add.existing(this);
  }

  // Abstract methods that derived classes must implement
  protected abstract getRobotName(): string;
  public abstract update(): void;

  // Move robot to a target position
  protected moveToTarget(target: Phaser.Math.Vector2): void {
    if (!target) return;

    this.target = target;

    // If we're already in the MOVING state, don't change it
    if (
      this.robotState !== RobotState.MOVING &&
      this.robotState !== RobotState.RETURNING
    ) {
      this.robotState = RobotState.MOVING;
      this.updateStateText();
    }

    console.log(`Moving to target (${target.x}, ${target.y})`);

    // Calculate distance to target
    const distance = Phaser.Math.Distance.Between(
      this.x,
      this.y,
      target.x,
      target.y
    );

    // Calculate duration based on distance and player velocity
    // This ensures robots move at a speed similar to the player
    const duration = (distance / ROBOT_VELOCITY) * 1000; // Convert to milliseconds

    // Use tweens for all movement for consistency
    this.scene.tweens.add({
      targets: this,
      x: target.x,
      y: target.y,
      duration: duration,
      ease: "Linear",
      onComplete: () => {
        console.log(`Reached target (${target.x}, ${target.y})`);
        this.stopMoving();

        // If we're returning, we need to handle deposit logic in the update method
        // Otherwise, we can transition to IDLE
        if (this.robotState !== RobotState.RETURNING) {
          this.robotState = RobotState.IDLE;
          this.updateStateText();
        }
      },
    });
  }

  // Check if robot has reached its target
  protected hasReachedTarget(threshold: number = 10): boolean {
    if (!this.target) return false;

    const distance = Phaser.Math.Distance.Between(
      this.x,
      this.y,
      this.target.x,
      this.target.y
    );

    const reached = distance < threshold;

    if (reached) {
      console.log(
        `Reached target (${this.target.x}, ${this.target.y}), distance: ${distance}`
      );
    }

    return reached;
  }

  // Return to home position
  protected returnHome(): void {
    this.robotState = RobotState.RETURNING;
    this.updateStateText();
    this.moveToTarget(this.homePosition);
  }

  // Stop moving
  protected stopMoving(): void {
    // Stop physics-based movement if we have a physics body
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body) {
      body.setVelocity(0, 0);
    }

    // Stop any active tweens on this object
    this.scene.tweens.killTweensOf(this);

    console.log(`Stopped moving at (${this.x}, ${this.y})`);
  }

  // Update state text
  protected updateStateText(): void {
    this.stateText.setText(this.robotState);
  }
}
