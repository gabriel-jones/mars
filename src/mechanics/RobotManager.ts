import Phaser from "phaser";
import { Robot } from "../entities/robots/Robot";
import { Optimus } from "../entities/robots/Optimus";
import { MiningDrone } from "../entities/robots/MiningDrone";
import { HealthBarRenderer } from "../interfaces/Health";
import {
  NUM_INITIAL_OPTIMUS,
  MAP_WIDTH,
  MAP_HEIGHT,
  TILE_SIZE,
  DEFAULT_FONT,
} from "../constants";
import { gameState } from "../state";
import { ResourceNode } from "../entities/resourceNode";
import { ResourceType } from "../data/resources";
import { Blueprint } from "../entities/buildings/Blueprint";
import { JobManager } from "../entities/robots/JobManager";
import { InventoryZone } from "../entities/buildings/InventoryZone";
import { Building } from "../entities/buildings/Building";

/**
 * RobotManager handles all robot-related functionality
 * including creation, management, and updates
 */
export class RobotManager {
  private scene: Phaser.Scene;
  private robots: Robot[] = [];
  private optimuses: Optimus[] = [];
  private miningDrones: MiningDrone[] = [];
  private healthBarRenderer: HealthBarRenderer;
  private starship: Phaser.GameObjects.GameObject | null = null;

  constructor(
    scene: Phaser.Scene,
    healthBarRenderer: HealthBarRenderer,
    starship: Phaser.GameObjects.GameObject | null = null
  ) {
    this.scene = scene;
    this.healthBarRenderer = healthBarRenderer;
    this.starship = starship;

    // We'll create robots explicitly after construction
    // instead of in the constructor
  }

  /**
   * Creates the initial robots for the colony
   * This should be called after the RobotManager is fully initialized
   */
  public createInitialRobots(): void {
    // Create Optimus robots
    this.createOptimusRobots(NUM_INITIAL_OPTIMUS);
  }

  /**
   * Create Optimus robots
   * @param count Number of robots to create
   */
  public createOptimusRobots(count: number): void {
    if (count <= 0) return;

    console.log(`Creating ${count} Optimus robots`);

    const isDelivery = this.robots.length > 0; // If we already have robots, this is a delivery

    // Get the spawn point from the scene if available
    const mainScene = this.scene as any;
    const spawnPoint = mainScene.spawnPoint;
    const landingPadOffset = 100;

    console.log("Robot spawn info:", {
      hasSpawnPoint: !!spawnPoint,
      spawnPointX: spawnPoint?.x,
      spawnPointY: spawnPoint?.y,
      hasStarship: !!this.starship,
      starshipX: this.starship ? (this.starship as any).x : null,
      starshipY: this.starship ? (this.starship as any).y : null,
    });

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 80 + Math.random() * 40; // Slightly smaller distance to keep robots closer

      // Use spawn point + landing pad offset if available, otherwise use starship position
      let x, y;

      if (spawnPoint) {
        // Use the spawn point + landing pad offset as the center for spawning
        // This places robots around the landing pad
        const centerX = spawnPoint.x + landingPadOffset;
        const centerY = spawnPoint.y + landingPadOffset;
        x = centerX + Math.cos(angle) * distance;
        y = centerY + Math.sin(angle) * distance;
      } else if (this.starship) {
        // Fallback to using starship position
        x = (this.starship as any).x + Math.cos(angle) * distance;
        y = (this.starship as any).y + Math.sin(angle) * distance;
      } else {
        // Last resort fallback - use center of map
        x = (MAP_WIDTH * TILE_SIZE) / 2 + Math.random() * 200 - 100;
        y = (MAP_HEIGHT * TILE_SIZE) / 2 + Math.random() * 200 - 100;
      }

      const optimus = new Optimus(this.scene, x, y);
      this.robots.push(optimus);
      this.optimuses.push(optimus);

      console.log(`Created Optimus robot ${i + 1}/${count} at (${x}, ${y})`);

      // Set up health bar for the new robot
      if (this.healthBarRenderer) {
        const healthBar = this.healthBarRenderer.createHealthBar(
          optimus as any,
          -30
        );
        optimus.setHealthBar(healthBar);
      }
    }

    // Show notification if this is a delivery
    if (isDelivery) {
      this.showRobotDeliveryNotification(count);
    }

