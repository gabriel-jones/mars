import Phaser from "phaser";
import { DUST_COLOR, PLAYER_VELOCITY } from "../constants";
import { DustEffects } from "../effects/DustEffects";
import { Agent } from "./Agent";
import { ToolInventory } from "./tools";

// Player class that extends Agent
export class Player extends Agent {
  private toolInventory: ToolInventory;
  private toolKeys: Phaser.Input.Keyboard.Key[] = [];
  private fireKey: Phaser.Input.Keyboard.Key;
  private escKey: Phaser.Input.Keyboard.Key;
  private lastFireTime: number = 0;
  private fireRate: number = 150; // milliseconds between shots
  private lastSelectedToolIndex: number = -1; // Track the last selected tool index

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    maxHealth: number = 100
  ) {
    // Create the player sprite
    const sprite = scene.physics.add
      .sprite(x, y, "player")
      .setDisplaySize(64, 64)
      .setDepth(10);
    sprite.setCollideWorldBounds(true);

    // Call the parent constructor
    super(scene, sprite, maxHealth);

    // Initialize tool inventory
    this.toolInventory = new ToolInventory(scene);
    console.log("Player tool inventory initialized:", this.toolInventory);
    console.log("Tools in inventory:", this.toolInventory.getAllTools());

    // Initialize tool selection keys (1, 2, 3)
    this.toolKeys = [
      scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
      scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
      scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
    ];

    // Initialize fire key (space)
    this.fireKey = scene.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE
    );

    // Initialize ESC key
    this.escKey = scene.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.ESC
    );

    // Set up mouse input for firing
    scene.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown()) {
        console.log("Mouse left button clicked, attempting to fire");
        this.tryToFire();
      }
    });

    console.log("Player created with tool inventory and keys");

    // Initialize dust effects
    this.initDustEffects({
      dustColor: DUST_COLOR,
      dustSize: 5,
      dustAlpha: 0.6,
      dustCount: 12,
      dustInterval: 70,
      dustLifetime: 1000,
      movementDustColor: DUST_COLOR,
      movementDustSize: 4,
      movementDustAlpha: 0.7,
      movementDustCount: 10,
    });

    // Initialize shadow effects
    this.initShadowEffects();
  }

  // Get the tool inventory
  public getToolInventory(): ToolInventory {
    return this.toolInventory;
  }

  // Try to fire the currently selected weapon
  private tryToFire(): void {
    const currentTime = this.scene.time.now;
    const selectedTool = this.toolInventory.getSelectedTool();

    console.log("Attempting to fire weapon...");
    console.log("Selected tool:", selectedTool?.name);
    console.log("Time since last fire:", currentTime - this.lastFireTime, "ms");

    // Check if we can fire (has a tool, and fire rate cooldown has passed)
    if (selectedTool && currentTime - this.lastFireTime >= this.fireRate) {
      console.log("Firing weapon:", selectedTool.name);
      selectedTool.fire();
      this.lastFireTime = currentTime;
    } else if (!selectedTool) {
      console.log("No tool selected, cannot fire");
    } else {
      console.log("Fire rate cooldown not passed yet");
    }
  }

  // Update the player
  public update(time: number, delta: number): void {
    if (!this.isAlive()) return;

    // Get controls from gameState
    const gameState = (window as any).gameState;
    const cursors = gameState.cursors;
    const wasdKeys = gameState.wasdKeys;

    if (cursors && wasdKeys) {
      // Update player movement
      this.updateMovement(cursors, wasdKeys);
    }

    // Update tool selection
    this.updateToolSelection();

    // Update cursor based on selected tool
    this.updateCursor();

    // Update selected tool position
    this.updateSelectedToolPosition();

    // Check for firing input (space key)
    if (this.fireKey.isDown) {
      this.tryToFire();
    }

    // Check for ESC key to deselect tool
    if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
      console.log("ESC key pressed, deselecting tool");
      this.toolInventory.deselectTool();
      this.lastSelectedToolIndex = -1;
      this.scene.input.setDefaultCursor("default");

      // Emit an event to notify the DetailView to clear selection
      this.scene.events.emit("tool:deselected");
    }

    // Update dust effects
    this.updateDustEffects(time);

    // Update shadow effects
    this.updateShadowEffects();
  }

  // Update player with explicit controls (for backward compatibility)
  public updateWithControls(
    time: number,
    delta: number,
    cursors: Phaser.Types.Input.Keyboard.CursorKeys,
    wasdKeys: {
      W: Phaser.Input.Keyboard.Key;
      A: Phaser.Input.Keyboard.Key;
      S: Phaser.Input.Keyboard.Key;
      D: Phaser.Input.Keyboard.Key;
    }
  ): void {
    if (!this.isAlive()) return;

    // Update player movement
    this.updateMovement(cursors, wasdKeys);

    // Update tool selection
    this.updateToolSelection();

    // Update selected tool position
    this.updateSelectedToolPosition();

    // Update dust effects
    this.updateDustEffects(time);

    // Update shadow effects
    this.updateShadowEffects();
  }

  // Update tool selection based on key presses
  private updateToolSelection(): void {
    // Check if any tool key is just pressed
    for (let i = 0; i < this.toolKeys.length; i++) {
      if (Phaser.Input.Keyboard.JustDown(this.toolKeys[i])) {
        console.log(`Tool key ${i + 1} pressed`);

        // If the same tool is already selected, deselect it (toggle behavior)
        if (this.lastSelectedToolIndex === i) {
          console.log(`Tool ${i} already selected, deselecting`);
          this.toolInventory.deselectTool();
          this.lastSelectedToolIndex = -1;
          this.scene.input.setDefaultCursor("default");

          // Emit an event to notify the DetailView to clear selection
          this.scene.events.emit("tool:deselected");
        } else {
          // Select the new tool
          this.toolInventory.selectTool(i);
          this.lastSelectedToolIndex = i;

          // Emit an event to notify the DetailView to show the tool
          const selectedTool = this.toolInventory.getSelectedTool();
          if (selectedTool) {
            this.scene.events.emit("tool:selected", selectedTool);
          }
        }
      }
    }
  }

  // Update the position of the selected tool
  private updateSelectedToolPosition(): void {
    const selectedTool = this.toolInventory.getSelectedTool();
    if (selectedTool) {
      // Get the mouse position in world coordinates
      const worldPoint = this.scene.input.activePointer.positionToCamera(
        this.scene.cameras.main
      ) as Phaser.Math.Vector2;

      // Calculate the angle between player and mouse pointer
      const angle = Phaser.Math.Angle.Between(
        this.sprite.x,
        this.sprite.y,
        worldPoint.x,
        worldPoint.y
      );

      // Determine if the weapon should be flipped (pointing left)
      // Angle is in radians: -π to π, where 0 is right, π/-π is left
      // We flip when pointing to the left half (angle > π/2 or angle < -π/2)
      const shouldFlip = angle > Math.PI / 2 || angle < -Math.PI / 2;

      // When flipped, we need to adjust the rotation angle
      // For a flipped sprite, we want to use the mirrored angle
      let adjustedAngle = angle;
      if (shouldFlip) {
        // When flipped, we need to invert the angle
        // This keeps the gun pointing in the right direction when flipped
        adjustedAngle = angle - Math.PI;
      }

      // Calculate position offset in the direction of the mouse
      const offsetDistance = 30; // Distance from player center
      const x = this.sprite.x + Math.cos(angle) * offsetDistance;
      const y = this.sprite.y + Math.sin(angle) * offsetDistance;

      // Show the tool at the calculated position
      selectedTool.show(x, y);

      // Set the tool to face in the direction of the mouse with adjusted angle
      selectedTool.setRotation(adjustedAngle);

      // Flip the sprite horizontally if pointing left
      selectedTool.setFlipX(shouldFlip);

      // Make the tool half the size
      selectedTool.setScale(0.5);

      // Update the laser pointer
      selectedTool.updateLaserPointer(x, y, worldPoint.x, worldPoint.y);

      // Log the tool position occasionally for debugging
      if (Math.random() < 0.01) {
        // Log approximately once every 100 frames
        console.log(
          `Tool position: ${x}, ${y}, Player position: ${this.sprite.x}, ${
            this.sprite.y
          }, Angle: ${Phaser.Math.RadToDeg(
            angle
          )}, Adjusted Angle: ${Phaser.Math.RadToDeg(
            adjustedAngle
          )}, Flipped: ${shouldFlip}`
        );
      }
    }
  }

  // Update player movement
  private updateMovement(
    cursors: Phaser.Types.Input.Keyboard.CursorKeys,
    wasdKeys: {
      W: Phaser.Input.Keyboard.Key;
      A: Phaser.Input.Keyboard.Key;
      S: Phaser.Input.Keyboard.Key;
      D: Phaser.Input.Keyboard.Key;
    }
  ): void {
    // Default velocity
    let velocityX = 0;
    let velocityY = 0;

    // Handle keyboard input
    if (cursors.left?.isDown || wasdKeys.A.isDown) {
      velocityX = -PLAYER_VELOCITY;
    } else if (cursors.right?.isDown || wasdKeys.D.isDown) {
      velocityX = PLAYER_VELOCITY;
    }

    if (cursors.up?.isDown || wasdKeys.W.isDown) {
      velocityY = -PLAYER_VELOCITY;
    } else if (cursors.down?.isDown || wasdKeys.S.isDown) {
      velocityY = PLAYER_VELOCITY;
    }

    // Apply velocity
    (this.sprite as Phaser.Physics.Arcade.Sprite).setVelocity(
      velocityX,
      velocityY
    );

    // Update dust effects based on movement
    if (this.dustEffects) {
      if (velocityX !== 0 || velocityY !== 0) {
        this.dustEffects.start();
        this.dustEffects.startMovementDust(); // Enable movement dust
      } else {
        // Only stop creating new dust particles, but don't hide existing ones
        this.dustEffects.stop();
        this.dustEffects.stopMovementDust(); // This now only stops creating new particles
      }
    }
  }

  // Handle death
  protected onDeath(): void {
    console.log("Player has died!");

    // Stop dust effects
    if (this.dustEffects) {
      this.dustEffects.stop();
      this.dustEffects.stopMovementDust();
    }

    // Clean up shadow effects
    this.cleanupShadowEffects();

    // Hide any selected tool
    this.toolInventory.deselectTool();

    // Stop movement
    (this.sprite as Phaser.Physics.Arcade.Sprite).setVelocity(0, 0);

    // You might want to trigger a game over screen or respawn logic here
  }

  // Clean up resources
  public destroy(): void {
    // Reset cursor to default when player is destroyed
    if (this.scene) {
      this.scene.input.setDefaultCursor("default");
    }

    // Destroy tool inventory
    this.toolInventory.destroy();

    // Call parent destroy method
    super.destroy();
  }

  // Update cursor based on selected tool
  private updateCursor(): void {
    const selectedTool = this.toolInventory.getSelectedTool();
    if (selectedTool && selectedTool.type === "assault-rifle") {
      this.scene.input.setDefaultCursor("crosshair");
    } else {
      this.scene.input.setDefaultCursor("default");
    }
  }
}

