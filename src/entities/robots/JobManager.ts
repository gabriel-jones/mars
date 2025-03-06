import { ResourceNode } from "../resourceNode";
import { ResourceType } from "../../data/resources";
import { Blueprint } from "../buildings/Blueprint";

// Define job types
export enum JobType {
  MERGE_STACKS = "merge_stacks",
  WORK_MACHINE = "work_machine",
  BUILD = "build",
  DELIVER_RESOURCE = "deliver_resource", // New job type for resource delivery
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
}
