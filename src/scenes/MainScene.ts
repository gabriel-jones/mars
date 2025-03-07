import * as Phaser from "phaser";
import {
  createPlayer,
  setupControls,
  updatePlayerMovement,
  cleanupPlayerDustEffects,
  Player,
} from "../entities/player";
import { createTileHighlight, updateTileHighlight } from "../ui/tileHighlight";
import { gameState } from "../state";
import { ActionMenu } from "../ui/actionMenu";
import { ResourceDisplay } from "../ui/resourceDisplay";
import { createMarsTileset, createTerrain } from "../terrain";
import { ResourceNode } from "../entities/resourceNode";
import { RESOURCE_DEFINITIONS, ResourceType } from "../data/resources";
import { TILE_SIZE } from "../constants";
import { createFPS } from "../ui/fps";
import { Starship } from "../entities/starship";
import { Optimus, MiningDrone, Robot } from "../entities/robots";
import { BuildingFactory } from "../entities/buildings";
import { BuildingType } from "../data/buildings";
import { Building } from "../entities/buildings/Building";
import { JobManager, JobType, Job } from "../entities/robots/JobManager";
import { TerrainFeature, TerrainFeatureType } from "../entities/TerrainFeature";
import { BuildingManager, Building as BuildingData } from "../data/buildings";
import { ResourceManager } from "../data/resources";
import { Blueprint } from "../entities/buildings/Blueprint";
import { Enemy, Alien } from "../entities/enemies";
import { ToolInventoryDisplay } from "../ui/toolInventoryDisplay";
import { DetailView } from "../ui/detailView";
import { LandingPad } from "../entities/buildings/LandingPad";
import { HealthBarRenderer } from "../interfaces/Health";
import { HabitatManager } from "../mechanics/HabitatManager";
import { JobManager as GameJobManager } from "../mechanics/JobManager";
import { BlueprintManager } from "../mechanics/BlueprintManager";
import { EnemyManager } from "../mechanics/EnemyManager";

export class MainScene extends Phaser.Scene {
  private actionMenu: ActionMenu;
  private resourceDisplay: ResourceDisplay;
  private toolInventoryDisplay: ToolInventoryDisplay;
  private detailView: DetailView;
  private fpsText: Phaser.GameObjects.Text;
  private uiCamera: Phaser.Cameras.Scene2D.Camera;
  private resourceNodes: ResourceNode[] = [];
  private terrainFeatures: TerrainFeature[] = [];
  private spawnPoint: Phaser.Math.Vector2;
  private map: Phaser.Tilemaps.Tilemap;
  private tileGroup: Phaser.GameObjects.Group | null = null;
  private starship: Starship;
  private robots: Robot[] = [];
  private miningDrones: MiningDrone[] = [];
  private optimuses: Optimus[] = [];
  private buildings: Building[] = [];
  private blueprints: Blueprint[] = [];
  private enemies: Enemy[] = [];
  private player: Player;
  private healthBarRenderer: HealthBarRenderer;

  // Manager instances
  private habitatManager: HabitatManager;
  private jobManager: GameJobManager;
  private blueprintManager: BlueprintManager;
  private enemyManager: EnemyManager;

  constructor() {
    super({ key: "MainScene" });
  }