// Player dust effects map for backward compatibility
const playerDustEffects = new Map<Phaser.Physics.Arcade.Sprite, DustEffects>();

// Create the player
export function createPlayer(scene: Phaser.Scene): Player {
  // Get the center of the entire map (which is 2x the size of the screen)
  const centerX = scene.game.config.width as number;
  const centerY = scene.game.config.height as number;

  // Create the player
  const player = new Player(scene, centerX, centerY);

  return player;
}

// Set up input controls
export function setupControls(scene: Phaser.Scene): {
  cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  wasdKeys: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
} {
  // Set up keyboard input
  const cursors = scene.input.keyboard!.createCursorKeys();

  // Add WASD keys
  const wasdKeys = {
    W: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
    A: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
    S: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
    D: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
  };

  return { cursors, wasdKeys };
}

// Update player movement - for backward compatibility
export function updatePlayerMovement(
  player: Phaser.Physics.Arcade.Sprite | Player,
  cursors: Phaser.Types.Input.Keyboard.CursorKeys,
  wasdKeys: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  },
  time?: number
): void {
  // If player is a Player instance, use its update method
  if (player instanceof Player) {
    player.updateWithControls(time || 0, 0, cursors, wasdKeys);
    return;
  }

  // Legacy code for backward compatibility
  // Get the dust effects for this player
  const dustEffects = playerDustEffects.get(player);

  // Default velocity
  let velocityX = 0;
  let velocityY = 0;

  // Handle keyboard input
  if (cursors.left?.isDown || wasdKeys.A.isDown) {
    velocityX = -PLAYER_VELOCITY;
  } else if (cursors.right?.isDown || wasdKeys.D.isDown) {
    velocityX = PLAYER_VELOCITY;
  }

  if (cursors.up?.isDown || wasdKeys.W.isDown) {
    velocityY = -PLAYER_VELOCITY;
  } else if (cursors.down?.isDown || wasdKeys.S.isDown) {
    velocityY = PLAYER_VELOCITY;
  }

  // Apply velocity
  player.setVelocity(velocityX, velocityY);

  // Update dust effects based on movement
  if (dustEffects) {
    if (velocityX !== 0 || velocityY !== 0) {
      dustEffects.start();
      dustEffects.startMovementDust(); // Enable movement dust
    } else {
      // Only stop creating new dust particles, but don't hide existing ones
      dustEffects.stop();
      dustEffects.stopMovementDust(); // This now only stops creating new particles
    }

    if (time) {
      dustEffects.update(time);
    }
  }
}

// Clean up player dust effects
export function cleanupPlayerDustEffects(
  player: Phaser.Physics.Arcade.Sprite | Player
): void {
  // If player is a Player instance, it will handle its own cleanup
  if (player instanceof Player) {
    return;
  }

  // Legacy code for backward compatibility
  const dustEffects = playerDustEffects.get(
    player as Phaser.Physics.Arcade.Sprite
  );
  if (dustEffects) {
    dustEffects.destroy();
    playerDustEffects.delete(player as Phaser.Physics.Arcade.Sprite);
  }
}
