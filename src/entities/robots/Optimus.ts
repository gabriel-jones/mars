import * as Phaser from "phaser";
import { Robot, RobotState } from "./Robot";
import { ResourceNode } from "../resourceNode";
import { ResourceManager, ResourceType } from "../../data/resources";
import { JobManager, Job, JobType } from "./JobManager";
import { Blueprint } from "../buildings/Blueprint";
import { TILE_SIZE } from "../../constants";
import { HealthBarRenderer } from "../../interfaces/Health";

// Optimus class - can perform tasks like a player
export class Optimus extends Robot {
  private taskQueue: (() => void)[] = [];
  private currentTask: (() => void) | null = null;
  private taskCompleteTime: number = 0;
  private resourceAmount: number = 0;
  private resourceType: ResourceType = "" as ResourceType;
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
  private lastDamageTime: number = 0; // Track when the robot last took damage
  private shieldRepairInterval: number = 10000; // 10 seconds in ms
  private shieldRepairAmount: number = 5; // Amount to repair per update when eligible

  // Set larger detection and attack ranges for Optimus robots
  // private detectionRange: number = 450; // Increased from 300
  // private attackRange: number = 350; // Increased from 250

  // Optimus robots are more accurate than other robots
  // private imprecisionFactor: number = 15; // Reduced from 20

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "optimus", 150); // Using the optimus sprite
    // Generate a unique ID for this robot
    this.robotId = `optimus-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    // Initialize wander timer with a random offset to prevent all robots from moving at once
    this.wanderTimer = scene.time.now + Math.random() * this.wanderIntervalMax;
    // Initialize last damage time
    this.lastDamageTime = scene.time.now;

    // Set larger detection and attack ranges for Optimus robots
    this.detectionRange = 450; // Increased from 300
    this.attackRange = 350; // Increased from 250

    // Optimus robots are more accurate than other robots
    this.imprecisionFactor = 15; // Reduced from 20

    // Initialize shield for Optimus robots (blue shield)
    this.initShield(75, 0x0088ff);
  }

  // Override damage method to track last damage time
  public damage(amount: number): void {
    // Update last damage time
    this.lastDamageTime = this.scene.time.now;

    // Call parent damage method
    super.damage(amount);
  }

  // Override damageShield method to track last damage time
  public damageShield(amount: number): void {
    // Update last damage time
    this.lastDamageTime = this.scene.time.now;

    // Call parent damageShield method
    super.damageShield(amount);
  }

  protected getRobotNameInternal(): string {
    return "Optimus";
  }

  public getRobotId(): string {
    return this.robotId;
  }

  public getResourceType(): ResourceType {
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
    resourceType: ResourceType,
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
    this.resourceType = "" as ResourceType;
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
    this.resourceType = "" as ResourceType;
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
    // Skip update if robot is dead
    if (!this.isAlive()) return;

    // Update shield position
    this.updateShieldPosition();

    // Check if it's time to repair shield (if not at full shield and not damaged recently)
    const timeSinceLastDamage = time - this.lastDamageTime;
    if (
      this.hasShield() &&
      this.getCurrentShield() < this.getMaxShield() &&
      timeSinceLastDamage > this.shieldRepairInterval
    ) {
      // Repair shield at a faster rate when in repair mode
      this.rechargeShield(this.shieldRepairAmount);

      // Update health bar to reflect shield changes
      if (this.healthBar) {
        const healthBarRenderer = new HealthBarRenderer(this.scene);
        healthBarRenderer.updateHealthBar(this.healthBar, this);
      }
    }
    // Normal slow recharge when not in repair mode
    else if (
      this.hasShield() &&
      this.getCurrentShield() < this.getMaxShield()
    ) {
      this.rechargeShield(delta / 2000); // Convert delta (ms) to seconds, half the rate of player

      // Update health bar to reflect shield changes
      if (this.healthBar) {
        const healthBarRenderer = new HealthBarRenderer(this.scene);
        healthBarRenderer.updateHealthBar(this.healthBar, this);
      }
    }

    // Scan for enemies more frequently (Optimus robots are more vigilant)
    if (time - this.lastScanTime >= this.scanInterval / 2) {
      this.scanForEnemies(time);
    }

    // If in defending state, attack enemies instead of normal behavior
    if (this.robotState === RobotState.DEFENDING && this.enemyTarget) {
      // Optimus robots will actively pursue enemies within their detection range
      const enemySprite = this.enemyTarget.getSprite();
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

      // If enemy is within detection range but outside attack range, move toward it
      if (distance > this.attackRange && distance < this.detectionRange) {
        // Calculate a position that's within attack range of the enemy
        const angle = Phaser.Math.Angle.Between(
          this.container.x,
          this.container.y,
          enemyX,
          enemyY
        );

        // Move to a position that's at attack range distance from the enemy
        const targetDistance = this.attackRange * 0.8; // Stay at 80% of attack range
        const targetX = enemyX - Math.cos(angle) * targetDistance;
        const targetY = enemyY - Math.sin(angle) * targetDistance;

        this.moveToTarget(new Phaser.Math.Vector2(targetX, targetY));
      }

      this.attackEnemyTarget(time);

      // Make sure health bar position is updated
      this.updateHealthBar();

      return; // Skip normal behavior while defending
    }

    // Update dust effects
    this.updateDustEffects(time);

    // Update state text
    this.updateStateText();

    // Update health bar
    this.updateHealthBar();

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
        this.resourceType = "" as ResourceType;

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

  // Override scanForEnemies to make Optimus robots more aggressive
  protected scanForEnemies(time: number): void {
    // Call the parent method to do the basic scanning
    super.scanForEnemies(time);

    // If we're already in defending state, no need to do additional scanning
    if (this.robotState === RobotState.DEFENDING) {
      return;
    }

    // Get enemies from game state
    const gameState = (window as any).gameState;
    const enemies = gameState.enemies || [];

    if (enemies.length === 0) {
      return;
    }

    // Optimus robots will proactively scan for enemies even when working on other tasks
    // They will prioritize defense over other tasks if enemies are detected
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

      // Optimus robots will detect enemies at a greater distance
      if (distance < this.detectionRange) {
        // Switch to defending state immediately
        this.enemyTarget = enemy;
        this.robotState = RobotState.DEFENDING;
        this.updateStateText();
        this.equipWeapon();

        console.log(
          `Optimus robot detected enemy at distance ${distance.toFixed(
            2
          )} and is engaging`
        );

        // If we were carrying out a job, pause it
        if (this.currentJob) {
          console.log(`Optimus robot pausing job to engage enemy`);
          // We don't cancel the job, just pause it by not executing it while in defending state
        }

        // Break out of the loop once we've found an enemy to engage
        break;
      }
    }
  }

  // Override onDeath to clean up shield
  protected onDeath(): void {
    // Clean up shield effect
    this.cleanupShieldEffect();

    // Call parent onDeath if it exists
    super.onDeath();
  }
}