  preload() {
    // Tileset
    createMarsTileset(this);

    // Player
    this.load.image("player", "assets/player.png");

    // Tools - try both SVG and PNG versions
    this.load.image("assault-rifle", "assets/assault-rifle.png");
    this.load.svg("assault-rifle", "assets/assault-rifle.svg");
    this.load.svg("assault-rifle-icon", "assets/assault-rifle-icon.svg");

    // Raygun for aliens
    this.load.image("raygun", "assets/raygun.png");
    this.load.svg("raygun", "assets/raygun.svg");
    this.load.image("raygun-fallback", "assets/assault-rifle.png"); // Fallback to assault rifle if raygun image is missing

    // Bullet
    this.load.image("bullet", "assets/bullet.png");

    // Fallback images for tools (in case SVG loading fails)
    this.load.image("assault-rifle-fallback", "assets/player.png"); // Using player as fallback

    // Buildings
    this.load.image("habitat", "assets/habitat.png");
    this.load.image("solar-panel", "assets/solar-panel.png");
    this.load.image("mining-station", "assets/mining-station.png");
    this.load.image("ice-drill", "assets/ice-drill.png");
    this.load.image("regolith-processor", "assets/regolith-processor.png");
    this.load.image("landing-pad", "assets/landing-pad.png");

    // Starship
    this.load.image("starship", "assets/starship.png");
    this.load.image("landingpad", "assets/landing-pad.png");
    this.load.svg("engine-flame", "assets/engine-flame.svg");

    // Robots
    this.load.image("optimus", "assets/optimus.png");
    this.load.image("mining-drone", "assets/mining-drone.png");

    // Enemies
    this.load.image("ufo", "assets/ufo.png");
    this.load.image("alien", "assets/alien.png");

    // Particles
    this.load.image("flare", "assets/flare-2.png"); // Make sure this is loaded for muzzle flash and blood effects

    // Create a small 8x8 dust texture programmatically
    const dustTexture = this.textures.createCanvas("dust-particle", 8, 8);
    if (dustTexture) {
      const dustContext = dustTexture.getContext();

      // Create a radial gradient for a soft dust particle
      const gradient = dustContext.createRadialGradient(4, 4, 0, 4, 4, 4);
      gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
      gradient.addColorStop(0.5, "rgba(255, 255, 255, 0.5)");
      gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

      dustContext.fillStyle = gradient;
      dustContext.fillRect(0, 0, 8, 8);

      // Update the texture
      dustTexture.refresh();
    }

    // Create a shadow texture programmatically
    const shadowTexture = this.textures.createCanvas("shadow", 64, 32);
    if (shadowTexture) {
      const shadowContext = shadowTexture.getContext();

      // Create a pixelated oval shadow
      shadowContext.fillStyle = "rgba(255, 255, 255, 1)";

      // Draw a MASSIVE pixelated oval (64x32 pixels)
      shadowContext.fillRect(0, 8, 64, 16);
      shadowContext.fillRect(8, 4, 48, 24);
      shadowContext.fillRect(16, 0, 32, 32);

      // Update the texture
      shadowTexture.refresh();
      console.log("Shadow texture created successfully - MASSIVE SIZE");
    } else {
      console.error("Failed to create shadow texture");
    }

    // Other
    this.load.svg("bulldozer", "assets/bulldozer.svg");
  }

