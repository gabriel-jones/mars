import * as Phaser from "phaser";
import { TILE_SIZE } from "../constants";
import { ResourceManager, ResourceType } from "../data/resources";

// Base Robot class that both robot types will inherit from
export enum RobotState {
  IDLE = "idle",
  MOVING = "moving",
  WORKING = "working",
  RETURNING = "returning",
}

type RobotType = "optimus" | "mining-drone";

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
        stroke: "#000000",
        strokeThickness: 2,
        align: "center",
      })
      .setOrigin(0.5);
    this.add(this.label);

    // Add state text
    this.stateText = scene.add
      .text(0, -25, "IDLE", {
        fontSize: "12px",
        color: "#FFFF00",
        stroke: "#000000",
        strokeThickness: 1,
        align: "center",
      })
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
    this.robotState = RobotState.MOVING;
    this.updateStateText();

    // Calculate direction to target
    const direction = new Phaser.Math.Vector2(
      target.x - this.x,
      target.y - this.y
    ).normalize();

    // Set velocity based on direction and speed
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(direction.x * this.speed, direction.y * this.speed);
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

    return distance < threshold;
  }

  // Return to home position
  protected returnHome(): void {
    this.robotState = RobotState.RETURNING;
    this.updateStateText();
    this.moveToTarget(this.homePosition);
  }

  // Stop moving
  protected stopMoving(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
  }

  // Update state text
  protected updateStateText(): void {
    this.stateText.setText(this.robotState);
  }
}

// Optimus class - can perform tasks like a player
export class Optimus extends Robot {
  private taskQueue: (() => void)[] = [];
  private currentTask: (() => void) | null = null;
  private taskCompleteTime: number = 0;
  private workDuration: number = 2000; // 2 seconds to complete a task

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "optimus", 150); // Using the optimus sprite
  }

  protected getRobotName(): string {
    return "Optimus";
  }

  // Add a task to the queue
  public addTask(task: () => void): void {
    this.taskQueue.push(task);
  }

  // Add a task to move to a position
  public moveToPosition(x: number, y: number): void {
    this.addTask(() => {
      this.moveToTarget(new Phaser.Math.Vector2(x, y));
    });
  }

  // Add a task to pick up an item
  //   public pickupItem(
  //     item: Phaser.GameObjects.Sprite | Phaser.GameObjects.Container
  //   ): void {
  //     this.addTask(() => {
  //       this.moveToTarget(new Phaser.Math.Vector2(item.x, item.y));
  //       // The actual pickup will happen in update when we reach the target
  //     });
  //   }

  // Add a task to work on a machine
  //   public workOnMachine(
  //     machine: Phaser.GameObjects.Sprite | Phaser.GameObjects.Container,
  //     duration: number = 2000
  //   ): void {
  //     this.addTask(() => {
  //       this.moveToTarget(new Phaser.Math.Vector2(machine.x, machine.y));
  //       // The actual work will happen in update when we reach the target
  //       this.workDuration = duration;
  //     });
  //   }

  //   // Add a task to build something
  //   public buildStructure(x: number, y: number, structureType: string): void {
  //     this.addTask(() => {
  //       this.moveToTarget(new Phaser.Math.Vector2(x, y));
  //       // The actual building will happen in update when we reach the target
  //     });
  //   }

  public update(): void {
    // Update state text
    this.updateStateText();

    // If we're moving, check if we've reached the target
    if (this.robotState === RobotState.MOVING && this.hasReachedTarget()) {
      this.stopMoving();
      this.robotState = RobotState.WORKING;
      this.updateStateText();

      // Set a timer for task completion
      this.taskCompleteTime = this.scene.time.now + this.workDuration;
    }

    // If we're working, check if the task is complete
    if (
      this.robotState === RobotState.WORKING &&
      this.scene.time.now >= this.taskCompleteTime
    ) {
      this.robotState = RobotState.IDLE;
      this.updateStateText();
      this.currentTask = null;

      // Return home if no more tasks
      if (this.taskQueue.length === 0) {
        this.returnHome();
      }
    }

    // If we're returning and have reached home, go idle
    if (this.robotState === RobotState.RETURNING && this.hasReachedTarget()) {
      this.stopMoving();
      this.robotState = RobotState.IDLE;
      this.updateStateText();
    }

    // If we're idle and have tasks, start the next one
    if (this.robotState === RobotState.IDLE && this.taskQueue.length > 0) {
      this.currentTask = this.taskQueue.shift()!;
      this.currentTask();
    }
  }
}

