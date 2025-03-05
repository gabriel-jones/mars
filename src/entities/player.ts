import Phaser from "phaser";
import { PLAYER_VELOCITY } from "../constants";

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

// Update player movement based on input
export function updatePlayerMovement(
  player: Phaser.Physics.Arcade.Sprite,
  cursors: Phaser.Types.Input.Keyboard.CursorKeys,
  wasdKeys: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  }
): void {
  // Reset player velocity
  player.setVelocity(0);

  // Handle player movement with arrow keys or WASD
  if (cursors.left.isDown || wasdKeys.A.isDown) {
    player.setVelocityX(-PLAYER_VELOCITY);
  } else if (cursors.right.isDown || wasdKeys.D.isDown) {
    player.setVelocityX(PLAYER_VELOCITY);
  }

  if (cursors.up.isDown || wasdKeys.W.isDown) {
    player.setVelocityY(-PLAYER_VELOCITY);
  } else if (cursors.down.isDown || wasdKeys.S.isDown) {
    player.setVelocityY(PLAYER_VELOCITY);
  }
}
