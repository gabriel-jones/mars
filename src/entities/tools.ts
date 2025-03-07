import Phaser from "phaser";

// Enum for tool types
export enum ToolType {
  ASSAULT_RIFLE = "assault-rifle",
  // Add more tool types here as needed
}

// Tool class to represent a tool in the inventory
export class Tool {
  public readonly type: ToolType;
  public readonly name: string;
  public readonly sprite: Phaser.GameObjects.Sprite | null = null;
  private laserLine: Phaser.GameObjects.Line | null = null;
  private laserDot: Phaser.GameObjects.Arc | null = null;
  private scene: Phaser.Scene | undefined;

  constructor(
    type: ToolType,
    name: string,
    scene?: Phaser.Scene,
    textureKey?: string
  ) {
    this.type = type;
    this.name = name;
    this.scene = scene;

    // Create sprite if scene and textureKey are provided
    if (scene && textureKey) {
      try {
        // Try to create the sprite with the provided texture key
        this.sprite = scene.add.sprite(0, 0, textureKey);
        this.sprite.setVisible(false);
        this.sprite.setDepth(20); // Higher than player

        // Initialize with default orientation (facing right)
        this.sprite.setFlipX(false);

        // Create laser pointer elements (initially invisible)
        this.laserLine = scene.add.line(0, 0, 0, 0, 0, 0, 0xff0000, 0.5);
        this.laserLine.setVisible(false);
        this.laserLine.setDepth(19); // Below the weapon

        this.laserDot = scene.add.circle(0, 0, 3, 0xff0000, 1);
        this.laserDot.setVisible(false);
        this.laserDot.setDepth(19); // Below the weapon

        console.log(
          `Created sprite for tool: ${name} with texture: ${textureKey}`
        );
      } catch (error) {
        // If that fails, try to use the rect texture
        console.error(
          `Failed to create sprite for tool: ${name} with texture: ${textureKey}`,
          error
        );
        try {
          this.sprite = scene.add.sprite(0, 0, `${textureKey}-rect`);
          this.sprite.setVisible(false);
          this.sprite.setDepth(20); // Higher than player

          // Initialize with default orientation (facing right)
          this.sprite.setFlipX(false);

          // Create laser pointer elements (initially invisible)
          this.laserLine = scene.add.line(0, 0, 0, 0, 0, 0, 0xff0000, 0.5);
          this.laserLine.setVisible(false);
          this.laserLine.setDepth(19); // Below the weapon

          this.laserDot = scene.add.circle(0, 0, 3, 0xff0000, 1);
          this.laserDot.setVisible(false);
          this.laserDot.setDepth(19); // Below the weapon

          console.log(
            `Created sprite for tool: ${name} with rect texture: ${textureKey}-rect`
          );
        } catch (rectError) {
          // If that fails, try to use the fallback texture
          console.error(
            `Failed to create sprite for tool: ${name} with rect texture: ${textureKey}-rect`,
            rectError
          );
          try {
            this.sprite = scene.add.sprite(0, 0, `${textureKey}-fallback`);
            this.sprite.setVisible(false);
            this.sprite.setDepth(20); // Higher than player

            // Initialize with default orientation (facing right)
            this.sprite.setFlipX(false);

            // Create laser pointer elements (initially invisible)
            this.laserLine = scene.add.line(0, 0, 0, 0, 0, 0, 0xff0000, 0.5);
            this.laserLine.setVisible(false);
            this.laserLine.setDepth(19); // Below the weapon

            this.laserDot = scene.add.circle(0, 0, 3, 0xff0000, 1);
            this.laserDot.setVisible(false);
            this.laserDot.setDepth(19); // Below the weapon

            console.log(
              `Created sprite for tool: ${name} with fallback texture: ${textureKey}-fallback`
            );
          } catch (fallbackError) {
            console.error(
              `Failed to create sprite for tool: ${name} with fallback texture: ${textureKey}-fallback`,
              fallbackError
            );
          }
        }
      }
    }
  }