// Mining Drone class - specialized for mining regolith
export class MiningDrone extends Robot {
  private miningArea: Phaser.Geom.Rectangle;
  private depositTarget:
    | Phaser.GameObjects.Sprite
    | Phaser.GameObjects.Container
    | null = null;
  private carryingResource: boolean = false;
  private resourceAmount: number = 0;
  private maxResourceCapacity: number = 10;
  private miningDuration: number = 1500; // 1.5 seconds to mine
  private miningCompleteTime: number = 0;
  private resourceType: ResourceType = "silicon"; // Default to silicon for regolith

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    miningAreaWidth: number = 200,
    miningAreaHeight: number = 200,
    depositTarget:
      | Phaser.GameObjects.Sprite
      | Phaser.GameObjects.Container
      | null = null
  ) {
    super(scene, x, y, "mining-drone", 120); // Using the mining drone sprite

    // Set mining area centered on the home position
    this.miningArea = new Phaser.Geom.Rectangle(
      x - miningAreaWidth / 2,
      y - miningAreaHeight / 2,
      miningAreaWidth,
      miningAreaHeight
    );

    // Set deposit target
    this.depositTarget = depositTarget;
  }

  protected getRobotName(): string {
    return "Mining Drone";
  }

  // Set the deposit target
  public setDepositTarget(
    target: Phaser.GameObjects.Sprite | Phaser.GameObjects.Container
  ): void {
    this.depositTarget = target;
  }

  // Set the mining area
  public setMiningArea(
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    this.miningArea = new Phaser.Geom.Rectangle(x, y, width, height);
  }

  // Set the resource type to mine
  public setResourceType(type: ResourceType): void {
    this.resourceType = type;
  }

  public update(): void {
    // Update state text with resource info if carrying
    if (this.carryingResource) {
      this.stateText.setText(`${this.robotState} (${this.resourceAmount})`);
    } else {
      this.updateStateText();
    }

    // State machine for the mining drone
    switch (this.robotState) {
      case RobotState.IDLE:
        // If not carrying resources, find a mining spot
        if (!this.carryingResource) {
          this.findMiningSpot();
        }
        // If carrying resources and have a deposit target, go there
        else if (this.depositTarget) {
          this.robotState = RobotState.RETURNING;
          this.updateStateText();
          this.moveToTarget(
            new Phaser.Math.Vector2(this.depositTarget.x, this.depositTarget.y)
          );
        }
        break;

      case RobotState.MOVING:
        // Check if we've reached the target
        if (this.hasReachedTarget()) {
          this.stopMoving();

          // If not carrying resources, start mining
          if (!this.carryingResource) {
            this.robotState = RobotState.WORKING;
            this.updateStateText();
            this.miningCompleteTime = this.scene.time.now + this.miningDuration;
          }
        }
        break;

      case RobotState.WORKING:
        // Check if mining is complete
        if (this.scene.time.now >= this.miningCompleteTime) {
          // Collect resources
          this.resourceAmount = this.maxResourceCapacity;
          this.carryingResource = true;

          // If we have a deposit target, go there
          if (this.depositTarget) {
            this.robotState = RobotState.RETURNING;
            this.updateStateText();
            this.moveToTarget(
              new Phaser.Math.Vector2(
                this.depositTarget.x,
                this.depositTarget.y
              )
            );
          } else {
            // No deposit target, go idle
            this.robotState = RobotState.IDLE;
            this.updateStateText();
          }
        }
        break;

      case RobotState.RETURNING:
        // Check if we've reached the deposit target
        if (this.hasReachedTarget()) {
          this.stopMoving();

          // Deposit resources
          if (this.carryingResource && this.depositTarget) {
            // Add resources to inventory
            ResourceManager.addResource(this.resourceType, this.resourceAmount);

            // Reset carrying state
            this.carryingResource = false;
            this.resourceAmount = 0;

            // Go back to idle to start the cycle again
            this.robotState = RobotState.IDLE;
            this.updateStateText();
          }
        }
        break;
    }
  }

  // Find a random spot within the mining area to mine
  private findMiningSpot(): void {
    const x = Phaser.Math.Between(
      this.miningArea.x,
      this.miningArea.x + this.miningArea.width
    );
    const y = Phaser.Math.Between(
      this.miningArea.y,
      this.miningArea.y + this.miningArea.height
    );

    this.robotState = RobotState.MOVING;
    this.updateStateText();
    this.moveToTarget(new Phaser.Math.Vector2(x, y));
  }
}