    // Make sure gameState.robots is always up to date
    gameState.robots = this.robots;
  }

  /**
   * Shows a notification when robots are delivered
   */
  private showRobotDeliveryNotification(count: number): void {
    // Create a notification text
    const notification = this.scene.add.text(
      this.scene.cameras.main.centerX,
      100,
      `STARSHIP DELIVERED ${count} OPTIMUS ROBOTS`,
      {
        fontSize: "24px",
        color: "#00ffff",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 4,
        shadow: {
          offsetX: 2,
          offsetY: 2,
          color: "#000000",
          blur: 5,
          fill: true,
        },
        fontFamily: DEFAULT_FONT,
      }
    );
    notification.setOrigin(0.5);
    notification.setScrollFactor(0);
    notification.setDepth(1000);

    // Fade out and remove after a few seconds
    this.scene.tweens.add({
      targets: notification,
      alpha: { from: 1, to: 0 },
      y: 80,
      duration: 3000,
      ease: "Power2",
      onComplete: () => {
        notification.destroy();
      },
    });
  }

  /**
   * Adds a robot to the manager
   */
  public addRobot(robot: Robot): void {
    this.robots.push(robot);

    // Add to gameState for enemies to target
    gameState.robots = this.robots;

    // If it's a mining drone, add it to the mining drones array
    if (robot instanceof MiningDrone) {
      this.miningDrones.push(robot as MiningDrone);
    }

    // If it's an optimus, add it to the optimuses array
    if (robot instanceof Optimus) {
      this.optimuses.push(robot as Optimus);
    }
  }

  /**
   * Removes a robot from the manager
   */
  public removeRobot(robot: Robot): void {
    console.log(`Removing robot: ${robot.getRobotName()}`);

    // Remove from main robots array
    const index = this.robots.indexOf(robot);
    if (index !== -1) {
      this.robots.splice(index, 1);
      console.log(
        `Removed robot from main array. Remaining robots: ${this.robots.length}`
      );
    }

    // Update gameState
    gameState.robots = this.robots;

    // If it's a mining drone, remove it from the mining drones array
    if (robot instanceof MiningDrone) {
      const droneIndex = this.miningDrones.indexOf(robot as MiningDrone);
      if (droneIndex !== -1) {
        this.miningDrones.splice(droneIndex, 1);
        console.log(
          `Removed mining drone. Remaining drones: ${this.miningDrones.length}`
        );
      }
    }

    // If it's an optimus, remove it from the optimuses array
    if (robot instanceof Optimus) {
      const optimusIndex = this.optimuses.indexOf(robot as Optimus);
      if (optimusIndex !== -1) {
        this.optimuses.splice(optimusIndex, 1);
        console.log(
          `Removed optimus. Remaining optimuses: ${this.optimuses.length}`
        );
      }
    }
  }

  /**
   * Updates all robots
   */
  public update(time: number, delta: number): void {
    // Filter out any destroyed robots or robots that are not alive
    this.robots = this.robots.filter((robot) => {
      // Check if the robot is alive and its container is still active
      const isActive =
        robot.isAlive() &&
        (robot as any).container &&
        (robot as any).container.active;
      return isActive;
    });

    // Also filter the specialized arrays
    this.optimuses = this.optimuses.filter((robot) => {
      const isActive =
        robot.isAlive() &&
        (robot as any).container &&
        (robot as any).container.active;
      return isActive;
    });

    this.miningDrones = this.miningDrones.filter((robot) => {
      const isActive =
        robot.isAlive() &&
        (robot as any).container &&
        (robot as any).container.active;
      return isActive;
    });

    // Update all robots
    this.robots.forEach((robot) => robot.update(time, delta));

    // Check if we need to create more Optimus robots
    if (this.optimuses.length < 2) {
      this.createOptimusRobots(2 - this.optimuses.length);
    }

    // Make sure gameState.robots is always up to date
    gameState.robots = this.robots;
  }

  /**
   * Gets all robots
   */
  public getRobots(): Robot[] {
    return this.robots;
  }

  /**
   * Gets all Optimus robots
   */
  public getOptimusRobots(): Optimus[] {
    return this.optimuses;
  }

  /**
   * Gets all mining drones
   */
  public getMiningDrones(): MiningDrone[] {
    return this.miningDrones;
  }

  /**
   * Gets robot info for the UI
   */
  public getRobotInfoForUI(): any[] {
    return this.robots.map((robot) => {
      let carrying = "";
      let carryingType = "";
      let inventory = {};
      let equippedTool = "None";
      let availableTools: string[] = [];
      let health = 0;
      let maxHealth = 100;
      let shield = 0;
      let maxShield = 0;

      // Get health information
      if (robot.getCurrentHealth && robot.getMaxHealth) {
        health = robot.getCurrentHealth();
        maxHealth = robot.getMaxHealth();
      }

      // Get shield information if available
      if (robot.hasShield && robot.hasShield()) {
        shield = robot.getCurrentShield();
        maxShield = robot.getMaxShield();
      }

      // Check if the robot is an Optimus
      if (robot instanceof Optimus) {
        // Get the resource type and amount if carrying something
        if (
          (robot as any).getCarriedResource &&
          (robot as any).getCarriedResource()
        ) {
          const resourceType = (robot as any).getResourceType();
          const resourceAmount = (robot as any).getResourceAmount();
          carrying = `${resourceType} (${resourceAmount})`;
          carryingType = resourceType;

          // Add to inventory
          inventory = {
            [resourceType]: resourceAmount,
          };
        }

        // Get equipped tool information
        if ((robot as any).assaultRifle) {
          equippedTool = "Assault Rifle";
          availableTools = ["Assault Rifle"];
        }
      }

      // Check if the robot is a MiningDrone
      if (robot instanceof MiningDrone) {
        // Get the resource type and amount if carrying something
        const resourceAmount =
          (robot as any).getResourceAmount &&
          (robot as any).getResourceAmount();
        if (resourceAmount > 0) {
          const resourceType = (robot as any).getResourceType();
          carrying = `${resourceType} (${resourceAmount})`;
          carryingType = resourceType;

          // Add to inventory
          inventory = {
            [resourceType]: resourceAmount,
          };
        }

        // Mining drones have a mining tool
        equippedTool = "Mining Tool";
        availableTools = ["Mining Tool"];
      }

      return {
        name: (robot as any).getRobotName
          ? (robot as any).getRobotName()
          : "Unknown",
        type: robot instanceof Optimus ? "optimus" : "mining-drone",
        state: (robot as any).getRobotState
          ? (robot as any).getRobotState()
          : "unknown",
        carrying: carrying,
        carryingType: carryingType,
        health: health,
        maxHealth: maxHealth,
        shield: shield,
        maxShield: maxShield,
        inventory: inventory,
        equippedTool: equippedTool,
        availableTools: availableTools,
      };
    });
  }

  /**
   * Updates the starship reference
   */
  public updateStarship(starship: Phaser.GameObjects.GameObject): void {
    this.starship = starship;
  }

  /**
   * Manually creates resource delivery jobs for blueprints
   * This is a more direct approach than relying on the JobManager
   */
  public createResourceDeliveryJobs(
    resourceNodes: ResourceNode[],
    blueprints: Blueprint[]
  ): void {
    // Skip if no blueprints, robots, or resource nodes
    if (
      blueprints.length === 0 ||
      this.robots.length === 0 ||
      resourceNodes.length === 0
    ) {
      return;
    }

    console.log(
      `Checking ${blueprints.length} blueprints for resource delivery jobs`
    );

    // Find available robots
    const availableRobots = this.robots.filter(
      (robot) => (robot as any).isAvailable && (robot as any).isAvailable()
    );

    if (availableRobots.length === 0) {
      console.log("No available robots for resource delivery");
      return;
    }

    console.log(
      `Found ${availableRobots.length} available robots for resource delivery`
    );

    // Check each blueprint
    for (const blueprint of blueprints) {
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
        const resourceNode = this.findResourceNodeWithType(
          resourceNodes,
          resource.type
        );
        if (!resourceNode) {
          console.log(`No resource node found with ${resource.type}`);
          continue;
        }

        console.log(
          `Found resource node with ${resource.type} at (${resourceNode.x}, ${resourceNode.y})`
        );

        // Get the next available robot
        if (availableRobots.length === 0) {
          console.log("No more available robots for resource delivery");
          return;
        }

        const robot = availableRobots.shift()!;
        console.log(
          `Assigning robot ${
            (robot as any).getRobotId?.() || "unknown"
          } to deliver ${resource.type}`
        );

        // Assign the robot to deliver the resource
        if (
          (robot as any).pickupResourceNode &&
          (robot as any).deliverResourceToBlueprint
        ) {
          // First, pick up the resource
          (robot as any).pickupResourceNode(resourceNode);

          // Then, deliver it to the blueprint
          (robot as any).deliverResourceToBlueprint(
            blueprint,
            resource.type,
            resource.amount - resource.current
          );

          console.log(
            `Robot assigned to deliver ${resource.amount - resource.current} ${
              resource.type
            } to blueprint`
          );

          // Only process one resource per blueprint to avoid overwhelming the system
          break;
        } else {
          console.log(
            `Robot ${
              (robot as any).getRobotId?.() || "unknown"
            } cannot handle resource delivery`
          );
          // Put the robot back in the available list
          availableRobots.push(robot);
        }
      }

      // Only process one blueprint at a time to avoid overwhelming the system
      if (availableRobots.length === 0) {
        break;
      }
    }
  }

  /**
   * Finds a resource node with the specified resource type
   */
  private findResourceNodeWithType(
    resourceNodes: ResourceNode[],
    resourceType: ResourceType
  ): ResourceNode | null {
    // Find a resource node with the required resource
    for (const node of resourceNodes) {
      const nodeResource = node.getResource();
      if (
        nodeResource &&
        nodeResource.type === resourceType &&
        node.getAmount() > 0
      ) {
        return node;
      }
    }
    return null;
  }

  /**
   * Creates jobs for robots to deliver resources to inventory zones
   * @param resourceNodes Array of resource nodes
   * @param buildings Array of buildings
   */
  public createInventoryZoneDeliveryJobs(
    resourceNodes: ResourceNode[],
    buildings: Building[]
  ): void {
    // Skip if no buildings, robots, or resource nodes
    if (
      buildings.length === 0 ||
      this.robots.length === 0 ||
      resourceNodes.length === 0
    ) {
      return;
    }

    // Find inventory zones
    const inventoryZones = buildings.filter(
      (building) => building.getBuildingType() === "inventory-zone"
    ) as InventoryZone[];

    if (inventoryZones.length === 0) {
      // No inventory zones found
      return;
    }

    console.log(
      `Checking ${inventoryZones.length} inventory zones for resource delivery jobs`
    );

    // Find available robots
    const availableRobots = this.robots.filter(
      (robot) => (robot as any).isAvailable && (robot as any).isAvailable()
    );

    if (availableRobots.length === 0) {
      console.log("No available robots for inventory delivery");
      return;
    }

    console.log(
      `Found ${availableRobots.length} available robots for inventory delivery`
    );

    // Get the job manager
    const jobManager = JobManager.getInstance();

    // For each resource node, create a job to deliver it to an inventory zone
    for (const resourceNode of resourceNodes) {
      // Skip if the resource node is already part of a job
      if (jobManager.isNodeInJob(resourceNode)) {
        continue;
      }

      // Find the closest inventory zone with space
      let closestZone: InventoryZone | null = null;
      let closestDistance = Infinity;

      for (const zone of inventoryZones) {
        if (zone.hasSpace()) {
          const distance = Phaser.Math.Distance.Between(
            resourceNode.x,
            resourceNode.y,
            zone.x,
            zone.y
          );

          if (distance < closestDistance) {
            closestZone = zone;
            closestDistance = distance;
          }
        }
      }

      // Skip if no inventory zone with space was found
      if (!closestZone) {
        console.log("No inventory zone with space found");
        continue;
      }

      // Create a job to deliver the resource to the inventory zone
      const job = jobManager.createDeliverToInventoryJob(
        resourceNode,
        closestZone
      );

      console.log(
        `Created job to deliver ${
          resourceNode.getResource().type
        } to inventory zone at (${closestZone.x}, ${closestZone.y})`
      );

      // Get the next available robot
      if (availableRobots.length === 0) {
        console.log("No more available robots for inventory delivery");
        return;
      }

      const robot = availableRobots.shift()!;
      console.log(
        `Assigning robot ${
          (robot as any).getRobotId?.() || "unknown"
        } to deliver ${resourceNode.getResource().type} to inventory zone`
      );

      // Assign the robot to the job
      jobManager.assignJob(job.id, (robot as any).getRobotId());
    }
  }

  /**
   * Cleans up resources
   */
  public shutdown(): void {
    // Clean up robots
    this.robots.forEach((robot) => {
      robot.destroy();
    });

    this.robots = [];
    this.optimuses = [];
    this.miningDrones = [];
  }
}