  create() {
    // Store a reference to gameState for easier access
    const gameState = (window as any).gameState;

    // Create health bar renderer
    this.healthBarRenderer = new HealthBarRenderer(this);

    // Initialize managers early in the create method
    this.habitatManager = new HabitatManager(this, this.buildings);
    this.jobManager = new GameJobManager(
      this,
      this.robots,
      this.resourceNodes,
      this.blueprints
    );
    this.blueprintManager = new BlueprintManager(
      this,
      this.blueprints,
      this.buildings,
      this.healthBarRenderer
    );

    // Initialize EnemyManager with a default spawn point
    // The actual spawn point will be set later
    this.enemyManager = new EnemyManager(
      this,
      this.enemies,
      new Phaser.Math.Vector2(0, 0),
      this.healthBarRenderer
    );

    // Set default cursor
    this.input.setDefaultCursor("default");

    // Initialize FPS counter
    this.fpsText = createFPS(this);

    // Create terrain
    const { map, groundLayer } = createTerrain(this);
    this.map = map;
    gameState.map = map;
    gameState.groundLayer = groundLayer;

    // Create player
    this.player = createPlayer(this);
    gameState.player = this.player.getSprite() as Phaser.Physics.Arcade.Sprite;

    // Add health bar to player
    const playerHealthBar = this.healthBarRenderer.createHealthBar(
      this.player as any, // Type cast to bypass type checking
      -30
    );
    this.player.setHealthBar(playerHealthBar);

    // Setup controls
    const controls = setupControls(this);
    gameState.cursors = controls.cursors;
    gameState.wasdKeys = controls.wasdKeys;

    // Create UI elements
    gameState.highlightRect = createTileHighlight(this);
    gameState.currentTilePos = { x: -1, y: -1 };

    // Listen for blueprint cancellation events
    this.events.on("blueprint:canceled", this.handleBlueprintCanceled, this);

    // Make sure physics is enabled
    this.physics.world.enable([this.player.getSprite()]);

    // Set up physics debug if needed
    this.physics.world.createDebugGraphic();
    this.physics.world.debugGraphic.setVisible(false); // Set to true to see physics bodies

    // Create a separate camera for UI elements that doesn't move
    this.uiCamera = this.cameras.add(
      0,
      0,
      this.game.config.width as number,
      this.game.config.height as number
    );
    this.uiCamera.setScroll(0, 0);
    this.uiCamera.setName("UICamera");

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
    this.cameras.main.setName("MainCamera");

    // Create build menu with map reference and UI camera
    this.actionMenu = new ActionMenu(this, gameState.map, (itemName, x, y) =>
      this.handleItemPlaced(itemName, x, y)
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

    // Set the spawn point
    this.spawnPoint = new Phaser.Math.Vector2(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2
    );

    // Update the spawn point in the enemy manager
    if (this.enemyManager) {
      this.enemyManager.updateSpawnPoint(this.spawnPoint);

      // Create enemies using the enemy manager
      this.enemyManager.createEnemies(5);
    } else {
      console.error("EnemyManager is not initialized!");
    }

    // Create a landing pad near the spawn point
    const landingPadOffset = 100; // Reduced distance from spawn point (was 200)
    const landingPadX = this.spawnPoint.x + landingPadOffset;
    const landingPadY = this.spawnPoint.y + landingPadOffset; // Changed to be below the spawn point instead of above

    // Create the landing pad
    const initialLandingPad = BuildingFactory.createBuilding(
      this,
      landingPadX,
      landingPadY,
      "landing-pad"
    ) as LandingPad;

    // Add to buildings list
    this.buildings.push(initialLandingPad);

    // Store a reference to the starship
    this.starship = initialLandingPad.getStarship();

    // Add resource nodes near the spawn point
    this.addResourceNodesNearSpawn();

    // Place ice deposits on the map
    this.placeIceDepositsOnTiles();

    // Create robots
    this.createRobots();

    // Store current tile position in registry for robot panel to access
    this.registry.set("player", gameState.player);
    this.registry.set("currentTilePos", gameState.currentTilePos);

    // Create tool inventory display
    console.log("Creating tool inventory display");
    this.toolInventoryDisplay = new ToolInventoryDisplay(
      this,
      this.player.getToolInventory()
    );

    console.log("Tool inventory display created:", this.toolInventoryDisplay);
    console.log(
      "Tool inventory container:",
      this.toolInventoryDisplay.getContainer()
    );

    // Make sure the tool inventory display is not ignored by the UI camera
    // and is ignored by the main camera
    this.cameras.main.ignore(this.toolInventoryDisplay.getContainer());

    // Make sure the UI camera doesn't ignore the tool inventory display
    // We need to explicitly tell the UI camera to include the tool inventory display
    // by not adding it to the ignore list
    this.uiCamera.ignore([gameState.player, gameState.groundLayer]);

    // Create detail view for entity selection
    console.log("Creating DetailView...");
    this.detailView = new DetailView(this);

    // Add debug message to check UI camera setup
    console.log("UI Camera setup:", {
      bounds: this.uiCamera.getBounds(),
      mainCamera: this.cameras.main.id,
      uiCamera: this.uiCamera.id,
      detailViewContainer: this.detailView.getContainer().name || "unnamed",
    });

    // Add resize handler
    this.scale.on("resize", this.handleResize, this);

    // Log debug info about the scene
    console.log("Scene setup complete. Debug info:", {
      width: this.scale.width,
      height: this.scale.height,
      cameras: this.cameras.cameras.length,
      mainCameraName: this.cameras.main.name,
      uiCameraName: this.uiCamera.name,
    });

    // Log the creation of UI elements
    console.log("UI elements created:", {
      actionMenu: !!this.actionMenu,
      resourceDisplay: !!this.resourceDisplay,
      toolInventoryDisplay: !!this.toolInventoryDisplay,
      detailView: !!this.detailView,
    });

    // Set up event listeners for habitat events
    this.events.on("habitatPlaced", this.onHabitatPlaced, this);
    this.events.on("habitatExpanded", this.onHabitatExpanded, this);
    this.events.on("habitatUpdated", this.onHabitatUpdated, this);
    this.events.on(
      "habitatExpansionPlaced",
      this.onHabitatExpansionPlaced,
      this
    );

    // Listen for custom events from BuildingManager
    if (typeof window !== "undefined") {
      window.addEventListener("habitatMerged", (e: any) =>
        this.onHabitatMerged(e.detail)
      );
      window.addEventListener("habitatSplit", (e: any) =>
        this.onHabitatSplit(e.detail)
      );
    }

    // Listen for building destroyed events
    this.events.on("buildingDestroyed", this.onBuildingDestroyed, this);
  }

  update(time: number, delta: number) {
    // Update FPS counter
    this.fpsText.setText(`FPS: ${Math.round(this.game.loop.actualFps)}`);

    // Update player movement
    if (this.player) {
      // Use the Player class's update method to handle movement and shooting
      this.player.update(time, delta);
    }

    // Update tile highlight whenever the mouse is over the game area
    gameState.currentTilePos = updateTileHighlight(
      this,
      gameState.highlightRect,
      gameState.map,
      gameState.currentTilePos
    );

    // Update UI elements
    this.actionMenu.update();

    // Update the robots list if the panel is open
    if (this.actionMenu.isRobotsPanelOpen) {
      this.updateRobotsListInMenu();
    }

    // Update the starships list if the panel is open
    if (this.actionMenu.isStarshipsPanelOpen) {
      this.actionMenu.updateStarshipsList();
    }

    // Update resource display
    this.resourceDisplay.update();

    // Update blueprints
    this.blueprintManager.updateBlueprints(time, delta);

    // Update buildings
    this.updateBuildings(time, delta);

    // Update robots
    this.updateRobots();

    // Create resource delivery jobs
    this.jobManager.createResourceDeliveryJobs();

    // Clean up completed jobs every 10 seconds
    if (time % 10000 < 100) {
      JobManager.getInstance().cleanupCompletedJobs();
    }

    // Update resource node physics
    this.updateResourceNodePhysics();

    // Update enemies with error handling
    if (this.enemyManager) {
      this.enemyManager.updateEnemies(time, delta);
    }

    // Update registry values
    this.registry.set("currentTilePos", gameState.currentTilePos);

    // Update tool inventory display with the selected tool index
    if (this.toolInventoryDisplay && this.player) {
      const selectedIndex = this.player.getToolInventory().getSelectedTool()
        ? this.player
            .getToolInventory()
            .getAllTools()
            .findIndex(
              (tool) =>
                tool === this.player.getToolInventory().getSelectedTool()
            )
        : -1;
      this.toolInventoryDisplay.updateSelection(selectedIndex);
    }

    // Update detail view
    if (this.detailView) {
      this.detailView.update(time, delta);
    }

    // Update player health bar
    if (this.player && this.player.getHealthBar()) {
      this.healthBarRenderer.updateHealthBar(
        this.player.getHealthBar()!,
        this.player
      );
    }

    // Update manager references
    this.updateManagerReferences();
  }

  private handleItemPlaced(itemName: string, x: number, y: number) {
    // Delegate to blueprint manager
    this.blueprintManager.handleItemPlaced(itemName, x, y);
  }

  private addResourceNodesNearSpawn(): void {
    // Define specific resource types and amounts to spawn
    const resourcesToSpawn: {
      type: ResourceType;
      amount: number;
    }[] = [
      { type: "iron", amount: 256 },
      { type: "silicon", amount: 256 },
      { type: "aluminium", amount: 64 },
      { type: "potatoes", amount: 64 },
    ];

    // Create a set of unique tile positions to avoid duplicates
    const usedTilePositions = new Set<string>();

    // Add resource nodes for each specified resource
    resourcesToSpawn.forEach((resourceInfo, index) => {
      ResourceManager.addResource(resourceInfo.type, resourceInfo.amount);

      // Generate a position based on index to ensure they're spread out
      const angle = (index / resourcesToSpawn.length) * Math.PI * 2;
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
        return;
      }

      // Mark this tile as used
      usedTilePositions.add(tileKey);

      // Find the resource definition
      const resourceDef = RESOURCE_DEFINITIONS.find(
        (r) => r.type === resourceInfo.type
      );

      if (resourceDef) {
        // Calculate how many nodes we need (max stack size is 64)
        const MAX_STACK_SIZE = 64;
        const numNodes = Math.ceil(resourceInfo.amount / MAX_STACK_SIZE);

        // Create multiple resource nodes if needed
        for (let i = 0; i < numNodes; i++) {
          // Calculate amount for this node (last node might have less)
          const nodeAmount =
            i === numNodes - 1
              ? resourceInfo.amount % MAX_STACK_SIZE || MAX_STACK_SIZE
              : MAX_STACK_SIZE;

          // Calculate a unique position for each node to prevent overlap
          // Use a spiral pattern around the original position
          const nodeAngle = (i / numNodes) * Math.PI * 2;
          const nodeDistance = 20 + i * 10; // Increasing distance for each node
          const nodeX = x + Math.cos(nodeAngle) * nodeDistance;
          const nodeY = y + Math.sin(nodeAngle) * nodeDistance;

          // Ensure this specific position isn't already used
          const nodeTileX = Math.floor(nodeX / TILE_SIZE);
          const nodeTileY = Math.floor(nodeY / TILE_SIZE);
          const nodeTileKey = `${nodeTileX},${nodeTileY}`;

          // Find an unused position nearby if this one is taken
          let finalX = nodeX;
          let finalY = nodeY;
          let attempts = 0;

          while (usedTilePositions.has(nodeTileKey) && attempts < 8) {
            // Try a slightly different angle and distance
            const adjustedAngle = nodeAngle + Math.random() * 0.5;
            const adjustedDistance = nodeDistance + Math.random() * 30;
            finalX = x + Math.cos(adjustedAngle) * adjustedDistance;
            finalY = y + Math.sin(adjustedAngle) * adjustedDistance;

            const finalTileX = Math.floor(finalX / TILE_SIZE);
            const finalTileY = Math.floor(finalY / TILE_SIZE);
            const finalTileKey = `${finalTileX},${finalTileY}`;

            if (!usedTilePositions.has(finalTileKey)) {
              usedTilePositions.add(finalTileKey);
              break;
            }

            attempts++;
          }

          // Create the resource node with the appropriate amount at the unique position
          const node = new ResourceNode(
            this,
            finalX,
            finalY,
            resourceDef,
            nodeAmount
          );
          this.resourceNodes.push(node);
        }
      }
    });
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
    this.robots.forEach((robot) =>
      robot.update(this.time.now, this.game.loop.delta)
    );

    // Check if we need to create more Optimus robots
    if (this.optimuses.length < 2) {
      this.createOptimusRobots(2 - this.optimuses.length);
    }

    // Make sure gameState.robots is always up to date
    gameState.robots = this.robots;
  }

