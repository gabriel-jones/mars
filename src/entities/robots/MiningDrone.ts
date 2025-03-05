import * as Phaser from "phaser";
import { Robot, RobotState } from "./Robot";
import { ResourceManager, ResourceType } from "../../data/resources";
import { TILE_SIZE, ROBOT_VELOCITY, DUST_COLOR } from "../../constants";
import { MINING_RADIUS, MiningStation } from "../buildings/MiningStation";
import { getResourceRichnessAt } from "../../terrain";
import { DustEffects } from "../../effects/DustEffects";

// Mining Drone class - specialized for mining regolith
export class MiningDrone extends Robot {
  // Reference to parent mining station
  private miningStation: MiningStation;

  // Resource handling
  private resourceAmount: number = 0;
  private maxResourceCapacity: number = 100;
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
    this.setDepth(10);

    // Configure Mars-appropriate dust effects
    this.configureDustEffects(scene);
  }

  // Configure Mars-appropriate dust effects
  private configureDustEffects(scene: Phaser.Scene): void {
    // Override the default dust effects with Mars-appropriate colors
    this.dustEffects = new DustEffects(scene, this, {
      dustColor: 0xd2b48c, // Tan color for Mars dust
      dustSize: 5, // Reduced from 8
      dustAlpha: 0.75, // Reduced from 0.85
      dustCount: 14, // Reduced from 16
      dustInterval: 70, // Increased from 60 to spawn less frequently
      dustLifetime: 1000, // Reduced from 1200
      workingDustColor: 0xd2b48c, // Tan color for Mars dust
      workingDustSize: 6, // Reduced from 9
      workingDustAlpha: 0.85, // Reduced from 0.95
      workingDustCount: 18, // Reduced from 24
      movementDustColor: 0xc19a6b, // Darker tan for movement dust
      movementDustSize: 5, // Reduced from 8
      movementDustAlpha: 0.8, // Reduced from 0.9
      movementDustCount: 25, // Reduced from 35
    });
  }

  protected getRobotName(): string {
    return "Mining Drone";
  }

  public setResourceType(type: ResourceType): void {
    this.resourceType = type;
  }

  public update(): void {
    // Update state text with resource info if carrying resources
    if (this.resourceAmount > 0) {
      this.stateText.setText(
        `${this.robotState.toUpperCase()} (${this.resourceAmount}/${
          this.maxResourceCapacity
        })`
      );
    } else {
      this.updateStateText();
    }

    // Update dust effects
    this.updateDustEffects(this.scene.time.now);

    // If we're idle and don't have a pattern, generate one and start mining
    if (this.robotState === RobotState.IDLE && !this.patternGenerated) {
      console.log("Idle drone, generating mining pattern");
      this.generateSnakePattern();
      this.moveToNextPatternPoint();
    }

    // Check if we're mining and if mining is complete
    if (
      this.robotState === RobotState.WORKING &&
      this.scene.time.now >= this.miningCompleteTime
    ) {
      // Mining complete, collect resources
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
        console.log("Reached capacity, returning to station");
        this.resourceAmount = this.maxResourceCapacity; // Cap at max
        this.returnToStation();
      } else {
        // Move to next point in the pattern
        this.moveToNextPatternPoint();
      }
    }

    // Find the nearest regolith processor if we're full
    if (
      this.resourceAmount >= this.maxResourceCapacity &&
      this.robotState !== RobotState.RETURNING
    ) {
      const processor = this.findNearestRegolithProcessor();
      if (processor) {
        this.robotState = RobotState.RETURNING;
        this.updateStateText();
        this.moveToTarget(new Phaser.Math.Vector2(processor.x, processor.y));
        this.clearWarning();
      } else {
        // No processor found, go idle and show warning
        this.robotState = RobotState.IDLE;
        this.updateStateText();
        this.showWarning();
      }
    }
  }

  // Return to the mining station
  private returnToStation(): void {
    this.robotState = RobotState.MOVING;
    this.updateStateText();

    // Start dust effects when moving
    this.dustEffects.start();
    this.dustEffects.startMovementDust();

    console.log(
      `Returning to station at (${this.miningStation.x}, ${this.miningStation.y})`
    );

    // Calculate distance to mining station
    const distance = Phaser.Math.Distance.Between(
      this.x,
      this.y,
      this.miningStation.x,
      this.miningStation.y
    );

    // Calculate duration based on distance and player velocity
    // This ensures drones move at a speed similar to the player
    const duration = (distance / ROBOT_VELOCITY) * 1000; // Convert to milliseconds

    // Use tweens for consistent movement
    this.scene.tweens.add({
      targets: this,
      x: this.miningStation.x,
      y: this.miningStation.y,
      duration: duration,
      ease: "Linear",
      onComplete: () => {
        this.stopMoving();
        this.dustEffects.stopMovementDust();
        this.robotState = RobotState.IDLE;
        this.updateStateText();
        console.log("Returned to station, going to next mining point");

        // Continue mining at the next pattern point
        if (this.patternGenerated && this.snakePattern.length > 0) {
          this.moveToNextPatternPoint();
        }
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

  // Move to the next point in the snake pattern
  private moveToNextPatternPoint(): void {
    if (!this.patternGenerated || this.snakePattern.length === 0) {
      this.generateSnakePattern();
      if (this.snakePattern.length === 0) {
        // Still no pattern points, return to station
        this.returnToStation();
        return;
      }
    }

    // If we've reached the end of the pattern, reverse direction
    if (
      this.currentPatternIndex >= this.snakePattern.length - 1 &&
      this.patternDirection === 1
    ) {
      this.patternDirection = -1;
    } else if (this.currentPatternIndex <= 0 && this.patternDirection === -1) {
      this.patternDirection = 1;
    }

    // Get the next point in the pattern
    const nextPoint = this.snakePattern[this.currentPatternIndex];

    // Update the index for next time
    this.currentPatternIndex += this.patternDirection;

    // Ensure index stays within bounds
    this.currentPatternIndex = Phaser.Math.Clamp(
      this.currentPatternIndex,
      0,
      this.snakePattern.length - 1
    );

    // Move to the next point
    this.robotState = RobotState.MOVING;
    this.updateStateText();

    // Start dust effects when moving
    this.dustEffects.start();
    this.dustEffects.startMovementDust();

    // Calculate distance to target
    const distance = Phaser.Math.Distance.Between(
      this.x,
      this.y,
      nextPoint.x,
      nextPoint.y
    );

    // Calculate duration based on distance and robot velocity
    const duration = (distance / ROBOT_VELOCITY) * 1000; // Convert to milliseconds

    // Use tweens for smoother movement
    this.scene.tweens.add({
      targets: this,
      x: nextPoint.x,
      y: nextPoint.y,
      duration: duration,
      ease: "Linear",
      onComplete: () => {
        if (this.robotState === RobotState.MOVING) {
          // Stop movement dust when we reach the target
          this.dustEffects.stopMovementDust();
          // Start mining when we reach the tile
          this.startMining();
        }
      },
    });

    // Stop any existing mining effects
    this.stopMining();
  }

  // Find the nearest regolith processor
  private findNearestRegolithProcessor(): Phaser.GameObjects.Container | null {
    // Get all buildings from the BuildingManager
    const buildings = (window as any).gameState?.buildings || [];

    let nearestProcessor: Phaser.GameObjects.Container | null = null;
    let shortestDistance = Infinity;

    // Find the nearest regolith processor
    for (const building of buildings) {
      if (building.type === "regolith-processor") {
        const distance = Phaser.Math.Distance.Between(
          this.x,
          this.y,
          building.position.x,
          building.position.y
        );

        if (distance < shortestDistance) {
          // Find the actual processor game object
          const processor = this.scene.children
            .getAll()
            .find(
              (child) =>
                child instanceof Phaser.GameObjects.Container &&
                (child as Phaser.GameObjects.Container).x ===
                  building.position.x &&
                (child as Phaser.GameObjects.Container).y ===
                  building.position.y &&
                (child as any).addRegolith
            ) as Phaser.GameObjects.Container | undefined;

          if (processor) {
            nearestProcessor = processor;
            shortestDistance = distance;
          }
        }
      }
    }

    if (nearestProcessor) {
      console.log(
        `Found nearest processor at (${nearestProcessor.x}, ${nearestProcessor.y}), distance: ${shortestDistance}`
      );
    } else {
      console.log("No regolith processor found");
    }

    return nearestProcessor;
  }

  // Show a warning that no processor is available
  private showWarning(): void {
    if (this.showingWarning) return;

    this.showingWarning = true;
    this.warningText = this.scene.add
      .text(0, -55, "No processor!", {
        fontSize: "12px",
        color: "#FF0000",
        align: "center",
      })
      .setOrigin(0.5);
    this.add(this.warningText);

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
        targets: this,
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
    this.setScale(1);
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
    this.dustEffects.start();
    this.dustEffects.showWorkingDust();
  }

  // Stop mining operation
  private stopMining(): void {
    if (this.robotState !== RobotState.WORKING) return;

    console.log("Stopping mining operation");

    // Hide mining indicator
    this.hideMiningIndicator();

    // Explicitly stop working dust effects
    this.dustEffects.hideWorkingDust();

    // Don't stop all dust effects here as we might be moving next
  }

  // Get resource richness at current position
  private getResourceRichnessAtCurrentPosition(): number {
    // Use the imported getResourceRichnessAt function
    return getResourceRichnessAt(this.x, this.y);
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
    // If we're in the MOVING state and following a pattern, start mining
    if (this.robotState === RobotState.MOVING && this.patternGenerated) {
      console.log("onReachTarget: Starting mining");
      this.startMining();
    } else if (this.robotState === RobotState.RETURNING) {
      // We've reached the processor, deposit our resources
      console.log("onReachTarget: Reached processor, depositing resources");

      // Find the processor we've reached
      const processor = this.findNearestRegolithProcessor();
      if (
        processor &&
        (processor as any).addRegolith &&
        (processor as any).canAcceptRegolith()
      ) {
        // Deposit the regolith
        (processor as any).addRegolith(this.resourceAmount);
        console.log(`Deposited ${this.resourceAmount} regolith at processor`);

        // Reset our resource amount
        this.resourceAmount = 0;

        // Return to mining
        this.robotState = RobotState.IDLE;
        this.updateStateText();
        this.patternGenerated = false; // Generate a new pattern
      } else {
        console.log("Failed to deposit regolith: No valid processor found");
        this.showWarning();
      }
    } else {
      console.log(
        "onReachTarget: Not starting mining. State:",
        this.robotState,
        "patternGenerated:",
        this.patternGenerated
      );
    }
  }
}
