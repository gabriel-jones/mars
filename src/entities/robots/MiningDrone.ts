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
  private miningEfficiency: number = 5; // Base mining efficiency

  // Visual effects
  private sparkleParticles: Phaser.GameObjects.Particles.ParticleEmitter | null =
    null;
  private sparkleEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null =
    null;
  private dustParticles: Phaser.GameObjects.Particles.ParticleEmitter | null =
    null;

  // Dust graphics for mining effect
  private dustGraphics: Phaser.GameObjects.Graphics[] = [];
  private isDustVisible: boolean = false;
  private isMovementDustVisible: boolean = false;
  private movementDustGraphics: Phaser.GameObjects.Graphics[] = [];
  private lastPosition: Phaser.Math.Vector2 = new Phaser.Math.Vector2(0, 0);

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
    super(scene, x, y, "mining-drone", 100);
    this.miningStation = miningStation;

    // Set home position to the mining station
    this.homePosition = new Phaser.Math.Vector2(
      miningStation.x,
      miningStation.y
    );

    // Initialize last position with current position
    this.lastPosition = new Phaser.Math.Vector2(x, y);

    // Set the robot's depth to ensure it renders above dust particles
    this.setDepth(10);

    // Create sparkle particles for mining effects
    this.createSparkleEffect();
    this.createDustEffect();

    // Create dust graphics
    this.createDustGraphics();
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

    // Show movement dust when robot is moving
    if (
      this.robotState === RobotState.MOVING ||
      this.robotState === RobotState.RETURNING
    ) {
      // Calculate distance moved since last update
      const distance = Phaser.Math.Distance.Between(
        this.x,
        this.y,
        this.lastPosition.x,
        this.lastPosition.y
      );

      // Create dust particles based on movement speed
      if (distance > 3) {
        // Create more particles when moving faster
        const particleCount = Math.min(Math.floor(distance / 2), 3);

        for (let i = 0; i < particleCount; i++) {
          this.showMovementDust();
        }

        // Update last position
        this.lastPosition.set(this.x, this.y);
      }
    } else {
      // Hide movement dust when not moving
      this.hideMovementDust();
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

    // If in WORKING state, make sure dust particles are at the robot's position
    if (this.robotState === RobotState.WORKING) {
      // Update particle positions
      if (this.sparkleEmitter) {
        this.sparkleEmitter.setPosition(this.x, this.y);
      }

      if (this.dustParticles) {
        this.dustParticles.setPosition(this.x, this.y);
      }

      // Update dust graphics positions
      this.dustGraphics.forEach((graphics) => {
        if (graphics.active && graphics.visible) {
          // Only reposition if it's a circle (not our custom graphics)
          if (graphics.type === "Circle") {
            graphics.x = this.x;
            graphics.y = this.y;
          }
        }
      });
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
              // Don't reset pattern index after depositing at processor
              // this.currentPatternIndex = 0; // Reset pattern index
              // this.patternDirection = 1; // Reset to forward direction
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
    // Create sparkle particle emitter
    this.sparkleParticles = this.scene.add.particles(0, 0, "flare", {
      lifespan: { min: 300, max: 600 },
      speed: { min: 10, max: 30 },
      scale: { start: 0.2, end: 0 },
      alpha: { start: 0.6, end: 0 },
      quantity: 5,
      frequency: 50,
      blendMode: "ADD",
      tint: [0xffffff, 0xffd700, 0xffa500], // White, gold, orange
      emitting: false, // Start disabled
    });

    this.sparkleEmitter = this.sparkleParticles;

    // Set depth to be above the robot
    if (this.sparkleParticles) {
      this.sparkleParticles.setDepth(15);
    }
  }

  // Create dust particle effect
  private createDustEffect(): void {
    console.log("Creating dust effect");
    // Create dust particle emitter
    this.dustParticles = this.scene.add.particles(0, 0, "flare", {
      lifespan: { min: 800, max: 1500 },
      speed: { min: 5, max: 20 },
      scale: { start: 0.3, end: 0.1 }, // Larger particles
      alpha: { start: 0.8, end: 0 }, // More opaque
      quantity: 10, // More particles
      frequency: 30, // More frequent particles
      blendMode: "NORMAL",
      tint: [0xd2b48c, 0xc19a6b, 0xbdb76b], // Tan/brown colors for Mars dust
      emitting: false,
      gravityY: 10, // Slight gravity to make dust fall
      angle: { min: 0, max: 360 }, // Emit in all directions
    });
    console.log("Dust particles created:", this.dustParticles);

    // Set depth to be below the robot
    if (this.dustParticles) {
      this.dustParticles.setDepth(5);
    }
  }

  // Create custom dust graphics
  private createDustGraphics(): void {
    console.log("Creating dust graphics");

    // Create 8 dust particles
    for (let i = 0; i < 12; i++) {
      // More particles
      // Create a graphics object
      const graphics = this.scene.add.graphics();

      // Set initial position (will be updated when shown)
      graphics.x = this.x;
      graphics.y = this.y;

      // Draw a small circle
      graphics.fillStyle(0xd2b48c, 0.8); // Tan color with higher alpha
      graphics.fillCircle(0, 0, 4); // Slightly larger circle

      // Hide initially
      graphics.visible = false;

      // Set depth to be below the robot
      graphics.setDepth(5);

      // Add to array
      this.dustGraphics.push(graphics);
    }

    // Create movement dust particles
    for (let i = 0; i < 20; i++) {
      // Increased from 8 to 20
      const graphics = this.scene.add.graphics();
      graphics.x = this.x;
      graphics.y = this.y;
      graphics.fillStyle(0xd2b48c, 0.6); // Tan color with medium alpha
      graphics.fillCircle(0, 0, 3); // Smaller circle for movement dust
      graphics.visible = false;

      // Set depth to be below the robot
      graphics.setDepth(5);

      this.movementDustGraphics.push(graphics);
    }
  }

  // Show dust graphics with animation
  private showDustGraphics(): void {
    if (this.isDustVisible) return;

    this.isDustVisible = true;
    console.log("Showing dust graphics");

    // Update positions and show graphics
    this.dustGraphics.forEach((graphics) => {
      // Calculate random position around the robot
      const angle = Math.random() * Math.PI * 2;
      const distance = 8 + Math.random() * 12; // Random distance between 8-20

      // Set position
      graphics.x = this.x + Math.cos(angle) * distance;
      graphics.y = this.y + Math.sin(angle) * distance;

      // Make visible
      graphics.visible = true;
      graphics.alpha = 0.8;
      graphics.scaleX = 1;
      graphics.scaleY = 1;

      // Create animation
      this.scene.tweens.add({
        targets: graphics,
        alpha: 0,
        scaleX: 2,
        scaleY: 2,
        x: graphics.x + Math.cos(angle) * 15, // Move outward more
        y: graphics.y + Math.sin(angle) * 15 + 8, // Move outward and down more
        duration: 400 + Math.random() * 300, // Faster animation
        onComplete: () => {
          if (this.isDustVisible) {
            // Reset and start again if still mining
            this.resetAndAnimateDustGraphic(graphics);
          }
        },
      });
    });
  }

  // Reset and animate a single dust graphic
  private resetAndAnimateDustGraphic(
    graphics: Phaser.GameObjects.Graphics
  ): void {
    if (!this.isDustVisible) return;

    const newAngle = Math.random() * Math.PI * 2;
    const newDistance = 8 + Math.random() * 12;

    // Update position to current robot position
    graphics.x = this.x + Math.cos(newAngle) * newDistance;
    graphics.y = this.y + Math.sin(newAngle) * newDistance;
    graphics.alpha = 0.8;
    graphics.scaleX = 1;
    graphics.scaleY = 1;

    // Animate
    this.scene.tweens.add({
      targets: graphics,
      alpha: 0,
      scaleX: 2,
      scaleY: 2,
      x: graphics.x + Math.cos(newAngle) * 15,
      y: graphics.y + Math.sin(newAngle) * 15 + 8,
      duration: 400 + Math.random() * 300,
      onComplete: () => {
        if (this.isDustVisible) {
          this.resetAndAnimateDustGraphic(graphics);
        }
      },
    });
  }

  // Hide dust graphics
  private hideDustGraphics(): void {
    if (!this.isDustVisible) return;

    this.isDustVisible = false;
    console.log("Hiding dust graphics");

    // Stop animations and hide graphics
    this.dustGraphics.forEach((graphics) => {
      this.scene.tweens.killTweensOf(graphics);
      graphics.visible = false;
    });
  }

  // Start mining at current location
  private startMining(): void {
    console.log("Starting mining at:", this.x, this.y);
    this.robotState = RobotState.WORKING;
    this.updateStateText();
    this.miningCompleteTime = this.scene.time.now + this.miningDuration;

    // Get resource richness at current position
    const richness = this.getResourceRichnessAtCurrentPosition();
    console.log("Resource richness:", richness);

    // Add a subtle visual indicator on the robot
    this.showMiningIndicator();

    // Start sparkle effect based on richness
    if (this.sparkleEmitter) {
      console.log("Starting sparkle effect");
      // Position the emitter at the drone
      this.sparkleEmitter.setPosition(this.x, this.y);

      // Scale particle quantity based on richness (0-1)
      const particleQuantity = Math.ceil(richness * 15) + 5; // More particles
      this.sparkleEmitter.setQuantity(particleQuantity);

      // Set frequency based on richness (higher richness = more frequent particles)
      const frequency = Math.max(30, 150 - richness * 120);
      this.sparkleEmitter.setFrequency(frequency);

      // Start the emitter
      this.sparkleEmitter.start();
      console.log("Sparkle emitter started");
    }

    // Show dust graphics
    this.showDustGraphics();

    // Start dust effect
    if (this.dustParticles) {
      console.log("Starting dust effect");
      this.dustParticles.setPosition(this.x, this.y);

      // Scale dust quantity based on richness
      const dustQuantity = Math.ceil(richness * 12) + 8; // More dust particles
      this.dustParticles.setQuantity(dustQuantity);

      // Adjust frequency based on richness
      const dustFrequency = Math.max(20, 80 - richness * 60); // More frequent particles
      this.dustParticles.setFrequency(dustFrequency);

      // Start the dust emitter
      this.dustParticles.start();
      console.log(
        "Dust emitter started with quantity:",
        dustQuantity,
        "frequency:",
        dustFrequency
      );
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

    if (this.dustParticles) {
      this.dustParticles.stop();
    }

    // Hide dust graphics
    this.hideDustGraphics();

    // Hide mining indicator
    this.hideMiningIndicator();
  }

  // When the robot reaches its target
  protected onReachTarget(): void {
    // If we're in the MOVING state and following a pattern, start mining
    if (this.robotState === RobotState.MOVING && this.patternGenerated) {
      console.log("onReachTarget: Starting mining");
      this.startMining();
    } else {
      console.log(
        "onReachTarget: Not starting mining. State:",
        this.robotState,
        "patternGenerated:",
        this.patternGenerated
      );
    }
  }

  // Override hasReachedTarget to call onReachTarget
  protected hasReachedTarget(threshold: number = 5): boolean {
    const reached = super.hasReachedTarget(threshold);
    if (reached) {
      console.log("Robot has reached target");
      this.onReachTarget();
    }
    return reached;
  }

  // Show dust behind the robot when moving
  private showMovementDust(): void {
    // Get a random dust graphic from the pool
    const availableGraphics = this.movementDustGraphics.filter(
      (g) => !g.visible
    );

    if (availableGraphics.length === 0) return;

    // Get a random dust graphic
    const graphics =
      availableGraphics[Math.floor(Math.random() * availableGraphics.length)];

    // Calculate position behind the robot
    // Get direction vector from last position to current position
    const directionX = this.x - this.lastPosition.x;
    const directionY = this.y - this.lastPosition.y;

    // Normalize and invert to get position behind the robot
    const length = Math.sqrt(directionX * directionX + directionY * directionY);
    if (length > 0) {
      const normalizedX = -directionX / length;
      const normalizedY = -directionY / length;

      // Add some randomness to the position
      const offsetX = (Math.random() - 0.5) * 10;
      const offsetY = (Math.random() - 0.5) * 10;

      // Set position further behind the robot
      graphics.x = this.x + normalizedX * 20 + offsetX;
      graphics.y = this.y + normalizedY * 20 + offsetY;

      // Clear any previous graphics and redraw
      graphics.clear();
      graphics.fillStyle(0xd2b48c, 0.8); // Tan color with higher alpha
      graphics.fillCircle(0, 0, 3 + Math.random() * 2); // Slightly varied size

      // Make visible and ensure depth is below robot
      graphics.visible = true;
      graphics.alpha = 0.9;
      graphics.scaleX = 1;
      graphics.scaleY = 1;
      graphics.setDepth(5); // Ensure depth is set correctly

      // Create animation
      this.scene.tweens.add({
        targets: graphics,
        alpha: 0,
        scaleX: 2,
        scaleY: 2,
        x: graphics.x + normalizedX * 10, // Continue moving in same direction
        y: graphics.y + normalizedY * 10 + 5, // Add slight gravity effect
        duration: 400 + Math.random() * 200,
        onComplete: () => {
          graphics.visible = false;
        },
      });
    }
  }

  // Hide all movement dust particles
  private hideMovementDust(): void {
    this.movementDustGraphics.forEach((graphics) => {
      graphics.visible = false;
    });
    this.isMovementDustVisible = false;
  }

  // Clean up resources when destroyed
  public destroy(fromScene?: boolean): void {
    // Clean up all graphics and particles
    this.dustGraphics.forEach((g) => g.destroy());
    this.movementDustGraphics.forEach((g) => g.destroy());

    if (this.sparkleParticles) {
      this.sparkleParticles.destroy();
    }

    if (this.dustParticles) {
      this.dustParticles.destroy();
    }

    if (this.miningIndicatorTween) {
      this.miningIndicatorTween.stop();
    }

    if (this.warningText) {
      this.warningText.destroy();
    }

    super.destroy(fromScene);
  }
}