  // Show the tool sprite at the given position
  public show(x: number, y: number): void {
    if (this.sprite) {
      this.sprite.setPosition(x, y);
      this.sprite.setVisible(true);

      // Also show the laser pointer
      if (this.laserLine) {
        this.laserLine.setVisible(true);
      }
      if (this.laserDot) {
        this.laserDot.setVisible(true);
      }

      console.log(`Showing tool: ${this.name} at position: ${x}, ${y}`);
    } else {
      console.warn(`Cannot show tool: ${this.name} - sprite is null`);
    }
  }

  // Hide the tool sprite
  public hide(): void {
    if (this.sprite) {
      this.sprite.setVisible(false);

      // Also hide the laser pointer
      if (this.laserLine) {
        this.laserLine.setVisible(false);
      }
      if (this.laserDot) {
        this.laserDot.setVisible(false);
      }

      console.log(`Hiding tool: ${this.name}`);
    } else {
      console.warn(`Cannot hide tool: ${this.name} - sprite is null`);
    }
  }

  // Update the laser pointer
  public updateLaserPointer(
    startX: number,
    startY: number,
    targetX: number,
    targetY: number
  ): void {
    if (this.laserLine && this.laserDot && this.sprite) {
      // Calculate the barrel position (slightly offset from the tool position)
      const barrelOffsetDistance = 30; // Increased from 25 to match the fire method
      const angle = this.sprite.rotation;
      const isFlipped = this.sprite.flipX;

      // Calculate the barrel position based on the sprite's rotation and flip state
      let barrelX, barrelY;

      if (isFlipped) {
        // If the sprite is flipped, we need to adjust the barrel position
        const adjustedAngle = angle + Math.PI; // Add 180 degrees
        barrelX = startX + Math.cos(adjustedAngle) * barrelOffsetDistance;
        barrelY = startY + Math.sin(adjustedAngle) * barrelOffsetDistance;
      } else {
        // Normal calculation for non-flipped sprite
        barrelX = startX + Math.cos(angle) * barrelOffsetDistance;
        barrelY = startY + Math.sin(angle) * barrelOffsetDistance;
      }

      // Update the laser line from barrel to target
      this.laserLine.setTo(barrelX, barrelY, targetX, targetY);

      // Update the laser dot position
      this.laserDot.setPosition(targetX, targetY);
    }
  }

  // Update the tool position
  public updatePosition(x: number, y: number): void {
    if (this.sprite) {
      this.sprite.setPosition(x, y);
    } else {
      console.warn(
        `Cannot update position for tool: ${this.name} - sprite is null`
      );
    }
  }

  // Set the rotation of the tool sprite
  public setRotation(rotation: number): void {
    if (this.sprite) {
      this.sprite.setRotation(rotation);
    } else {
      console.warn(
        `Cannot set rotation for tool: ${this.name} - sprite is null`
      );
    }
  }

  // Set the scale of the tool sprite
  public setScale(scale: number): void {
    if (this.sprite) {
      this.sprite.setScale(scale);
    } else {
      console.warn(`Cannot set scale for tool: ${this.name} - sprite is null`);
    }
  }

  // Set the horizontal flip of the tool sprite
  public setFlipX(flip: boolean): void {
    if (this.sprite) {
      this.sprite.setFlipX(flip);
    } else {
      console.warn(`Cannot set flipX for tool: ${this.name} - sprite is null`);
    }
  }

