import * as Phaser from "phaser";
import { TILE_SIZE } from "../constants";
import { ResourceType } from "../data/resources";
import { TransferItem } from "../ui/earthMenu";
import { DEPTH } from "../depth";
import { ResourceNode } from "../entities/resourceNode";

export enum StarshipState {
  MARS_LANDED = "mars_landed",
  MARS_TAKEOFF = "mars_takeoff",
  MARS_ORBIT = "mars_orbit",
  MARS_TO_EARTH = "mars_to_earth",
  EARTH_ORBIT = "earth_orbit",
  EARTH_TO_MARS = "earth_to_mars",
  MARS_LANDING = "mars_landing",
}

export class Starship extends Phaser.GameObjects.Container {
  private starshipSprite: Phaser.GameObjects.Sprite;
  private engineFlame: Phaser.GameObjects.Sprite;
  private currentState: StarshipState;
  private stateTimer: Phaser.Time.TimerEvent;
  private landingCoordinates: { x: number; y: number };
  private flightHeight: number = 1000; // How high the ship flies off screen
  private animationDuration: number = 5000; // 5 seconds for animations

  // Durations for each state (in milliseconds)
  private stateDurations = {
    marsOrbit: 5000, // 5 seconds in Mars orbit (reduced from 10s)
    marsToEarth: 7000, // 7 seconds for Mars to Earth transfer (reduced from 15s)
    earthOrbit: 5000, // 5 seconds in Earth orbit (reduced from 10s)
    earthToMars: 7000, // 7 seconds for Earth to Mars transfer (reduced from 15s)
  };

  private transferQueue: TransferItem[] = [];

  // Inventory for the starship with index signature
  public inventory: { [key in ResourceType]?: number } = {};

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    this.scene = scene;
    this.landingCoordinates = { x, y };

    console.log(`Starship created at position (${x}, ${y})`);

    // Create the starship sprite
    this.starshipSprite = scene.add
      .sprite(0, 0, "starship")
      .setOrigin(0.5, 1) // Set origin to bottom center for landing effect
      .setDisplaySize(TILE_SIZE * 2, TILE_SIZE * 8) // Set exact size in tiles
      .setDepth(DEPTH.STARSHIP);
    this.add(this.starshipSprite);

    // Create engine flame sprite
    this.engineFlame = scene.add
      .sprite(0, 0, "flame")
      .setOrigin(0.5, 0) // Set origin to top center
      .setScale(0.8)
      .setVisible(false)
      .setDepth(DEPTH.STARSHIP - 1); // Set depth lower than starship
    this.add(this.engineFlame);

    // Position the flame at the bottom of the rocket
    this.engineFlame.setPosition(0, -25); // Position at the same point as the starship's bottom

    // Set initial state
    this.currentState = StarshipState.MARS_LANDED;

    // Add to scene
    scene.add.existing(this);