  // Create a specific number of Optimus robots
  private createOptimusRobots(count: number): void {
    if (count <= 0) return;

    const isDelivery = this.robots.length > 0; // If we already have robots, this is a delivery

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

      // Set up health bar for the new robot
      if (this.healthBarRenderer) {
        const healthBar = this.healthBarRenderer.createHealthBar(
          optimus as any,
          -30
        );
        optimus.setHealthBar(healthBar);
      }
    }

    // Update the robots list in the menu
    this.updateRobotsListInMenu();

    // Show notification if this is a delivery
    if (isDelivery) {
      // Create a notification text
      const notification = this.add.text(
        this.cameras.main.centerX,
        100,
        `STARSHIP DELIVERED ${count} OPTIMUS ROBOTS`,
        {
          fontSize: "24px",
          color: "#00ffff",
          fontStyle: "bold",
          stroke: "#000000",
          strokeThickness: 4,
          shadow: {
            offsetX: 2,
            offsetY: 2,
            color: "#000000",
            blur: 2,
            stroke: true,
            fill: true,
          },
        }
      );
      notification.setOrigin(0.5);
      notification.setScrollFactor(0);
      notification.setDepth(1000);

      // Fade out and remove after a few seconds
      this.tweens.add({
        targets: notification,
        alpha: { from: 1, to: 0 },
        y: 80,
        duration: 3000,
        ease: "Power2",
        onComplete: () => {
          notification.destroy();
        },
      });
    }

