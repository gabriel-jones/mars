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
export const NUM_INITIAL_ENEMIES = 5;
export const NUM_INITIAL_OPTIMUS = 4;
export const INITIAL_MONEY = 1_000_000;

// Weapon constants
export const RAYGUN_ATTACK_DAMAGE = 8;
export const ASSAULT_RIFLE_ATTACK_DAMAGE = 10;

// Raid constants
export const INITIAL_RAID_INTERVAL = 60_000; // 1 minute between raids initially
export const INITIAL_RAID_SIZE = 3; // Initial number of aliens in a raid
export const RAID_SIZE_MULTIPLIER = 1.3; // How much to multiply raid size each time
export const MAX_RAID_SIZE = 10; // Maximum number of aliens in a raid
export const RAID_WARNING_TIME = 5_000; // 5 seconds warning before raid

// Terrain features
export const NUM_ICE_DEPOSITS = 8;

// Robot visibility and combat settings
export const ROBOT_DETECTION_RANGE = 600; // Increased from 300 - Range to detect enemies
export const ROBOT_ATTACK_RANGE = 400; // Increased from 250 - Range to attack enemies
export const ROBOT_MAX_SHOOTING_RANGE = 700; // Maximum distance at which robots can shoot
export const ROBOT_IMPRECISION_FACTOR = 20; // Accuracy factor for robots (lower is more accurate)
export const ROBOT_SCAN_INTERVAL = 500; // ms between enemy scans
export const ROBOT_FIRE_RATE = 800; // ms between shots (robots fire more slowly than players)

// Optimus-specific settings
export const OPTIMUS_DETECTION_RANGE = 800; // Increased from 450 - Range to detect enemies
export const OPTIMUS_ATTACK_RANGE = 500; // Increased from 350 - Range to attack enemies
export const OPTIMUS_MAX_SHOOTING_RANGE = 900; // Maximum distance at which Optimus can shoot
export const OPTIMUS_IMPRECISION_FACTOR = 15; // Accuracy factor for Optimus (lower is more accurate)

// Enemy visibility and combat settings
export const ENEMY_PREFERRED_SHOOTING_DISTANCE = 300; // Increased from 150 - Distance at which enemies prefer to stop and shoot
export const ENEMY_MAX_SHOOTING_RANGE = 600; // Increased from 500 - Maximum distance at which enemies can shoot
export const ENEMY_IMPRECISION_FACTOR = 40; // Reduced from 50 - Accuracy factor for enemies (higher is less accurate)

// Default font stack that uses Apple system font with appropriate fallbacks
export const DEFAULT_FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"';
