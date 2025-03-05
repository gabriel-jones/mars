import * as Phaser from "phaser";
import {
  createPlayer,
  setupControls,
  updatePlayerMovement,
  cleanupPlayerDustEffects,
} from "../entities/player";
import { createTileHighlight, updateTileHighlight } from "../ui/tileHighlight";
import { gameState } from "../state";
import { BuildMenu } from "../ui/buildMenu";
import { ResourceDisplay } from "../ui/resourceDisplay";
import { createMarsTileset, createTerrain } from "../terrain";
import { ResourceNode } from "../entities/resourceNode";
import { RESOURCE_DEFINITIONS } from "../data/resources";
import { TILE_SIZE } from "../constants";
import { createFPS } from "../ui/fps";
import { Starship } from "../entities/starship";
import { Optimus, MiningDrone, Robot } from "../entities/robots";
import { BuildingFactory } from "../entities/buildings";
import { BuildingType } from "../data/buildings";
import { Building } from "../entities/buildings/Building";
import { JobManager } from "../entities/robots/JobManager";
import { TerrainFeature, TerrainFeatureType } from "../entities/TerrainFeature";
import { BuildingManager, Building as BuildingData } from "../data/buildings";
import { ResourceManager } from "../data/resources";

export class MainScene extends Phaser.Scene {
  private buildMenu: BuildMenu;
  private resourceDisplay: ResourceDisplay;
  private uiCamera: Phaser.Cameras.Scene2D.Camera;
  private resourceNodes: ResourceNode[] = [];
  private terrainFeatures: TerrainFeature[] = [];
  private spawnPoint: Phaser.Math.Vector2;
  private map: Phaser.Tilemaps.Tilemap;
  private tileGroup: Phaser.GameObjects.Group | null = null;
  private fpsText: Phaser.GameObjects.Text;
  private starship: Starship;
  private robots: Robot[] = [];
  private miningDrones: MiningDrone[] = [];
  private optimuses: Optimus[] = [];

  constructor() {
    super({ key: "MainScene" });
  }

  preload() {
    // Tileset
    createMarsTileset(this);

    // Player
    this.load.image("player", "assets/player.png");

    // Buildings
    this.load.image("habitat", "assets/habitat.png");
    this.load.image("solar-panel", "assets/solar-panel.png");
    this.load.image("mining-station", "assets/mining-station.png");
    this.load.image("ice-drill", "assets/ice-drill.png");
    this.load.image("regolith-processor", "assets/regolith-processor.png");

    // Starship
    this.load.image("starship", "assets/starship.png");
    this.load.image("landingpad", "assets/landing-pad.png");
    this.load.svg("engine-flame", "assets/engine-flame.svg");

    // Robots
    this.load.image("optimus", "assets/optimus.png");
    this.load.image("mining-drone", "assets/mining-drone.png");

    // Particles
    this.load.image("flare", "assets/flare.png"); // Particle effect for mining

    // Other
    this.load.svg("bulldozer", "assets/bulldozer.svg");
  }

  create() {
    // Initialize FPS counter
    this.fpsText = createFPS(this);

    // Create terrain
    const { map, groundLayer } = createTerrain(this);
    gameState.map = map;
    gameState.groundLayer = groundLayer;

    // Create player
    gameState.player = createPlayer(this);

    // Setup controls
    const { cursors, wasdKeys } = setupControls(this);
    gameState.cursors = cursors;
    gameState.wasdKeys = wasdKeys;

    // Create UI elements
    gameState.highlightRect = createTileHighlight(this);
    gameState.currentTilePos = { x: -1, y: -1 };

    // Create a separate camera for UI elements that doesn't move
    this.uiCamera = this.cameras.add(
      0,
      0,
      this.game.config.width as number,
      this.game.config.height as number
    );
    this.uiCamera.setScroll(0, 0);

    // Don't make the UI camera transparent - we need to see UI elements
    this.uiCamera.setBackgroundColor(0x000000);
    this.uiCamera.setAlpha(0); // Keep alpha at 0 to see through to the game

    // Make the UI camera ignore game world objects
    this.uiCamera.ignore([gameState.player, gameState.groundLayer]);

    // Set the main camera to follow the player but ignore UI
    this.cameras.main.setBounds(
      0,
      0,
      (this.game.config.width as number) * 2,
      (this.game.config.height as number) * 2
    );
    this.cameras.main.startFollow(gameState.player, true);

    // Create build menu with map reference and UI camera
    this.buildMenu = new BuildMenu(
      this,
      gameState.map,
      this.handleItemPlaced.bind(this)
    );

    // Create resource display
    this.resourceDisplay = new ResourceDisplay(this);

    // Set world bounds if you have a large map
    this.physics.world.setBounds(
      0,
      0,
      (this.game.config.width as number) * 2,
      (this.game.config.height as number) * 2
    );

    // Create the player at the spawn point
    this.spawnPoint = new Phaser.Math.Vector2(
      gameState.player.x,
      gameState.player.y
    );

    // Create starship near spawn point
    const starshipOffset = 200; // Distance from spawn point
    const starshipX = this.spawnPoint.x + starshipOffset;
    const starshipY = this.spawnPoint.y - starshipOffset; // Position above the spawn point
    this.starship = new Starship(this, starshipX, starshipY);

    // Add resource nodes near the spawn point
    this.addResourceNodesNearSpawn();

    // Place ice deposits on the map
    this.placeIceDepositsOnTiles();

    // Create robots
    this.createRobots();

    // Store current tile position in registry for robot panel to access
    this.registry.set("player", gameState.player);
    this.registry.set("currentTilePos", gameState.currentTilePos);
  }

