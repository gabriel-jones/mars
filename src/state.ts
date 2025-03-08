import Phaser from "phaser";
import { Building } from "./data/buildings";
import { ResourceCount } from "./data/resources";
import { Robot } from "./entities/robots";
import { Enemy } from "./entities/enemies";
import { INITIAL_MONEY } from "./constants";

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
  robots: Robot[]; // Add robots array for enemies to target
  enemies: Enemy[]; // Add enemies array
  resources: {
    inventory: ResourceCount[];
    events: Phaser.Events.EventEmitter;
  };
  money: number; // Add money property
}

// Initialize empty game state
export const gameState = {
  robots: [],
  enemies: [],
  resources: {
    inventory: [],
    events: new Phaser.Events.EventEmitter(),
  },
  money: INITIAL_MONEY,
} as unknown as GameState;

// Make gameState accessible globally for debugging and for robots to access
(window as any).gameState = gameState;
