import Phaser from "phaser";
import { Building } from "./Building";
import {
  ResourceManager,
  RESOURCE_DEFINITIONS,
  ResourceType,
} from "../../data/resources";
import { ResourceNode } from "../resourceNode";

export class RegolithProcessor extends Building {
  private processingText: Phaser.GameObjects.Text;
  private regolithAmount: number = 0;
  private processingRate: number = 5; // Process 5 regolith at a time
  private lastProcessTime: number = 0;
  private processingInterval: number = 2500; // Process every 2.5 seconds

  // Resource nodes spawned by the processor
  private spawnedResources: Map<ResourceType, ResourceNode> = new Map();

  // Smoke particle effect
  private smokeParticles: Phaser.GameObjects.Particles.ParticleEmitter | null =
    null;
  private isProcessing: boolean = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "regolith-processor");

    // Add processing text
    this.processingText = scene.add.text(0, 40, this.getLabelText(), {
      fontSize: "12px",
      color: "#ffffff",
      // backgroundColor: "#000000",
      // padding: { x: 3, y: 2 },
    });
    this.processingText.setOrigin(0.5);
    this.add(this.processingText);

    // Initialize the last process time
    this.lastProcessTime = scene.time.now;

    // Create smoke particle effect
    this.createSmokeEffect();

    // Set the sprite's depth to ensure it renders above the smoke
    this.sprite.setDepth(10);

    // Start smoke effect if we have initial regolith
    if (this.regolithAmount > 0) {
      this.startSmokeEffect();
      // Don't process immediately - wait for the normal processing interval
    }
  }

  getLabelText(): string {
    return `Regolith: ${this.regolithAmount}`;
  }

  // Create smoke particle effect
  private createSmokeEffect(): void {
    // Create smoke particle emitter - add directly to scene, not as a child
    this.smokeParticles = this.scene.add
      .particles(this.x, this.y, "flare", {
        lifespan: { min: 2000, max: 4000 },
        speed: { min: 10, max: 30 },
        scale: { start: 0.3, end: 0.1 },
        alpha: { start: 0.7, end: 0 },
        quantity: 4,
        frequency: 70,
        blendMode: "NORMAL",
        tint: [0x777777, 0x999999, 0xaaaaaa], // Gray colors for smoke
        emitting: false,
        gravityY: -30, // Negative gravity to make smoke rise
        angle: { min: 260, max: 280 }, // Emit upward
      })
      .setDepth(100);
  }

  // Start smoke effect
  private startSmokeEffect(): void {
    if (this.smokeParticles && !this.isProcessing) {
      // Update position in case the processor moved
      this.smokeParticles.setPosition(this.x, this.y);
      this.smokeParticles.start();
      this.isProcessing = true;
    }
  }

  // Stop smoke effect
  private stopSmokeEffect(): void {
    if (this.smokeParticles && this.isProcessing) {
      this.smokeParticles.stop();
      this.isProcessing = false;
    }
  }

  protected getBuildingName(): string {
    return "Regolith Processor";
  }

  // Add regolith to the processor
  public addRegolith(amount: number): void {
    this.regolithAmount += amount;
    this.updateProcessingText();

    // Start smoke effect if we have regolith
    if (this.regolithAmount > 0) {
      this.startSmokeEffect();
    }
  }

  // Get the current regolith amount
  public getRegolithAmount(): number {
    return this.regolithAmount;
  }

  // Check if the processor can accept more regolith
  public canAcceptRegolith(): boolean {
    return true; // For now, always accept regolith
  }

  private updateProcessingText(): void {
    this.processingText.setText(this.getLabelText());
  }

  public update(): void {
    // Process regolith at regular intervals
    const currentTime = this.scene.time.now;
    const timeSinceLastProcess = currentTime - this.lastProcessTime;

    if (timeSinceLastProcess >= this.processingInterval) {
      console.log(
        `Time to process regolith! Time since last process: ${timeSinceLastProcess}ms, Interval: ${this.processingInterval}ms`
      );
      this.processRegolith();
      this.lastProcessTime = currentTime;
    }

    // Update smoke effect based on regolith amount
    if (this.regolithAmount > 0 && !this.isProcessing) {
      this.startSmokeEffect();
    } else if (this.regolithAmount <= 0 && this.isProcessing) {
      this.stopSmokeEffect();
    }

    // Update smoke position if the processor moves
    if (this.smokeParticles && this.isProcessing) {
      this.smokeParticles.setPosition(this.x, this.y);
    }
  }

  private processRegolith(): void {
    if (this.regolithAmount > 0) {
      // Calculate how much to process
      const amountToProcess = Math.min(
        this.regolithAmount,
        this.processingRate
      );

      console.log(
        `Processing ${amountToProcess} regolith out of ${this.regolithAmount} total`
      );

      // Process the regolith and extract resources based on occurrence rates
      this.extractResources(amountToProcess);

      // Reduce the regolith amount
      this.regolithAmount -= amountToProcess;
      console.log(
        `Regolith remaining after processing: ${this.regolithAmount}`
      );

      // Update the display
      this.updateProcessingText();

      // Stop smoke effect if no more regolith
      if (this.regolithAmount <= 0) {
        this.stopSmokeEffect();
      }
    } else {
      console.log("No regolith to process");
    }
  }

  // Extract resources from regolith based on occurrence rates
  private extractResources(amountProcessed: number): void {
    // Get all resources that can be extracted from regolith (have occurrence rates)
    const extractableResources = RESOURCE_DEFINITIONS.filter(
      (resource) => resource.occurrenceRate && resource.occurrenceRate > 0
    );

    // Always guarantee at least one resource when processing regolith
    let anyResourceExtracted = false;

    // Track which resources we've already processed
    const processedResources = new Set<ResourceType>();

    // Extract each resource based on its occurrence rate
    for (const resource of extractableResources) {
      if (resource.occurrenceRate) {
        // For larger amounts, use probability-based approach for all resources
        // Boost silicon yield by 50%
        let multiplier = resource.occurrenceRate;
        if (resource.type === "silicon") {
          multiplier = multiplier * 1.5; // Boost silicon yield by 50%
        }

        // Calculate base amount
        let baseAmount = amountProcessed * multiplier;

        // For resources with low occurrence rates, give them a minimum chance
        // This ensures even rare resources have a chance to spawn
        let amountToExtract = 0;

        if (baseAmount < 1) {
          // For resources that would yield less than 1 unit, use probability
          const probability = baseAmount; // Use the fractional amount as probability
          const randomValue = Math.random();

          // If random value is less than probability, extract 1 unit
          if (randomValue < probability) {
            amountToExtract = 1;
          }
        } else {
          // For resources that would yield at least 1 unit, use floor
          amountToExtract = Math.floor(baseAmount);
        }

        if (amountToExtract > 0) {
          // Add to global resource manager
          ResourceManager.addResource(resource.type, amountToExtract);

          // Spawn or update resource node
          this.spawnResourceNode(resource, amountToExtract);

          console.log(`Extracted ${amountToExtract} ${resource.name}`);

          anyResourceExtracted = true;
          processedResources.add(resource.type);
        }
      }
    }

    // If no resources were extracted, guarantee at least one silicon
    if (!anyResourceExtracted) {
      // Find silicon in the resource definitions
      const silicon = RESOURCE_DEFINITIONS.find((r) => r.type === "silicon");
      if (silicon) {
        // Add 1 silicon to the resource manager
        ResourceManager.addResource("silicon", 1);

        // Spawn a silicon node
        this.spawnResourceNode(silicon, 1);

        console.log("Guaranteed extraction: 1 Silicon");
      }
    }

    // Ensure we get at least one random resource that's not silicon or iron
    // This helps ensure variety in resource spawning
    if (processedResources.size <= 2 && amountProcessed >= 3) {
      // Get resources that haven't been processed yet and aren't silicon or iron
      const otherResources = extractableResources.filter(
        (r) =>
          !processedResources.has(r.type) &&
          r.type !== "silicon" &&
          r.type !== "iron"
      );

      if (otherResources.length > 0) {
        // Pick a random resource from the remaining ones
        const randomIndex = Math.floor(Math.random() * otherResources.length);
        const randomResource = otherResources[randomIndex];

        // Add 1 of this resource
        ResourceManager.addResource(randomResource.type, 1);

        // Spawn a resource node
        this.spawnResourceNode(randomResource, 1);

        console.log(`Bonus extraction: 1 ${randomResource.name}`);
      }
    }
  }

  // Spawn or update a ResourceNode next to the processor
  private spawnResourceNode(resource: any, amount: number): void {
    // Check if we already have this resource type
    if (this.spawnedResources.has(resource.type)) {
      // Update existing node with additional amount
      const existingNode = this.spawnedResources.get(resource.type);
      if (existingNode) {
        existingNode.addAmount(amount);
        return;
      }
    }

    // If we don't have this resource yet, create a new node
    // Calculate position (arrange in a circle around the processor)
    const angle = Math.random() * Math.PI * 2; // Random angle
    const distance = 80; // Distance from processor center
    const x = this.x + Math.cos(angle) * distance;
    const y = this.y + Math.sin(angle) * distance;

    // Create a new ResourceNode
    const resourceNode = new ResourceNode(this.scene, x, y, resource, amount);

    // Store reference to the resource node
    this.spawnedResources.set(resource.type, resourceNode);
  }

  // Clean up resources when destroyed
  public destroy(fromScene?: boolean): void {
    if (this.smokeParticles) {
      this.smokeParticles.destroy();
    }

    // Clean up spawned resources
    this.spawnedResources.forEach((resourceNode) => {
      resourceNode.destroy();
    });

    super.destroy(fromScene);
  }
}
