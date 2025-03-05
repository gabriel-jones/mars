import * as Phaser from "phaser";
import { Robot, RobotState } from "./Robot";
import { ResourceManager, ResourceType } from "../../data/resources";
import { TILE_SIZE, ROBOT_VELOCITY } from "../../constants";
import { MINING_RADIUS, MiningStation } from "../buildings/MiningStation";
import { getResourceRichnessAt } from "../../terrain";

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
  private miningEfficiency: number = 1; // Base mining efficiency

  // Visual effects
  private sparkleParticles: Phaser.GameObjects.Particles.ParticleEmitter | null =
    null;
  private sparkleEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null =
    null;

  // Mining pattern
  private snakePattern: Phaser.Math.Vector2[] = [];
  private currentPatternIndex: number = 0;
  private patternGenerated: boolean = false;
  private patternDirection: 1 | -1 = 1; // 1 = forward, -1 = backward

  // Warning display
  private warningText: Phaser.GameObjects.Text | null = null;
  private showingWarning: boolean = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    miningStation: MiningStation
  ) {
    super(scene, x, y, "mining-drone", 100);
    this.miningStation = miningStation;

    // Set home position to the mining station
    this.homePosition = new Phaser.Math.Vector2(
      miningStation.x,
      miningStation.y
    );

    // Create sparkle particles for mining effects
    this.createSparkleEffect();
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
        `${this.robotState} (${this.resourceAmount}/${this.maxResourceCapacity})`
      );
    } else {
      this.updateStateText();
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

    // State machine for the mining drone
    switch (this.robotState) {
      case RobotState.IDLE:
        // If not full, generate snake pattern and start mining
        if (this.resourceAmount < this.maxResourceCapacity) {
          if (!this.patternGenerated) {
            this.generateSnakePattern();
          }
          this.moveToNextPatternPoint();
        }
        break;

      case RobotState.MOVING:
        // Movement is now handled by tweens in moveToNextPatternPoint
        // No need to check for hasReachedTarget here
        break;

      case RobotState.WORKING:
        // Check if mining is complete
        if (this.scene.time.now >= this.miningCompleteTime) {
          // Calculate mining yield based on the mining station's yield
          // Convert yield/min to yield/operation
          const yieldPerMinute = (this.miningStation as any).miningYield || 1;
          const operationsPerMinute = 60000 / this.miningDuration;
          const yieldPerOperation = Math.max(
            1,
            Math.round(yieldPerMinute / operationsPerMinute)
          );

          // Apply mining efficiency and collect resources
          const resourcesMined = Math.min(
            yieldPerOperation * this.miningEfficiency,
            this.maxResourceCapacity - this.resourceAmount
          );

          this.resourceAmount += resourcesMined;
          console.log(
            `Mined ${resourcesMined} ${this.resourceType} (Total: ${this.resourceAmount}/${this.maxResourceCapacity})`
          );

          // If we've reached capacity, go deposit
          if (this.resourceAmount >= this.maxResourceCapacity) {
            const processor = this.findNearestRegolithProcessor();
            if (processor) {
              this.robotState = RobotState.RETURNING;
              this.updateStateText();
              this.moveToTarget(
                new Phaser.Math.Vector2(processor.x, processor.y)
              );
              this.clearWarning();
            } else {
              // No processor found, go idle and show warning
              this.robotState = RobotState.IDLE;
              this.updateStateText();
              this.showWarning();
            }
          } else {
            // Continue mining in the pattern
            this.moveToNextPatternPoint();
          }

          // Stop mining effects
          this.stopMining();
        }
        break;

      case RobotState.RETURNING:
        // The tween onComplete will trigger hasReachedTarget
        // We just need to check if we're at the target position
        if (
          this.target &&
          Math.abs(this.x - this.target.x) < 5 &&
          Math.abs(this.y - this.target.y) < 5
        ) {
          // Only process this once
          if (this.robotState === RobotState.RETURNING) {
            console.log("Processing deposit at processor");

            // Deposit resources
            if (this.resourceAmount > 0) {
              // Try to deposit at a RegolithProcessor
              const processor = this.scene.children
                .getAll()
                .find(
                  (child) =>
                    child instanceof Phaser.GameObjects.Container &&
                    child.x === this.target?.x &&
                    child.y === this.target?.y &&
                    (child as any).addRegolith
                ) as any;

              if (processor && processor.addRegolith) {
                // Add resources to the processor
                processor.addRegolith(this.resourceAmount);
                console.log(
                  `Deposited ${this.resourceAmount} regolith at processor`
                );
              } else {
                // If no processor found, add to general inventory
                ResourceManager.addResource(
                  this.resourceType,
                  this.resourceAmount
                );
                console.log(
                  `Added ${this.resourceAmount} ${this.resourceType} to inventory`
                );
              }

              // Reset resource amount
              this.resourceAmount = 0;
              this.currentPatternIndex = 0; // Reset pattern index
              this.patternDirection = 1; // Reset to forward direction
            }

            // Return to mining station
            this.returnToStation();

            // Stop mining effects
            this.stopMining();
          }
        }
        break;
    }
  }

  // Return to the mining station
  private returnToStation(): void {
    this.robotState = RobotState.MOVING;
    this.updateStateText();

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
        this.robotState = RobotState.IDLE;
        this.updateStateText();
        console.log("Returned to station, going idle");
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
    if (this.snakePattern.length === 0) {
      this.generateSnakePattern();
      if (this.snakePattern.length === 0) {
        // Still no pattern points, return to station
        this.returnToStation();
        return;
      }
    }

    // Check if we've reached the end or beginning of the pattern
    if (this.currentPatternIndex >= this.snakePattern.length) {
      // Reached the end, reverse direction
      this.patternDirection = -1;
      this.currentPatternIndex = this.snakePattern.length - 2; // Start from second-to-last point
    } else if (this.currentPatternIndex < 0) {
      // Reached the beginning, reverse direction
      this.patternDirection = 1;
      this.currentPatternIndex = 1; // Start from second point
    }

    // Make sure index is within bounds
    this.currentPatternIndex = Math.max(
      0,
      Math.min(this.currentPatternIndex, this.snakePattern.length - 1)
    );

    const nextPoint = this.snakePattern[this.currentPatternIndex];

    // Debug output to help diagnose issues
    console.log(
      `Moving to tile ${this.currentPatternIndex} (direction: ${this.patternDirection}): (${nextPoint.x}, ${nextPoint.y})`
    );

    // Update index for next move based on direction
    this.currentPatternIndex += this.patternDirection;

    // Set state and move
    this.robotState = RobotState.MOVING;
    this.updateStateText();

    // Calculate distance to target
    const distance = Phaser.Math.Distance.Between(
      this.x,
      this.y,
      nextPoint.x,
      nextPoint.y
    );

    // Calculate duration based on distance and robot velocity
    // This ensures drones move at a speed similar to the player
    const duration = (distance / ROBOT_VELOCITY) * 1000; // Convert to milliseconds

    // Use tweens for smoother movement from tile to tile
    this.scene.tweens.add({
      targets: this,
      x: nextPoint.x,
      y: nextPoint.y,
      duration: duration, // Use calculated duration instead of fixed 500ms
      ease: "Linear",
      onComplete: () => {
        if (this.robotState === RobotState.MOVING) {
          this.stopMoving();

          // Start mining when we reach the tile
          this.robotState = RobotState.WORKING;
          this.updateStateText();
          this.miningCompleteTime = this.scene.time.now + this.miningDuration;
        }
      },
    });

    // Stop any active mining effects
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
        stroke: "#000000",
        strokeThickness: 1,
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

  // Create sparkle particle effect
  private createSparkleEffect(): void {
    // Create particle emitter
    this.sparkleParticles = this.scene.add.particles(0, 0, "flare", {
      lifespan: { min: 300, max: 600 },
      speed: { min: 10, max: 30 },
      scale: { start: 0.1, end: 0 },
      quantity: 0, // Start with no particles
      blendMode: "ADD",
      tint: [0xffffff, 0xffd700, 0xffa500], // White, gold, orange
      emitting: false, // Start disabled
    });

    this.sparkleEmitter = this.sparkleParticles;
  }

  // Start mining at current location
  private startMining(): void {
    this.robotState = RobotState.WORKING;
    this.updateStateText();
    this.miningCompleteTime = this.scene.time.now + this.miningDuration;

    // Get resource richness at current position
    const richness = this.getResourceRichnessAtCurrentPosition();

    // Start sparkle effect based on richness
    if (this.sparkleEmitter) {
      // Position the emitter at the drone
      this.sparkleEmitter.setPosition(this.x, this.y);

      // Scale particle quantity based on richness (0-1)
      const particleQuantity = Math.ceil(richness * 10);
      this.sparkleEmitter.setQuantity(particleQuantity);

      // Set frequency based on richness (higher richness = more frequent particles)
      const frequency = Math.max(50, 200 - richness * 150);
      this.sparkleEmitter.setFrequency(frequency);

      // Start the emitter
      this.sparkleEmitter.start();
    }
  }

  // Get resource richness at current position
  private getResourceRichnessAtCurrentPosition(): number {
    // Use the imported getResourceRichnessAt function
    return getResourceRichnessAt(this.x, this.y);
  }

  // Stop mining effects
  private stopMining(): void {
    if (this.sparkleEmitter) {
      this.sparkleEmitter.stop();
    }
  }

  // When the robot reaches its target
  protected onReachTarget(): void {
    // If we're in the MOVING state and following a pattern, start mining
    if (this.robotState === RobotState.MOVING && this.patternGenerated) {
      this.startMining();
    }
  }

  // Override hasReachedTarget to call onReachTarget
  protected hasReachedTarget(threshold: number = 5): boolean {
    const reached = super.hasReachedTarget(threshold);
    if (reached) {
      this.onReachTarget();
    }
    return reached;
  }

  // Clean up resources when destroyed
  public destroy(fromScene?: boolean): void {
    // Clean up particle effects
    if (this.sparkleParticles) {
      this.sparkleParticles.destroy();
      this.sparkleParticles = null;
      this.sparkleEmitter = null;
    }

    // Call parent destroy
    super.destroy(fromScene);
  }
}
