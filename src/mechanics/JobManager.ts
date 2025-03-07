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

    console.log(
      `Checking ${this.blueprints.length} blueprints for resource delivery jobs`
    );

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
        console.log(
          `Blueprint at (${blueprint.x}, ${blueprint.y}) has no required resources`
        );
        continue;
      }

      console.log(
        `Blueprint at (${blueprint.x}, ${blueprint.y}) requires ${requiredResources.length} resources`
      );

      // Check each required resource
      for (const resource of requiredResources) {
        // Skip if resource is already complete
        if (resource.current >= resource.amount) {
          console.log(
            `Resource ${resource.type} is already complete (${resource.current}/${resource.amount})`
          );
          continue;
        }

        console.log(
          `Blueprint needs ${resource.amount - resource.current} more ${
            resource.type
          }`
        );

        // Find a resource node with the required resource
        const resourceNode = this.findResourceNodeWithType(resource.type);
        if (!resourceNode) {
          console.log(`No resource node found with ${resource.type}`);
          continue;
        }

        console.log(
          `Found resource node with ${resource.type} at (${resourceNode.x}, ${resourceNode.y})`
        );

        // Find an available robot
        const availableRobot = this.findAvailableRobot();
        if (!availableRobot) {
          console.log("No available robots found for resource delivery");
          continue;
        }

        console.log(
          `Found available robot for resource delivery: ${
            (availableRobot as any).getRobotId?.() || "unknown"
          }`
        );

        // Create a job for this resource delivery
        this.createResourceDeliveryJob(
          resourceNode,
          blueprint,
          resource.type,
          resource.amount - resource.current
        );

        // Only create one job at a time to avoid overwhelming the system
        break;
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

    console.log(
      `Creating resource delivery job for ${amount} ${resourceType} from (${resourceNode.x}, ${resourceNode.y}) to blueprint at (${blueprint.x}, ${blueprint.y})`
    );

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

        console.log(
          `Assigned robot ${
            (availableRobot as any).getRobotId?.() || "unknown"
          } to deliver ${amount} ${resourceType} to blueprint`
        );
      } else {
        console.log(
          `Robot ${
            (availableRobot as any).getRobotId?.() || "unknown"
          } cannot deliver resources to blueprints`
        );
      }
    } else {
      console.log(
        `Robot ${
          (availableRobot as any).getRobotId?.() || "unknown"
        } cannot pick up resources`
      );
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