    console.log(`Starship initialized with state: ${this.currentState}`);
  }

  preload() {
    // Preload assets if needed
  }

  startCycle() {
    console.log("Starting starship cycle");

    // Clear any existing timer
    if (this.stateTimer) {
      this.stateTimer.remove();
    }

    // Make sure the starship is visible and in the correct position
    this.setVisible(true);
    this.setPosition(this.landingCoordinates.x, this.landingCoordinates.y);
    this.currentState = StarshipState.MARS_LANDED;

    // Only schedule takeoff if there's an active transfer queue
    this.checkForEarthTransferQueue();
  }

  takeOffFromMars() {
    if (this.currentState !== StarshipState.MARS_LANDED) {
      console.log(`Cannot take off: current state is ${this.currentState}`);
      return;
    }

    console.log("Starship taking off from Mars");
    this.currentState = StarshipState.MARS_TAKEOFF;

    // Clear any existing timer
    if (this.stateTimer) {
      this.stateTimer.remove();
    }

    // Reset rotation to ensure we start from a vertical position
    this.setRotation(0);

    // Show engine flame
    this.engineFlame.setVisible(true);

    // Create flame animation
    this.scene.tweens.add({
      targets: this.engineFlame,
      scaleX: { from: 0.6, to: 0.8 },
      scaleY: { from: 0.6, to: 1.2 },
      alpha: { from: 0.7, to: 1 },
      duration: 1000,
      repeat: 4,
      yoyo: true,
    });

    // Add ship shaking effect
    this.scene.tweens.add({
      targets: this.starshipSprite,
      x: { from: -2, to: 2 },
      duration: 50,
      yoyo: true,
      repeat: 20,
      ease: "Sine.easeInOut",
    });

    // Calculate the angle for rotation based on the arc
    // For takeoff, we want to rotate clockwise (positive angle)
    // The angle should be around 15-20 degrees (0.26-0.35 radians) for a natural look
    const rotationAngle = 0.3; // ~17 degrees in radians

    // Animate both position and rotation
    this.scene.tweens.add({
      targets: this,
      x: this.x + 200, // Move slightly to the right
      y: this.y - this.flightHeight, // Move up
      rotation: rotationAngle, // Rotate to match the arc trajectory
      duration: this.animationDuration,
      ease: "Sine.easeIn",
      // Use onUpdate to create a more natural rotation that follows the arc
      onUpdate: (tween) => {
        // Calculate progress (0 to 1)
        const progress = tween.progress;

        // Start rotating after initial vertical ascent (after 20% of the animation)
        if (progress > 0.2) {
          // Gradually increase rotation to match the arc
          // Map progress from 0.2-1.0 to 0-rotationAngle
          const currentRotation = rotationAngle * ((progress - 0.2) / 0.8);
          this.setRotation(currentRotation);
        } else {
          // Keep vertical during initial ascent
          this.setRotation(0);
        }
      },
      onComplete: () => {
        console.log("Starship reached Mars orbit");
        this.currentState = StarshipState.MARS_ORBIT;
        this.setVisible(false);

        // Schedule Mars to Earth transfer
        this.stateTimer = this.scene.time.delayedCall(
          this.stateDurations.marsOrbit,
          () => {
            this.startMarsToEarthTransfer();
          }
        );
      },
    });
  }

  startMarsToEarthTransfer() {
    if (this.currentState !== StarshipState.MARS_ORBIT) return;

    this.currentState = StarshipState.MARS_TO_EARTH;

    // Schedule arrival at Earth orbit
    this.stateTimer = this.scene.time.delayedCall(
      this.stateDurations.marsToEarth,
      () => {
        this.arriveAtEarthOrbit();
      }
    );
  }

  arriveAtEarthOrbit() {
    console.log("Starship arrived at Earth orbit");
    this.currentState = StarshipState.EARTH_ORBIT;

    // Process the transfer queue
    this.processTransferQueue();

    // Set a timer to start the return journey
    this.stateTimer = this.scene.time.delayedCall(
      this.stateDurations.earthOrbit,
      () => {
        this.startEarthToMarsTransfer();
      }
    );
  }

  startEarthToMarsTransfer() {
    if (this.currentState !== StarshipState.EARTH_ORBIT) return;

    this.currentState = StarshipState.EARTH_TO_MARS;

    // Schedule arrival back at Mars orbit
    this.stateTimer = this.scene.time.delayedCall(
      this.stateDurations.earthToMars,
      () => {
        this.arriveBackAtMarsOrbit();
      }
    );
  }

  arriveBackAtMarsOrbit() {
    if (this.currentState !== StarshipState.EARTH_TO_MARS) return;

    this.currentState = StarshipState.MARS_ORBIT;

    // Schedule landing on Mars
    this.stateTimer = this.scene.time.delayedCall(
      this.stateDurations.marsOrbit / 2, // Shorter time before landing
      () => {
        this.landOnMars();
      }
    );
  }

  landOnMars() {
    console.log("Landing on Mars");
    this.currentState = StarshipState.MARS_LANDING;

    // Starting position (above and slightly to the left)
    const startX = this.landingCoordinates.x - 200;
    const startY = this.landingCoordinates.y - this.flightHeight;

    // Reset position and make visible
    this.setPosition(startX, startY);
    this.setVisible(true);
    this.engineFlame.setVisible(true);

    // Set initial rotation for landing approach
    // For landing from the left, we want a slight counter-clockwise rotation (negative angle)
    const initialRotationAngle = -0.3; // ~-17 degrees in radians
    this.setRotation(initialRotationAngle);

    console.log(
      `Starship set to position (${startX}, ${startY}) for landing with rotation ${initialRotationAngle}`
    );

    // Create flame animation
    this.scene.tweens.add({
      targets: this.engineFlame,
      scaleX: { from: 0.8, to: 0.6 },
      scaleY: { from: 1.2, to: 0.6 },
      alpha: { from: 1, to: 0.7 },
      duration: 1000,
      repeat: 4,
      yoyo: true,
    });

    // Add ship shaking effect
    this.scene.tweens.add({
      targets: this.starshipSprite,
      x: { from: -2, to: 2 },
      duration: 50,
      yoyo: true,
      repeat: 20,
      ease: "Sine.easeInOut",
    });

    // Animate both position and rotation for landing
    this.scene.tweens.add({
      targets: this,
      x: this.landingCoordinates.x, // Move to landing coordinates
      y: this.landingCoordinates.y, // Move to landing coordinates
      rotation: 0, // End with vertical orientation
      duration: this.animationDuration,
      ease: "Sine.easeOut",
      // Use onUpdate to create a more natural rotation that follows the arc
      onUpdate: (tween) => {
        // Calculate progress (0 to 1)
        const progress = tween.progress;

        // Gradually decrease rotation as we approach landing
        // For the last 20% of the animation, we want to be completely vertical
        if (progress < 0.8) {
          // Map progress from 0-0.8 to initialRotationAngle-0
          const currentRotation = initialRotationAngle * (1 - progress / 0.8);
          this.setRotation(currentRotation);
        } else {
          // Vertical orientation for final approach
          this.setRotation(0);
        }
      },
      onComplete: () => {
        console.log("Landed on Mars at coordinates:", this.landingCoordinates);
        this.currentState = StarshipState.MARS_LANDED;
        this.engineFlame.setVisible(false);

        // Ensure we're perfectly vertical at landing
        this.setRotation(0);

        // Process the transfer queue to deliver items
        this.processTransferQueueOnMars();

        // Check if there's an active transfer queue in the Earth menu
        this.checkForEarthTransferQueue();
      },
    });
  }

  // Check if there's an active transfer queue in the Earth menu and schedule takeoff if needed
  private checkForEarthTransferQueue(): void {
    console.log(
      `Checking for Earth transfer queue, current state: ${this.currentState}`
    );

    const mainScene = this.scene as any;

    // Try to access the Earth menu through the ActionMenu
    if (!mainScene.actionMenu || !mainScene.actionMenu.earthMenu) {
      console.error(
        "Earth menu not found in scene. Looking for actionMenu.earthMenu"
      );
      return;
    }

    // Get the transfer queue from the Earth menu
    const queue = mainScene.actionMenu.earthMenu.getTransferQueue();
    console.log(`Transfer queue length: ${queue ? queue.length : "undefined"}`);

    // Only schedule takeoff if there's an active transfer queue
    if (queue && queue.length > 0) {
      console.log(
        `Active transfer queue found with ${queue.length} items, scheduling takeoff`
      );

      // Clear any existing timer
      if (this.stateTimer) {
        this.stateTimer.remove();
      }

      // Set a timer to take off again - use a shorter delay for better responsiveness
      this.stateTimer = this.scene.time.delayedCall(
        1000, // Use a shorter delay (1 second) for better responsiveness
        () => {
          console.log("Takeoff timer triggered, calling takeOffFromMars()");
          this.takeOffFromMars();
        }
      );
    } else {
      console.log("No active transfer queue, staying on Mars");
      // Ship will stay on Mars until there's an active transfer queue
      // We'll check periodically for a transfer queue
      this.scheduleTransferQueueCheck();
    }
  }

  // Force immediate takeoff (can be called directly from the Earth menu)
  public forceImmediateTakeoff(): void {
    console.log("Force immediate takeoff called");

    // Only take off if we're landed on Mars
    if (this.currentState === StarshipState.MARS_LANDED) {
      console.log("Forcing immediate takeoff from Mars");

      // Clear any existing timer
      if (this.stateTimer) {
        this.stateTimer.remove();
      }

      // Take off immediately
      this.takeOffFromMars();
    } else {
      console.log(
        `Cannot force takeoff: current state is ${this.currentState}`
      );
    }
  }

  // Schedule a periodic check for a transfer queue
  private scheduleTransferQueueCheck(): void {
    // Check every 5 seconds for a transfer queue
    this.stateTimer = this.scene.time.delayedCall(5000, () => {
      if (this.currentState === StarshipState.MARS_LANDED) {
        this.checkForEarthTransferQueue();
      }
    });
  }

  // Process the transfer queue when landed on Mars
  private processTransferQueueOnMars(): void {
    // Get the landing coordinates
    const x = this.landingCoordinates.x;
    const y = this.landingCoordinates.y;

    // Get the main scene
    const mainScene = this.scene as any;

    // Log the current inventory
    console.log(
      "Starship inventory on Mars landing:",
      JSON.stringify(this.inventory)
    );

    // Process resources from inventory
    let hasResources = false;
    for (const resourceType in this.inventory) {
      const typedResourceType = resourceType as ResourceType;
      const amount = this.inventory[typedResourceType];
      if (amount && amount > 0) {
        hasResources = true;
        break;
      }
    }

    if (!hasResources) {
      console.log("No resources to deliver");
    } else {
      console.log("Delivering resources from starship inventory");

      // First, handle robots if any
      const robotCount = this.inventory["robot"] || 0;
      if (robotCount > 0) {
        if (mainScene.robotManager) {
          mainScene.robotManager.createOptimusRobots(robotCount);
          console.log(`Delivered ${robotCount} Optimus robots`);
          // Clear the robot inventory
          this.inventory["robot"] = 0;
        } else {
          console.error("Robot manager not found in scene");
        }
      }

      // Then handle other resources
      for (const resourceType in this.inventory) {
        const typedResourceType = resourceType as ResourceType;
        // Skip robots as they were handled above
        if (typedResourceType === "robot") continue;

        const amount = this.inventory[typedResourceType] || 0;
        if (amount <= 0) continue;

        // Get the resource definition
        const resourceDef = mainScene.getResourceDefinition
          ? mainScene.getResourceDefinition(typedResourceType)
          : { emoji: "📦", name: typedResourceType };

        console.log(`Delivering ${amount} ${typedResourceType}`);

        // Create resource nodes in batches to avoid too many objects
        const batchSize = 64; // Maximum resources per node
        const numFullBatches = Math.floor(amount / batchSize);
        const remainder = amount % batchSize;

        // Create full batch nodes
        for (let i = 0; i < numFullBatches; i++) {
          this.spawnResourceNode(
            typedResourceType,
            batchSize,
            x,
            y,
            resourceDef
          );
        }

        // Create remainder node if needed
        if (remainder > 0) {
          this.spawnResourceNode(
            typedResourceType,
            remainder,
            x,
            y,
            resourceDef
          );
        }

        // Clear the inventory
        this.inventory[typedResourceType] = 0;
      }
    }
  }

  // Helper method to spawn a resource node
  private spawnResourceNode(
    resourceType: ResourceType,
    amount: number,
    centerX: number,
    centerY: number,
    resourceDef: any
  ): void {
    // Calculate a random position around the landing pad
    const angle = Math.random() * Math.PI * 2;
    const distance = 150 + Math.random() * 100; // 150-250 pixels from center
    const x = centerX + Math.cos(angle) * distance;
    const y = centerY + Math.sin(angle) * distance;

    // Create a resource node
    const mainScene = this.scene as any;
    if (mainScene.createResourceNode) {
      mainScene.createResourceNode(x, y, resourceType, amount);
      console.log(
        `Created resource node with ${amount} ${resourceType} at (${x}, ${y})`
      );
    } else {
      // Fallback if createResourceNode is not available
      // Create a proper Resource object
      const resource = {
        type: resourceType,
        name: resourceDef.name || resourceType,
        emoji: resourceDef.emoji || "📦",
      };

      const resourceNode = new ResourceNode(this.scene, x, y, resource, amount);
      this.scene.add.existing(resourceNode);
      console.log(
        `Created fallback resource node with ${amount} ${resourceType} at (${x}, ${y})`
      );
    }
  }

  update(time?: number, delta?: number) {
    // Only ensure visibility and position when in MARS_LANDED state
    // and not when taking off or in other states
    if (this.currentState === StarshipState.MARS_LANDED) {
      // Make sure the ship is visible and in the correct position
      this.setVisible(true);

      // Log the state occasionally for debugging
      if (time && time % 5000 < 16) {
        console.log(
          `Starship state: ${this.currentState}, position: (${this.x}, ${this.y})`
        );
      }
    }
  }

  public getState(): StarshipState {
    return this.currentState;
  }

  public getInventory(): { [key in ResourceType]?: number } {
    return this.inventory;
  }

  public addToInventory(resourceType: ResourceType, amount: number): void {
    if (!this.inventory[resourceType]) {
      this.inventory[resourceType] = 0;
    }
    this.inventory[resourceType]! += amount;
  }

  public removeFromInventory(
    resourceType: ResourceType,
    amount: number
  ): boolean {
    if (
      !this.inventory[resourceType] ||
      this.inventory[resourceType]! < amount
    ) {
      return false;
    }
    this.inventory[resourceType]! -= amount;
    return true;
  }

  // Add method to set the transfer queue
  public setTransferQueue(queue: TransferItem[]): void {
    this.transferQueue = [...queue];
    console.log(`Transfer queue set with ${this.transferQueue.length} items`);
  }

  // Add method to get the transfer queue
  public getTransferQueue(): TransferItem[] {
    return this.transferQueue;
  }

  // Add method to clear the transfer queue
  public clearTransferQueue(): void {
    this.transferQueue = [];
  }

  // Process the transfer queue when in Earth orbit
  public processTransferQueue(): void {
    // Get the Earth menu from the scene
    const mainScene = this.scene as any;

    // Try to access the Earth menu through the ActionMenu
    if (!mainScene.actionMenu || !mainScene.actionMenu.earthMenu) {
      console.error(
        "Earth menu not found in scene. Looking for actionMenu.earthMenu"
      );
      return;
    }

    // Log the current inventory before processing
    console.log(
      "Starship inventory before processing:",
      JSON.stringify(this.inventory)
    );

    // Get the transfer queue
    const queue = mainScene.actionMenu.earthMenu.getTransferQueue();
    if (!queue || queue.length === 0) {
      console.log("No items in transfer queue");
      return;
    }

    console.log(
      `Processing transfer queue with ${queue.length} items:`,
      JSON.stringify(queue)
    );

    // Track Starlink satellites for Mars menu update
    let starlinkCount = 0;

    // Process each item in the queue
    queue.forEach((item: TransferItem) => {
      if (item.isStarlink) {
        // Handle Starlink satellites - they stay in Mars orbit
        starlinkCount += item.amount;
        console.log(`Added ${item.amount} Starlink satellites to Mars orbit`);
      } else if (item.isRobot) {
        // Add robots to the inventory as a special resource type
        const resourceType = "robot" as ResourceType;
        if (!this.inventory[resourceType]) {
          this.inventory[resourceType] = 0;
        }
        this.inventory[resourceType] =
          (this.inventory[resourceType] || 0) + item.amount;
        console.log(`Added ${item.amount} robots to starship inventory`);
      } else {
        // Add resources to the starship inventory
        const resourceType = item.resourceType;
        if (!this.inventory[resourceType]) {
          this.inventory[resourceType] = 0;
        }
        this.inventory[resourceType] =
          (this.inventory[resourceType] || 0) + item.amount;
        console.log(
          `Added ${item.amount} ${resourceType} to starship inventory`
        );
      }
    });

    // Update Mars menu with Starlink satellite count if any were added
    if (starlinkCount > 0 && mainScene.actionMenu) {
      // Get current count from Mars menu if available
      let currentCount = 0;
      if (mainScene.actionMenu.marsMenu) {
        // We'll implement a method to get the current count
        currentCount = mainScene.marsMenu
          ? mainScene.marsMenu.getStarlinkCount() || 0
          : 0;
      }

      // Update the Mars menu with the new total
      mainScene.actionMenu.updateMarsMenuStarlinkStatus(
        currentCount + starlinkCount
      );
    }

    // Log the updated inventory
    console.log(
      "Starship inventory after processing:",
      JSON.stringify(this.inventory)
    );

    // Clear the queue
    mainScene.actionMenu.earthMenu.clearTransferQueue();
  }
}
