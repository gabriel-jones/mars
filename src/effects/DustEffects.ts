import * as Phaser from "phaser";

export class DustEffects {
  private scene: Phaser.Scene;
  private dustParticles: Phaser.GameObjects.Sprite[] = [];
  private lastPosition: Phaser.Math.Vector2;
  private entity: Phaser.GameObjects.GameObject;
  private isActive: boolean = false;
  private dustInterval: number = 100; // Decreased from 150 to spawn more frequently
  private lastDustTime: number = 0;
  private dustSize: number = 1.0; // Scale for the 8x8 dust texture
  private dustColor: number = 0xcccccc;
  private dustAlpha: number = 0.7; // Reduced from 0.8
  private dustLifetime: number = 1000; // Increased from 800 ms
  private dustCount: number = 12; // Increased from 8

  // Working dust effect properties
  private workingDustParticles: Phaser.GameObjects.Sprite[] = [];
  private isWorkingDustVisible: boolean = false;
  private workingDustCount: number = 16; // Increased from 12
  private workingDustColor: number = 0xd2b48c;
  private workingDustAlpha: number = 0.8; // Reduced from 0.9
  private workingDustSize: number = 1.0; // Scale for the 8x8 dust texture

  // Movement dust effect properties
  private movementDustParticles: Phaser.GameObjects.Sprite[] = [];
  private isMovementDustVisible: boolean = false;
  private movementDustCount: number = 30; // Increased from 20
  private movementDustColor: number = 0xd2b48c;
  private movementDustAlpha: number = 0.75; // Reduced from 0.85
  private movementDustSize: number = 0.8; // Scale for the 8x8 dust texture

  constructor(
    scene: Phaser.Scene,
    entity: Phaser.GameObjects.GameObject,
    options: {
      dustColor?: number;
      dustSize?: number;
      dustAlpha?: number;
      dustCount?: number;
      dustLifetime?: number;
      dustInterval?: number;
      workingDustColor?: number;
      workingDustSize?: number;
      workingDustAlpha?: number;
      workingDustCount?: number;
      movementDustColor?: number;
      movementDustSize?: number;
      movementDustAlpha?: number;
      movementDustCount?: number;
    } = {}
  ) {
    this.scene = scene;
    this.entity = entity;
    this.lastPosition = new Phaser.Math.Vector2(
      (entity as any).x || 0,
      (entity as any).y || 0
    );

    // Apply custom options for regular dust
    if (options.dustColor !== undefined) this.dustColor = options.dustColor;
    if (options.dustSize !== undefined) this.dustSize = options.dustSize;
    if (options.dustAlpha !== undefined) this.dustAlpha = options.dustAlpha;
    if (options.dustCount !== undefined) this.dustCount = options.dustCount;
    if (options.dustLifetime !== undefined)
      this.dustLifetime = options.dustLifetime;
    if (options.dustInterval !== undefined)
      this.dustInterval = options.dustInterval;

    // Apply custom options for working dust
    if (options.workingDustColor !== undefined)
      this.workingDustColor = options.workingDustColor;
    if (options.workingDustSize !== undefined)
      this.workingDustSize = options.workingDustSize;
    if (options.workingDustAlpha !== undefined)
      this.workingDustAlpha = options.workingDustAlpha;
    if (options.workingDustCount !== undefined)
      this.workingDustCount = options.workingDustCount;

    // Apply custom options for movement dust
    if (options.movementDustColor !== undefined)
      this.movementDustColor = options.movementDustColor;
    if (options.movementDustSize !== undefined)
      this.movementDustSize = options.movementDustSize;
    if (options.movementDustAlpha !== undefined)
      this.movementDustAlpha = options.movementDustAlpha;
    if (options.movementDustCount !== undefined)
      this.movementDustCount = options.movementDustCount;

    // Create dust graphics pools
    this.createDustParticles();
    this.createWorkingDustParticles();
    this.createMovementDustParticles();
  }

  private createDustParticles(): void {
    // Create a pool of dust particles
    for (let i = 0; i < this.dustCount; i++) {
      const particle = this.scene.add.sprite(0, 0, "dust-particle");
      particle.setVisible(false);
      particle.setDepth(5);
      particle.setScale(this.dustSize);
      particle.setTint(this.dustColor);
      this.dustParticles.push(particle);
    }
  }

  private createWorkingDustParticles(): void {
    // Create working dust particles
    for (let i = 0; i < this.workingDustCount; i++) {
      const particle = this.scene.add.sprite(0, 0, "dust-particle");

      // Set initial position (will be updated when shown)
      particle.x = (this.entity as any).x || 0;
      particle.y = (this.entity as any).y || 0;

      // Set appearance
      particle.setScale(this.workingDustSize);
      particle.setTint(this.workingDustColor);
      particle.setAlpha(this.workingDustAlpha);

      // Hide initially
      particle.visible = false;

      // Set depth to be below the entity
      particle.setDepth(5);

      // Add to array
      this.workingDustParticles.push(particle);
    }
  }

