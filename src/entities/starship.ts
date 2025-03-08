import * as Phaser from "phaser";
import { TILE_SIZE } from "../constants";
import { ResourceType } from "../data/resources";
import { TransferItem } from "../ui/earthMenu";
import { DEPTH } from "../depth";

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

  private robotsToDeliver: number = 2; // Number of robots to deliver each landing

  // Transfer queue for Earth resources
  private transferQueue: TransferItem[] = [];

  // Inventory for the starship with index signature
  public inventory: { [key in ResourceType]?: number } = {
    iron: 200,
    silicon: 150,
    titanium: 50,
    aluminium: 75,
    water: 100,
    regolith: 0,
  };

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    this.scene = scene;
    this.landingCoordinates = { x, y };

    // Create the starship sprite
    this.starshipSprite = scene.add
      .sprite(0, 0, "starship")
      .setOrigin(0.5, 1) // Set origin to bottom center for landing effect
      .setDisplaySize(TILE_SIZE * 2, TILE_SIZE * 8) // Set exact size in tiles
      .setDepth(DEPTH.STARSHIP);
    this.add(this.starshipSprite);

    // Create engine flame sprite
    this.engineFlame = scene.add
      .sprite(0, 0, "engine-flame")
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

    // Start the cycle automatically
    this.startCycle();
  }

  preload() {
    // Preload assets if needed
  }

  startCycle() {
    // Schedule first takeoff after a short delay
    this.stateTimer = this.scene.time.delayedCall(5000, () => {
      this.takeOffFromMars();
    });
  }

  takeOffFromMars() {
    if (this.currentState !== StarshipState.MARS_LANDED) return;

    this.currentState = StarshipState.MARS_TAKEOFF;

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

    // Create takeoff animation - animate the container instead of individual sprites
    this.scene.tweens.add({
      targets: this,
      y: this.y - this.flightHeight,
      duration: this.animationDuration,
      ease: "Cubic.easeIn",
      onComplete: () => {
        // Ship has reached Mars orbit
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
    if (this.currentState !== StarshipState.MARS_ORBIT) return;

    this.currentState = StarshipState.MARS_LANDING;

    // Reset position above landing pad
    this.setPosition(
      this.landingCoordinates.x,
      this.landingCoordinates.y - this.flightHeight
    );
    this.setVisible(true);
    this.engineFlame.setVisible(true);

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

    // Create landing animation - animate the container instead of individual sprites
    this.scene.tweens.add({
      targets: this,
      y: this.landingCoordinates.y,
      duration: this.animationDuration,
      ease: "Cubic.easeOut",
      onComplete: () => {
        // Ship has landed
        this.currentState = StarshipState.MARS_LANDED;
        this.engineFlame.setVisible(false);

        // Deliver robots when the ship lands
        this.deliverRobots();

        // Schedule next takeoff
        this.stateTimer = this.scene.time.delayedCall(
          this.stateDurations.marsOrbit, // Use same duration as orbit for landed state
          () => {
            this.takeOffFromMars();
          }
        );
      },
    });
  }

  // Deliver Optimus robots when the starship lands
  private deliverRobots(): void {
    // Get the main scene
    const mainScene = this.scene as any;

    // Check if the scene has a robotManager
    if (mainScene.robotManager) {
      // Use the RobotManager to create the robots
      mainScene.robotManager.createOptimusRobots(this.robotsToDeliver);
    }
  }

  update(time?: number, delta?: number) {
    // Log the current state for debugging
    if (Math.random() < 0.01) {
      // Only log occasionally to avoid spam
      console.log(
        `Starship update called, current state: ${this.currentState}`
      );
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

  public setRobotsToDeliver(count: number): void {
    this.robotsToDeliver = count;
  }

  public getRobotsToDeliver(): number {
    return this.robotsToDeliver;
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

  // Add method to process the transfer queue when in Earth orbit
  public processTransferQueue(): void {
    if (this.currentState !== StarshipState.EARTH_ORBIT) {
      console.log("Cannot process transfer queue - not in Earth orbit");
      return;
    }

    console.log(
      `Processing transfer queue with ${this.transferQueue.length} items`
    );

    // Process each item in the queue
    this.transferQueue.forEach((item) => {
      // Add the resources to the inventory
      if (!this.inventory[item.resourceType]) {
        this.inventory[item.resourceType] = 0;
      }

      this.inventory[item.resourceType]! += item.amount;
      console.log(
        `Added ${item.amount} ${item.resourceType} to starship inventory`
      );
    });

    // Clear the queue after processing
    this.clearTransferQueue();
  }
}
