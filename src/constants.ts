// Physical constants
export const PLAYER_VELOCITY = 200;
export const ROBOT_VELOCITY = 100;
export const TILE_SIZE = 64;
export const WORLD_WIDTH = 100;
export const WORLD_HEIGHT = 100;
export const MAP_WIDTH = 50;
export const MAP_HEIGHT = 50;

// Colors
export const DUST_COLOR = 0xc2b280;

// Start conditions
export const NUM_INITIAL_ENEMIES = 10;
export const NUM_INITIAL_OPTIMUS = 4;
export const INITIAL_MONEY = 1_000_000;

// Raid constants
export const INITIAL_RAID_INTERVAL = 60_000; // 1 second between raids initially
export const INITIAL_RAID_SIZE = 3; // Initial number of aliens in a raid
export const RAID_SIZE_MULTIPLIER = 1.3; // How much to multiply raid size each time
export const MAX_RAID_SIZE = 30; // Maximum number of aliens in a raid
export const RAID_WARNING_TIME = 5_000; // 5 seconds warning before raid

// Terrain features
export const NUM_ICE_DEPOSITS = 8;

// Default font stack that uses Apple system font with appropriate fallbacks
export const DEFAULT_FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"';
