import * as Phaser from "phaser";
import { Robot, RobotState } from "./Robot";

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
