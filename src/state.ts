import Phaser from "phaser";
import { Building } from "./data/buildings";

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
  buildings?: Building[]; // Add buildings array to store all placed buildings
}

// Initialize empty game state
export const gameState = {} as GameState;

// Make gameState accessible globally for debugging and for robots to access
(window as any).gameState = gameState;