  private createMovementDustParticles(): void {
    // Create movement dust particles
    for (let i = 0; i < this.movementDustCount; i++) {
      const particle = this.scene.add.sprite(0, 0, "dust-particle");
      particle.x = (this.entity as any).x || 0;
      particle.y = (this.entity as any).y || 0;
      particle.setScale(this.movementDustSize);
      particle.setTint(this.movementDustColor);
      particle.setAlpha(this.movementDustAlpha);
      particle.visible = false;

      // Set depth to be below the entity
      particle.setDepth(5);

      this.movementDustParticles.push(particle);
    }
  }

  public update(time: number): void {
    if (!this.isActive) return;

    const entityX = (this.entity as any).x;
    const entityY = (this.entity as any).y;

    if (!entityX || !entityY) return;

    // Check if entity has moved enough to create dust
    const distance = Phaser.Math.Distance.Between(
      this.lastPosition.x,
      this.lastPosition.y,
      entityX,
      entityY
    );

    // Only create dust if the entity is moving and enough time has passed
    if (distance > 1 && time > this.lastDustTime + this.dustInterval) {
      this.lastDustTime = time;

      // Calculate movement speed to adjust dust frequency
      const speed = distance / (time - (this.lastDustTime - this.dustInterval));

      // Show movement dust (footsteps) if entity is moving
      if (this.isMovementDustVisible) {
        // Create footsteps based on speed - faster movement = more frequent footsteps
        const footstepCount = Math.min(2, Math.ceil(distance / 5));

        for (let i = 0; i < footstepCount; i++) {
          this.showMovementDust();
        }
      }

      // Only create regular dust puffs for faster movement
      if (speed > 0.05) {
        // Create more dust puffs when moving faster
        const dustPuffsToCreate = Math.min(2, Math.ceil(distance / 4));

        for (let i = 0; i < dustPuffsToCreate; i++) {
          // Create dust at positions between last and current position
          const ratio = i / dustPuffsToCreate;
          const interpolatedX =
            this.lastPosition.x + (entityX - this.lastPosition.x) * ratio;
          const interpolatedY =
            this.lastPosition.y + (entityY - this.lastPosition.y) * ratio;

          this.createDustPuff(interpolatedX, interpolatedY);
        }
      }
    }

    // Update last position
    this.lastPosition.set(entityX, entityY);
  }

  private createDustPuff(x: number, y: number): void {
    // Get an available dust particle
    const availableParticles = this.dustParticles.filter((p) => !p.visible);
    if (availableParticles.length === 0) return;

    // Get a random dust particle
    const particle =
      availableParticles[Math.floor(Math.random() * availableParticles.length)];

    // Calculate position for the dust puff
    // For general movement dust, we want it to appear directly behind the player
    const entityX = (this.entity as any).x;
    const entityY = (this.entity as any).y;

    if (!entityX || !entityY) return;

    // Calculate direction of movement
    const dx = entityX - this.lastPosition.x;
    const dy = entityY - this.lastPosition.y;

    // Only create dust if there's actual movement
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;

    const movementAngle = Math.atan2(dy, dx);

    // Add some randomness to the position
    const dustDistance = 4 + Math.random() * 4;
    const randomAngleOffset = (Math.random() - 0.5) * 0.5; // Small angle variation

    // Position dust behind the player
    const dustX =
      x - Math.cos(movementAngle + randomAngleOffset) * dustDistance;
    const dustY =
      y - Math.sin(movementAngle + randomAngleOffset) * dustDistance;

    // Set the particle properties
    const actualSize = this.dustSize * (0.7 + Math.random() * 0.3);
    particle.setPosition(dustX, dustY);
    particle.setVisible(true);
    particle.setAlpha(this.dustAlpha);
    particle.setScale(actualSize);
    particle.setTint(this.dustColor);

    // Animate the dust to fade out and expand slightly
    this.scene.tweens.add({
      targets: particle,
      alpha: 0,
      scale: actualSize * 1.3,
      duration: 350 + Math.random() * 150,
      ease: "Sine.easeOut",
      onComplete: () => {
        particle.setVisible(false);
      },
    });
  }

  // Show working dust graphics with animation
  public showWorkingDust(): void {
    if (this.isWorkingDustVisible) return;

    this.isWorkingDustVisible = true;

    // Update positions and show graphics
    this.workingDustParticles.forEach((particle) => {
      const entityX = (this.entity as any).x;
      const entityY = (this.entity as any).y;

      if (entityX === undefined || entityY === undefined) return;

      this.resetAndAnimateWorkingDustParticle(particle);
    });
  }

