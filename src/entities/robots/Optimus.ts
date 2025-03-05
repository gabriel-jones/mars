import * as Phaser from "phaser";
import { Robot, RobotState } from "./Robot";
import { ResourceNode } from "../resourceNode";
import { ResourceManager } from "../../data/resources";
import { JobManager, Job, JobType } from "./JobManager";

// Optimus class - can perform tasks like a player
export class Optimus extends Robot {
  private taskQueue: (() => void)[] = [];
  private currentTask: (() => void) | null = null;
  private taskCompleteTime: number = 0;
  private resourceAmount: number = 0;
  private resourceType: string = "";
  private targetResourceNode: ResourceNode | null = null;
  private jobCheckTimer: number = 0;
  private jobCheckInterval: number = 3000; // Check for jobs every 3 seconds
  private currentJob: Job | null = null;
  private robotId: string;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "optimus", 150); // Using the optimus sprite
    // Generate a unique ID for this robot
    this.robotId = `optimus_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  }

  protected getRobotName(): string {
    return "Optimus";
  }

  public getRobotId(): string {
    return this.robotId;
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

  // Add a task to pick up a resource node
  public pickupResourceNode(resourceNode: ResourceNode): void {
    this.addTask(() => {
      this.targetResourceNode = resourceNode;
      this.moveToTarget(
        new Phaser.Math.Vector2(resourceNode.x, resourceNode.y)
      );
      // The actual pickup will happen in update when we reach the target
    });
  }

  // Add a task to deliver a resource to another node
  public deliverResourceToNode(targetNode: ResourceNode): void {
    this.addTask(() => {
      this.targetResourceNode = targetNode;
      this.moveToTarget(new Phaser.Math.Vector2(targetNode.x, targetNode.y));
      // The actual delivery will happen in update when we reach the target
    });
  }

  // Look for available jobs
  private findAndAssignJob(): boolean {
    // Get the job manager instance
    const jobManager = JobManager.getInstance();

    // First check if there are any available jobs
    const availableJobs = jobManager.getAvailableJobs();

    if (availableJobs.length > 0) {
      // Take the first available job
      const job = availableJobs[0];

      // Assign the job to this robot
      if (jobManager.assignJob(job.id, this.robotId)) {
        this.currentJob = job;

        // Process the job based on its type
        switch (job.type) {
          case JobType.MERGE_STACKS:
            if (job.sourceNode && job.targetNode) {
              console.log(
                `Robot ${this.robotId} assigned to merge stacks job ${job.id}`
              );

              // Add tasks to pick up the source node and deliver to target
              this.pickupResourceNode(job.sourceNode);
              this.deliverResourceToNode(job.targetNode);
            }
            break;

          case JobType.WORK_MACHINE:
            if (job.targetNode) {
              console.log(
                `Robot ${this.robotId} assigned to work machine job ${job.id}`
              );

              // Move to the machine and work on it
              this.addTask(() => {
                this.targetResourceNode = job.targetNode as ResourceNode;
                this.moveToTarget(
                  new Phaser.Math.Vector2(job.targetNode!.x, job.targetNode!.y)
                );
              });
            }
            break;

          case JobType.BUILD:
            if (job.position) {
              console.log(
                `Robot ${this.robotId} assigned to build job ${job.id}`
              );

              // Move to the build location and work on it
              this.addTask(() => {
                this.moveToTarget(job.position!);
              });
            }
            break;
        }

        return true;
      }
    }

    // If no existing jobs, look for new merge stack jobs
    jobManager.findMergeStackJobs();

    // Try again with newly created jobs
    const newJobs = jobManager.getAvailableJobs();
    if (newJobs.length > 0) {
      const job = newJobs[0];

      if (jobManager.assignJob(job.id, this.robotId)) {
        this.currentJob = job;

        // Process the job based on its type
        switch (job.type) {
          case JobType.MERGE_STACKS:
            if (job.sourceNode && job.targetNode) {
              console.log(
                `Robot ${this.robotId} assigned to merge stacks job ${job.id}`
              );

              // Add tasks to pick up the source node and deliver to target
              this.pickupResourceNode(job.sourceNode);
              this.deliverResourceToNode(job.targetNode);
            }
            break;

          case JobType.WORK_MACHINE:
            if (job.targetNode) {
              console.log(
                `Robot ${this.robotId} assigned to work machine job ${job.id}`
              );

              // Move to the machine and work on it
              this.addTask(() => {
                this.targetResourceNode = job.targetNode as ResourceNode;
                this.moveToTarget(
                  new Phaser.Math.Vector2(job.targetNode!.x, job.targetNode!.y)
                );
              });
            }
            break;

          case JobType.BUILD:
            if (job.position) {
              console.log(
                `Robot ${this.robotId} assigned to build job ${job.id}`
              );

              // Move to the build location and work on it
              this.addTask(() => {
                this.moveToTarget(job.position!);
              });
            }
            break;
        }

        return true;
      }
    }

    return false;
  }

  // Pick up a resource from a node
  private pickupResource(resourceNode: ResourceNode): void {
    if (!resourceNode) return;

    // Get the resource type and amount
    const resource = resourceNode.getResource();
    const amount = resourceNode.getAmount();

    // Store the resource information
    this.resourceType = resource.type;
    this.resourceAmount = amount;

    // Use the base class method to set up carrying
    this.setCarriedResource(resourceNode, resource.emoji);

    // Remove the resource node from the scene (it's being carried)
    resourceNode.harvest(amount);
  }

  // Deliver the carried resource to a target node
  private deliverResource(targetNode: ResourceNode): void {
    if (!this.carriedResource) return;

    // Add the carried amount to the target node
    targetNode.addAmount(this.resourceAmount);

    // Add the resource to the inventory
    if (this.resourceType && this.resourceAmount > 0) {
      ResourceManager.addResource(
        this.resourceType as any,
        this.resourceAmount
      );
    }

    // Clear the carried resource using the base class method
    this.clearCarriedResource();
    this.resourceAmount = 0;
  }

  public update(): void {
    // Update state text
    this.updateStateText();

    // Update dust effects
    this.updateDustEffects(this.scene.time.now);

    // Check for jobs periodically when idle
    if (
      this.robotState === RobotState.IDLE &&
      this.taskQueue.length === 0 &&
      !this.currentJob
    ) {
      if (this.scene.time.now > this.jobCheckTimer) {
        // Look for and assign a job
        this.findAndAssignJob();

        // Set the next job check time
        this.jobCheckTimer = this.scene.time.now + this.jobCheckInterval;
      }
    }

    // If we're moving or carrying, check if we've reached the target
    if (
      (this.robotState === RobotState.MOVING ||
        this.robotState === RobotState.CARRYING) &&
      this.hasReachedTarget()
    ) {
      this.stopMoving();

      // If we have a target resource node and we're not carrying anything, pick it up
      if (this.targetResourceNode && !this.carriedResource) {
        this.pickupResource(this.targetResourceNode);
        this.targetResourceNode = null;

        // For pickup tasks (part of MERGE_STACKS), don't enter working state
        // Just go straight to carrying and continue to the next task
        this.robotState = RobotState.CARRYING;
        this.updateStateText();

        // If we have more tasks, immediately process the next one (which should be delivery)
        if (this.taskQueue.length > 0) {
          this.currentTask = this.taskQueue.shift()!;
          this.currentTask();
        }
      }
      // If we're carrying a resource and have reached the target, deliver it
      else if (this.carriedResource && this.targetResourceNode) {
        this.deliverResource(this.targetResourceNode);
        this.targetResourceNode = null;
        this.robotState = RobotState.IDLE;
        this.updateStateText();
      }
      // Otherwise, check if we need to work on this job
      else if (this.currentJob && this.currentJob.workDuration > 0) {
        this.robotState = RobotState.WORKING;
        this.updateStateText();

        // Set a timer for task completion based on the job's work duration
        this.taskCompleteTime =
          this.scene.time.now + this.currentJob.workDuration;
      }
      // If no work duration, just go idle
      else {
        this.robotState = RobotState.IDLE;
        this.updateStateText();
      }
    }

    // If we're working, check if the task is complete
    if (
      this.robotState === RobotState.WORKING &&
      this.scene.time.now >= this.taskCompleteTime
    ) {
      this.robotState = RobotState.IDLE;
      this.updateStateText();

      // If we have a current job and we've completed the work, mark it as completed
      if (
        this.currentJob &&
        (this.currentJob.type === JobType.WORK_MACHINE ||
          this.currentJob.type === JobType.BUILD)
      ) {
        JobManager.getInstance().completeJob(this.currentJob.id);
        this.currentJob = null;
      }

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
