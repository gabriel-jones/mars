import Phaser from "phaser";

// Game state interface
interface GameState {
  player: Phaser.Physics.Arcade.Sprite;
  cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  wasdKeys: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  map: Phaser.Tilemaps.Tilemap;
  groundLayer: Phaser.Tilemaps.TilemapLayer;
  highlightRect: Phaser.GameObjects.Rectangle;
  currentTilePos: { x: number; y: number };
  tileData?: {
    [key: string]: {
      hasIceDeposit?: boolean;
      // Add other tile data as needed
    };
  };
}

// Initialize empty game state
export const gameState = {} as GameState;
