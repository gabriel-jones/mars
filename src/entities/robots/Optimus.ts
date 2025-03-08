import * as Phaser from "phaser";
import { Robot, RobotState } from "./Robot";
import { ResourceNode } from "../resourceNode";
import { ResourceManager, ResourceType } from "../../data/resources";
import { JobManager, Job, JobType } from "./JobManager";
import { Blueprint } from "../buildings/Blueprint";
import { TILE_SIZE } from "../../constants";
import { HealthBarRenderer } from "../../interfaces/Health";
import { GrowZone } from "../buildings/GrowZone";
import { InventoryZone } from "../buildings/InventoryZone";
import { DEPTH } from "../../depth";
import { Tool } from "../tools";
import { Enemy } from "../enemies/Enemy";
import {
  OPTIMUS_DETECTION_RANGE,
  OPTIMUS_ATTACK_RANGE,
  OPTIMUS_MAX_SHOOTING_RANGE,
  OPTIMUS_IMPRECISION_FACTOR,
} from "../../constants";

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
  private resourceCheckTimer: number = 0;
  private resourceCheckInterval: number = 5000; // Check for loose resources every 5 seconds (reduced from 15 seconds)
  private mergeCheckTimer: number = 0;
  private mergeCheckInterval: number = 15000; // Check for merge opportunities every 15 seconds (reduced from 30 seconds)

  // Set larger detection and attack ranges for Optimus robots
  protected detectionRange: number = OPTIMUS_DETECTION_RANGE;
  protected attackRange: number = OPTIMUS_ATTACK_RANGE;
  protected maxShootingRange: number = OPTIMUS_MAX_SHOOTING_RANGE;

  // Optimus robots are more accurate than other robots
  protected imprecisionFactor: number = OPTIMUS_IMPRECISION_FACTOR;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "optimus", 150); // Using the optimus sprite
    // Generate a unique ID for this robot
    this.robotId = `optimus-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    // Initialize wander timer with a random offset to prevent all robots from moving at once
    this.wanderTimer = scene.time.now + Math.random() * this.wanderIntervalMax;
    // Initialize resource check timer with a random offset to prevent all robots from checking at once
    this.resourceCheckTimer =
      scene.time.now + Math.random() * this.resourceCheckInterval;
    // Initialize merge check timer with a random offset
    this.mergeCheckTimer =
      scene.time.now + Math.random() * this.mergeCheckInterval;
    // Initialize last damage time
    this.lastDamageTime = scene.time.now;

    // Initialize shield for Optimus robots with custom implementation
    this.initCustomShield(75, 0x0088ff);
  }

  // Custom shield implementation for Optimus robots
  private initCustomShield(maxShield: number, shieldColor: number): void {
    // Set shield properties
    this.maxShield = maxShield;
    this.shield = maxShield;
    this.shieldActive = true;
    this.shieldColor = shieldColor;

    // Remove any existing shield effect
    if (this.shieldEffect) {
      this.shieldEffect.destroy();
      this.shieldEffect = null;
    }

    // Get the sprite from the container
    const sprite = this.container.getByName("sprite");
    let width = 64;
    let height = 64;

    if (sprite && sprite instanceof Phaser.GameObjects.Sprite) {
      width = sprite.displayWidth;
      height = sprite.displayHeight;
    }

    // Create a shield effect
    this.shieldEffect = this.scene.add.ellipse(
      0,
      0,
      width * 1.1, // Slightly larger than the sprite
      height * 1.1, // Slightly larger than the sprite
      this.shieldColor,
      0.2 // Higher opacity for better visibility
    );

    // Add a more visible stroke
    this.shieldEffect.setStrokeStyle(2, this.shieldColor, 0.6);

    // Set depth to be just above the sprite
    this.shieldEffect.setDepth(DEPTH.SHIELD);

    // Initially invisible until taking damage
    this.shieldEffect.setVisible(false);

    // Add the shield effect to the scene (not the container)
    // This allows it to be positioned independently
    this.scene.add.existing(this.shieldEffect);

    // Update shield position immediately
    this.updateCustomShieldPosition();
  }

  // Override damage method to track last damage time
  public damage(amount: number): void {
    // Update last damage time
    this.lastDamageTime = this.scene.time.now;

    // Set shield visibility timer to show shield effect if shield is active
    if (this.shieldActive && this.shield > 0) {
      this.shieldVisibilityTimer = this.scene.time.now + 300; // Show for 300ms
    }

    // Call parent damage method
    super.damage(amount);
  }

  // Override damageShield method to track last damage time and handle shield visibility
  public damageShield(amount: number): void {
    // Update last damage time
    this.lastDamageTime = this.scene.time.now;

    // Only proceed if we have a shield
    if (this.shieldActive && this.shield > 0) {
      // Calculate actual damage (can't go below 0)
      const actualDamage = Math.min(this.shield, amount);
      this.shield -= actualDamage;

      // Set shield visibility timer to show shield effect
      this.shieldVisibilityTimer = this.scene.time.now + 300; // Show for 300ms

      // Show shield effect when hit
      if (this.shieldEffect) {
        this.shieldEffect.setVisible(true);
      }

      // If shield is depleted, deactivate it
      if (this.shield <= 0) {
        this.shieldActive = false;
        if (this.shieldEffect) {
          this.shieldEffect.setVisible(false);
        }
      }
    } else {
      // If no shield, pass damage to health
      super.damage(amount);
    }
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

  // Check if the robot is available for new jobs
  public isAvailable(): boolean {
    // Robot is available if it's idle and not currently assigned to a job
    return (
      this.robotState === RobotState.IDLE &&
      this.currentJob === null &&
      this.taskQueue.length === 0
    );
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
      console.log(
        `Robot ${this.robotId} moving to pick up resource at (${resourceNode.x}, ${resourceNode.y})`
      );
      this.targetResourceNode = resourceNode;
      this.moveToTarget(
        new Phaser.Math.Vector2(resourceNode.x, resourceNode.y)
      );
      // Set state to MOVING
      this.robotState = RobotState.MOVING;
      this.updateStateText();
      // The actual pickup will happen in onReachTarget when we reach the target
    });
  }

  // Add a task to deliver a resource to another node
  public deliverResourceToNode(targetNode: ResourceNode): void {
    this.addTask(() => {
      console.log(
        `Robot ${this.robotId} moving to deliver resource to node at (${targetNode.x}, ${targetNode.y})`
      );
      this.targetResourceNode = targetNode;
      this.moveToTarget(new Phaser.Math.Vector2(targetNode.x, targetNode.y));
      // Set state to MOVING
      this.robotState = RobotState.MOVING;
      this.updateStateText();
      // The actual delivery will happen in onReachTarget when we reach the target
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

      // Set state to MOVING
      this.robotState = RobotState.MOVING;
      this.updateStateText();

      // The actual delivery will happen in onReachTarget when we reach the target
      this.targetBlueprint = blueprint;
    });
  }

  /**
   * Deliver a resource to an inventory zone
   * @param inventoryZone The inventory zone to deliver to
   */
  public deliverResourceToInventoryZone(inventoryZone: InventoryZone): void {
    // Check if we have a resource to deliver
    if (!this.resourceType || this.resourceAmount <= 0) {
      console.log(
        `Robot ${this.robotId} has no resource to deliver to inventory zone`
      );
      return;
    }

    // Find an available tile in the inventory zone
    const tilePosition = inventoryZone.findAvailableTilePosition(
      this.resourceType
    );

    if (!tilePosition) {
      console.log(
        `Robot ${this.robotId} couldn't find an available tile in inventory zone`
      );
      return;
    }

    // Clear any existing tasks
    this.taskQueue = [];

    // Add task to move to the specific tile in the inventory zone
    this.addTask(() => {
      console.log(
        `Robot ${this.robotId} moving to tile at (${tilePosition.x}, ${tilePosition.y}) in inventory zone`
      );
      this.moveToTarget(tilePosition);

      // Set state to MOVING if we're not already carrying
      if (this.robotState !== RobotState.CARRYING) {
        this.robotState = RobotState.MOVING;
      }
      this.updateStateText();

      // Store the inventory zone in the job for delivery
      if (
        this.currentJob &&
        this.currentJob.type === JobType.DELIVER_TO_INVENTORY
      ) {
        this.currentJob.inventoryZone = inventoryZone;
      }
    });

    // We don't need to add a separate task for delivery
    // The onReachTarget method will handle the delivery when the robot reaches the target
    // This ensures we don't have timing issues with the task queue
  }

  /**
   * Deliver the carried resource to an inventory zone
   * @param inventoryZone The inventory zone to deliver to
   */
  private deliverResourceToInventory(inventoryZone: InventoryZone): void {
    // Check if we have a resource to deliver
    if (!this.resourceType || this.resourceAmount <= 0) {
      console.log(
        `Robot ${this.robotId} has no resource to deliver to inventory zone`
      );
      return;
    }

    // Get the resource object
    const resource = ResourceManager.getResource(this.resourceType);
    if (!resource) {
      console.log(
        `Robot ${this.robotId} has invalid resource type: ${this.resourceType}`
      );
      return;
    }

    // Log the delivery attempt
    console.log(
      `Robot ${this.robotId} attempting to deliver ${this.resourceAmount} ${this.resourceType} to inventory zone at (${this.container.x}, ${this.container.y})`
    );

    // Create a temporary resource node to represent the carried resource
    const tempNode = new ResourceNode(
      this.scene,
      this.container.x,
      this.container.y,
      resource,
      this.resourceAmount
    );

    // Try to add the resource to the inventory zone
    const success = inventoryZone.addResourceNode(tempNode);

    if (success) {
      console.log(
        `Robot ${this.robotId} delivered ${this.resourceAmount} ${this.resourceType} to inventory zone`
      );

      // Clear the carried resource
      if (this.carriedResource) {
        this.carriedResource.destroy();
        this.carriedResource = null;
      }

      // Clear the carried resource sprite
      this.clearCarriedResource();

      // Reset resource information
      this.resourceType = "" as ResourceType;
      this.resourceAmount = 0;

      // Update the label
      if (this.label) {
        this.label.setText(this.getRobotNameInternal());
      }

      // Set state back to idle
      this.robotState = RobotState.IDLE;
      this.updateStateText();

      // Mark the job as completed if it's a delivery job
      if (
        this.currentJob &&
        this.currentJob.type === JobType.DELIVER_TO_INVENTORY
      ) {
        console.log(
          `Robot ${this.robotId} completing inventory delivery job ${this.currentJob.id}`
        );
        JobManager.getInstance().completeJob(this.currentJob.id);
        this.currentJob = null;
      }

      // Check if there are more resources to deliver in the inventory zone
      this.checkForLooseResources();
    } else {
      console.log(
        `Robot ${this.robotId} failed to deliver ${this.resourceAmount} ${this.resourceType} to inventory zone - no space`
      );

      // Try to find another available tile in the inventory zone
      const tilePosition = inventoryZone.findAvailableTilePosition(
        this.resourceType
      );

      if (tilePosition) {
        console.log(
          `Robot ${this.robotId} found another tile at (${tilePosition.x}, ${tilePosition.y}), moving there`
        );

        // Move to the new tile
        this.moveToTarget(tilePosition);
        return;
      }

      // The temporary node will be destroyed automatically if it couldn't be added
      // Drop the resource at the robot's current position
      this.dropResource();

      // Set state back to idle
      this.robotState = RobotState.IDLE;
      this.updateStateText();

      // Cancel the job if it's a delivery job
      if (
        this.currentJob &&
        this.currentJob.type === JobType.DELIVER_TO_INVENTORY
      ) {
        console.log(
          `Robot ${this.robotId} cancelling inventory delivery job ${this.currentJob.id} - no space`
        );
        JobManager.getInstance().cancelJob(this.currentJob.id);
        this.currentJob = null;
      }
    }
  }

  // Look for available jobs
  private findAndAssignJob(): boolean {
    // Check if we already have a job
    if (this.currentJob) {
      return true;
    }

    // Get the job manager
    const jobManager = JobManager.getInstance();

    // Define preferred job types based on robot type
    const preferredJobTypes = [
      JobType.BUILD, // Building is highest priority
      JobType.DELIVER_RESOURCE, // Delivering resources to blueprints is high priority
      JobType.DELIVER_TO_INVENTORY, // Inventory organization is medium priority
      JobType.MERGE_STACKS, // Merging stacks is lower priority
      JobType.WATER_TILE,
      JobType.PLANT_SEED,
      JobType.HARVEST_CROP,
      JobType.WORK_MACHINE,
    ];

    // Get available jobs with our preferred types first
    const availableJobs = jobManager.getAvailableJobs(preferredJobTypes);

    if (availableJobs.length === 0) {
      return false;
    }

    // Find the closest job
    let closestJob: Job | null = null;
    let closestDistance = Number.MAX_SAFE_INTEGER;

    for (const job of availableJobs) {
      let jobPosition: Phaser.Math.Vector2 | null = null;

      // Determine the position of the job based on its type
      if (job.position) {
        jobPosition = job.position;
      } else if (job.targetNode) {
        jobPosition = new Phaser.Math.Vector2(
          job.targetNode.x,
          job.targetNode.y
        );
      } else if (job.sourceNode) {
        jobPosition = new Phaser.Math.Vector2(
          job.sourceNode.x,
          job.sourceNode.y
        );
      } else if (job.blueprint) {
        jobPosition = new Phaser.Math.Vector2(job.blueprint.x, job.blueprint.y);
      } else if (job.growZone && job.tileIndex !== undefined) {
        // For farming jobs, get the position of the specific tile
        const tiles = job.growZone.getTiles();
        if (tiles[job.tileIndex]) {
          jobPosition = new Phaser.Math.Vector2(
            tiles[job.tileIndex].x,
            tiles[job.tileIndex].y
          );
        }
      }

      if (jobPosition) {
        const distance = Phaser.Math.Distance.Between(
          this.container.x,
          this.container.y,
          jobPosition.x,
          jobPosition.y
        );

        if (distance < closestDistance) {
          closestDistance = distance;
          closestJob = job;
        }
      }
    }

    if (closestJob) {
      // Assign the job to this robot
      if (jobManager.assignJob(closestJob.id, this.robotId)) {
        this.currentJob = closestJob;

        console.log(
          `Robot ${this.robotId} assigned to ${closestJob.type} job ${closestJob.id}`
        );

        // Process the job based on its type
        switch (closestJob.type) {
          case JobType.MERGE_STACKS:
            if (closestJob.sourceNode && closestJob.targetNode) {
              console.log(
                `Robot ${this.robotId} assigned to merge stacks job ${closestJob.id}`
              );

              // Add tasks to pick up the source node and deliver to target
              this.pickupResourceNode(closestJob.sourceNode);
              this.deliverResourceToNode(closestJob.targetNode);
            }
            break;

          case JobType.WORK_MACHINE:
            if (closestJob.targetNode) {
              console.log(
                `Robot ${this.robotId} assigned to work machine job ${closestJob.id}`
              );

              // Move to the machine and work on it
              this.addTask(() => {
                this.targetResourceNode = closestJob.targetNode as ResourceNode;
                this.moveToTarget(
                  new Phaser.Math.Vector2(
                    closestJob.targetNode!.x,
                    closestJob.targetNode!.y
                  )
                );
              });
            }
            break;

          case JobType.BUILD:
            if (closestJob.position) {
              console.log(
                `Robot ${this.robotId} assigned to build job ${closestJob.id}`
              );

              // Move to the build location and work on it
              this.addTask(() => {
                this.moveToTarget(closestJob.position!);
              });
            }
            break;

          case JobType.DELIVER_RESOURCE:
            if (
              closestJob.sourceNode &&
              closestJob.position &&
              closestJob.blueprint &&
              closestJob.resourceType &&
              closestJob.resourceAmount
            ) {
              console.log(
                `Robot ${this.robotId} assigned to deliver resource job ${closestJob.id}`
              );

              // Add tasks to pick up the resource and deliver to blueprint
              this.pickupResourceNode(closestJob.sourceNode);
              this.deliverResourceToBlueprint(
                closestJob.blueprint,
                closestJob.resourceType,
                closestJob.resourceAmount
              );
            }
            break;

          case JobType.DELIVER_TO_INVENTORY:
            if (closestJob.sourceNode && closestJob.inventoryZone) {
              console.log(
                `Robot ${this.robotId} assigned to deliver to inventory job ${closestJob.id}`
              );

              // Add tasks to pick up the resource and deliver to inventory zone
              this.pickupResourceNode(closestJob.sourceNode);
              this.deliverResourceToInventoryZone(closestJob.inventoryZone);
            }
            break;

          case JobType.WATER_TILE:
            if (closestJob.growZone && closestJob.tileIndex !== undefined) {
              this.handleWaterTileJob(
                closestJob.growZone,
                closestJob.tileIndex
              );
            }
            break;

          case JobType.PLANT_SEED:
            if (closestJob.growZone && closestJob.tileIndex !== undefined) {
              this.handlePlantSeedJob(
                closestJob.growZone,
                closestJob.tileIndex
              );
            }
            break;

          case JobType.HARVEST_CROP:
            if (closestJob.growZone && closestJob.tileIndex !== undefined) {
              this.handleHarvestCropJob(
                closestJob.growZone,
                closestJob.tileIndex
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
    if (!resource) {
      console.log(`Robot ${this.robotId} tried to pick up invalid resource`);
      return;
    }

    const availableAmount = resourceNode.getAmount();
    if (availableAmount <= 0) {
      console.log(`Robot ${this.robotId} tried to pick up empty resource`);
      return;
    }

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

    // Set state to CARRYING
    this.robotState = RobotState.CARRYING;
    this.updateStateText();

    // If this is for an inventory delivery job, make sure the job has the resource info
    if (
      this.currentJob &&
      this.currentJob.type === JobType.DELIVER_TO_INVENTORY
    ) {
      this.currentJob.resourceType = resource.type;
      this.currentJob.resourceAmount = amountToPickup;
    }
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
    // Only wander if we're idle
    if (this.robotState !== RobotState.IDLE) {
      return;
    }

    // Calculate a random position around the home position
    const angle = Math.random() * Math.PI * 2; // Random angle in radians
    const distance = Math.random() * this.wanderRadius; // Random distance within wander radius
    const targetX = this.homePosition.x + Math.cos(angle) * distance;
    const targetY = this.homePosition.y + Math.sin(angle) * distance;

    // Move to the random position
    this.moveToTarget(new Phaser.Math.Vector2(targetX, targetY));

    // Set state to wandering
    this.robotState = RobotState.WANDERING;
    this.updateStateText();

    // Reset wander timer with random interval
    this.wanderTimer =
      this.scene.time.now +
      this.wanderIntervalMin +
      Math.random() * (this.wanderIntervalMax - this.wanderIntervalMin);
  }

  /**
   * Check for loose resources and create inventory delivery jobs
   * This helps keep the base organized by moving resources to inventory zones
   */
  private checkForLooseResources(): void {
    // Only check if we're idle
    if (
      this.robotState !== RobotState.IDLE ||
      this.taskQueue.length > 0 ||
      this.currentJob
    ) {
      return;
    }

    // Get all resource nodes in the scene
    const resourceNodes: ResourceNode[] = [];
    this.scene.children.list.forEach((child) => {
      if (child instanceof ResourceNode) {
        resourceNodes.push(child);
      }
    });

    // Skip if no resources found
    if (resourceNodes.length === 0) {
      return;
    }

    // Get all inventory zones in the scene
    const inventoryZones: InventoryZone[] = [];
    this.scene.children.list.forEach((child) => {
      if (child instanceof InventoryZone) {
        inventoryZones.push(child);
      }
    });

    // Skip if no inventory zones found
    if (inventoryZones.length === 0) {
      return;
    }

    // Create delivery jobs for loose resources
    const jobManager = JobManager.getInstance();
    const jobsCreated = jobManager.createInventoryDeliveryJobsForLooseResources(
      resourceNodes,
      inventoryZones
    );

    if (jobsCreated > 0) {
      console.log(
        `Created ${jobsCreated} inventory delivery jobs for loose resources`
      );

      // Immediately check for a job to pick up
      this.findAndAssignJob();
    }
  }

  /**
   * Check for merge opportunities in inventory zones
   * This helps keep inventory zones organized by merging stacks of the same resource type
   */
  private checkForMergeOpportunities(): void {
    // Only check if we're idle
    if (
      this.robotState !== RobotState.IDLE ||
      this.taskQueue.length > 0 ||
      this.currentJob
    ) {
      return;
    }

    // Get all inventory zones in the scene
    const inventoryZones: InventoryZone[] = [];
    this.scene.children.list.forEach((child) => {
      if (child instanceof InventoryZone) {
        inventoryZones.push(child);
      }
    });

    // Skip if no inventory zones found
    if (inventoryZones.length === 0) {
      return;
    }

    // Create merge jobs for resources in inventory zones
    const jobManager = JobManager.getInstance();
    const jobsCreated = jobManager.createInventoryMergeJobs(inventoryZones);

    if (jobsCreated > 0) {
      console.log(
        `Created ${jobsCreated} merge jobs for resources in inventory zones`
      );

      // Immediately check for a job to pick up
      this.findAndAssignJob();
    }
  }

  // Update the optimus robot
  public update(time: number, delta: number): void {
    // Update shield position if it exists
    this.updateCustomShieldPosition();

    // Skip update if robot is dead
    if (!this.isAlive()) return;

    // Update shield position and effect
    this.updateShieldPosition();
    this.updateShieldEffect(time);

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

    // Update health bar position
    this.updateHealthBarPosition();

    // Update shadow effects
    this.updateShadowEffects();

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

    // If we're moving, check if we've reached the target
    if (
      (this.robotState === RobotState.MOVING ||
        this.robotState === RobotState.RETURNING ||
        this.robotState === RobotState.WANDERING ||
        this.robotState === RobotState.CARRYING) &&
      this.target
    ) {
      if (this.hasReachedTarget()) {
        this.stopMoving();
        this.onReachTarget();
      } else {
        // Continue moving towards the target
        // No need to call any method here as the robot's velocity is already set
      }
    }

    // Handle task completion
    if (
      this.robotState === RobotState.WORKING &&
      time >= this.taskCompleteTime &&
      this.currentJob
    ) {
      // Task is complete, handle based on job type
      switch (this.currentJob.type) {
        case JobType.WATER_TILE:
          if (
            this.currentJob.growZone &&
            this.currentJob.tileIndex !== undefined
          ) {
            // Water the tile
            const success = this.currentJob.growZone.waterTile(
              this.currentJob.tileIndex
            );
            console.log(
              `Robot ${this.robotId} watered tile ${
                this.currentJob.tileIndex
              }: ${success ? "success" : "failed"}`
            );
          }
          // Complete the job
          JobManager.getInstance().completeJob(this.currentJob.id);
          this.currentJob = null;
          this.robotState = RobotState.IDLE;
          this.updateStateText();
          break;

        case JobType.PLANT_SEED:
          if (
            this.currentJob.growZone &&
            this.currentJob.tileIndex !== undefined
          ) {
            // Plant seeds in the tile
            const success = this.currentJob.growZone.plantSeed(
              this.currentJob.tileIndex
            );
            console.log(
              `Robot ${this.robotId} planted seeds in tile ${
                this.currentJob.tileIndex
              }: ${success ? "success" : "failed"}`
            );
          }
          // Complete the job
          JobManager.getInstance().completeJob(this.currentJob.id);
          this.currentJob = null;
          this.robotState = RobotState.IDLE;
          this.updateStateText();
          break;

        case JobType.HARVEST_CROP:
          if (
            this.currentJob.growZone &&
            this.currentJob.tileIndex !== undefined
          ) {
            // Harvest the crop
            const resourceType = this.currentJob.growZone.harvestTile(
              this.currentJob.tileIndex
            );
            if (resourceType) {
              // Add the harvested resource to the global inventory
              ResourceManager.addResource(resourceType, 1);
              console.log(
                `Robot ${this.robotId} harvested ${resourceType} from tile ${this.currentJob.tileIndex}`
              );
            } else {
              console.log(
                `Robot ${this.robotId} failed to harvest from tile ${this.currentJob.tileIndex}`
              );
            }
          }
          // Complete the job
          JobManager.getInstance().completeJob(this.currentJob.id);
          this.currentJob = null;
          this.robotState = RobotState.IDLE;
          this.updateStateText();
          break;

        default:
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
    }

    // If we're idle and have tasks, start the next one
    if (this.robotState === RobotState.IDLE && this.taskQueue.length > 0) {
      this.currentTask = this.taskQueue.shift()!;
      this.currentTask();
    }

    // Check for jobs periodically when idle
    if (
      this.robotState === RobotState.IDLE &&
      this.taskQueue.length === 0 &&
      !this.currentJob
    ) {
      // First, always check for regular jobs
      if (this.scene.time.now > this.jobCheckTimer) {
        // Look for and assign a job
        const foundJob = this.findAndAssignJob();

        // Set the next job check time
        this.jobCheckTimer = this.scene.time.now + this.jobCheckInterval;

        // Only proceed with inventory organization if no regular job was found
        if (!foundJob) {
          // Check for loose resources periodically
          if (this.scene.time.now > this.resourceCheckTimer) {
            this.checkForLooseResources();

            // Set the next resource check time
            this.resourceCheckTimer =
              this.scene.time.now + this.resourceCheckInterval;
          }

          // Check for merge opportunities periodically
          if (this.scene.time.now > this.mergeCheckTimer) {
            this.checkForMergeOpportunities();

            // Set the next merge check time
            this.mergeCheckTimer =
              this.scene.time.now + this.mergeCheckInterval;
          }

          // Wander around if it's time to wander
          if (this.scene.time.now > this.wanderTimer) {
            this.wanderAroundHome();
          }
        }
      }
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
    // Call parent onDeath method
    super.onDeath();

    // Clean up shield effect
    if (this.shieldEffect) {
      this.shieldEffect.destroy();
      this.shieldEffect = null;
    }

    // Additional cleanup specific to Optimus
    if (this.currentJob) {
      // Cancel the job so another robot can take it
      const jobManager = JobManager.getInstance();
      jobManager.cancelJob(this.currentJob.id);
      this.currentJob = null;
    }
  }

  // Handle watering a tile in a grow zone
  private handleWaterTileJob(growZone: GrowZone, tileIndex: number): void {
    const tiles = growZone.getTiles();
    if (!tiles[tileIndex]) {
      // Invalid tile index, complete the job
      JobManager.getInstance().completeJob(this.currentJob!.id);
      this.currentJob = null;
      return;
    }

    const tile = tiles[tileIndex];
    const targetPosition = new Phaser.Math.Vector2(tile.x, tile.y);

    // Move to the tile
    this.moveToTarget(targetPosition);

    // Check if we've reached the target
    if (this.hasReachedTarget()) {
      // We've reached the tile, start watering
      this.robotState = RobotState.WORKING;
      this.updateStateText();
      this.taskCompleteTime =
        this.scene.time.now + this.currentJob!.workDuration;
    }
  }

  // Handle planting seeds in a tile
  private handlePlantSeedJob(growZone: GrowZone, tileIndex: number): void {
    const tiles = growZone.getTiles();
    if (!tiles[tileIndex]) {
      // Invalid tile index, complete the job
      JobManager.getInstance().completeJob(this.currentJob!.id);
      this.currentJob = null;
      return;
    }

    const tile = tiles[tileIndex];
    const targetPosition = new Phaser.Math.Vector2(tile.x, tile.y);

    // Move to the tile
    this.moveToTarget(targetPosition);

    // Check if we've reached the target
    if (this.hasReachedTarget()) {
      // We've reached the tile, start planting
      this.robotState = RobotState.WORKING;
      this.updateStateText();
      this.taskCompleteTime =
        this.scene.time.now + this.currentJob!.workDuration;
    }
  }

  // Handle harvesting crops from a tile
  private handleHarvestCropJob(growZone: GrowZone, tileIndex: number): void {
    const tiles = growZone.getTiles();
    if (!tiles[tileIndex]) {
      // Invalid tile index, complete the job
      JobManager.getInstance().completeJob(this.currentJob!.id);
      this.currentJob = null;
      return;
    }

    const tile = tiles[tileIndex];
    const targetPosition = new Phaser.Math.Vector2(tile.x, tile.y);

    // Move to the tile
    this.moveToTarget(targetPosition);

    // Check if we've reached the target
    if (this.hasReachedTarget()) {
      // We've reached the tile, start harvesting
      this.robotState = RobotState.WORKING;
      this.updateStateText();
      this.taskCompleteTime =
        this.scene.time.now + this.currentJob!.workDuration;
    }
  }

  // Custom method to update shield position
  private updateCustomShieldPosition(): void {
    if (this.shieldEffect) {
      // Get the world position of the robot
      const worldPos = this.container.getWorldTransformMatrix();
      const x = worldPos.tx;
      const y = worldPos.ty;

      // Position the shield at the robot's world position
      this.shieldEffect.setPosition(x, y);

      // Check if shield should be visible based on timer
      const currentTime = this.scene.time.now;
      const showShield =
        this.shield > 0 && currentTime < this.shieldVisibilityTimer;

      if (showShield) {
        // Make shield visible with pulse effect
        this.shieldEffect.setVisible(true);

        // Calculate fade based on time remaining
        const timeRemaining = this.shieldVisibilityTimer - currentTime;
        const alpha = Math.min(0.7, timeRemaining / 100); // Fade out as timer expires

        this.shieldEffect.setAlpha(alpha);
      } else {
        // Hide shield if inactive, depleted, or timer expired
        this.shieldEffect.setVisible(false);
      }
    }
  }

  protected onReachTarget(): void {
    // Call the parent method
    super.onReachTarget();

    console.log(
      `Robot ${this.robotId} reached target in state ${this.robotState}`
    );

    // Handle based on current state
    switch (this.robotState) {
      case RobotState.MOVING:
        // If we're moving and have a current task, complete it
        if (this.currentTask) {
          this.taskCompleteTime = this.scene.time.now;
          this.currentTask = null;
        }

        // If we have a target resource node and we're not carrying anything, pick it up
        if (this.targetResourceNode && !this.carriedResource) {
          console.log(`Robot ${this.robotId} picking up resource from node`);
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
          console.log(`Robot ${this.robotId} delivering resource to node`);
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

          console.log(
            `Robot ${this.robotId} carrying ${amount} ${resourceType}`
          );

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
        // If we're at an inventory zone and have a delivery job, deliver the resource
        else if (
          this.currentJob &&
          this.currentJob.type === JobType.DELIVER_TO_INVENTORY &&
          this.currentJob.inventoryZone
        ) {
          console.log(
            `Robot ${this.robotId} reached inventory zone, delivering resource`
          );
          this.deliverResourceToInventory(this.currentJob.inventoryZone);
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
        break;

      case RobotState.CARRYING:
        // If we have more tasks, process the next one
        if (this.taskQueue.length > 0) {
          console.log(
            `Robot ${this.robotId} in CARRYING state, processing next task`
          );
          this.currentTask = this.taskQueue.shift()!;
          this.currentTask();
        } else if (
          this.currentJob &&
          this.currentJob.type === JobType.DELIVER_TO_INVENTORY
        ) {
          // If we're carrying a resource and have reached the inventory zone, deliver it
          console.log(
            `Robot ${this.robotId} in CARRYING state with no more tasks, delivering to inventory zone`
          );

          // Find the inventory zone from the job
          if (this.currentJob.inventoryZone) {
            this.deliverResourceToInventory(this.currentJob.inventoryZone);
          } else {
            console.log(
              `Robot ${this.robotId} has no inventory zone to deliver to`
            );
            // Drop the resource if we can't deliver it
            this.dropResource();

            // Cancel the job
            JobManager.getInstance().cancelJob(this.currentJob.id);
            this.currentJob = null;

            // Go idle
            this.robotState = RobotState.IDLE;
            this.updateStateText();
          }
        } else {
          // If no more tasks and no inventory zone job, go idle
          console.log(
            `Robot ${this.robotId} in CARRYING state with no more tasks and no inventory zone job`
          );
          this.robotState = RobotState.IDLE;
          this.updateStateText();
        }
        break;

      case RobotState.RETURNING:
        // If we're returning home, go idle
        this.robotState = RobotState.IDLE;
        this.updateStateText();
        break;

      case RobotState.WANDERING:
        // If we've reached our wandering target, go back to idle
        this.robotState = RobotState.IDLE;
        this.updateStateText();
        break;
    }
  }
}
