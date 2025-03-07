import Phaser from "phaser";

// Enum for tool types
export enum ToolType {
  ASSAULT_RIFLE = "assault-rifle",
  RAYGUN = "raygun",
  // Add more tool types here as needed
}

// Weapon characteristics
interface WeaponCharacteristics {
  burstCount: number;
  burstDelay: number;
  burstCooldown: number;
  damage: number;
  imprecision: number;
}

// Define characteristics for each weapon type
const WEAPON_CHARACTERISTICS: Record<ToolType, WeaponCharacteristics> = {
  [ToolType.ASSAULT_RIFLE]: {
    burstCount: 3,
    burstDelay: 100,
    burstCooldown: 800,
    damage: 10,
    imprecision: 20,
  },
  [ToolType.RAYGUN]: {
    burstCount: 3,
    burstDelay: 200,
    burstCooldown: 3000,
    damage: 15,
    imprecision: 50,
  },
};

// Tool class to represent a tool in the inventory
export class Tool {
  public readonly type: ToolType;
  public readonly name: string;
  public readonly sprite: Phaser.GameObjects.Sprite | null = null;
  private laserLine: Phaser.GameObjects.Line | null = null;
  private laserDot: Phaser.GameObjects.Arc | null = null;
  private scene: Phaser.Scene | undefined;

  // Burst fire properties
  private burstCount: number = 0;
  private maxBurstCount: number = 3;
  private burstDelay: number = 100; // ms between shots in a burst
  private burstCooldown: number = 500; // ms between bursts
  private lastBurstTime: number = 0;
  private lastFireTime: number = 0;
  private characteristics: WeaponCharacteristics;