    // Make sure gameState.robots is always up to date
    if ((window as any).gameState) {
      (window as any).gameState.robots = this.robots;
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

    // Add to gameState for enemies to target
    gameState.robots = this.robots;

    // If it's a mining drone, add it to the mining drones array
    if (robot instanceof MiningDrone) {
      this.miningDrones.push(robot as MiningDrone);
    }

    // If it's an optimus, add it to the optimuses array
    if (robot instanceof Optimus) {
      this.optimuses.push(robot as Optimus);
    }

    // Update the robots list in the action menu
    this.updateRobotsListInMenu();
  }

  // Update all buildings in the game
  private updateBuildings(time: number, delta: number): void {
    // Get all buildings from the BuildingManager
    const buildings = BuildingManager.getBuildings();

    // Debug log the buildings
    if (time % 5000 < 20) {
      // Log every ~5 seconds
      console.log(`BuildingManager has ${buildings.length} buildings:`);
      buildings.forEach((b, index) => {
        console.log(
          `  ${index}: ${b.type} at (${b.position.x}, ${b.position.y})`
        );
      });
    }

    // Get all building instances in the scene
    const buildingInstances = this.children
      .getChildren()
      .filter((child) => child instanceof Building);

    // Debug log if we have any regolith processors
    if (time % 5000 < 20) {
      const processors = buildingInstances.filter(
        (child) => child.constructor.name === "RegolithProcessor"
      );
      console.log(
        `Found ${processors.length} RegolithProcessor instances in the scene`
      );

      // Update all processors directly
      processors.forEach((processor) => {
        console.log(
          `Directly updating RegolithProcessor at (${processor.x}, ${processor.y})`
        );
        // Call the update method using bracket notation to avoid TypeScript errors
        (processor as any).update(time);
      });
    }

    // Loop through each building and update it
    buildings.forEach((buildingData: BuildingData) => {
      // Calculate the expected position in world coordinates
      const expectedX = buildingData.position.x * TILE_SIZE + TILE_SIZE / 2;
      const expectedY = buildingData.position.y * TILE_SIZE + TILE_SIZE / 2;

      // Find the building instance in the scene
      const buildingInstance = buildingInstances.find(
        (child) =>
          Math.abs(child.x - expectedX) < 10 &&
          Math.abs(child.y - expectedY) < 10
      );

      // Debug log if we found the building instance
      if (buildingData.type === "regolith-processor" && time % 5000 < 20) {
        console.log(
          `Looking for RegolithProcessor at (${expectedX}, ${expectedY})`
        );
        console.log(`Found instance: ${buildingInstance ? "YES" : "NO"}`);
      }

      // If we found the building instance, update it
      if (buildingInstance) {
        // Call the update method using bracket notation to avoid TypeScript errors
        (buildingInstance as any).update(time);

        // Update health bar
        if (buildingInstance.getHealthBar()) {
          this.healthBarRenderer.updateHealthBar(
            buildingInstance.getHealthBar()!,
            buildingInstance
          );
        }
      }
    });
  }