  update(time: number, delta: number) {
    // Update FPS counter
    this.fpsText.setText(`FPS: ${Math.round(this.game.loop.actualFps)}`);

    // Update player movement
    if (gameState.player) {
      updatePlayerMovement(
        gameState.player,
        gameState.cursors,
        gameState.wasdKeys,
        time
      );
    }

    // Update tile highlight
    if (gameState.highlightRect) {
      gameState.currentTilePos = updateTileHighlight(
        this,
        gameState.highlightRect,
        gameState.map,
        gameState.currentTilePos
      );
    }

    // Update resource display
    this.resourceDisplay.update();

    // Update build menu
    this.buildMenu.update();

    // Update resource node physics
    this.updateResourceNodePhysics();

    // Update robots
    this.updateRobots();

    // Update buildings
    this.updateBuildings();

    // Update registry values
    this.registry.set("currentTilePos", gameState.currentTilePos);

    // Clean up completed jobs every 10 seconds
    if (time % 10000 < 100) {
      JobManager.getInstance().cleanupCompletedJobs();
    }
  }

  private handleItemPlaced(itemName: string, x: number, y: number) {
    // Create the building using the factory
    const building = BuildingFactory.createBuilding(
      this,
      x,
      y,
      itemName as BuildingType
    );

    console.log(
      `Placed ${itemName} at tile (${Math.floor(x / 64)}, ${Math.floor(
        y / 64
      )})`
    );
  }

  private addResourceNodesNearSpawn(): void {
    // Add various resource nodes around the spawn point
    const resourceTypes = ["potatoes", "iron", "silicon", "water", "aluminium"];

    // Create a set of unique tile positions to avoid duplicates
    const usedTilePositions = new Set<string>();

    // Add 10 resource nodes of different types
    for (let i = 0; i < 10; i++) {
      // Generate a random angle and distance from spawn
      const angle = Math.random() * Math.PI * 2;
      const distance = 100 + Math.random() * 50;

      // Calculate world position
      const x = this.spawnPoint.x + Math.cos(angle) * distance;
      const y = this.spawnPoint.y + Math.sin(angle) * distance;

      // Convert to tile position
      const tileX = Math.floor(x / TILE_SIZE);
      const tileY = Math.floor(y / TILE_SIZE);
      const tileKey = `${tileX},${tileY}`;

      // Skip if this tile already has a resource node
      if (usedTilePositions.has(tileKey)) {
        continue;
      }

      // Mark this tile as used
      usedTilePositions.add(tileKey);

      // Select a random resource type
      const resourceType =
        resourceTypes[Math.floor(Math.random() * resourceTypes.length)];
      const resourceDef = RESOURCE_DEFINITIONS.find(
        (r) => r.type === resourceType
      );

      if (resourceDef) {
        // Create the resource node with a random amount between 10 and 64
        const node = new ResourceNode(
          this,
          x,
          y,
          resourceDef,
          Phaser.Math.Between(10, 64)
        );

        this.resourceNodes.push(node);
      }
    }
  }

