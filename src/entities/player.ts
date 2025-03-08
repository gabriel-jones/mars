import Phaser from "phaser";
import { DUST_COLOR, PLAYER_VELOCITY } from "../constants";
import { DustEffects } from "../effects/DustEffects";
import { Agent } from "./Agent";
import { ToolInventory, Tool, ToolType } from "./tools";
import { HealthBarRenderer } from "../interfaces/Health";
import { DEPTH } from "../depth";

// Player class that extends Agent
export class Player extends Agent {
  private toolInventory: ToolInventory;
  private toolKeys: Phaser.Input.Keyboard.Key[] = [];
  private fireKey: Phaser.Input.Keyboard.Key;
  private escKey: Phaser.Input.Keyboard.Key;
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
      .setDepth(DEPTH.PLAYER);
    sprite.setCollideWorldBounds(true);

    // Call the parent constructor
    super(scene, sprite, maxHealth);

    // Create tool inventory
    this.toolInventory = new ToolInventory(scene);

    // Set up keyboard input for tool selection (1-3 keys)
    this.toolKeys = [
      scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
      scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
      scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
    ];

    // Set up fire key (spacebar)
    this.fireKey = scene.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE
    );

    // Set up escape key
    this.escKey = scene.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.ESC
    );

    // Initialize dust effects
    this.initDustEffects({
      dustColor: DUST_COLOR,
      dustSize: 5,
      dustAlpha: 0.6,
      dustCount: 10,
      dustInterval: 80,
      dustLifetime: 900,
      movementDustColor: DUST_COLOR,
      movementDustSize: 4,
      movementDustAlpha: 0.7,
      movementDustCount: 8,
    });

    // Initialize shadow effects
    this.initShadowEffects();

    // Initialize shield for player (blue shield)
    this.initShield(50, 0x0088ff);

    // Store a reference to the player instance in gameState for bullet collision detection
    (window as any).gameState.playerInstance = this;
  }

  // Get the tool inventory
  public getToolInventory(): ToolInventory {
    return this.toolInventory;
  }

  // Try to fire the currently selected weapon
  private tryToFire(): void {
    const selectedTool = this.toolInventory.getSelectedTool();
    if (!selectedTool) {
      return;
    }

    // Get the target position (mouse pointer)
    const targetX = this.scene.input.activePointer.worldX;
    const targetY = this.scene.input.activePointer.worldY;

    // Fire the tool using the Agent's fireTool method with isPlayer=true
    this.fireTool(targetX, targetY, true);
  }

  // Update the player
  public update(time: number, delta: number): void {
    if (!this.isAlive()) return;

    // Get controls from gameState
    const gameState = (window as any).gameState;
    const cursors = gameState.cursors;
    const wasdKeys = gameState.wasdKeys;

    // Update with controls
    this.updateWithControls(time, delta, cursors, wasdKeys);

    // Update dust effects
    this.updateDustEffects(time);

    // Update shadow effects
    this.updateShadowEffects();

    // Update health bar position
    this.updateHealthBarPosition();

    // Update shield position
    this.updateShieldPosition();

    // Update cursor based on what's under the mouse
    this.updateCursor();

    // Slowly recharge shield over time (1 point per second)
    if (this.hasShield() && this.getCurrentShield() < this.getMaxShield()) {
      this.rechargeShield(delta / 1000); // Convert delta (ms) to seconds
    }
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

    // Check if fire key is pressed or mouse is clicked
    if (this.fireKey.isDown || this.scene.input.activePointer.isDown) {
      this.tryToFire();
    }

    // Check if escape key is pressed to deselect tool
    if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
      this.toolInventory.deselectTool();
      this.lastSelectedToolIndex = -1;
    }

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
    if (!selectedTool) return;

    const spriteX = (this.sprite as Phaser.Physics.Arcade.Sprite).x;
    const spriteY = (this.sprite as Phaser.Physics.Arcade.Sprite).y;

    // Show the tool at the player's position
    selectedTool.show(spriteX, spriteY, true);

    // Calculate angle to mouse pointer
    const pointer = this.scene.input.activePointer;
    const angle = Phaser.Math.Angle.Between(
      spriteX,
      spriteY,
      pointer.worldX,
      pointer.worldY
    );

    // Update tool rotation to face the mouse pointer
    selectedTool.setRotation(angle);

    // Flip the tool sprite if facing left
    selectedTool.setFlipX(Math.abs(angle) > Math.PI / 2);

    // Update the laser pointer
    selectedTool.updateLaserPointer(
      spriteX,
      spriteY,
      pointer.worldX,
      pointer.worldY,
      true
    );

    // Also update the equipped tool in the Agent class
    this.equipTool(selectedTool);
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

  // Handle player death
  protected onDeath(): void {
    // Clean up shield effect directly instead of calling super
    this.cleanupShieldEffect();

    console.log("Player died!");

    // Show destruction effect
    this.showDestructionEffect();

    // Disable player controls
    if (this.sprite instanceof Phaser.Physics.Arcade.Sprite) {
      this.sprite.setVelocity(0, 0);
      this.sprite.setActive(false);
    }

    // Hide the player sprite
    this.sprite.setVisible(false);

    // Trigger game over after a delay
    this.scene.time.delayedCall(1000, () => {
      // Show game over screen
      this.scene.scene.start("GameOverScene");
    });
  }

  // Create explosion effect
  private showDestructionEffect(): void {
    const x = (this.sprite as Phaser.Physics.Arcade.Sprite).x;
    const y = (this.sprite as Phaser.Physics.Arcade.Sprite).y;

    // Create explosion particles
    const particles = this.scene.add.particles(x, y, "flare", {
      speed: { min: 50, max: 150 },
      scale: { start: 0.4, end: 0 },
      lifespan: 800,
      blendMode: "ADD",
      tint: 0xff0000,
      quantity: 15,
      emitting: false,
    });

    // Explode once
    particles.explode(30);

    // Clean up particles after animation completes
    this.scene.time.delayedCall(1000, () => {
      particles.destroy();
    });
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

  // Override the damage method to make the player invincible
  public damage(amount: number): void {
    // Log the damage but don't actually apply it
    console.log(
      `Player would take ${amount} damage, but is currently invincible`
    );

    // Flash the player to indicate damage was received
    if (this.sprite instanceof Phaser.Physics.Arcade.Sprite) {
      this.sprite.setTint(0xff0000);

      // Reset tint after a short delay
      this.scene.time.delayedCall(100, () => {
        if (this.sprite instanceof Phaser.Physics.Arcade.Sprite) {
          this.sprite.clearTint();
        }
      });
    }
  }
}

