import * as Phaser from "phaser";
import { Robot, RobotState } from "./Robot";
import { ResourceManager, ResourceType } from "../../data/resources";
import { TILE_SIZE, ROBOT_VELOCITY, DUST_COLOR } from "../../constants";
import { MINING_RADIUS, MiningStation } from "../buildings/MiningStation";
import { getResourceRichnessAt } from "../../terrain";
import { DustEffects } from "../../effects/DustEffects";
import { DEPTH } from "../../depth";

// Mining Drone class - specialized for mining regolith
export class MiningDrone extends Robot {
  // Reference to parent mining station
  private miningStation: MiningStation;

  // Resource handling
  private resourceAmount: number = 0;
  private maxResourceCapacity: number = 10;
  private miningDuration: number = 1500; // 1.5 seconds to mine
  private miningCompleteTime: number = 0;
  private resourceType: ResourceType = "regolith"; // Default to regolith
  private miningEfficiency: number = 8; // Increased from 5 to compensate for richness factor

  // Mining pattern
  private snakePattern: Phaser.Math.Vector2[] = [];
  private currentPatternIndex: number = 0;
  private patternGenerated: boolean = false;
  private patternDirection: 1 | -1 = 1; // 1 = forward, -1 = backward

  // Mining visual indicator
  private miningIndicatorTween: Phaser.Tweens.Tween | null = null;

