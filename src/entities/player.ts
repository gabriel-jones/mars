import Phaser from "phaser";
import { DUST_COLOR, PLAYER_VELOCITY } from "../constants";
import { DustEffects } from "../effects/DustEffects";
import { Agent } from "./Agent";

// Player class that extends Agent
export class Player extends Agent {
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

    // Update dust effects
    this.updateDustEffects(time);

    // Update shadow effects
    this.updateShadowEffects();
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

    // Stop movement
    (this.sprite as Phaser.Physics.Arcade.Sprite).setVelocity(0, 0);

    // You might want to trigger a game over screen or respawn logic here
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
