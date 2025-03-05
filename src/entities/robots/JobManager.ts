import { ResourceNode } from "../resourceNode";

// Define job types
export enum JobType {
  MERGE_STACKS = "merge_stacks",
  WORK_MACHINE = "work_machine",
  BUILD = "build",
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

    job.completed = true;
    console.log(`Completed job ${jobId}`);
  }

  // Get all available jobs (not assigned and not completed)
  public getAvailableJobs(): Job[] {
    const availableJobs: Job[] = [];
    this.jobs.forEach((job) => {
      if (!job.assignedRobotId && !job.completed) {
        availableJobs.push(job);
      }
    });
    return availableJobs;
  }

  // Get all jobs assigned to a specific robot
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
  private isNodeInJob(node: ResourceNode): boolean {
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
    this.jobs.forEach((job, jobId) => {
      if (job.completed) {
        jobsToRemove.push(jobId);
      }
    });

    jobsToRemove.forEach((jobId) => {
      this.jobs.delete(jobId);
    });

    if (jobsToRemove.length > 0) {
      console.log(`Cleaned up ${jobsToRemove.length} completed jobs`);
    }
  }
}