// Player dust effects map for backward compatibility
const playerDustEffects = new Map<Phaser.Physics.Arcade.Sprite, DustEffects>();

// Create the player
export function createPlayer(scene: Phaser.Scene): Player {
  // Get the spawn point from the MainScene
  const mainScene = scene as any;
  let spawnX, spawnY;

  if (mainScene.spawnPoint) {
    // Use the spawn point coordinates plus the landing pad offset
    // This will place the player near the landing pad where robots spawn
    const landingPadOffset = 100;
    // Position the player slightly to the right of the landing pad
    spawnX = mainScene.spawnPoint.x + landingPadOffset + 100;
    spawnY = mainScene.spawnPoint.y + landingPadOffset;

    console.log("Creating player at:", {
      x: spawnX,
      y: spawnY,
      spawnPointX: mainScene.spawnPoint.x,
      spawnPointY: mainScene.spawnPoint.y,
      offset: landingPadOffset,
    });
  } else {
    // Fallback to center of map if spawnPoint is not available
    spawnX = (scene.game.config.width as number) / 2;
    spawnY = (scene.game.config.height as number) / 2;

    console.log("Creating player at center (fallback):", {
      x: spawnX,
      y: spawnY,
      gameWidth: scene.game.config.width,
      gameHeight: scene.game.config.height,
    });
  }

  // Ensure the player is created at a valid position
  if (
    isNaN(spawnX) ||
    isNaN(spawnY) ||
    !isFinite(spawnX) ||
    !isFinite(spawnY)
  ) {
    console.error("Invalid player spawn position, using fallback position");
    spawnX = 500;
    spawnY = 500;
  }

  // Create the player at the new location
  const player = new Player(scene, spawnX, spawnY);

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
