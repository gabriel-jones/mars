import { ResourceNode } from "../resourceNode";
import { ResourceType } from "../../data/resources";
import { Blueprint } from "../buildings/Blueprint";
import { GrowZone } from "../buildings/GrowZone";
import { InventoryZone } from "../buildings/InventoryZone";
import { TILE_SIZE } from "../../constants";

// Define job types
export enum JobType {
  MERGE_STACKS = "merge_stacks",
  WORK_MACHINE = "work_machine",
  BUILD = "build",
  DELIVER_RESOURCE = "deliver_resource", // Deliver resource to a blueprint
  DELIVER_TO_INVENTORY = "deliver_to_inventory", // Deliver resource to an inventory zone
  WATER_TILE = "water_tile", // Water a grow zone tile
  PLANT_SEED = "plant_seed", // Plant seeds in a grow zone tile
  HARVEST_CROP = "harvest_crop", // Harvest crops from a grow zone tile
  // Add more job types as needed
}

// Job interface
export interface Job {
  id: string;
  type: JobType;
  assignedRobotId?: string;
  sourceNode?: ResourceNode;
  targetNode?: ResourceNode;
  position?: Phaser.Math.Vector2;
  completed: boolean;
  workDuration: number; // Duration in milliseconds for this job
  // Additional properties for resource delivery
  resourceType?: ResourceType;
  resourceAmount?: number;
  blueprint?: Blueprint;
  // Additional properties for farming jobs
  growZone?: GrowZone;
  tileIndex?: number;
  inventoryZone?: InventoryZone;
  // Add more properties as needed for different job types
}

export class JobManager {
  private static instance: JobManager;
  private jobs: Map<string, Job> = new Map();
  private nextJobId: number = 1;

  private constructor() {}

  // Get the singleton instance
  public static getInstance(): JobManager {
    if (!JobManager.instance) {
      JobManager.instance = new JobManager();
    }
    return JobManager.instance;
  }

  // Create a new merge stacks job
  public createMergeStacksJob(
    sourceNode: ResourceNode,
    targetNode: ResourceNode
  ): Job {
    const jobId = `job_${this.nextJobId++}`;
    const job: Job = {
      id: jobId,
      type: JobType.MERGE_STACKS,
      sourceNode,
      targetNode,
      completed: false,
      workDuration: 0, // No work duration for pickup/delivery tasks
    };

    this.jobs.set(jobId, job);
    console.log(`Created new merge stacks job: ${jobId}`);
    return job;
  }

  // Create a new work machine job
  public createWorkMachineJob(
    machineNode: ResourceNode,
    duration: number = 5000 // Default 5 seconds for machine work
  ): Job {
    const jobId = `job_${this.nextJobId++}`;
    const job: Job = {
      id: jobId,
      type: JobType.WORK_MACHINE,
      targetNode: machineNode,
      completed: false,
      workDuration: duration, // Set the work duration based on the machine
    };

    this.jobs.set(jobId, job);
    console.log(`Created new work machine job: ${jobId}`);
    return job;
  }

  // Create a new build job
  public createBuildJob(
    position: Phaser.Math.Vector2,
    duration: number = 8000 // Default 8 seconds for building
  ): Job {
    const jobId = `job_${this.nextJobId++}`;
    const job: Job = {
      id: jobId,
      type: JobType.BUILD,
      position,
      completed: false,
      workDuration: duration, // Set the work duration based on what's being built
    };

    this.jobs.set(jobId, job);
    console.log(`Created new build job: ${jobId}`);
    return job;
  }

  // Create a new resource delivery job
  public createResourceDeliveryJob(
    sourceNode: ResourceNode,
    blueprint: Blueprint,
    resourceType: ResourceType,
    resourceAmount: number
  ): Job {
    const jobId = `job_${this.nextJobId++}`;
    const job: Job = {
      id: jobId,
      type: JobType.DELIVER_RESOURCE,
      sourceNode,
      position: new Phaser.Math.Vector2(blueprint.x, blueprint.y),
      completed: false,
      workDuration: 0, // No work duration for delivery tasks
      resourceType,
      resourceAmount,
      blueprint,
    };

    this.jobs.set(jobId, job);
    console.log(
      `Created new resource delivery job: ${jobId} for ${resourceAmount} ${resourceType}`
    );
    return job;
  }

