import * as Phaser from "phaser";
import { TILE_SIZE, ROBOT_VELOCITY, DUST_COLOR } from "../../constants";
import { ResourceNode } from "../resourceNode";
import { DustEffects } from "../../effects/DustEffects";

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
export abstract class Robot extends Phaser.GameObjects.Container {
  protected sprite: Phaser.GameObjects.Sprite;
  protected robotState: RobotState;
  protected target: Phaser.Math.Vector2 | null = null;
  protected homePosition: Phaser.Math.Vector2;
  protected speed: number;
  protected label: Phaser.GameObjects.Text;
  protected stateText: Phaser.GameObjects.Text;
  protected carriedResource: ResourceNode | null = null;
  protected carriedResourceSprite: Phaser.GameObjects.Text | null = null;
  protected dustEffects: DustEffects;

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

    // Create dust effects
    this.dustEffects = new DustEffects(scene, this, {
      dustColor: DUST_COLOR,
      dustSize: 5,
      dustAlpha: 0.6,
      dustCount: 10,
      dustInterval: 80,
      dustLifetime: 900,
      movementDustColor: DUST_COLOR,
      movementDustSize: 4,
      movementDustAlpha: 0.7,
      movementDustCount: 16,
    });

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
      this.robotState !== RobotState.RETURNING &&
      this.robotState !== RobotState.CARRYING
    ) {
      // If carrying a resource, set state to CARRYING, otherwise MOVING
      this.robotState = this.carriedResource
        ? RobotState.CARRYING
        : RobotState.MOVING;
      this.updateStateText();
    }

    // Start dust effects when moving
    this.dustEffects.start();
    this.dustEffects.startMovementDust();

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

        // Call onReachTarget to allow derived classes to handle target reached events
        this.onReachTarget();

        // If we're returning, we need to handle deposit logic in the update method
        // Otherwise, we can transition to IDLE
        if (this.robotState !== RobotState.RETURNING) {
          this.robotState = this.carriedResource
            ? RobotState.CARRYING
            : RobotState.IDLE;
          this.updateStateText();
        }
      },
    });
  }

  // Method to be overridden by derived classes to handle target reached events
  protected onReachTarget(): void {
    // Base implementation does nothing
    // Derived classes can override this to add custom behavior
  }

  // Check if the robot has reached its target
  protected hasReachedTarget(): boolean {
    if (!this.target) return false;

    const distance = Phaser.Math.Distance.Between(
      this.x,
      this.y,
      this.target.x,
      this.target.y
    );

    return distance < 5; // Close enough to consider "reached"
  }

  // Stop the robot's movement
  protected stopMoving(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);

    // Stop dust effects when not moving
    if (this.robotState !== RobotState.WORKING) {
      this.dustEffects.stop();
      this.dustEffects.stopMovementDust();
    }
  }

  // Update the state text
  protected updateStateText(): void {
    if (this.carriedResource) {
      this.stateText.setText(`${this.robotState.toUpperCase()} (CARRYING)`);
    } else {
      this.stateText.setText(this.robotState.toUpperCase());
    }
  }

  // Return to home position
  protected returnHome(): void {
    this.robotState = RobotState.RETURNING;
    this.updateStateText();
    this.moveToTarget(this.homePosition);
  }

  // Set up carrying a resource
  protected setCarriedResource(
    resource: ResourceNode | null,
    emoji: string = ""
  ): void {
    // Clear any existing carried resource
    if (this.carriedResourceSprite) {
      this.carriedResourceSprite.destroy();
      this.carriedResourceSprite = null;
    }

    this.carriedResource = resource;

    // If we have a resource to carry, create a visual representation
    if (resource && emoji) {
      this.carriedResourceSprite = this.scene.add
        .text(0, -10, emoji, {
          fontSize: "24px",
        })
        .setOrigin(0.5);
      this.add(this.carriedResourceSprite);

      // Update the state text to show we're carrying something
      this.updateStateText();
    }
  }

  // Clear carried resource
  protected clearCarriedResource(): void {
    if (this.carriedResourceSprite) {
      this.carriedResourceSprite.destroy();
      this.carriedResourceSprite = null;
    }

    this.carriedResource = null;
    this.updateStateText();
  }

  // Update dust effects
  protected updateDustEffects(time: number): void {
    if (this.dustEffects) {
      this.dustEffects.update(time);

      // If the robot is moving, show movement dust
      if (
        this.robotState === RobotState.MOVING ||
        this.robotState === RobotState.RETURNING
      ) {
        this.dustEffects.startMovementDust();
      } else {
        this.dustEffects.stopMovementDust();
      }

      // If the robot is working, show working dust
      if (this.robotState === RobotState.WORKING) {
        this.dustEffects.showWorkingDust();
      } else {
        this.dustEffects.hideWorkingDust();
      }
    }
  }

  // Clean up resources when destroyed
  public destroy(fromScene?: boolean): void {
    if (this.dustEffects) {
      this.dustEffects.destroy();
    }
    super.destroy(fromScene);
  }
}
