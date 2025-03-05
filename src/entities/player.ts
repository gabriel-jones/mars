import Phaser from "phaser";
import { DUST_COLOR, PLAYER_VELOCITY } from "../constants";
import { DustEffects } from "../effects/DustEffects";

// Player dust effects map
const playerDustEffects = new Map<Phaser.Physics.Arcade.Sprite, DustEffects>();

// Create the player
export function createPlayer(
  scene: Phaser.Scene
): Phaser.Physics.Arcade.Sprite {
  // Get the center of the entire map (which is 2x the size of the screen)
  const centerX = scene.game.config.width as number;
  const centerY = scene.game.config.height as number;

  const player = scene.physics.add
    .sprite(centerX, centerY, "player")
    .setDisplaySize(64, 64)
    .setDepth(10);
  player.setCollideWorldBounds(true);

  // Create dust effects for the player
  const dustEffects = new DustEffects(scene, player, {
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

  // Store the dust effects in the map
  playerDustEffects.set(player, dustEffects);

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

// Update player movement
export function updatePlayerMovement(
  player: Phaser.Physics.Arcade.Sprite,
  cursors: Phaser.Types.Input.Keyboard.CursorKeys,
  wasdKeys: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  },
  time?: number
): void {
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
  player: Phaser.Physics.Arcade.Sprite
): void {
  const dustEffects = playerDustEffects.get(player);
  if (dustEffects) {
    dustEffects.destroy();
    playerDustEffects.delete(player);
  }
}