  // Fire the weapon
  public fire(): void {
    if (!this.sprite || !this.scene) return;

    // Get the barrel position
    const barrelOffsetDistance = 30; // Increased from 25 to move flash further from player
    const angle = this.sprite.rotation;
    const isFlipped = this.sprite.flipX;

    // Calculate the barrel position based on the sprite's rotation and flip state
    let barrelX, barrelY;

    if (isFlipped) {
      // If the sprite is flipped, we need to adjust the barrel position
      const adjustedAngle = angle + Math.PI; // Add 180 degrees
      barrelX = this.sprite.x + Math.cos(adjustedAngle) * barrelOffsetDistance;
      barrelY = this.sprite.y + Math.sin(adjustedAngle) * barrelOffsetDistance;
    } else {
      // Normal calculation for non-flipped sprite
      barrelX = this.sprite.x + Math.cos(angle) * barrelOffsetDistance;
      barrelY = this.sprite.y + Math.sin(angle) * barrelOffsetDistance;
    }

    // Get the target position (where the laser dot is)
    const targetX = this.laserDot?.x || this.scene.input.activePointer.worldX;
    const targetY = this.laserDot?.y || this.scene.input.activePointer.worldY;

    // Create muzzle flash effect first (so it's visible immediately)
    this.createMuzzleFlash(barrelX, barrelY, angle);

    // Create a bullet
    this.createBullet(barrelX, barrelY, targetX, targetY);

    // Add a screen shake effect for more impact
    if (this.scene.cameras && this.scene.cameras.main) {
      this.scene.cameras.main.shake(50, 0.005);
    }

    console.log(
      `Fired weapon: ${this.name} from position: ${barrelX}, ${barrelY} towards: ${targetX}, ${targetY}, Flipped: ${isFlipped}`
    );
  }

  // Create a bullet
  private createBullet(
    startX: number,
    startY: number,
    targetX: number,
    targetY: number
  ): void {
    if (!this.scene) return;

    console.log(
      `Creating bullet from (${startX}, ${startY}) to (${targetX}, ${targetY})`
    );

    // Calculate the angle and velocity
    const angle = Math.atan2(targetY - startY, targetX - startX);
    const speed = 800; // Bullet speed
    const velocityX = Math.cos(angle) * speed;
    const velocityY = Math.sin(angle) * speed;

    // Create a bullet as a simple rectangle for better visibility
    const bullet = this.scene.add.rectangle(
      startX,
      startY,
      8, // bulletWidth
      4, // bulletHeight
      0xffff00
    );
    bullet.setRotation(angle);
    bullet.setDepth(15);

    // Enable physics on the bullet
    this.scene.physics.add.existing(bullet);

    // Get the physics body
    const body = bullet.body as Phaser.Physics.Arcade.Body;

    if (!body) {
      console.error("Failed to create bullet physics body");
      return;
    }

    // Set bullet physics properties
    body.setVelocity(velocityX, velocityY);
    body.setCollideWorldBounds(true);
    body.onWorldBounds = true;

    // Make sure the bullet has a proper hitbox - larger than visual for better hit detection
    body.setSize(16, 16);
    body.setOffset(-4, -6); // Center the hitbox on the bullet

    // Enable debug visualization to see the physics body
    body.debugShowBody = true;
    body.debugBodyColor = 0xff0000;

    // Add a visual debug rectangle to show the bullet's hitbox
    const debugRect = this.scene.add.rectangle(
      bullet.x,
      bullet.y,
      16,
      16,
      0xff0000,
      0.3
    );
    debugRect.setDepth(20);

    // Update the debug rectangle position with the bullet
    const updateDebugRect = () => {
      if (bullet.active) {
        debugRect.setPosition(bullet.x, bullet.y);
      } else {
        debugRect.destroy();
      }
    };

    // Add an update event to keep the debug rectangle with the bullet
    const debugUpdater = this.scene.time.addEvent({
      delay: 16,
      callback: updateDebugRect,
      loop: true,
    });

    // Log that the bullet was created successfully
    console.log(
      `Bullet created successfully with velocity (${velocityX}, ${velocityY})`
    );

    // Destroy bullet when it hits world bounds
    const worldBoundsListener = (body: Phaser.Physics.Arcade.Body) => {
      if (body.gameObject === bullet) {
        console.log("Bullet hit world bounds, destroying");
        bullet.destroy();
        debugRect.destroy();
        debugUpdater.destroy();
        // Remove the listener to prevent memory leaks
        this.scene?.physics.world.off("worldbounds", worldBoundsListener);
      }
    };

    this.scene.physics.world.on("worldbounds", worldBoundsListener);

    // Destroy bullet after 1 second (if it hasn't hit anything)
    this.scene.time.delayedCall(1000, () => {
      if (bullet && bullet.active) {
        console.log("Bullet lifetime expired, destroying");
        bullet.destroy();
        debugRect.destroy();
        debugUpdater.destroy();
      }
    });

    // Get enemies from gameState instead of searching through all scene children
    const gameState = (window as any).gameState;
    const enemies = gameState.enemies || [];

    console.log(
      `Found ${enemies.length} enemies for bullet collision detection from gameState`
    );

    // Set up collision with enemies
    if (enemies.length > 0) {
      console.log("Setting up bullet collision with enemies");

      // Log enemy positions for debugging
      enemies.forEach((enemy: any, index: number) => {
        const enemySprite = enemy.getSprite();
        console.log(
          `Enemy ${index} position: (${enemySprite.x}, ${enemySprite.y}), active: ${enemySprite.active}`
        );
      });

      // Use overlap instead of collider for more control
      const processOverlap = (): boolean => {
        // Check for overlap with each enemy
        for (const enemy of enemies) {
          const enemySprite = enemy.getSprite();

          // Skip if enemy or bullet is not active
          if (!enemySprite.active || !bullet.active) continue;

          // Check for overlap between bullet and enemy sprite
          const bulletBounds = bullet.getBounds();
          const enemyBounds = enemySprite.getBounds();

          if (Phaser.Geom.Rectangle.Overlaps(bulletBounds, enemyBounds)) {
            console.log(
              `Bullet hit enemy at position: (${enemySprite.x}, ${enemySprite.y})`
            );

            // Destroy the bullet
            bullet.destroy();
            debugRect.destroy();
            debugUpdater.destroy();

            // Damage the enemy
            if (typeof enemy.damage === "function") {
              enemy.damage(10);
              this.createBloodEffect(enemySprite);
              console.log(`Successfully damaged enemy`);
            } else {
              console.error("Damage method not found on enemy");
            }

            // We found and processed an overlap
            return true;
          }
        }

        // No overlap found
        return false;
      };

      // Check for overlap every frame until bullet is destroyed
      const overlapChecker = this.scene.time.addEvent({
        delay: 16, // Check approximately every frame (60fps)
        callback: () => {
          if (!bullet.active) {
            overlapChecker.destroy();
            return;
          }

          if (processOverlap()) {
            overlapChecker.destroy();
          }
        },
        loop: true,
      });

      console.log("Bullet-enemy overlap checker created successfully");
    }
  }