  // Clean up resources when the scene is destroyed
  shutdown() {
    // Clean up event listeners
    this.input.off("pointerdown");
    this.input.off("pointermove");
    if (this.input.keyboard) {
      this.input.keyboard.off("keydown");
    }

    // Clean up UI elements
    if (this.actionMenu) {
      // Clean up action menu if needed
    }

    if (this.resourceDisplay) {
      // Clean up resource display if needed
    }

    if (this.toolInventoryDisplay) {
      this.toolInventoryDisplay.destroy();
    }

    if (this.detailView) {
      this.detailView.destroy();
    }

    // Clean up player - skip if not initialized
    if (typeof this.player !== "undefined" && this.player !== null) {
      this.player.destroy();
    }

    // Clean up robots
    if (this.robots) {
      this.robots.forEach((robot) => {
        robot.destroy();
      });
    }

    // Clean up buildings
    if (this.buildings) {
      this.buildings.forEach((building) => {
        building.destroy();
      });
    }

    // Clean up blueprints
    if (this.blueprints) {
      this.blueprints.forEach((blueprint) => {
        blueprint.destroy();
      });
    }

    // Clean up enemies
    if (this.enemies) {
      this.enemies.forEach((enemy) => {
        enemy.destroy();
      });
    }

    // Clean up resource nodes
    if (this.resourceNodes) {
      this.resourceNodes.forEach((node) => {
        node.destroy();
      });
    }

    // Clean up terrain features
    if (this.terrainFeatures) {
      this.terrainFeatures.forEach((feature) => {
        feature.destroy();
      });
    }

    // Remove resize handler
    this.scale.off("resize", this.handleResize, this);

    // Remove habitat event listeners
    this.events.off("habitatPlaced", this.onHabitatPlaced, this);
    this.events.off("habitatExpanded", this.onHabitatExpanded, this);
    this.events.off("habitatUpdated", this.onHabitatUpdated, this);
    this.events.off(
      "habitatExpansionPlaced",
      this.onHabitatExpansionPlaced,
      this
    );

    // Remove custom event listeners
    if (typeof window !== "undefined") {
      window.removeEventListener("habitatMerged", (e: any) =>
        this.onHabitatMerged(e.detail)
      );
      window.removeEventListener("habitatSplit", (e: any) =>
        this.onHabitatSplit(e.detail)
      );
    }

    // Remove building destroyed event listener
    this.events.off("buildingDestroyed", this.onBuildingDestroyed, this);
  }