  constructor(
    type: ToolType,
    name: string,
    scene?: Phaser.Scene,
    textureKey?: string
  ) {
    this.type = type;
    this.name = name;
    this.scene = scene;

    // Set weapon characteristics based on type
    this.characteristics = WEAPON_CHARACTERISTICS[type];
    this.maxBurstCount = this.characteristics.burstCount;
    this.burstDelay = this.characteristics.burstDelay;
    this.burstCooldown = this.characteristics.burstCooldown;

    // Initialize with a random burst time
    if (scene) {
      this.lastBurstTime = scene.time.now - Math.random() * this.burstCooldown;
    }

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
  public show(x: number, y: number, isPlayer: boolean = false): void {
    if (this.sprite) {
      this.sprite.setPosition(x, y);
      this.sprite.setVisible(true);

      // Set a consistent scale for all entities
      this.sprite.setScale(0.5);

      // Only show the laser pointer for the player
      if (this.laserLine && isPlayer) {
        this.laserLine.setVisible(true);
      } else if (this.laserLine) {
        this.laserLine.setVisible(false);
      }

      if (this.laserDot && isPlayer) {
        this.laserDot.setVisible(true);
      } else if (this.laserDot) {
        this.laserDot.setVisible(false);
      }
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
    } else {
      console.warn(`Cannot hide tool: ${this.name} - sprite is null`);
    }
  }

  // Update the laser pointer
  public updateLaserPointer(
    startX: number,
    startY: number,
    targetX: number,
    targetY: number,
    isPlayer: boolean = false
  ): void {
    // Create laser pointer components if they don't exist
    if (!this.laserLine || !this.laserDot) {
      // Only create visible laser pointers for the player
      const alpha = isPlayer ? 0.3 : 0.0; // Invisible for non-players, but still functional

      if (!this.laserLine && this.scene) {
        this.laserLine = this.scene.add.line(0, 0, 0, 0, 0, 0, 0xff0000, alpha);
        this.laserLine.setDepth(10);
      }

      if (!this.laserDot && this.scene) {
        this.laserDot = this.scene.add.circle(0, 0, 3, 0xff0000, alpha);
        this.laserDot.setDepth(10);
      }
    }

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
      // If the sprite is flipped (facing left), adjust the rotation by 180 degrees
      const isFlipped = this.sprite.flipX;
      if (isFlipped) {
        // When facing left, we need to rotate 180 degrees
        this.sprite.setRotation(rotation + Math.PI);
      } else {
        this.sprite.setRotation(rotation);
      }
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

  // Check if the weapon can fire (based on burst logic)
  public canFire(currentTime: number): boolean {
    // Check if we're in the middle of a burst
    if (
      this.burstCount > 0 &&
      currentTime - this.lastFireTime >= this.burstDelay
    ) {
      return true;
    }
    // Check if we can start a new burst
    else if (
      this.burstCount === 0 &&
      currentTime - this.lastBurstTime >= this.burstCooldown
    ) {
      return true;
    }

    return false;
  }

  // Update burst state after firing
  public updateBurstState(currentTime: number): void {
    if (this.burstCount > 0) {
      // Continue current burst
      this.burstCount--;
      this.lastFireTime = currentTime;
    } else {
      // Start new burst
      this.burstCount = this.maxBurstCount - 1; // Subtract 1 because we're firing one shot now
      this.lastBurstTime = currentTime;
      this.lastFireTime = currentTime;
    }
  }

  // Get the damage value for this weapon
  public getDamage(): number {
    return this.characteristics.damage;
  }

  // Get the imprecision factor for this weapon
  public getImprecision(): number {
    return this.characteristics.imprecision;
  }

  // Fire the weapon
  public fire(isPlayer: boolean = false): void {
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
    let targetX, targetY;

    if (this.laserDot) {
      // Use the laser dot position if available
      targetX = this.laserDot.x;
      targetY = this.laserDot.y;
    } else if (isPlayer) {
      // Only use the player's cursor for player-controlled weapons
      targetX = this.scene.input.activePointer.worldX;
      targetY = this.scene.input.activePointer.worldY;
    } else {
      // For non-player entities without a laser dot, calculate target based on angle
      // This ensures robots and enemies shoot in the direction they're facing
      const targetDistance = 1000; // Far enough to be off-screen
      targetX = barrelX + Math.cos(angle) * targetDistance;
      targetY = barrelY + Math.sin(angle) * targetDistance;
    }

    // Create muzzle flash effect first (so it's visible immediately)
    this.createMuzzleFlash(barrelX, barrelY, angle);

    // Create a bullet
    this.createBullet(barrelX, barrelY, targetX, targetY);

    // Add a screen shake effect for more impact, but only for player
    if (isPlayer && this.scene.cameras && this.scene.cameras.main) {
      this.scene.cameras.main.shake(50, 0.005);
    }
  }

  // Create a bullet
  private createBullet(
    startX: number,
    startY: number,
    targetX: number,
    targetY: number
  ): void {
    if (!this.scene) return;

    // Calculate the angle and velocity
    const angle = Math.atan2(targetY - startY, targetX - startX);
    const speed = 800; // Bullet speed
    const velocityX = Math.cos(angle) * speed;
    const velocityY = Math.sin(angle) * speed;

    // Create a bullet based on the tool type
    let bullet: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Arc;
    let bulletColor: number;
    let bulletDamage: number = this.getDamage(); // Use the weapon's damage value

    if (this.type === ToolType.RAYGUN) {
      // Raygun creates a glowing energy ball
      bullet = this.scene.add.circle(
        startX,
        startY,
        6, // radius
        0x00ffff, // cyan color
        1
      );
      bulletColor = 0x00ffff;

      // Add a glow effect
      const glow = this.scene.add.circle(
        startX,
        startY,
        12, // larger radius for glow
        0x00ffff,
        0.3
      );
      glow.setDepth(14); // Below the bullet

      // Make the glow follow the bullet
      const updateGlow = () => {
        if (bullet.active) {
          glow.setPosition(bullet.x, bullet.y);
        } else {
          glow.destroy();
        }
      };

      // Add an update event for the glow
      const glowUpdater = this.scene.time.addEvent({
        delay: 16,
        callback: updateGlow,
        loop: true,
      });

      // Clean up the glow when the bullet is destroyed
      const originalDestroy = bullet.destroy;
      bullet.destroy = function () {
        glow.destroy();
        glowUpdater.destroy();
        // Call the original destroy method with the correct context
        return originalDestroy.call(this);
      };
    } else {
      // Default assault rifle bullet
      bullet = this.scene.add.rectangle(
        startX,
        startY,
        8, // bulletWidth
        4, // bulletHeight
        0xffff00
      );
      bulletColor = 0xffff00;
      bullet.setRotation(angle);
    }

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
    body.debugBodyColor = bulletColor;

    // Add a visual debug rectangle to show the bullet's hitbox
    const debugRect = this.scene.add.rectangle(
      bullet.x,
      bullet.y,
      16,
      16,
      bulletColor,
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

    // Destroy bullet when it hits world bounds
    const worldBoundsListener = (body: Phaser.Physics.Arcade.Body) => {
      if (body.gameObject === bullet) {
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
        bullet.destroy();
        debugRect.destroy();
        debugUpdater.destroy();
      }
    });

    // Get enemies from gameState instead of searching through all scene children
    const gameState = (window as any).gameState;
    const enemies = gameState.enemies || [];
    const player = gameState.player;
    const robots = gameState.robots || [];

    // Set up collision with enemies, player, and robots
    const processOverlap = (): boolean => {
      // Check if this is an enemy's bullet
      const isEnemyBullet = this.name.toLowerCase().includes("raygun");

      if (isEnemyBullet) {
        // Enemy bullets can hit the player and robots

        // Check for player collision
        if (player && player.active && bullet.active) {
          const bulletBounds = bullet.getBounds();
          const playerBounds = player.getBounds();

          if (Phaser.Geom.Rectangle.Overlaps(bulletBounds, playerBounds)) {
            // Destroy the bullet
            bullet.destroy();
            debugRect.destroy();
            debugUpdater.destroy();

            // Damage the player
            const playerInstance = (window as any).gameState.playerInstance;
            if (playerInstance && typeof playerInstance.damage === "function") {
              playerInstance.damage(bulletDamage);
            } else {
              console.error("Damage method not found on player");
            }

            return true;
          }
        }

        // Check for robot collisions
        for (const robot of robots) {
          if (
            !robot ||
            !robot.getSprite ||
            typeof robot.getSprite !== "function"
          ) {
            continue;
          }

          const robotSprite = robot.getSprite();
          if (!robotSprite || !robotSprite.active || !bullet.active) {
            continue;
          }

          // Get the position of the robot sprite
          let robotX, robotY;
          let robotBounds;

          if (robotSprite instanceof Phaser.GameObjects.Container) {
            robotX = robotSprite.x;
            robotY = robotSprite.y;
            // Create a bounds object for the container
            robotBounds = new Phaser.Geom.Rectangle(
              robotX - 32, // Half the typical size
              robotY - 32,
              64, // Typical size
              64
            );
          } else {
            robotX = robotSprite.x;
            robotY = robotSprite.y;
            robotBounds = robotSprite.getBounds();
          }

          const bulletBounds = bullet.getBounds();

          if (Phaser.Geom.Rectangle.Overlaps(bulletBounds, robotBounds)) {
            // Destroy the bullet
            bullet.destroy();
            debugRect.destroy();
            debugUpdater.destroy();

            // Try multiple ways to damage the robot
            let damageApplied = false;

            // Method 1: Try direct damage method on robot
            if (typeof robot.damage === "function") {
              robot.damage(bulletDamage);

              damageApplied = true;
            }
            // Method 2: Try damage via robotInstance
            else if (
              robotSprite.robotInstance &&
              typeof robotSprite.robotInstance.damage === "function"
            ) {
              robotSprite.robotInstance.damage(bulletDamage);

              damageApplied = true;
            }
            // Method 3: Try to access the robot instance from gameState
            else {
              // Find the matching robot in gameState
              const gameStateRobots = (window as any).gameState.robots || [];
              for (const stateRobot of gameStateRobots) {
                if (
                  stateRobot &&
                  stateRobot.getSprite &&
                  stateRobot.getSprite() === robotSprite
                ) {
                  if (typeof stateRobot.damage === "function") {
                    stateRobot.damage(bulletDamage);

                    damageApplied = true;
                    break;
                  }
                }
              }
            }

            if (damageApplied) {
              // Create blood effect
              this.createBloodEffect(robotSprite);
            } else {
              console.error(
                "Failed to damage robot - no valid damage method found"
              );
            }

            return true;
          }
        }
      } else {
        // Player bullets can hit enemies

        // Check for enemy collisions
        for (const enemy of enemies) {
          const enemySprite = enemy.getSprite();

          // Skip if enemy or bullet is not active
          if (!enemySprite.active || !bullet.active) continue;

          // Check for overlap between bullet and enemy sprite
          const bulletBounds = bullet.getBounds();
          const enemyBounds = enemySprite.getBounds();

          if (Phaser.Geom.Rectangle.Overlaps(bulletBounds, enemyBounds)) {
            // Destroy the bullet
            bullet.destroy();
            debugRect.destroy();
            debugUpdater.destroy();

            // Damage the enemy
            if (typeof enemy.damage === "function") {
              enemy.damage(bulletDamage);
              this.createBloodEffect(enemySprite);
            } else {
              console.error("Damage method not found on enemy");
            }

            return true;
          }
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

        processOverlap();
      },
      loop: true,
    });
  }

  // Create muzzle flash effect
  private createMuzzleFlash(x: number, y: number, angle: number): void {
    if (!this.scene) return;

    // Different muzzle flash based on weapon type
    let flashColor = 0xffff00; // Default yellow
    let flashScale = 0.2;

    if (this.type === ToolType.RAYGUN) {
      flashColor = 0x00ffff; // Cyan for raygun
      flashScale = 0.3; // Larger flash
    }

    // Create a sprite for the muzzle flash
    const muzzleFlash = this.scene.add.sprite(x, y, "flare");
    muzzleFlash.setTint(flashColor);
    muzzleFlash.setScale(flashScale);
    muzzleFlash.setRotation(angle);
    muzzleFlash.setDepth(25); // Above everything

    // Animate the muzzle flash
    this.scene.tweens.add({
      targets: muzzleFlash,
      alpha: 0,
      scale: flashScale * 1.5,
      duration: 50,
      onComplete: () => {
        muzzleFlash.destroy();
      },
    });
  }

  // Create blood effect when an entity is hit
  private createBloodEffect(
    entity: Phaser.Physics.Arcade.Sprite | Phaser.GameObjects.Container
  ): void {
    if (!this.scene) return;

    // Determine the entity type and set appropriate blood color
    let bloodColor = 0xff0000; // Default red blood

    // Check if it's an enemy
    const isUFO = (entity as any).enemyType === "ufo";
    if (isUFO) {
      bloodColor = 0x00ff00; // Green for UFOs
    }

    // Check if it's a robot
    const isRobot = (entity as any).robotType || (entity as any).robotInstance;
    if (isRobot) {
      bloodColor = 0x888888; // Gray/metallic for robots
    }

    // Get entity position
    let x, y;
    if (entity instanceof Phaser.GameObjects.Container) {
      x = entity.x;
      y = entity.y;
    } else {
      x = entity.x;
      y = entity.y;
    }

    // Create a particle emitter for the blood
    const particles = this.scene.add.particles(0, 0, "flare", {
      x: x,
      y: y,
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

  // Destroy the tool and clean up resources
  public destroy(): void {
    // Hide the tool first
    this.hide();

    // Destroy the sprite
    if (this.sprite) {
      this.sprite.destroy();
    }

    // Destroy the laser line
    if (this.laserLine) {
      this.laserLine.destroy();
    }

    // Destroy the laser dot
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
    const selectedTool = this.getSelectedTool();
    if (selectedTool) {
      selectedTool.show(x, y, true); // Pass true for isPlayer
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