  // Create muzzle flash effect
  private createMuzzleFlash(x: number, y: number, angle: number): void {
    if (!this.scene) return;

    console.log(`Creating muzzle flash at (${x}, ${y}) with angle ${angle}`);

    // Create a more appropriately sized orange circle for the muzzle flash
    const flash = this.scene.add.circle(x, y, 6, 0xffaa00, 1);
    flash.setDepth(16);

    // Add a simple animation to make it fade out
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 1.5,
      duration: 120,
      onComplete: () => {
        flash.destroy();
      },
    });

    // Create a few particles
    for (let i = 0; i < 6; i++) {
      const particleAngle = angle + (Math.random() - 0.5) * 0.6; // Random angle within a cone
      const particleSpeed = 50 + Math.random() * 50; // Random speed

      // Start particles exactly at the muzzle position
      const particleX = x;
      const particleY = y;

      const particle = this.scene.add.circle(
        particleX,
        particleY,
        2,
        0xffaa00,
        0.9
      );
      particle.setDepth(15);

      // Move the particle outward
      this.scene.tweens.add({
        targets: particle,
        x: particleX + Math.cos(particleAngle) * particleSpeed,
        y: particleY + Math.sin(particleAngle) * particleSpeed,
        alpha: 0,
        scale: 0.5,
        duration: 120,
        onComplete: () => {
          particle.destroy();
        },
      });
    }

    // Add a bright flash at the barrel (smaller)
    const brightFlash = this.scene.add.circle(x, y, 8, 0xffffff, 0.7);
    brightFlash.setDepth(17);

    // Make the bright flash disappear quickly
    this.scene.tweens.add({
      targets: brightFlash,
      alpha: 0,
      scale: 1.2,
      duration: 60,
      onComplete: () => {
        brightFlash.destroy();
      },
    });
  }

  // Create blood effect when an enemy is hit
  private createBloodEffect(enemy: Phaser.Physics.Arcade.Sprite): void {
    if (!this.scene) return;

    // Determine if the enemy is a UFO (for green blood) or other enemy (red blood)
    const isUFO = (enemy as any).enemyType === "ufo";
    const bloodColor = isUFO ? 0x00ff00 : 0xff0000;

    // Create a particle emitter for the blood
    const particles = this.scene.add.particles(0, 0, "flare", {
      x: enemy.x,
      y: enemy.y,
      speed: { min: 50, max: 150 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.2, end: 0 },
      lifespan: 300,
      tint: bloodColor,
      blendMode: "ADD",
      frequency: -1, // Emit all particles at once
      quantity: 15,
    });

    // Emit particles once
    particles.explode();

    // Destroy the emitter after a short delay
    this.scene.time.delayedCall(500, () => {
      particles.destroy();
    });
  }

  // Clean up resources
  public destroy(): void {
    if (this.sprite) {
      this.sprite.destroy();
    }
    if (this.laserLine) {
      this.laserLine.destroy();
    }
    if (this.laserDot) {
      this.laserDot.destroy();
    }
  }
}