  private updateRobotsListInMenu() {
    // Get all robots and their information
    const robotsInfo = this.robots.map((robot) => {
      let carrying = "";

      // Check if the robot is an Optimus
      if (robot instanceof Optimus) {
        // Get the resource type and amount if carrying something
        if (
          (robot as any).getCarriedResource &&
          (robot as any).getCarriedResource()
        ) {
          const resourceType = (robot as any).getResourceType();
          const resourceAmount = (robot as any).getResourceAmount();
          carrying = `${resourceType} (${resourceAmount})`;
        }
      }

      // Check if the robot is a MiningDrone
      if (robot instanceof MiningDrone) {
        // Get the resource type and amount if carrying something
        const resourceAmount =
          (robot as any).getResourceAmount &&
          (robot as any).getResourceAmount();
        if (resourceAmount > 0) {
          carrying = `${(robot as any).getResourceType()} (${resourceAmount})`;
        }
      }

      return {
        name: (robot as any).getRobotName
          ? (robot as any).getRobotName()
          : "Unknown",
        type: robot instanceof Optimus ? "optimus" : "mining-drone",
        state: (robot as any).getRobotState
          ? (robot as any).getRobotState()
          : "unknown",
        carrying: carrying,
      };
    });

    // Update the robots list in the menu
    if (this.actionMenu) {
      this.actionMenu.updateRobotsList(robotsInfo);
    }
  }