  private updateResourceNodePhysics(): void {
    // Resource nodes are now immovable and snapped to tiles
    // No need to apply physics forces anymore
    // Instead, we can use this method to update any visual effects
    // or handle any other resource node-related logic that needs
    // to happen every frame
  }

  placeIceDepositsOnTiles() {
    // Get the tilemap
    const map = gameState.map;

    // Number of ice deposits to place
    const numDeposits = 32;

    // Get all valid tiles for placement
    const validTiles = [];

    // Loop through all tiles in the map
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const tile = map.getTileAt(x, y);

        // Check if this is a valid tile for an ice deposit
        if (tile && this.isValidTileForIceDeposit(tile)) {
          validTiles.push(tile);
        }
      }
    }

    // Randomly select tiles for ice deposits
    if (validTiles.length > 0) {
      // Shuffle the valid tiles array
      Phaser.Utils.Array.Shuffle(validTiles);

      // Place ice deposits on the first numDeposits tiles
      for (let i = 0; i < Math.min(numDeposits, validTiles.length); i++) {
        const tile = validTiles[i];

        // Convert tile position to world coordinates
        const worldX = map.tileToWorldX(tile.x)! + TILE_SIZE / 2;
        const worldY = map.tileToWorldY(tile.y)! + TILE_SIZE / 2;

        // Create a terrain feature for the ice deposit
        const iceDeposit = new TerrainFeature(
          this,
          worldX,
          worldY,
          TerrainFeatureType.IceDeposit
        );

        // Add to our terrain features array
        this.terrainFeatures.push(iceDeposit);

        // Mark this tile as having an ice deposit in gameState
        gameState.tileData = gameState.tileData || {};
        gameState.tileData[`${tile.x},${tile.y}`] = { hasIceDeposit: true };
      }
    }
  }

  isValidTileForIceDeposit(tile: Phaser.Tilemaps.Tile): boolean {
    // Define criteria for valid ice deposit tiles
    // For example, only allow certain tile types or properties

    // For now, let's say any tile is valid except the edges of the map
    const map = gameState.map;
    return (
      tile.x > 2 &&
      tile.y > 2 &&
      tile.x < map.width - 3 &&
      tile.y < map.height - 3
    );
  }

  // Update all robots
  private updateRobots(): void {
    // Update all robots
    this.robots.forEach((robot) => robot.update());

    // Check if we need to create more Optimus robots
    if (this.optimuses.length < 2) {
      this.createOptimusRobots(2 - this.optimuses.length);
    }
  }

  // Create a specific number of Optimus robots
  private createOptimusRobots(count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 100 + Math.random() * 50;
      const x = this.starship
        ? this.starship.x + Math.cos(angle) * distance
        : 400;
      const y = this.starship
        ? this.starship.y + Math.sin(angle) * distance
        : 400;

      const optimus = new Optimus(this, x, y);
      this.robots.push(optimus);
      this.optimuses.push(optimus);
    }
  }

  // Create robots for the colony
  private createRobots(): void {
    // Create a few humanoid robots near the starship
    this.createOptimusRobots(2);
  }

  // Add a robot to the scene
  public addRobot(robot: Robot): void {
    this.robots.push(robot);

    // Also add to the specific type array
    if (robot instanceof MiningDrone) {
      this.miningDrones.push(robot);
    } else if (robot instanceof Optimus) {
      this.optimuses.push(robot);
    }
  }

  // Update all buildings in the game
  private updateBuildings(): void {
    // Get all buildings from the BuildingManager
    const buildings = BuildingManager.getBuildings();

    // Loop through each building and update it
    buildings.forEach((buildingData: BuildingData) => {
      // Find the building instance in the scene
      const buildingInstance = this.children
        .getChildren()
        .find(
          (child) =>
            child instanceof Building &&
            child.x === buildingData.position.x * TILE_SIZE + TILE_SIZE / 2 &&
            child.y === buildingData.position.y * TILE_SIZE + TILE_SIZE / 2
        ) as Building;

      // If we found the building instance, update it
      if (buildingInstance) {
        buildingInstance.update(this.time.now);
      }
    });
  }

  // Clean up resources when the scene is destroyed
  shutdown() {
    // Clean up player dust effects
    if (gameState.player) {
      cleanupPlayerDustEffects(gameState.player);
    }

    // Clean up the resource display
    if (this.resourceDisplay) {
      this.resourceDisplay.destroy();
    }

    // Clean up other resources as needed
  }
}