// Tool inventory class to manage the player's tools
export class ToolInventory {
  private tools: (Tool | null)[] = [null, null, null]; // 3 slots for tools
  private selectedIndex: number = -1; // -1 means no tool selected
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    // Initialize with assault rifle in the first slot
    this.tools[0] = new Tool(
      ToolType.ASSAULT_RIFLE,
      "Assault Rifle",
      scene,
      ToolType.ASSAULT_RIFLE
    );

    // Set initial scale for the assault rifle
    if (this.tools[0] && this.tools[0].sprite) {
      this.tools[0].setScale(0.5);
    }
  }

  // Get the currently selected tool
  public getSelectedTool(): Tool | null {
    if (this.selectedIndex === -1) {
      return null;
    }
    return this.tools[this.selectedIndex];
  }

  // Select a tool by index (0-2)
  public selectTool(index: number): void {
    // Validate index
    if (index < 0 || index >= this.tools.length) {
      console.error(`Invalid tool index: ${index}`);
      return;
    }

    // Deselect current tool if any
    if (this.selectedIndex !== -1) {
      const currentTool = this.tools[this.selectedIndex];
      if (currentTool) {
        currentTool.hide();
      }
    }

    // Select new tool
    this.selectedIndex = index;
    const selectedTool = this.tools[this.selectedIndex];

    // Update cursor based on selected tool
    if (this.scene && selectedTool) {
      if (selectedTool.type === "assault-rifle") {
        this.scene.input.setDefaultCursor("crosshair");
      } else {
        this.scene.input.setDefaultCursor("default");
      }
    }

    console.log(
      `Selected tool at index ${index}:`,
      selectedTool?.name || "none"
    );
  }

  // Deselect the current tool
  public deselectTool(): void {
    // Deselect current tool if any
    if (this.selectedIndex !== -1) {
      const currentTool = this.tools[this.selectedIndex];
      if (currentTool) {
        currentTool.hide();
      }
      this.selectedIndex = -1;

      // Reset cursor to default
      if (this.scene) {
        this.scene.input.setDefaultCursor("default");
      }
    }
  }

  // Update the position of the selected tool
  public updateSelectedToolPosition(x: number, y: number): void {
    if (this.selectedIndex !== -1 && this.tools[this.selectedIndex]) {
      this.tools[this.selectedIndex]!.updatePosition(x, y);
    }
  }

  // Get all tools
  public getAllTools(): (Tool | null)[] {
    return this.tools;
  }

  // Clean up resources
  public destroy(): void {
    for (const tool of this.tools) {
      if (tool) {
        tool.destroy();
      }
    }
  }
}