  // Create a new water tile job
  public createWaterTileJob(
    growZone: GrowZone,
    tileIndex: number,
    duration: number = 2000 // Default 2 seconds for watering
  ): Job {
    const jobId = `job_${this.nextJobId++}`;
    const job: Job = {
      id: jobId,
      type: JobType.WATER_TILE,
      growZone,
      tileIndex,
      completed: false,
      workDuration: duration,
    };

    this.jobs.set(jobId, job);
    console.log(`Created new water tile job: ${jobId} for tile ${tileIndex}`);
    return job;
  }

  // Create a new plant seed job
  public createPlantSeedJob(
    growZone: GrowZone,
    tileIndex: number,
    duration: number = 3000 // Default 3 seconds for planting
  ): Job {
    const jobId = `job_${this.nextJobId++}`;
    const job: Job = {
      id: jobId,
      type: JobType.PLANT_SEED,
      growZone,
      tileIndex,
      completed: false,
      workDuration: duration,
    };

    this.jobs.set(jobId, job);
    console.log(`Created new plant seed job: ${jobId} for tile ${tileIndex}`);
    return job;
  }

  // Create a new harvest crop job
  public createHarvestCropJob(
    growZone: GrowZone,
    tileIndex: number,
    duration: number = 4000 // Default 4 seconds for harvesting
  ): Job {
    const jobId = `job_${this.nextJobId++}`;
    const job: Job = {
      id: jobId,
      type: JobType.HARVEST_CROP,
      growZone,
      tileIndex,
      completed: false,
      workDuration: duration,
    };

    this.jobs.set(jobId, job);
    console.log(`Created new harvest crop job: ${jobId} for tile ${tileIndex}`);
    return job;
  }

  // Find all farming jobs (water, plant, harvest)
  public findFarmingJobs(): Job[] {
    return Array.from(this.jobs.values()).filter(
      (job) =>
        !job.completed &&
        !job.assignedRobotId &&
        (job.type === JobType.WATER_TILE ||
          job.type === JobType.PLANT_SEED ||
          job.type === JobType.HARVEST_CROP)
    );
  }

  // Find resource delivery jobs for blueprints
  public findResourceDeliveryJobs(): Job[] {
    // This will be implemented in the MainScene to scan for blueprints and resource nodes
    // and create delivery jobs as needed
    return [];
  }

  // Assign a job to a robot
  public assignJob(jobId: string, robotId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) {
      console.log(`Job ${jobId} not found`);
      return false;
    }

    if (job.assignedRobotId) {
      console.log(
        `Job ${jobId} already assigned to robot ${job.assignedRobotId}`
      );
      return false;
    }