  private resetAndAnimateWorkingDustParticle(
    particle: Phaser.GameObjects.Sprite
  ): void {
    const entityX = (this.entity as any).x;
    const entityY = (this.entity as any).y;

    if (entityX === undefined || entityY === undefined) return;

    // Random position around the entity
    const angle = Math.random() * Math.PI * 2;
    const distance = 10 + Math.random() * 15; // Adjusted for dust texture
    const particleX = entityX + Math.cos(angle) * distance;
    const particleY = entityY + Math.sin(angle) * distance;

    // Set initial properties
    particle.setPosition(particleX, particleY);
    particle.setScale(this.workingDustSize * (0.7 + Math.random() * 0.6));
    particle.setAlpha(this.workingDustAlpha * (0.7 + Math.random() * 0.3));
    particle.setTint(this.workingDustColor);
    particle.setVisible(true);

    // Animate rising and fading
    this.scene.tweens.add({
      targets: particle,
      y: particleY - 20 - Math.random() * 15,
      alpha: 0,
      scale: particle.scale * 0.5,
      duration: 1000 + Math.random() * 500,
      ease: "Sine.easeOut",
      onComplete: () => {
        if (this.isWorkingDustVisible) {
          this.resetAndAnimateWorkingDustParticle(particle);
        } else {
          particle.setVisible(false);
        }
      },
    });
  }

  public hideWorkingDust(): void {
    this.isWorkingDustVisible = false;

    // Fade out all working dust particles
    this.workingDustParticles.forEach((particle) => {
      if (particle.visible) {
        this.scene.tweens.add({
          targets: particle,
          alpha: 0,
          duration: 300,
          onComplete: () => {
            particle.setVisible(false);
          },
        });
      }
    });
  }

  private showMovementDust(): void {
    // Get an available movement dust particle
    const availableParticles = this.movementDustParticles.filter(
      (p) => !p.visible
    );
    if (availableParticles.length === 0) return;

    // Get a random dust particle
    const particle =
      availableParticles[Math.floor(Math.random() * availableParticles.length)];

    const entityX = (this.entity as any).x;
    const entityY = (this.entity as any).y;

    if (entityX === undefined || entityY === undefined) return;

    // Calculate direction of movement
    const dx = entityX - this.lastPosition.x;
    const dy = entityY - this.lastPosition.y;

    // Only create footsteps if there's actual movement
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;

    const movementAngle = Math.atan2(dy, dx);

    // Position dust directly behind the player based on movement direction
    // This creates a more realistic footstep effect
    const footstepDistance = 5 + Math.random() * 3; // Distance behind player

    // Calculate position behind the player in the opposite direction of movement
    const dustX = entityX - Math.cos(movementAngle) * footstepDistance;
    const dustY = entityY - Math.sin(movementAngle) * footstepDistance;

    // Add slight randomness to position to simulate left/right foot alternation
    const lateralOffset =
      (Math.random() > 0.5 ? 1 : -1) * (2 + Math.random() * 3);
    // Calculate perpendicular direction for lateral offset
    const perpAngle = movementAngle + Math.PI / 2;
    const finalX = dustX + Math.cos(perpAngle) * lateralOffset;
    const finalY = dustY + Math.sin(perpAngle) * lateralOffset;

    // Set the particle properties
    const actualSize = this.movementDustSize * (0.6 + Math.random() * 0.3); // Smaller for footsteps
    particle.setPosition(finalX, finalY);
    particle.setVisible(true);
    particle.setAlpha(this.movementDustAlpha * (0.6 + Math.random() * 0.3));
    particle.setScale(actualSize);
    particle.setTint(this.movementDustColor);

    // Animate the dust to expand slightly and fade out
    // For footsteps, we want a subtle puff that stays mostly in place
    this.scene.tweens.add({
      targets: particle,
      alpha: 0,
      scale: actualSize * 1.5, // Expand slightly
      duration: 300 + Math.random() * 150, // Faster animation for footsteps
      ease: "Sine.easeOut",
      onComplete: () => {
        particle.setVisible(false);
      },
    });
  }

  public startMovementDust(): void {
    this.isMovementDustVisible = true;
  }

  public stopMovementDust(): void {
    this.isMovementDustVisible = false;

    // Fade out all movement dust particles
    this.movementDustParticles.forEach((particle) => {
      if (particle.visible) {
        this.scene.tweens.add({
          targets: particle,
          alpha: 0,
          duration: 200,
          onComplete: () => {
            particle.setVisible(false);
          },
        });
      }
    });
  }

  public start(): void {
    this.isActive = true;
  }

  public stop(): void {
    this.isActive = false;
  }

  public destroy(): void {
    // Clean up all dust particles
    [
      ...this.dustParticles,
      ...this.workingDustParticles,
      ...this.movementDustParticles,
    ].forEach((particle) => {
      this.scene.tweens.killTweensOf(particle);
      particle.destroy();
    });

    this.dustParticles = [];
    this.workingDustParticles = [];
    this.movementDustParticles = [];
  }
}
