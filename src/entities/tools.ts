import Phaser from "phaser";
import { DEPTH } from "../depth";
import {
  ASSAULT_RIFLE_ATTACK_DAMAGE,
  RAYGUN_ATTACK_DAMAGE,
} from "../constants";

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
  size: number;
}

// Define characteristics for each weapon type
const WEAPON_CHARACTERISTICS: Record<ToolType, WeaponCharacteristics> = {
  [ToolType.ASSAULT_RIFLE]: {
    burstCount: 3,
    burstDelay: 100,
    burstCooldown: 800,
    damage: ASSAULT_RIFLE_ATTACK_DAMAGE,
    imprecision: 20,
    size: 64,
  },
  [ToolType.RAYGUN]: {
    burstCount: 3,
    burstDelay: 200,
    burstCooldown: 3000,
    damage: RAYGUN_ATTACK_DAMAGE,
    imprecision: 50,
    size: 32,
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
        this.sprite.setDisplaySize(
          this.characteristics.size,
          this.characteristics.size
        ); // Square shape
        this.sprite.setDepth(DEPTH.TOOL); // Higher than player

        // Initialize with default orientation (facing right)
        this.sprite.setFlipX(false);

        // Create laser pointer elements (initially invisible)
        this.laserLine = scene.add.line(0, 0, 0, 0, 0, 0, 0xff0000, 0.5);
        this.laserLine.setVisible(false);
        this.laserLine.setDepth(DEPTH.TOOL - 1); // Below the weapon

        this.laserDot = scene.add.circle(0, 0, 3, 0xff0000, 1);
        this.laserDot.setVisible(false);
        this.laserDot.setDepth(DEPTH.TOOL - 1); // Below the weapon
      } catch (error) {
        // If that fails, try to use the rect texture
        console.error(
          `Failed to create sprite for tool: ${name} with texture: ${textureKey}`,
          error
        );
        try {
          this.sprite = scene.add.sprite(0, 0, `${textureKey}-rect`);
          this.sprite.setVisible(false);
          this.sprite.setDepth(DEPTH.TOOL); // Higher than player

          // Initialize with default orientation (facing right)
          this.sprite.setFlipX(false);

          // Create laser pointer elements (initially invisible)
          this.laserLine = scene.add.line(0, 0, 0, 0, 0, 0, 0xff0000, 0.5);
          this.laserLine.setVisible(false);
          this.laserLine.setDepth(DEPTH.TOOL - 1); // Below the weapon

          this.laserDot = scene.add.circle(0, 0, 3, 0xff0000, 1);
          this.laserDot.setVisible(false);
          this.laserDot.setDepth(DEPTH.TOOL - 1); // Below the weapon
        } catch (rectError) {
          // If that fails, try to use the fallback texture
          console.error(
            `Failed to create sprite for tool: ${name} with rect texture: ${textureKey}-rect`,
            rectError
          );
          try {
            this.sprite = scene.add.sprite(0, 0, `${textureKey}-fallback`);
            this.sprite.setVisible(false);
            this.sprite.setDepth(DEPTH.TOOL); // Higher than player

            // Initialize with default orientation (facing right)
            this.sprite.setFlipX(false);

            // Create laser pointer elements (initially invisible)
            this.laserLine = scene.add.line(0, 0, 0, 0, 0, 0, 0xff0000, 0.5);
            this.laserLine.setVisible(false);
            this.laserLine.setDepth(DEPTH.TOOL - 1); // Below the weapon

            this.laserDot = scene.add.circle(0, 0, 3, 0xff0000, 1);
            this.laserDot.setVisible(false);
            this.laserDot.setDepth(DEPTH.TOOL - 1); // Below the weapon
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

  // Show the tool at the specified position
  public show(x: number, y: number, isPlayer: boolean = false): void {
    if (!this.sprite) {
      console.warn(`Cannot show tool: ${this.name} - sprite is null`);
      return;
    }

    // Make the sprite visible
    this.sprite.setVisible(true);

    // Update the position
    this.updatePosition(x, y);

    // Hide the laser pointer for all weapons
    if (this.laserLine) {
      this.laserLine.setVisible(false);
    }
    if (this.laserDot) {
      this.laserDot.setVisible(false);
    }
  }

  // Hide the tool
  public hide(): void {
    if (!this.sprite) {
      return;
    }

    // Make the sprite invisible
    this.sprite.setVisible(false);

    // Hide the laser pointer
    if (this.laserLine) {
      this.laserLine.setVisible(false);
    }
    if (this.laserDot) {
      this.laserDot.setVisible(false);
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
    if (!this.laserLine || !this.laserDot) {
      return;
    }

    // Calculate the angle to the target
    const angle = Phaser.Math.Angle.Between(startX, startY, targetX, targetY);

    // Calculate the barrel position
    const barrelOffsetDistance = 30;
    let barrelX, barrelY;

    if (this.sprite && this.sprite.flipX) {
      // If the sprite is flipped, we need to adjust the barrel position
      const adjustedAngle = angle + Math.PI; // Add 180 degrees
      barrelX = startX + Math.cos(adjustedAngle) * barrelOffsetDistance;
      barrelY = startY + Math.sin(adjustedAngle) * barrelOffsetDistance;
    } else {
      // Normal calculation for non-flipped sprite
      barrelX = startX + Math.cos(angle) * barrelOffsetDistance;
      barrelY = startY + Math.sin(angle) * barrelOffsetDistance;
    }

    // Calculate the end point of the laser
    const laserLength = 1000; // Long enough to go off-screen
    const endX = barrelX + Math.cos(angle) * laserLength;
    const endY = barrelY + Math.sin(angle) * laserLength;

    // Update the laser line
    this.laserLine.setTo(barrelX, barrelY, endX, endY);

    // Update the laser dot position
    // For player, use the exact target position
    // For enemies, add some imprecision
    if (isPlayer) {
      this.laserDot.setPosition(targetX, targetY);
    } else {
      // Add imprecision for enemies
      const imprecision = this.getImprecision();
      const randomOffsetX = (Math.random() - 0.5) * imprecision;
      const randomOffsetY = (Math.random() - 0.5) * imprecision;
      this.laserDot.setPosition(
        targetX + randomOffsetX,
        targetY + randomOffsetY
      );
    }

    // Hide laser lines for everyone
    this.laserLine.setVisible(false);
    this.laserDot.setVisible(false);
  }

  // Update the position of the tool
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

  // Set the exact display size of the tool sprite in pixels
  public setDisplaySize(width: number, height: number): void {
    if (this.sprite) {
      this.sprite.setDisplaySize(width, height);
    } else {
      console.warn(
        `Cannot set display size for tool: ${this.name} - sprite is null`
      );
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
    if (!this.sprite || !this.scene) {
      console.warn("Cannot fire: sprite or scene is undefined");
      return;
    }

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

    // Log firing for debugging
    console.log(
      `Tool ${this.name} firing from (${barrelX.toFixed(0)}, ${barrelY.toFixed(
        0
      )}) to (${targetX.toFixed(0)}, ${targetY.toFixed(
        0
      )}), isPlayer: ${isPlayer}`
    );

    // Create muzzle flash effect first (so it's visible immediately)
    this.createMuzzleFlash(barrelX, barrelY, angle);

    // Create a bullet - force direct call to ensure it's created
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
    if (!this.scene) {
      console.error("Cannot create bullet: scene is undefined");
      return;
    }

    try {
      // Calculate angle to target
      const angle = Phaser.Math.Angle.Between(startX, startY, targetX, targetY);

      // Add some imprecision to the angle based on weapon characteristics
      const imprecision = this.characteristics.imprecision;
      const randomAngle = angle + (Math.random() - 0.5) * (imprecision / 500);

      // Create the bullet sprite with the appropriate texture
      let bullet;
      if (this.type === ToolType.RAYGUN) {
        // Use the red raygun bullet texture
        bullet = this.scene.physics.add.sprite(startX, startY, "raygun-bullet");
        bullet.setDisplaySize(8, 4);
      } else {
        // Use the standard white bullet texture
        bullet = this.scene.physics.add.sprite(startX, startY, "bullet");
        bullet.setTint(0xffff00); // Yellow for other weapons
        bullet.setDisplaySize(6, 3);
      }

      bullet.setDepth(DEPTH.BULLET);

      // Set bullet rotation to match angle
      bullet.setRotation(randomAngle);

      // Calculate velocity based on angle with some randomness
      const speed = 800; // Bullet speed
      const velocityX = Math.cos(randomAngle) * speed;
      const velocityY = Math.sin(randomAngle) * speed;

      // Set bullet velocity
      bullet.setVelocity(velocityX, velocityY);

      // Enable continuous collision detection for fast-moving objects
      const bulletBody = bullet.body as Phaser.Physics.Arcade.Body;
      if (bulletBody) {
        // This helps prevent tunneling through objects at high speeds
        bulletBody.setBounce(0);
        bulletBody.setMaxSpeed(1200);

        // Store the previous position to help with collision detection
        (bullet as any).prevX = startX;
        (bullet as any).prevY = startY;
      }

      // Get the damage from weapon characteristics
      const damage = this.characteristics.damage;

      // Store damage value on the bullet for collision handling
      (bullet as any).damage = damage;

      // Store the weapon type on the bullet for collision handling
      (bullet as any).weaponType = this.type;

      // Store whether this is an enemy bullet
      const isEnemyBullet = this.name.toLowerCase().includes("alien");
      (bullet as any).isEnemyBullet = isEnemyBullet;

      // Enable physics body for collision detection
      this.scene.physics.world.enable(bullet);

      // Set up the physics body for better collision detection
      const body = bullet.body as Phaser.Physics.Arcade.Body;
      if (body) {
        // Set a larger hitbox for the bullet for better collision detection
        body.setSize(24, 24); // Increased from 16x16 to 24x24 for better collision
        body.setOffset(-8, -10); // Adjusted offset to center the hitbox better

        // Disable gravity for the bullet
        body.setAllowGravity(false);

        // Enable collision with world bounds
        body.setCollideWorldBounds(true);
        body.onWorldBounds = true;
      }

      // Add a visual debug rectangle to show the bullet's hitbox
      const debugRect = this.scene.add.rectangle(
        bullet.x,
        bullet.y,
        24,
        24,
        this.type === ToolType.RAYGUN ? 0xff0000 : 0xffff00, // Match the bullet color
        0.3
      );
      debugRect.setDepth(DEPTH.BULLET + 1);

      // Get gameState for collision detection
      const gameState = (window as any).gameState;

      // Set up basic collision detection
      if (isEnemyBullet) {
        // Enemy bullets can hit the player
        if (gameState.player) {
          this.scene.physics.add.overlap(
            bullet,
            gameState.player,
            (bullet, player) => {
              // Destroy the bullet
              bullet.destroy();
              debugRect.destroy();

              // Damage the player
              if (
                gameState.playerInstance &&
                typeof gameState.playerInstance.damage === "function"
              ) {
                gameState.playerInstance.damage(damage);
                console.log(`Player hit by enemy bullet for ${damage} damage`);
              }
            },
            undefined,
            this
          );
        }

        // Enemy bullets can hit robots
        if (gameState.robots && gameState.robots.length > 0) {
          for (const robot of gameState.robots) {
            if (robot && robot.getSprite) {
              const robotSprite = robot.getSprite();
              this.scene.physics.add.overlap(
                bullet,
                robotSprite,
                (bullet, robotSprite) => {
                  // Destroy the bullet
                  bullet.destroy();
                  debugRect.destroy();

                  // Damage the robot
                  if (robot && typeof robot.damage === "function") {
                    robot.damage(damage);
                    console.log(
                      `Robot hit by enemy bullet for ${damage} damage`
                    );
                  }
                },
                undefined,
                this
              );
            }
          }
        }
      } else {
        // Player bullets can hit enemies
        if (gameState.enemies && gameState.enemies.length > 0) {
          // Create a single collision handler for all enemies
          this.scene.physics.add.overlap(
            bullet,
            gameState.enemies
              .map((enemy: any) => enemy.getSprite())
              .filter(Boolean),
            (bullet, enemySprite) => {
              // Destroy the bullet
              bullet.destroy();
              debugRect.destroy();

              // Find the enemy instance from the sprite
              const enemy = gameState.enemies.find(
                (e: any) => e.getSprite() === enemySprite
              );

              // Damage the enemy
              if (enemy && typeof enemy.damage === "function") {
                enemy.damage(damage);
                console.log(`Enemy hit by player bullet for ${damage} damage`);
              }
            },
            // Process callback to ensure collision is always checked
            (bullet, enemySprite) => {
              return true; // Always process the collision
            },
            this
          );
        }
      }

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

      // Add an update event to handle continuous collision detection
      const bulletUpdater = this.scene.time.addEvent({
        delay: 8, // Check more frequently than the debug rect
        callback: () => {
          if (!bullet.active) return;

          // Store current position for next frame
          const currentX = bullet.x;
          const currentY = bullet.y;

          // Update the debug rectangle position
          debugRect.setPosition(currentX, currentY);

          // Store current position for next frame
          (bullet as any).prevX = currentX;
          (bullet as any).prevY = currentY;
        },
        loop: true,
      });

      // Log bullet creation
      console.log(
        `Created bullet with damage ${damage}, angle ${(
          (randomAngle * 180) /
          Math.PI
        ).toFixed(1)}°, isEnemyBullet: ${isEnemyBullet}`
      );

      // Destroy the bullet after a certain time or distance
      this.scene.time.delayedCall(1500, () => {
        if (bullet && bullet.active) {
          bullet.destroy();
          debugRect.destroy();
          debugUpdater.destroy();
          bulletUpdater.destroy();
        }
      });
    } catch (error) {
      console.error("Error creating bullet:", error);
    }
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
    muzzleFlash.setDepth(DEPTH.TOOL + 1); // Above everything

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
