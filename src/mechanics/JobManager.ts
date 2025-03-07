import Phaser from "phaser";
import { Robot } from "../entities/robots/Robot";
import { ResourceNode } from "../entities/resourceNode";
import { Blueprint } from "../entities/buildings/Blueprint";
import { ResourceType } from "../data/resources";

/**
 * JobManager handles all job-related functionality
 * including resource delivery, building construction, etc.
 */
export class JobManager {
  private scene: Phaser.Scene;
  private robots: Robot[] = [];
  private resourceNodes: ResourceNode[] = [];
  private blueprints: Blueprint[] = [];

  constructor(
    scene: Phaser.Scene,
    robots: Robot[],
    resourceNodes: ResourceNode[],
    blueprints: Blueprint[]
  ) {
    this.scene = scene;
    this.robots = robots;
    this.resourceNodes = resourceNodes;
    this.blueprints = blueprints;
  }

  /**
   * Creates resource delivery jobs for blueprints
   */
  public createResourceDeliveryJobs(): void {
    // Skip if no blueprints or robots
    if (this.blueprints.length === 0 || this.robots.length === 0) {
      return;
    }

    // Check each blueprint
    for (const blueprint of this.blueprints) {
      // Skip if blueprint is already complete
      if ((blueprint as any).isComplete && (blueprint as any).isComplete()) {
        continue;
      }

      // Get required resources
      const requiredResources = (blueprint as any).getRequiredResources
        ? (blueprint as any).getRequiredResources()
        : [];

      // Skip if no required resources
      if (requiredResources.length === 0) {
        continue;
      }

      // Check each required resource
      for (const resource of requiredResources) {
        // Skip if resource is already complete
        if (resource.current >= resource.amount) {
          continue;
        }

        // Find a resource node with the required resource
        const resourceNode = this.findResourceNodeWithType(resource.type);
        if (!resourceNode) {
          continue;
        }

        // Create a job for this resource delivery
        this.createResourceDeliveryJob(
          resourceNode,
          blueprint,
          resource.type,
          resource.amount - resource.current
        );
      }
    }
  }

  /**
   * Finds a resource node with the specified resource type
   */
  private findResourceNodeWithType(
    resourceType: ResourceType
  ): ResourceNode | null {
    // Find a resource node with the required resource
    for (const node of this.resourceNodes) {
      const nodeResource = node.getResource();
      if (nodeResource.type === resourceType && node.getAmount() > 0) {
        return node;
      }
    }
    return null;
  }

  /**
   * Creates a resource delivery job
   */
  private createResourceDeliveryJob(
    resourceNode: ResourceNode,
    blueprint: Blueprint,
    resourceType: ResourceType,
    amount: number
  ): void {
    // Find an available robot
    const availableRobot = this.findAvailableRobot();
    if (!availableRobot) {
      return;
    }

    // Create the job
    if ((availableRobot as any).pickupResourceNode) {
      // First, pick up the resource
      (availableRobot as any).pickupResourceNode(resourceNode);

      // Then, deliver it to the blueprint
      if ((availableRobot as any).deliverResourceToBlueprint) {
        (availableRobot as any).deliverResourceToBlueprint(
          blueprint,
          resourceType,
          amount
        );
      }
    }
  }

  /**
   * Finds an available robot
   */
  private findAvailableRobot(): Robot | null {
    // Find a robot that's not busy
    for (const robot of this.robots) {
      if ((robot as any).isAvailable && (robot as any).isAvailable()) {
        return robot;
      }
    }
    return null;
  }

  /**
   * Updates the references to robots, resource nodes, and blueprints
   */
  public updateReferences(
    robots: Robot[],
    resourceNodes: ResourceNode[],
    blueprints: Blueprint[]
  ): void {
    this.robots = robots;
    this.resourceNodes = resourceNodes;
    this.blueprints = blueprints;
  }
}