  // Warning display
  private warningText: Phaser.GameObjects.Text | null = null;
  private showingWarning: boolean = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    miningStation: MiningStation
  ) {
    super(scene, x, y, "mining-drone");
    this.miningStation = miningStation;

    // Set home position to the mining station
    this.homePosition = new Phaser.Math.Vector2(
      miningStation.x,
      miningStation.y
    );

    // Set the robot's depth to ensure it renders above dust particles
    this.container.setDepth(DEPTH.AGENT);

    // Configure Mars-appropriate dust effects
    this.configureDustEffects(scene);
  }

  // Configure Mars-appropriate dust effects
  private configureDustEffects(scene: Phaser.Scene): void {
    // Override the default dust effects with Mars-appropriate colors
    this.initDustEffects({
      dustColor: 0xd2b48c, // Tan color for Mars dust
      dustSize: 5, // Reduced from 8
      dustAlpha: 0.75, // Reduced from 0.85
      dustCount: 12, // Increased from 10
      dustInterval: 70, // Reduced from 100
      dustLifetime: 800, // Reduced from 1000
      movementDustColor: 0xd2b48c,
      movementDustSize: 4,
      movementDustAlpha: 0.7,
      movementDustCount: 8,
    });
  }

  protected getRobotNameInternal(): string {
    return "Mining Drone";
  }

  public getResourceType(): string {
    return this.resourceType;
  }

  public getResourceAmount(): number {
    return this.resourceAmount;
  }

  public setResourceType(type: ResourceType): void {
    this.resourceType = type;
  }

  // Update the mining drone
  public update(time: number, delta: number): void {
    // Scan for enemies first
    this.scanForEnemies(time);

    // If in defending state, attack enemies instead of mining
    if (this.robotState === RobotState.DEFENDING && this.enemyTarget) {
      this.attackEnemyTarget(time);

      // Make sure health bar position is updated
      this.updateHealthBar();

      return; // Skip normal mining behavior while defending
    }

    // Update the state text
    this.updateStateText();

    // Update dust effects
    this.updateDustEffects(time);

    // Update health bar
    this.updateHealthBar();

    // If we're idle and don't have a pattern, generate one and start mining
    if (this.robotState === RobotState.IDLE && !this.patternGenerated) {
      console.log("Idle drone, generating mining pattern");
      this.generateSnakePattern();
      this.moveToNextPatternPoint();
      return; // Skip the rest of the update to avoid state conflicts
    }

    // If we're idle and full of resources, periodically check for processors
    if (
      this.robotState === RobotState.IDLE &&
      this.resourceAmount >= this.maxResourceCapacity
    ) {
      // Check for processors every 3 seconds
      if (time % 3000 < delta) {
        console.log("Idle with full capacity, checking for processors again");
        const processor = this.findNearestRegolithProcessor();
        if (processor) {
          console.log(
            `Found processor at (${processor.x}, ${processor.y}), moving to it`
          );
          // Move to the processor
          this.moveToTarget(new Phaser.Math.Vector2(processor.x, processor.y));
          this.robotState = RobotState.RETURNING;
          this.clearWarning();
        }
      }
    }

    // Check if mining is complete
    if (
      this.robotState === RobotState.WORKING &&
      this.scene.time.now >= this.miningCompleteTime
    ) {
      console.log("Mining complete");
      this.stopMining();

      // Get the mining yield from the mining station
      const stationYield = this.miningStation.getMiningYield();

      // Get the average richness from the mining station's area
      const { avgRichness } = MiningStation.calculateMiningYieldAt(
        this.miningStation.x,
        this.miningStation.y
      );

      // Calculate amount mined based on the mining station's yield and the richness at current position
      const localRichness = this.getResourceRichnessAtCurrentPosition();

      // Scale the mining yield by the local richness relative to the average richness
      const richnessRatio = localRichness / Math.max(0.1, avgRichness);
      const amountMined = Math.ceil((stationYield / 10) * richnessRatio);

      this.resourceAmount += amountMined;
      console.log(
        `Mining complete. Mined ${amountMined} ${this.resourceType}. Total: ${this.resourceAmount}/${this.maxResourceCapacity}`
      );

      // Check if we've reached capacity
      if (this.resourceAmount >= this.maxResourceCapacity) {
        console.log("Reached capacity, looking for a processor");
        this.resourceAmount = this.maxResourceCapacity; // Cap at max

        // Find the nearest regolith processor
        const processor = this.findNearestRegolithProcessor();
        if (processor) {
          console.log(
            `Found processor at (${processor.x}, ${processor.y}), moving to it`
          );
          // Move to the processor
          this.moveToTarget(new Phaser.Math.Vector2(processor.x, processor.y));
          this.robotState = RobotState.RETURNING;
        } else {
          console.warn("No processor found, showing warning");
          this.showWarning();

          // Don't return to station, just continue mining from current position
          // But we're full, so we can't mine more. Just go idle until a processor is built.
          this.robotState = RobotState.IDLE;
          this.updateStateText();
        }
      } else {
        // Move to next point in the pattern
        this.moveToNextPatternPoint();
      }
    }
  }

  // Return to the mining station
  private returnToStation(): void {
    // Set state to RETURNING
    this.robotState = RobotState.RETURNING;
    this.updateStateText();

    // Start dust effects when moving
    if (this.dustEffects) {
      this.dustEffects.start();
      this.dustEffects.startMovementDust();
    }

    console.log(
      `Returning to station at (${this.miningStation.x}, ${this.miningStation.y})`
    );

    // Calculate distance to mining station
    const distance = Phaser.Math.Distance.Between(
      this.container.x,
      this.container.y,
      this.miningStation.x,
      this.miningStation.y
    );

    // Calculate duration based on distance and player velocity
    // This ensures drones move at a speed similar to the player
    const duration = (distance / ROBOT_VELOCITY) * 1000; // Convert to milliseconds

    // Use tweens for consistent movement
    this.scene.tweens.add({
      targets: this.container,
      x: this.miningStation.x,
      y: this.miningStation.y,
      duration: duration,
      ease: "Linear",
      onComplete: () => {
        this.stopMoving();
        if (this.dustEffects) {
          this.dustEffects.stopMovementDust();
        }
        this.robotState = RobotState.IDLE;
        this.updateStateText();
        console.log("Returned to station, going to next mining point");

        // Reset the pattern so we generate a new one
        this.patternGenerated = false;
        this.snakePattern = [];
      },
    });
  }

  // Generate a snake pattern within the mining area
  private generateSnakePattern(): void {
    this.snakePattern = [];

    // Get mining area dimensions from the mining station
    const miningAreaSize = (MINING_RADIUS * 2 + 1) * TILE_SIZE;
    const halfSize = miningAreaSize / 2;

    // Calculate the top-left corner of the mining area
    const startX = this.miningStation.x - halfSize;
    const startY = this.miningStation.y - halfSize;

    // Calculate how many tiles fit in the mining area
    const tilesPerSide = MINING_RADIUS * 2 + 1;

    console.log(
      `Generating snake pattern for mining area: ${tilesPerSide}x${tilesPerSide} tiles`
    );

    // Generate a snake pattern through the mining area
    for (let row = 0; row < tilesPerSide; row++) {
      // Alternate direction based on row (snake pattern)
      const isRightToLeft = row % 2 === 1;

      for (let col = 0; col < tilesPerSide; col++) {
        // For odd rows, go right to left
        const adjustedCol = isRightToLeft ? tilesPerSide - 1 - col : col;

        // Calculate the center of this tile
        const tileX = startX + (adjustedCol + 0.5) * TILE_SIZE;
        const tileY = startY + (row + 0.5) * TILE_SIZE;

        this.snakePattern.push(new Phaser.Math.Vector2(tileX, tileY));
      }
    }

    console.log(
      `Generated ${this.snakePattern.length} points in snake pattern`
    );
    this.patternGenerated = true;
    this.currentPatternIndex = 0;
    this.patternDirection = 1; // Reset to forward direction
  }

  // Custom method to move to a mining point without using the base class's moveToTarget
  private moveToMiningPoint(point: Phaser.Math.Vector2): void {
    console.log(`Moving to mining point (${point.x}, ${point.y})`);

    // Set state to MOVING
    this.robotState = RobotState.MOVING;
    this.updateStateText();

    // Start dust effects when moving
    if (this.dustEffects) {
      this.dustEffects.start();
      this.dustEffects.startMovementDust();
    }

    // Calculate distance to target
    const distance = Phaser.Math.Distance.Between(
      this.container.x,
      this.container.y,
      point.x,
      point.y
    );

    // Calculate duration based on distance and robot velocity
    const duration = (distance / ROBOT_VELOCITY) * 1000; // Convert to milliseconds

    // Use tweens for smoother movement
    this.scene.tweens.add({
      targets: this.container,
      x: point.x,
      y: point.y,
      duration: duration,
      ease: "Linear",
      onComplete: () => {
        console.log(`Reached mining point (${point.x}, ${point.y})`);
        // Stop movement dust when we reach the target
        if (this.dustEffects) {
          this.dustEffects.stopMovementDust();
        }

        // Start mining immediately
        this.startMining();
      },
    });
  }

  private moveToNextPatternPoint(): void {
    console.log(
      "moveToNextPatternPoint called, current state:",
      this.robotState
    );

    if (!this.patternGenerated || this.snakePattern.length === 0) {
      console.log("No pattern exists, generating new one");
      this.generateSnakePattern();
      if (this.snakePattern.length === 0) {
        // Still no pattern points, go idle instead of returning to station
        console.log("No pattern points available, going idle");
        this.robotState = RobotState.IDLE;
        this.updateStateText();
        return;
      }
    }

    // If we've reached the end of the pattern, reverse direction
    if (
      this.currentPatternIndex >= this.snakePattern.length - 1 &&
      this.patternDirection === 1
    ) {
      this.patternDirection = -1;
      console.log("Reached end of pattern, reversing direction");
    } else if (this.currentPatternIndex <= 0 && this.patternDirection === -1) {
      this.patternDirection = 1;
      console.log("Reached start of pattern, reversing direction");
    }

    // Get the next point in the pattern
    const nextPoint = this.snakePattern[this.currentPatternIndex];
    if (!nextPoint) {
      console.error("No valid point found at index", this.currentPatternIndex);
      this.robotState = RobotState.IDLE;
      this.updateStateText();
      return;
    }

    console.log(
      `Next pattern point: (${nextPoint.x}, ${nextPoint.y}), index: ${this.currentPatternIndex}`
    );

    // Update the index for next time
    this.currentPatternIndex += this.patternDirection;

    // Ensure index stays within bounds
    this.currentPatternIndex = Phaser.Math.Clamp(
      this.currentPatternIndex,
      0,
      this.snakePattern.length - 1
    );

    // Use our custom method to move to the mining point
    this.moveToMiningPoint(nextPoint);
  }

  // Find the nearest regolith processor
  private findNearestRegolithProcessor(): Phaser.GameObjects.Container | null {
    // Get all buildings from the BuildingManager
    const buildings = (window as any).gameState?.buildings || [];

    // First, find all regolith processor buildings
    const processorBuildings = buildings.filter(
      (building: any) =>
        building.type === "regolith-processor" && !building.isBlueprint
    );

    if (processorBuildings.length === 0) {
      console.log("No regolith processor buildings found in BuildingManager");
      // Don't return null yet, continue checking the scene
    } else {
      console.log(
        `Found ${processorBuildings.length} regolith processor buildings in BuildingManager`
      );
    }

    // Get all container objects in the scene
    const allContainers = this.scene.children
      .getAll()
      .filter(
        (child) => child instanceof Phaser.GameObjects.Container
      ) as Phaser.GameObjects.Container[];

    // Find containers that have the addRegolith method (RegolithProcessor instances)
    const processorContainers = allContainers.filter(
      (container) =>
        typeof (container as any).addRegolith === "function" &&
        typeof (container as any).canAcceptRegolith === "function"
    );

    if (processorContainers.length === 0) {
      console.log("No RegolithProcessor containers found in scene");
      return null;
    }

    console.log(
      `Found ${processorContainers.length} RegolithProcessor containers in scene`
    );

    // Find the nearest processor container
    let nearestProcessor: Phaser.GameObjects.Container | null = null;
    let shortestDistance = Infinity;

    for (const container of processorContainers) {
      // Skip containers that can't accept regolith
      if (!(container as any).canAcceptRegolith()) {
        continue;
      }

      const distance = Phaser.Math.Distance.Between(
        this.container.x,
        this.container.y,
        container.x,
        container.y
      );

      if (distance < shortestDistance) {
        nearestProcessor = container;
        shortestDistance = distance;
      }
    }

    if (nearestProcessor) {
      console.log(
        `Found nearest processor at (${nearestProcessor.x}, ${nearestProcessor.y}), distance: ${shortestDistance}`
      );
    } else {
      console.log("No suitable regolith processor found");
    }

    return nearestProcessor;
  }

  // Show a warning that no processor is available
  private showWarning(): void {
    if (this.showingWarning) return;

    this.showingWarning = true;
    this.warningText = this.scene.add
      .text(0, -60, "⚠️ INVENTORY FULL", {
        fontSize: "14px",
        color: "#FF0000",
        fontStyle: "bold",
        backgroundColor: "#FFFF00",
        padding: {
          x: 5,
          y: 2,
        },
      })
      .setOrigin(0.5);
    this.container.add(this.warningText);

    // Make it blink
    this.scene.tweens.add({
      targets: this.warningText,
      alpha: 0,
      duration: 500,
      ease: "Linear",
      yoyo: true,
      repeat: -1,
    });
  }

  // Clear the warning
  private clearWarning(): void {
    if (!this.showingWarning) return;

    this.showingWarning = false;
    if (this.warningText) {
      this.warningText.destroy();
      this.warningText = null;
    }
  }

  // Show a visual indicator directly on the robot when mining
  private showMiningIndicator(): void {
    console.log("Showing mining indicator");

    try {
      // Create a pulsing animation
      if (this.miningIndicatorTween) {
        this.miningIndicatorTween.stop();
      }

      // Create a subtle pulsing scale animation on the container
      this.miningIndicatorTween = this.scene.tweens.add({
        targets: this.container,
        scaleX: { from: 1, to: 1.05 }, // Very subtle
        scaleY: { from: 1, to: 1.05 }, // Very subtle
        duration: 300,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    } catch (error) {
      console.error("Error creating tween:", error);
    }
  }

  // Hide the mining indicator
  private hideMiningIndicator(): void {
    console.log("Hiding mining indicator");

    // Stop the pulsing animation
    if (this.miningIndicatorTween) {
      this.miningIndicatorTween.stop();
      this.miningIndicatorTween = null;
    }

    // Reset scale
    this.container.setScale(1);
  }

  // Start mining at current location
  private startMining(): void {
    if (this.robotState === RobotState.WORKING) return;

    console.log("Starting mining operation");
    this.robotState = RobotState.WORKING;
    this.updateStateText();

    // Calculate mining complete time
    const now = this.scene.time.now;
    this.miningCompleteTime = now + this.miningDuration;

    // Show mining indicator
    this.showMiningIndicator();

    // Explicitly activate working dust effects
    if (this.dustEffects) {
      this.dustEffects.start();
      this.dustEffects.showWorkingDust();
    }
  }

  // Stop mining operation
  private stopMining(): void {
    if (this.robotState !== RobotState.WORKING) return;

    console.log("Stopping mining operation");

    // Hide mining indicator
    this.hideMiningIndicator();

    // Explicitly stop working dust effects
    if (this.dustEffects) {
      this.dustEffects.hideWorkingDust();
    }

    // Don't stop all dust effects here as we might be moving next
  }

  // Get resource richness at current position
  private getResourceRichnessAtCurrentPosition(): number {
    // Use the imported getResourceRichnessAt function
    return getResourceRichnessAt(this.container.x, this.container.y);
  }

  // Clean up resources when destroyed
  public destroy(fromScene?: boolean): void {
    // Clean up warning text
    if (this.warningText) {
      this.warningText.destroy();
      this.warningText = null;
    }

    // Call parent destroy method
    super.destroy(fromScene);
  }

  // When the robot reaches its target
  protected onReachTarget(): void {
    console.log("onReachTarget called, state:", this.robotState);

    // If we're in the MOVING state and following a pattern, start mining
    if (this.robotState === RobotState.MOVING && this.patternGenerated) {
      console.log("onReachTarget: Starting mining");
      this.startMining();
    } else if (this.robotState === RobotState.RETURNING) {
      // We've reached the processor, deposit our resources
      console.log("onReachTarget: Reached processor, depositing resources");

      // Find the processor we've reached
      const processor = this.findNearestRegolithProcessor();
      if (processor) {
        console.log(`Found processor at (${processor.x}, ${processor.y})`);

        try {
          // Check if it has the required methods
          const canAccept =
            typeof (processor as any).canAcceptRegolith === "function";
          const canAdd = typeof (processor as any).addRegolith === "function";

          console.log(
            `Processor methods check - canAcceptRegolith: ${canAccept}, addRegolith: ${canAdd}`
          );

          if (canAccept && canAdd && (processor as any).canAcceptRegolith()) {
            // Deposit the regolith
            (processor as any).addRegolith(this.resourceAmount);
            console.log(
              `Deposited ${this.resourceAmount} regolith at processor`
            );

            // Reset our resource amount
            this.resourceAmount = 0;

            // IMPORTANT: Set the state to MOVING to prevent the base class from setting it to IDLE
            this.robotState = RobotState.MOVING;
            this.updateStateText();

            console.log("After depositing, continuing mining pattern");

            // Instead of using a delay, immediately continue the pattern
            if (this.patternGenerated && this.snakePattern.length > 0) {
              console.log("Continuing mining pattern after processor drop-off");
              this.moveToNextPatternPoint();
            } else {
              // Only generate a new pattern if we don't have one
              console.log(
                "No pattern exists, generating new one after processor drop-off"
              );
              this.patternGenerated = false;
              this.generateSnakePattern();
              this.moveToNextPatternPoint();
            }
          } else {
            console.error(
              "Processor cannot accept regolith or missing required methods"
            );
            this.showWarning();

            // Set state to MOVING to prevent going idle
            this.robotState = RobotState.MOVING;
            this.updateStateText();

            // Don't return to station, just continue mining from current position
            if (this.patternGenerated && this.snakePattern.length > 0) {
              console.log("Continuing mining pattern after processor error");
              this.moveToNextPatternPoint();
            } else {
              console.log("Generating new pattern after processor error");
              this.patternGenerated = false;
              this.generateSnakePattern();
              this.moveToNextPatternPoint();
            }
          }
        } catch (error) {
          console.error("Error interacting with processor:", error);
          this.showWarning();

          // Set state to MOVING to prevent going idle
          this.robotState = RobotState.MOVING;
          this.updateStateText();

          // Don't return to station, just continue mining from current position
          if (this.patternGenerated && this.snakePattern.length > 0) {
            console.log("Continuing mining pattern after processor error");
            this.moveToNextPatternPoint();
          } else {
            console.log("Generating new pattern after processor error");
            this.patternGenerated = false;
            this.generateSnakePattern();
            this.moveToNextPatternPoint();
          }
        }
      } else {
        console.error("No processor found at target location");
        this.showWarning();

        // Set state to MOVING to prevent going idle
        this.robotState = RobotState.MOVING;
        this.updateStateText();

        // Don't return to station, just continue mining from current position
        if (this.patternGenerated && this.snakePattern.length > 0) {
          console.log("Continuing mining pattern after no processor found");
          this.moveToNextPatternPoint();
        } else {
          console.log("Generating new pattern after no processor found");
          this.patternGenerated = false;
          this.generateSnakePattern();
          this.moveToNextPatternPoint();
        }
      }
    }
  }

  // Override the updateStateText method to include resource amount
  protected updateStateText(): void {
    if (this.resourceAmount > 0) {
      this.stateText.setText(
        `${this.robotState.toUpperCase()} (${this.resourceAmount}/${
          this.maxResourceCapacity
        })`
      );
    } else {
      this.stateText.setText(`${this.robotState.toUpperCase()}`);
    }
  }
}