    job.assignedRobotId = robotId;
    console.log(`Assigned job ${jobId} to robot ${robotId}`);
    return true;
  }

  // Mark a job as completed
  public completeJob(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job) {
      console.log(`Job ${jobId} not found`);
      return;
    }

    const robotId = job.assignedRobotId;
    job.completed = true;
    job.assignedRobotId = undefined; // Clear the robot assignment

    console.log(
      `Job ${jobId} of type ${job.type} marked as completed by robot ${robotId}`
    );
  }

  // Get all available jobs (not assigned and not completed)
  public getAvailableJobs(preferredJobTypes?: JobType[]): Job[] {
    const availableJobs = Array.from(this.jobs.values()).filter(
      (job) => !job.assignedRobotId && !job.completed
    );

    // If preferred job types are specified, prioritize those
    if (preferredJobTypes && preferredJobTypes.length > 0) {
      // First, get jobs of preferred types
      const preferredJobs = availableJobs.filter((job) =>
        preferredJobTypes.includes(job.type)
      );

      // If we found preferred jobs, return those
      if (preferredJobs.length > 0) {
        return preferredJobs;
      }
    }

    return availableJobs;
  }

  // Get a job by its ID
  public getJobById(jobId: string): Job | undefined {
    return this.jobs.get(jobId);
  }

  // Get all jobs (both available and assigned)
  public getAllJobs(): Map<string, Job> {
    return this.jobs;
  }

  // Get jobs assigned to a specific robot
  public getJobsForRobot(robotId: string): Job[] {
    const robotJobs: Job[] = [];
    this.jobs.forEach((job) => {
      if (job.assignedRobotId === robotId && !job.completed) {
        robotJobs.push(job);
      }
    });
    return robotJobs;
  }

  // Find merge stack jobs for resource nodes
  public findMergeStackJobs(): Job[] {
    // Get all resource nodes from the ResourceManager
    const resourceNodes = ResourceNode.getAllNodes();

    if (resourceNodes.length < 2) return [];

    const newJobs: Job[] = [];

    // Group nodes by resource type
    const nodesByType: { [key: string]: ResourceNode[] } = {};

    resourceNodes.forEach((node) => {
      const resourceType = node.getResource().type;
      if (!nodesByType[resourceType]) {
        nodesByType[resourceType] = [];
      }
      nodesByType[resourceType].push(node);
    });

    // Look for resource types with multiple nodes
    for (const resourceType in nodesByType) {
      const nodes = nodesByType[resourceType];

      if (nodes.length >= 2) {
        // Sort nodes by amount (ascending)
        nodes.sort((a, b) => a.getAmount() - b.getAmount());

        // Check if we can merge any two nodes
        for (let i = 0; i < nodes.length - 1; i++) {
          const sourceNode = nodes[i];

          // Skip nodes that are already part of a job
          if (this.isNodeInJob(sourceNode)) continue;

          for (let j = i + 1; j < nodes.length; j++) {
            const targetNode = nodes[j];

            // Skip nodes that are already part of a job
            if (this.isNodeInJob(targetNode)) continue;

            // Check if merging would not exceed the max stack size (64)
            if (sourceNode.getAmount() + targetNode.getAmount() <= 64) {
              // We found a pair to merge!
              console.log(
                `Found resource stacks to merge: ${sourceNode.getAmount()} + ${targetNode.getAmount()} ${resourceType}`
              );

              // Create a new job
              const job = this.createMergeStacksJob(sourceNode, targetNode);
              newJobs.push(job);

              // Only create one job per source node
              break;
            }
          }
        }
      }
    }

    return newJobs;
  }

  // Check if a node is already part of a job
  public isNodeInJob(node: ResourceNode): boolean {
    let isInJob = false;
    this.jobs.forEach((job) => {
      if (
        !job.completed &&
        ((job.sourceNode && job.sourceNode === node) ||
          (job.targetNode && job.targetNode === node))
      ) {
        isInJob = true;
      }
    });
    return isInJob;
  }

  // Clean up completed jobs
  public cleanupCompletedJobs(): void {
    const jobsToRemove: string[] = [];
    const jobTypes: { [key: string]: number } = {};

    this.jobs.forEach((job, jobId) => {
      if (job.completed) {
        jobsToRemove.push(jobId);

        // Track job types for logging
        if (!jobTypes[job.type]) {
          jobTypes[job.type] = 0;
        }
        jobTypes[job.type]++;
      }
    });

    jobsToRemove.forEach((jobId) => {
      this.jobs.delete(jobId);
    });

    if (jobsToRemove.length > 0) {
      // Create a summary of job types that were cleaned up
      const typeSummary = Object.entries(jobTypes)
        .map(([type, count]) => `${type}: ${count}`)
        .join(", ");

      console.log(
        `Cleaned up ${jobsToRemove.length} completed jobs (${typeSummary})`
      );
    }
  }

  // Cancel a job by ID
  public cancelJob(jobId: string): boolean {
    console.log(`Canceling job ${jobId}`);

    // Check if the job exists
    if (!this.jobs.has(jobId)) {
      console.warn(`Job ${jobId} not found, cannot cancel`);
      return false;
    }

    // Get the job
    const job = this.jobs.get(jobId)!;

    // If the job is assigned to a robot, we need to notify the robot
    if (job.assignedRobotId) {
      console.log(
        `Job ${jobId} is assigned to robot ${job.assignedRobotId}, notifying robot`
      );
      // The robot will need to handle this notification in its update loop
      // For now, we'll just mark the job as completed
      job.completed = true;
    }

    // Remove the job from the jobs map
    this.jobs.delete(jobId);

    console.log(`Job ${jobId} canceled successfully`);
    return true;
  }

  /**
   * Create a job to deliver a resource to an inventory zone
   * @param sourceNode The resource node to deliver
   * @param inventoryZone The inventory zone to deliver to
   * @returns The created job
   */
  public createDeliverToInventoryJob(
    sourceNode: ResourceNode,
    inventoryZone: InventoryZone
  ): Job {
    // Check if the inventory zone has space
    if (!inventoryZone.hasSpace()) {
      console.log("Inventory zone is full, cannot create delivery job");
      // Create a dummy job that's already completed
      const dummyJobId = `dummy_deliver_to_inventory_${this.nextJobId++}`;
      const dummyJob: Job = {
        id: dummyJobId,
        type: JobType.DELIVER_TO_INVENTORY,
        completed: true, // Already completed so it won't be assigned
        workDuration: 0,
      };
      return dummyJob;
    }

    // Check if the source node has a valid resource
    if (!sourceNode.getResource()) {
      console.log(
        "Source node has no valid resource, cannot create delivery job"
      );
      // Create a dummy job that's already completed
      const dummyJobId = `dummy_deliver_to_inventory_${this.nextJobId++}`;
      const dummyJob: Job = {
        id: dummyJobId,
        type: JobType.DELIVER_TO_INVENTORY,
        completed: true, // Already completed so it won't be assigned
        workDuration: 0,
      };
      return dummyJob;
    }

    const jobId = `deliver_to_inventory_${this.nextJobId++}`;
    const job: Job = {
      id: jobId,
      type: JobType.DELIVER_TO_INVENTORY,
      sourceNode: sourceNode,
      inventoryZone: inventoryZone,
      position: new Phaser.Math.Vector2(inventoryZone.x, inventoryZone.y),
      completed: false,
      workDuration: 2000, // 2 seconds to deliver
      resourceType: sourceNode.getResource().type,
      resourceAmount: sourceNode.getAmount(),
    };

    this.jobs.set(jobId, job);
    console.log(
      `Created deliver to inventory job ${jobId} for ${job.resourceAmount} ${job.resourceType}`
    );
    return job;
  }

  /**
   * Find all jobs for delivering resources to inventory zones
   * @returns Array of inventory zone delivery jobs
   */
  public findInventoryDeliveryJobs(): Job[] {
    return Array.from(this.jobs.values()).filter(
      (job) =>
        job.type === JobType.DELIVER_TO_INVENTORY &&
        !job.completed &&
        !job.assignedRobotId
    );
  }

  /**
   * Check if a resource node is inside an inventory zone
   * @param resourceNode The resource node to check
   * @param inventoryZones Array of inventory zones to check against
   * @returns True if the node is inside an inventory zone, false otherwise
   */
  public isNodeInInventoryZone(
    resourceNode: ResourceNode,
    inventoryZones: InventoryZone[]
  ): boolean {
    // Calculate resource position in grid coordinates
    const resourceGridX = Math.floor(resourceNode.x / TILE_SIZE);
    const resourceGridY = Math.floor(resourceNode.y / TILE_SIZE);

    // Check if the resource is within any inventory zone
    return inventoryZones.some((zone) => {
      // Calculate zone boundaries in grid coordinates
      const zoneGridX = Math.floor(zone.x / TILE_SIZE);
      const zoneGridY = Math.floor(zone.y / TILE_SIZE);
      const halfWidth = Math.floor(zone.tileWidth / 2);
      const halfHeight = Math.floor(zone.tileHeight / 2);

      // Check if resource is within zone boundaries
      return (
        resourceGridX >= zoneGridX - halfWidth &&
        resourceGridX <= zoneGridX + halfWidth &&
        resourceGridY >= zoneGridY - halfHeight &&
        resourceGridY <= zoneGridY + halfHeight
      );
    });
  }

  /**
   * Scan for resources not in inventory zones and create delivery jobs for them
   * @param resourceNodes All resource nodes in the game
   * @param inventoryZones All inventory zones in the game
   * @param maxJobs Maximum number of jobs to create at once (default: 2)
   * @returns Number of jobs created
   */
  public createInventoryDeliveryJobsForLooseResources(
    resourceNodes: ResourceNode[],
    inventoryZones: InventoryZone[],
    maxJobs: number = 2
  ): number {
    // Check if there are any pending blueprint deliveries first
    // If so, don't create inventory delivery jobs to avoid competition
    const pendingBlueprintDeliveries = this.findResourceDeliveryJobs();
    if (pendingBlueprintDeliveries.length > 0) {
      console.log(
        "Skipping inventory delivery jobs due to pending blueprint deliveries"
      );
      return 0;
    }

    // Skip if there are no inventory zones with space
    const availableInventoryZones = inventoryZones.filter((zone) =>
      zone.hasSpace()
    );
    if (availableInventoryZones.length === 0) {
      return 0;
    }

    let jobsCreated = 0;

    // Find resources not in inventory zones
    for (const resourceNode of resourceNodes) {
      // Stop if we've reached the maximum number of jobs
      if (jobsCreated >= maxJobs) {
        break;
      }

      // Skip if the node is already part of a job
      if (this.isNodeInJob(resourceNode)) {
        continue;
      }

      // Skip if the node has no resource or amount
      if (!resourceNode.getResource() || resourceNode.getAmount() <= 0) {
        continue;
      }

      // Check if the resource is inside an inventory zone
      const isInInventoryZone = this.isNodeInInventoryZone(
        resourceNode,
        inventoryZones
      );

      // If not in an inventory zone, create a job to deliver it
      if (!isInInventoryZone) {
        // Find the best inventory zone for this resource type
        const resourceType = resourceNode.getResource().type;
        const bestZone = InventoryZone.findBestZoneForResource(
          resourceType,
          availableInventoryZones
        );

        if (bestZone) {
          this.createDeliverToInventoryJob(resourceNode, bestZone);
          jobsCreated++;
        }
      }
    }

    return jobsCreated;
  }

  /**
   * Create jobs for merging resource stacks within inventory zones
   * This helps keep inventory zones organized by merging stacks of the same resource type
   * @param inventoryZones Array of inventory zones to check
   * @param maxJobs Maximum number of jobs to create at once (default: 1)
   * @returns Number of jobs created
   */
  public createInventoryMergeJobs(
    inventoryZones: InventoryZone[],
    maxJobs: number = 1
  ): number {
    // Check if there are any pending blueprint deliveries first
    // If so, don't create merge jobs to avoid competition
    const pendingBlueprintDeliveries = this.findResourceDeliveryJobs();
    if (pendingBlueprintDeliveries.length > 0) {
      console.log("Skipping merge jobs due to pending blueprint deliveries");
      return 0;
    }

    let jobsCreated = 0;

    // Process each inventory zone
    for (const zone of inventoryZones) {
      // Stop if we've reached the maximum number of jobs
      if (jobsCreated >= maxJobs) {
        break;
      }

      // Get all resources in this zone
      const resources = zone.getResourceNodes();

      // Skip if there are less than 2 resources (nothing to merge)
      if (resources.length < 2) {
        continue;
      }

      // Group resources by type
      const resourcesByType = new Map<ResourceType, ResourceNode[]>();

      for (const resource of resources) {
        const type = resource.getResource().type;
        if (!resourcesByType.has(type)) {
          resourcesByType.set(type, []);
        }
        resourcesByType.get(type)!.push(resource);
      }

      // For each resource type with multiple stacks, create merge jobs
      for (const [type, nodes] of resourcesByType.entries()) {
        // Stop if we've reached the maximum number of jobs
        if (jobsCreated >= maxJobs) {
          break;
        }

        // Skip if there's only one stack of this type
        if (nodes.length < 2) {
          continue;
        }

        // Sort nodes by amount (descending) to merge smaller stacks into larger ones
        nodes.sort((a, b) => b.getAmount() - a.getAmount());

        // Create merge jobs for all but the largest stack
        for (let i = 1; i < nodes.length; i++) {
          // Stop if we've reached the maximum number of jobs
          if (jobsCreated >= maxJobs) {
            break;
          }

          // Skip if the node is already part of a job
          if (this.isNodeInJob(nodes[i])) {
            continue;
          }

          // Create a job to merge this stack into the largest stack
          this.createMergeStacksJob(nodes[i], nodes[0]);
          jobsCreated++;
        }
      }
    }

    return jobsCreated;
  }
}