  // Handle blueprint cancellation
  private handleBlueprintCanceled(blueprint: any): void {
    // Delegate to blueprint manager
    if (this.blueprintManager) {
      this.blueprintManager.handleBlueprintCanceled(blueprint);
    }
  }

  // Handle window resize events
  private handleResize(gameSize: Phaser.Structs.Size): void {
    // Resize UI elements
    if (this.toolInventoryDisplay) {
      this.toolInventoryDisplay.resize();
    }

    // Log resize event for debugging
    console.log("Game resized to:", gameSize.width, gameSize.height);
  }

  // Habitat event handlers
  private onHabitatPlaced(data: {
    startX: number;
    startY: number;
    width: number;
    height: number;
  }): void {
    if (this.habitatManager) {
      this.habitatManager.onHabitatPlaced(data);
    }
  }

  private onHabitatExpanded(data: {
    habitatId: string;
    newTiles: { x: number; y: number }[];
  }): void {
    if (this.habitatManager) {
      this.habitatManager.onHabitatExpanded(data);
    }
  }

  private onHabitatUpdated(data: { habitatId: string }): void {
    if (this.habitatManager) {
      this.habitatManager.onHabitatUpdated(data);
    }
  }

  private onHabitatExpansionPlaced(data: {
    startX: number;
    startY: number;
    width: number;
    height: number;
    expansionId: string;
    targetHabitatId: string;
    tiles: { x: number; y: number }[];
  }): void {
    if (this.habitatManager) {
      this.habitatManager.onHabitatExpansionPlaced(data);
    }
  }

  private onHabitatMerged(data: {
    primaryHabitatId: string;
    mergedHabitatId: string;
  }): void {
    if (this.habitatManager) {
      this.habitatManager.onHabitatMerged(data);

      // Update the buildings reference in the habitat manager
      this.habitatManager.updateBuildings(this.buildings);
    }
  }

  private onHabitatSplit(data: {
    originalHabitatId: string;
    newHabitatId: string;
  }): void {
    if (this.habitatManager) {
      this.habitatManager.onHabitatSplit(data);
    }
  }

  // Building event handlers
  private onBuildingDestroyed(building: Building): void {
    // Remove the building from our list
    const index = this.buildings.indexOf(building);
    if (index !== -1) {
      this.buildings.splice(index, 1);
    }

    // Remove the building from the scene
    building.destroy();

    // Show destruction effect
    this.showDestructionEffect(building.x, building.y);
  }

  // Update references in managers when collections change
  private updateManagerReferences(): void {
    if (this.habitatManager) {
      this.habitatManager.updateBuildings(this.buildings);
    }

    if (this.jobManager) {
      this.jobManager.updateReferences(
        this.robots,
        this.resourceNodes,
        this.blueprints
      );
    }

    if (this.blueprintManager) {
      this.blueprintManager.updateReferences(this.blueprints, this.buildings);
    }

    if (this.enemyManager) {
      this.enemyManager.updateReferences(this.enemies);
    }
  }

  // Add a method to show destruction effect
  private showDestructionEffect(x: number, y: number): void {
    // Create a particle emitter for the destruction effect
    const particles = this.add.particles(x, y, "flare", {
      speed: { min: 50, max: 150 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.4, end: 0 },
      lifespan: 500,
      tint: [0xff0000, 0xff7700, 0xffff00],
      blendMode: "ADD",
      frequency: -1, // Emit all particles at once
      quantity: 20,
    });

    // Emit particles once
    particles.explode();

    // Destroy the emitter after a short delay
    this.time.delayedCall(1000, () => {
      particles.destroy();
    });
  }
}
