import * as Phaser from "phaser";

export class DustEffects {
  private scene: Phaser.Scene;
  private dustGraphics: Phaser.GameObjects.Graphics[] = [];
  private lastPosition: Phaser.Math.Vector2;
  private entity: Phaser.GameObjects.GameObject;
  private isActive: boolean = false;
  private dustInterval: number = 100; // Decreased from 150 to spawn more frequently
  private lastDustTime: number = 0;
  private dustSize: number = 5; // Reduced from 7
  private dustColor: number = 0xcccccc;
  private dustAlpha: number = 0.7; // Reduced from 0.8
  private dustLifetime: number = 1000; // Increased from 800 ms
  private dustCount: number = 12; // Increased from 8

  // Working dust effect properties
  private workingDustGraphics: Phaser.GameObjects.Graphics[] = [];
  private isWorkingDustVisible: boolean = false;
  private workingDustCount: number = 16; // Increased from 12
  private workingDustColor: number = 0xd2b48c;
  private workingDustAlpha: number = 0.8; // Reduced from 0.9
  private workingDustSize: number = 5; // Reduced from 6

  // Movement dust effect properties
  private movementDustGraphics: Phaser.GameObjects.Graphics[] = [];
  private isMovementDustVisible: boolean = false;
  private movementDustCount: number = 30; // Increased from 20
  private movementDustColor: number = 0xd2b48c;
  private movementDustAlpha: number = 0.75; // Reduced from 0.85
  private movementDustSize: number = 4; // Reduced from 6

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
    this.createDustGraphics();
    this.createWorkingDustGraphics();
    this.createMovementDustGraphics();
  }

  private createDustGraphics(): void {
    // Create a pool of dust graphics
    for (let i = 0; i < this.dustCount; i++) {
      const graphics = this.scene.add.graphics();
      graphics.setVisible(false);
      graphics.setDepth(5);
      this.dustGraphics.push(graphics);
    }
  }

  private createWorkingDustGraphics(): void {
    // Create working dust particles
    for (let i = 0; i < this.workingDustCount; i++) {
      const graphics = this.scene.add.graphics();

      // Set initial position (will be updated when shown)
      graphics.x = (this.entity as any).x || 0;
      graphics.y = (this.entity as any).y || 0;

      // Draw a small circle
      graphics.fillStyle(this.workingDustColor, this.workingDustAlpha);
      graphics.fillCircle(0, 0, this.workingDustSize);

      // Hide initially
      graphics.visible = false;

      // Set depth to be below the entity
      graphics.setDepth(5);

      // Add to array
      this.workingDustGraphics.push(graphics);
    }
  }

  private createMovementDustGraphics(): void {
    // Create movement dust particles
    for (let i = 0; i < this.movementDustCount; i++) {
      const graphics = this.scene.add.graphics();
      graphics.x = (this.entity as any).x || 0;
      graphics.y = (this.entity as any).y || 0;
      graphics.fillStyle(this.movementDustColor, this.movementDustAlpha);
      graphics.fillCircle(0, 0, this.movementDustSize);
      graphics.visible = false;

      // Set depth to be below the entity
      graphics.setDepth(5);

      this.movementDustGraphics.push(graphics);
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
      // Create more dust puffs when moving faster
      const dustPuffsToCreate = Math.min(3, Math.ceil(distance / 3));

      for (let i = 0; i < dustPuffsToCreate; i++) {
        // Create dust at positions between last and current position
        const ratio = i / dustPuffsToCreate;
        const interpolatedX =
          this.lastPosition.x + (entityX - this.lastPosition.x) * ratio;
        const interpolatedY =
          this.lastPosition.y + (entityY - this.lastPosition.y) * ratio;

        this.createDustPuff(interpolatedX, interpolatedY);
      }

      this.lastDustTime = time;

      // Show movement dust if entity is moving
      if (distance > 2 && this.isMovementDustVisible) {
        // Create multiple movement dust particles for faster movement
        const movementDustCount = Math.min(3, Math.ceil(distance / 4));
        for (let i = 0; i < movementDustCount; i++) {
          this.showMovementDust();
        }
      }
    }

    // Update last position
    this.lastPosition.set(entityX, entityY);
  }

  private createDustPuff(x: number, y: number): void {
    // Get an available dust graphic
    const availableGraphics = this.dustGraphics.filter((g) => !g.visible);
    if (availableGraphics.length === 0) return;

    // Get a random dust graphic
    const graphics =
      availableGraphics[Math.floor(Math.random() * availableGraphics.length)];

    // Position slightly behind the entity with some randomness
    const angle = Math.random() * Math.PI * 2;
    const distance = this.dustSize + Math.random() * this.dustSize; // Reduced from 1.5
    const dustX = x - Math.cos(angle) * distance;
    const dustY = y - Math.sin(angle) * distance;

    // Reset and draw the dust with a larger size
    graphics.clear();
    graphics.fillStyle(this.dustColor, this.dustAlpha);

    // Draw a larger circle with a slight glow effect
    const actualSize = this.dustSize + Math.random() * 2; // Reduced from 3
    graphics.fillCircle(0, 0, actualSize);

    // Add a subtle glow effect
    graphics.fillStyle(this.dustColor, this.dustAlpha * 0.3); // Reduced from 0.4
    graphics.fillCircle(0, 0, actualSize * 1.3); // Reduced from 1.5

    graphics.setPosition(dustX, dustY);
    graphics.setVisible(true);
    graphics.setAlpha(this.dustAlpha);
    graphics.setScale(1.1); // Reduced from 1.2

    // Animate the dust with a longer duration and more dramatic scaling
    this.scene.tweens.add({
      targets: graphics,
      alpha: 0,
      scale: 0.4, // Increased from 0.3
      duration: this.dustLifetime,
      ease: "Sine.easeOut",
      onComplete: () => {
        graphics.setVisible(false);
      },
    });
  }

  // Show working dust graphics with animation
  public showWorkingDust(): void {
    if (this.isWorkingDustVisible) return;

    this.isWorkingDustVisible = true;

    // Update positions and show graphics
    this.workingDustGraphics.forEach((graphics) => {
      const entityX = (this.entity as any).x;
      const entityY = (this.entity as any).y;

      if (!entityX || !entityY) return;

      // Calculate random position around the entity
      const angle = Math.random() * Math.PI * 2;
      const distance = 8 + Math.random() * 12; // Random distance between 8-20

      // Set position
      graphics.x = entityX + Math.cos(angle) * distance;
      graphics.y = entityY + Math.sin(angle) * distance;

      // Make visible
      graphics.visible = true;
      graphics.alpha = this.workingDustAlpha;
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
          if (this.isWorkingDustVisible) {
            // Reset and start again if still working
            this.resetAndAnimateWorkingDustGraphic(graphics);
          }
        },
      });
    });
  }

  // Reset and animate a single working dust graphic
  private resetAndAnimateWorkingDustGraphic(
    graphics: Phaser.GameObjects.Graphics
  ): void {
    if (!this.isWorkingDustVisible) return;

    const entityX = (this.entity as any).x;
    const entityY = (this.entity as any).y;

    if (!entityX || !entityY) return;

    const newAngle = Math.random() * Math.PI * 2;
    const newDistance = 8 + Math.random() * 12;

    // Update position to current entity position
    graphics.x = entityX + Math.cos(newAngle) * newDistance;
    graphics.y = entityY + Math.sin(newAngle) * newDistance;
    graphics.alpha = this.workingDustAlpha;
    graphics.scaleX = 1;
    graphics.scaleY = 1;

    // Clear and redraw with current settings
    graphics.clear();
    graphics.fillStyle(this.workingDustColor, this.workingDustAlpha);
    graphics.fillCircle(0, 0, this.workingDustSize);

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
        if (this.isWorkingDustVisible) {
          this.resetAndAnimateWorkingDustGraphic(graphics);
        }
      },
    });
  }

  // Hide working dust graphics
  public hideWorkingDust(): void {
    if (!this.isWorkingDustVisible) return;

    this.isWorkingDustVisible = false;

    // Stop animations and hide graphics
    this.workingDustGraphics.forEach((graphics) => {
      this.scene.tweens.killTweensOf(graphics);
      graphics.visible = false;
    });
  }

  // Show movement dust behind the entity when moving
  private showMovementDust(): void {
    // Get a random dust graphic from the pool
    const availableGraphics = this.movementDustGraphics.filter(
      (g) => !g.visible
    );

    if (availableGraphics.length === 0) return;

    // Get a random dust graphic
    const graphics =
      availableGraphics[Math.floor(Math.random() * availableGraphics.length)];

    const entityX = (this.entity as any).x;
    const entityY = (this.entity as any).y;

    if (!entityX || !entityY) return;

    // Calculate position behind the entity
    // Get direction vector from last position to current position
    const directionX = entityX - this.lastPosition.x;
    const directionY = entityY - this.lastPosition.y;

    // Normalize and invert to get position behind the entity
    const length = Math.sqrt(directionX * directionX + directionY * directionY);
    if (length > 0) {
      const normalizedX = -directionX / length;
      const normalizedY = -directionY / length;

      // Add more randomness to the position for a wider dust trail
      const offsetX = (Math.random() - 0.5) * 18; // Reduced from 25
      const offsetY = (Math.random() - 0.5) * 18; // Reduced from 25

      // Set position further behind the entity
      graphics.x = entityX + normalizedX * 20 + offsetX; // Reduced from 30
      graphics.y = entityY + normalizedY * 20 + offsetY; // Reduced from 30

      // Clear any previous graphics and redraw
      graphics.clear();

      // Create a more visible dust cloud with layered circles
      const baseSize = this.movementDustSize + Math.random() * 3; // Reduced from 5

      // Draw main dust particle
      graphics.fillStyle(this.movementDustColor, this.movementDustAlpha);
      graphics.fillCircle(0, 0, baseSize);

      // Add a subtle glow/halo effect
      graphics.fillStyle(this.movementDustColor, this.movementDustAlpha * 0.5);
      graphics.fillCircle(0, 0, baseSize * 1.3); // Reduced from 1.5

      // Add a very faint outer glow
      graphics.fillStyle(this.movementDustColor, this.movementDustAlpha * 0.2);
      graphics.fillCircle(0, 0, baseSize * 1.8); // Reduced from 2.2

      // Make visible and ensure depth is below entity
      graphics.visible = true;
      graphics.alpha = this.movementDustAlpha + 0.1; // Reduced from 0.15
      graphics.scaleX = 1.2; // Reduced from 1.5
      graphics.scaleY = 1.2; // Reduced from 1.5
      graphics.setDepth(5); // Ensure depth is set correctly

      // Create animation with longer duration and more dramatic effects
      this.scene.tweens.add({
        targets: graphics,
        alpha: 0,
        scaleX: 2.0, // Reduced from 3.0
        scaleY: 2.0, // Reduced from 3.0
        x: graphics.x + normalizedX * 15, // Reduced from 20
        y: graphics.y + normalizedY * 15 + 8, // Reduced from 20+10
        duration: 700 + Math.random() * 300, // Reduced from 800+400
        onComplete: () => {
          graphics.visible = false;
        },
      });
    }
  }

  // Enable movement dust
  public startMovementDust(): void {
    this.isMovementDustVisible = true;
  }

  // Disable movement dust
  public stopMovementDust(): void {
    this.isMovementDustVisible = false;
    // Don't hide existing dust particles - let them fade out naturally
    // Removed call to hideMovementDust()
  }

  // Hide all movement dust particles - only used when destroying the effect
  //   private hideMovementDust(): void {
  //     this.movementDustGraphics.forEach((graphics) => {
  //       this.scene.tweens.killTweensOf(graphics);
  //       graphics.visible = false;
  //     });
  //   }

  public start(): void {
    this.isActive = true;
  }

  public stop(): void {
    this.isActive = false;
  }

  public destroy(): void {
    // Clean up all dust graphics
    this.dustGraphics.forEach((g) => g.destroy());
    this.workingDustGraphics.forEach((g) => g.destroy());
    this.movementDustGraphics.forEach((g) => g.destroy());

    this.dustGraphics = [];
    this.workingDustGraphics = [];
    this.movementDustGraphics = [];
  }
}
