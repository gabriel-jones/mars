import * as Phaser from "phaser";
import { Robot, RobotState } from "./Robot";
import { ResourceNode } from "../resourceNode";
import { ResourceManager, ResourceType } from "../../data/resources";
import { JobManager, Job, JobType } from "./JobManager";
import { Blueprint } from "../buildings/Blueprint";
import { TILE_SIZE } from "../../constants";

// Optimus class - can perform tasks like a player
export class Optimus extends Robot {
  private taskQueue: (() => void)[] = [];
  private currentTask: (() => void) | null = null;
  private taskCompleteTime: number = 0;
  private resourceAmount: number = 0;
  private resourceType: string = "";
  private targetResourceNode: ResourceNode | null = null;
  private targetBlueprint: Blueprint | null = null;
  private jobCheckTimer: number = 0;
  private jobCheckInterval: number = 1000; // Check for jobs every 1 second (reduced from 3 seconds)
  private currentJob: Job | null = null;
  private robotId: string;
  private wanderTimer: number = 0;
  private wanderIntervalMin: number = 3000; // Minimum time between wandering (3 seconds)
  private wanderIntervalMax: number = 8000; // Maximum time between wandering (8 seconds)
  private wanderRadius: number = 5 * TILE_SIZE; // 5 blocks

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "optimus", 150); // Using the optimus sprite
    // Generate a unique ID for this robot
    this.robotId = `optimus-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    // Initialize wander timer with a random offset to prevent all robots from moving at once
    this.wanderTimer = scene.time.now + Math.random() * this.wanderIntervalMax;
  }

  protected getRobotNameInternal(): string {
    return "Optimus";
  }

  public getRobotId(): string {
    return this.robotId;
  }

  public getResourceType(): string {
    return this.resourceType;
  }

  public getResourceAmount(): number {
    return this.resourceAmount;
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

  // Add a task to deliver a resource to a blueprint
  public deliverResourceToBlueprint(
    blueprint: Blueprint,
    resourceType: string,
    amount: number
  ): void {
    console.log(
      `Robot ${this.robotId} adding task to deliver ${amount} ${resourceType} to blueprint`
    );

    this.addTask(() => {
      // Store the resource type and amount
      this.resourceType = resourceType;
      this.resourceAmount = amount;

      // Move to the blueprint
      console.log(
        `Robot ${this.robotId} moving to blueprint at (${blueprint.x}, ${blueprint.y})`
      );
      this.moveToTarget(new Phaser.Math.Vector2(blueprint.x, blueprint.y));

      // The actual delivery will happen in update when we reach the target
      this.targetBlueprint = blueprint;
    });
  }

  // Look for available jobs
  private findAndAssignJob(): boolean {
    // Skip if we already have a job
    if (this.currentJob) {
      console.log(
        `Robot ${this.robotId} already has job ${this.currentJob.id}, skipping job search`
      );
      return false;
    }

    // Skip if we're not idle
    if (this.robotState !== RobotState.IDLE) {
      console.log(
        `Robot ${this.robotId} is not idle (state: ${this.robotState}), skipping job search`
      );
      return false;
    }

    // Get the job manager instance
    const jobManager = JobManager.getInstance();

    // Prioritize resource delivery jobs
    const priorityJobTypes = [
      JobType.DELIVER_RESOURCE,
      JobType.BUILD,
      JobType.MERGE_STACKS,
    ];

    // First check if there are any available jobs with priority for resource delivery
    const availableJobs = jobManager.getAvailableJobs(priorityJobTypes);

    if (availableJobs.length > 0) {
      // Take the first available job
      const job = availableJobs[0];

      // Assign the job to this robot
      if (jobManager.assignJob(job.id, this.robotId)) {
        this.currentJob = job;

        console.log(
          `Robot ${this.robotId} assigned to ${job.type} job ${job.id}`
        );

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

          case JobType.DELIVER_RESOURCE:
            if (
              job.sourceNode &&
              job.position &&
              job.blueprint &&
              job.resourceType &&
              job.resourceAmount
            ) {
              console.log(
                `Robot ${this.robotId} assigned to deliver resource job ${job.id}`
              );

              // Add tasks to pick up the resource and deliver to blueprint
              this.pickupResourceNode(job.sourceNode);
              this.deliverResourceToBlueprint(
                job.blueprint,
                job.resourceType,
                job.resourceAmount
              );
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

          case JobType.DELIVER_RESOURCE:
            if (
              job.sourceNode &&
              job.position &&
              job.blueprint &&
              job.resourceType &&
              job.resourceAmount
            ) {
              console.log(
                `Robot ${this.robotId} assigned to deliver resource job ${job.id}`
              );

              // Add tasks to pick up the resource and deliver to blueprint
              this.pickupResourceNode(job.sourceNode);
              this.deliverResourceToBlueprint(
                job.blueprint,
                job.resourceType,
                job.resourceAmount
              );
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
    const availableAmount = resourceNode.getAmount();

    // Determine how much to pick up
    let amountToPickup = availableAmount;

    // If this is for a delivery job, only pick up what's needed
    if (
      this.currentJob &&
      this.currentJob.type === JobType.DELIVER_RESOURCE &&
      this.currentJob.resourceAmount
    ) {
      amountToPickup = Math.min(
        availableAmount,
        this.currentJob.resourceAmount
      );
      console.log(
        `Robot ${this.robotId} picking up ${amountToPickup}/${availableAmount} ${resource.type} for delivery job`
      );
    } else {
      console.log(
        `Robot ${this.robotId} picking up all ${availableAmount} ${resource.type}`
      );
    }

    // Store the resource information
    this.resourceType = resource.type;
    this.resourceAmount = amountToPickup;

    // Create a temporary resource node for carrying (this won't be added to the scene)
    const tempNode = new ResourceNode(
      this.scene,
      0,
      0,
      resource,
      amountToPickup
    );
    tempNode.setVisible(false); // Hide it since it's just for data storage

    // Use the base class method to set up carrying
    this.setCarriedResource(tempNode, resource.emoji);

    // Remove the picked up amount from the original resource node
    // This will only destroy the node if it's completely empty
    resourceNode.harvest(amountToPickup);
  }

  // Drop the currently carried resource back to the ground
  private dropResource(): void {
    // If we're not carrying anything, do nothing
    if (this.resourceAmount <= 0) return;

    console.log(`Dropping ${this.resourceAmount} ${this.resourceType}`);

    // Get the resource object from the resource type
    const resource = ResourceManager.getResource(
      this.resourceType as ResourceType
    );

    if (resource) {
      // Create a new resource node at our position
      new ResourceNode(
        this.scene,
        this.container.x,
        this.container.y,
        resource,
        this.resourceAmount
      );
    }

    // Clear our carried resource
    this.resourceAmount = 0;
    this.resourceType = "";
    this.clearCarriedResource();
  }

  // Deliver the carried resource to a target node
  private deliverResource(targetNode: ResourceNode): void {
    if (!this.carriedResource) return;

    console.log(
      `Robot ${this.robotId} delivering ${this.resourceAmount} ${this.resourceType} to node`
    );

    // Add the carried amount to the target node
    targetNode.addAmount(this.resourceAmount);

    // Add the resource to the inventory if needed
    if (this.resourceType && this.resourceAmount > 0) {
      ResourceManager.addResource(
        this.resourceType as any,
        this.resourceAmount
      );
    }

    // Clear the carried resource
    if (this.carriedResource) {
      this.carriedResource.destroy();
      this.carriedResource = null;
    }

    // Clear the carried resource sprite
    this.clearCarriedResource();

    // Reset resource information
    this.resourceAmount = 0;
    this.resourceType = "";
  }

  // Make the robot wander around its home position
  private wanderAroundHome(): void {
    // Check if the robot is already too far from home
    const distanceFromHome = Phaser.Math.Distance.Between(
      this.container.x,
      this.container.y,
      this.homePosition.x,
      this.homePosition.y
    );

    // If the robot is already at the edge of the wander radius, return home first
    if (distanceFromHome >= this.wanderRadius * 0.8) {
      console.log(
        `Robot ${this.robotId} too far from home, returning before wandering again`
      );
      this.returnHome();
      return;
    }

    // Calculate a random position within the wander radius
    const angle = Math.random() * Math.PI * 2; // Random angle in radians
    const distance = Math.random() * this.wanderRadius; // Random distance within radius

    // Calculate new position
    const newX = this.homePosition.x + Math.cos(angle) * distance;
    const newY = this.homePosition.y + Math.sin(angle) * distance;

    console.log(`Robot ${this.robotId} wandering to (${newX}, ${newY})`);

    // Move to the new position
    this.moveToTarget(new Phaser.Math.Vector2(newX, newY));

    // Set the next wander time with a random interval
    const nextInterval =
      this.wanderIntervalMin +
      Math.random() * (this.wanderIntervalMax - this.wanderIntervalMin);
    this.wanderTimer = this.scene.time.now + nextInterval;
  }

  // Update the optimus robot
  public update(time: number, delta: number): void {
    // Update state text
    this.updateStateText();

    // Update dust effects
    this.updateDustEffects(time);

    // Check if current job is completed or cancelled
    if (this.currentJob && this.carriedResource) {
      const jobManager = JobManager.getInstance();
      const jobStillExists = jobManager.getJobById(this.currentJob.id);

      // If job no longer exists (was cancelled) and we're carrying resources, drop them
      if (!jobStillExists) {
        console.log(
          `Robot ${this.robotId} detected job ${this.currentJob.id} was cancelled, dropping resources`
        );
        this.dropResource();
        this.currentJob = null;
        return;
      }
    }

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

      // Wander around when idle and not already moving
      if (this.scene.time.now > this.wanderTimer && !this.target) {
        this.wanderAroundHome();
        // Note: wanderTimer is now set inside wanderAroundHome
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
      // If we're carrying a resource and have reached a blueprint, deliver to the blueprint
      else if (this.carriedResource && this.targetBlueprint) {
        console.log(
          `Robot ${this.robotId} reached blueprint with carried resource`
        );

        // Get the resource type and amount from the carried resource
        const resourceType = this.resourceType as ResourceType;
        const amount = this.resourceAmount;

        console.log(`Robot ${this.robotId} carrying ${amount} ${resourceType}`);

        // Add the resource to the blueprint
        const amountAdded = this.targetBlueprint.addResource(
          resourceType,
          amount
        );

        console.log(
          `Robot ${this.robotId} delivered ${amountAdded} ${resourceType} to blueprint`
        );

        // If we couldn't deliver all resources (blueprint might be full or doesn't need more)
        if (amountAdded < amount) {
          const remainingAmount = amount - amountAdded;
          console.log(
            `Robot ${this.robotId} has ${remainingAmount} ${resourceType} remaining`
          );

          // Create a new resource node with the remaining resources
          const resource = ResourceManager.getResource(resourceType);
          if (resource && remainingAmount > 0) {
            console.log(
              `Dropping ${remainingAmount} ${resource} that didn't fit`
            );

            // Create a new resource node with the remaining resources
            new ResourceNode(
              this.scene,
              this.container.x,
              this.container.y,
              resource,
              remainingAmount
            );
          }
        }

        // Clear the carried resource
        if (this.carriedResource) {
          this.carriedResource.destroy();
          this.carriedResource = null;
        }

        // Clear the carried resource sprite
        this.clearCarriedResource();

        // Reset resource information
        this.resourceAmount = 0;
        this.resourceType = "";

        // Reset the target blueprint
        this.targetBlueprint = null;

        // Mark the job as completed
        if (
          this.currentJob &&
          this.currentJob.type === JobType.DELIVER_RESOURCE
        ) {
          console.log(
            `Robot ${this.robotId} completing job ${this.currentJob.id}`
          );
          JobManager.getInstance().completeJob(this.currentJob.id);
          this.currentJob = null;
        }

        this.robotState = RobotState.IDLE;
        this.updateStateText();
      }
      // Otherwise, check if we need to work on this job
      else if (this.currentJob && this.currentJob.workDuration > 0) {
        console.log(
          `Robot ${this.robotId} starting work on job ${this.currentJob.id} of type ${this.currentJob.type}`
        );

        this.robotState = RobotState.WORKING;
        this.updateStateText();

        // Set a timer for task completion based on the job's work duration
        this.taskCompleteTime =
          this.scene.time.now + this.currentJob.workDuration;
      }
      // If no work duration, just go idle
      else {
        console.log(`Robot ${this.robotId} has no work to do, going idle`);

        // Clear any current job since there's nothing to do
        if (this.currentJob) {
          console.log(
            `Robot ${this.robotId} clearing job ${this.currentJob.id} with no work duration`
          );
          this.currentJob = null;
        }

        // Clear any target references to prevent getting stuck
        this.target = null;
        this.targetResourceNode = null;
        this.targetBlueprint = null;

        this.robotState = RobotState.IDLE;
        this.updateStateText();
      }
    }

    // If we're working, check if the task is complete
    if (
      this.robotState === RobotState.WORKING &&
      this.scene.time.now >= this.taskCompleteTime
    ) {
      console.log(`Robot ${this.robotId} completed work task`);

      // If we have a current job and we've completed the work, mark it as completed
      if (
        this.currentJob &&
        (this.currentJob.type === JobType.WORK_MACHINE ||
          this.currentJob.type === JobType.BUILD)
      ) {
        console.log(
          `Robot ${this.robotId} completing job ${this.currentJob.id} of type ${this.currentJob.type}`
        );
        JobManager.getInstance().completeJob(this.currentJob.id);

        // Log the current job before clearing it
        console.log(
          `Robot ${this.robotId} clearing job reference after completion`
        );
        this.currentJob = null;
      }

      this.currentTask = null;

      // Clear any target references
      this.target = null;
      this.targetResourceNode = null;
      this.targetBlueprint = null;

      // Set state to IDLE so the robot can take on new jobs
      console.log(
        `Robot ${this.robotId} transitioning to IDLE state after work completion`
      );
      this.robotState = RobotState.IDLE;
      this.updateStateText();

      // Return home if no more tasks
      if (this.taskQueue.length === 0) {
        console.log(
          `Robot ${this.robotId} returning home after work completion`
        );
        this.returnHome();
      }
    }

    // If we're returning and have reached home, go idle
    if (this.robotState === RobotState.RETURNING && this.hasReachedTarget()) {
      console.log(`Robot ${this.robotId} reached home, going idle`);
      this.stopMoving();

      // Clear the target to prevent getting stuck
      this.target = null;

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
