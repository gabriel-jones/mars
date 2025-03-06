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

export class MainScene extends Phaser.Scene {
  private actionMenu: ActionMenu;
  private resourceDisplay: ResourceDisplay;
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

    // Enemies
    this.load.image("ufo", "assets/ufo.png");
    this.load.image("alien", "assets/alien.png");

    // Particles
    this.load.image("flare", "assets/flare-2.png"); // Particle effect for mining

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

    // Setup controls
    const controls = setupControls(this);
    gameState.cursors = controls.cursors;
    gameState.wasdKeys = controls.wasdKeys;

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

    // Create enemies
    this.createEnemies();

    // Store current tile position in registry for robot panel to access
    this.registry.set("player", gameState.player);
    this.registry.set("currentTilePos", gameState.currentTilePos);
  }

  update(time: number, delta: number) {
    // Update FPS counter
    this.fpsText.setText(`FPS: ${Math.round(this.game.loop.actualFps)}`);

    // Update player movement
    if (gameState.player) {
      if (this.player) {
        // Use the new Player class update method
        this.player.update(time, delta);

        // Log shadow update for debugging
        if (time % 1000 < 20) {
          console.log("Player update called, shadows should be updating");
        }
      } else {
        // Fallback to the old function for backward compatibility
        updatePlayerMovement(
          gameState.player,
          gameState.cursors,
          gameState.wasdKeys,
          time
        );
      }
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

    // Update UI elements
    this.actionMenu.update();

    // Update the robots list if the panel is open
    if (this.actionMenu.isRobotsPanelOpen) {
      this.updateRobotsListInMenu();
    }

    // Update resource display
    this.resourceDisplay.update();

    // Update all robots
    this.updateRobots();

    // Update all buildings
    this.updateBuildings(time, delta);

    // Update all blueprints
    this.updateBlueprints(time, delta);

    // Update resource node physics
    this.updateResourceNodePhysics();

    // Periodically check for resource delivery jobs (every 2 seconds)
    if (time % 2000 < 20) {
      this.createResourceDeliveryJobs();
    }

    // Clean up completed jobs every 10 seconds
    if (time % 10000 < 100) {
      JobManager.getInstance().cleanupCompletedJobs();
    }

    // Update enemies
    this.updateEnemies(time, delta);

    // Update registry values
    this.registry.set("currentTilePos", gameState.currentTilePos);
  }

  private handleItemPlaced(itemName: string, x: number, y: number) {
    // Convert world coordinates to tile coordinates for logging
    const tileX = Math.floor(x / TILE_SIZE);
    const tileY = Math.floor(y / TILE_SIZE);

    // Check if this is a blueprint request
    if (itemName.startsWith("blueprint-")) {
      // Extract the actual building type from the blueprint request
      const buildingType = itemName.replace("blueprint-", "") as BuildingType;

      console.log(
        `Creating blueprint for ${buildingType} at (${tileX}, ${tileY})`
      );

      // Create a blueprint using the factory
      const blueprint = BuildingFactory.createBlueprint(
        this,
        x,
        y,
        buildingType
      );

      // Add to our blueprints list
      this.blueprints.push(blueprint);

      console.log(
        `Placed blueprint for ${buildingType} at tile (${tileX}, ${tileY}) with size ${blueprint.tileWidth}x${blueprint.tileHeight}`
      );
    } else {
      // This branch should only be used for direct building placement (not through the build menu)
      console.log(
        `Creating actual building ${itemName} at (${tileX}, ${tileY})`
      );

      // Create the actual building using the factory with the provided position
      const building = BuildingFactory.createBuilding(
        this,
        x,
        y,
        itemName as BuildingType
      );

      // Add to our buildings list
      this.buildings.push(building);

      console.log(
        `Placed ${itemName} at tile (${tileX}, ${tileY}) with size ${building.tileWidth}x${building.tileHeight}`
      );
    }
  }

  // Update all blueprints and check if any are complete
  private updateBlueprints(time: number, delta: number): void {
    // Update all blueprints
    for (let i = this.blueprints.length - 1; i >= 0; i--) {
      const blueprint = this.blueprints[i];
      blueprint.update(time, delta);

      // Check if the blueprint is complete and should be converted to a real building
      if (blueprint.isComplete()) {
        // Get the building type and position
        const buildingType = blueprint.buildingType;
        const x = blueprint.x;
        const y = blueprint.y;

        // Remove the blueprint
        blueprint.destroy();
        this.blueprints.splice(i, 1);

        // Create the actual building
        const building = BuildingFactory.createBuilding(
          this,
          x,
          y,
          buildingType
        );

        // Add to our buildings list
        this.buildings.push(building);

        console.log(
          `Blueprint complete! Created ${buildingType} at (${x}, ${y})`
        );
      }
    }

    // Periodically check for resource delivery jobs (every 5 seconds)
    if (time % 5000 < 20) {
      this.createResourceDeliveryJobs();
    }
  }

  // Create resource delivery jobs for blueprints
  private createResourceDeliveryJobs(): void {
    // Skip if no blueprints
    if (this.blueprints.length === 0) return;

    console.log(
      `Checking for resource delivery jobs for ${this.blueprints.length} blueprints`
    );

    // Get the job manager
    const jobManager = JobManager.getInstance();

    // Get existing delivery jobs to avoid creating duplicates
    const existingDeliveryJobs = Array.from(
      jobManager.getAllJobs().values()
    ).filter(
      (job) =>
        (job as Job).type === JobType.DELIVER_RESOURCE &&
        !(job as Job).completed
    ) as Job[];

    // Skip if we already have active delivery jobs
    if (existingDeliveryJobs.length >= this.optimuses.length) {
      console.log(
        `Already have ${existingDeliveryJobs.length} active delivery jobs, skipping`
      );
      return;
    }

    // Get all resource nodes
    const resourceNodes = ResourceNode.getAllNodes();
    console.log(`Found ${resourceNodes.length} resource nodes`);

    // Group resource nodes by type
    const nodesByType: { [key: string]: ResourceNode[] } = {};
    resourceNodes.forEach((node) => {
      const resourceType = node.getResource().type;
      if (!nodesByType[resourceType]) {
        nodesByType[resourceType] = [];
      }
      nodesByType[resourceType].push(node);
    });

    // Log available resource types
    console.log("Available resource types:", Object.keys(nodesByType));

    // Check each blueprint for needed resources
    for (const blueprint of this.blueprints) {
      console.log(`Checking blueprint for ${blueprint.buildingType}`);

      // Get the required resources for this blueprint
      const requiredResources = blueprint.getRequiredResources();
      console.log(
        `Blueprint requires ${requiredResources.length} resource types`
      );

      // For each required resource
      for (const req of requiredResources) {
        console.log(
          `Checking resource ${req.type}: ${req.current}/${req.amount}`
        );

        // Skip if we already have enough
        if (req.current >= req.amount) {
          console.log(`Already have enough ${req.type}`);
          continue;
        }

        // Check if there's already a job for this blueprint and resource type
        const existingJob = existingDeliveryJobs.find(
          (job) => job.blueprint === blueprint && job.resourceType === req.type
        );

        if (existingJob) {
          console.log(`Already have a job for ${req.type} to this blueprint`);
          continue;
        }

        // Find resource nodes of this type
        const nodes = nodesByType[req.type] || [];
        console.log(`Found ${nodes.length} nodes of type ${req.type}`);

        // Skip if no nodes of this type
        if (nodes.length === 0) {
          console.log(`No nodes of type ${req.type} available`);
          continue;
        }

        // Find a node that isn't already part of a job
        const availableNode = nodes.find(
          (node) => !jobManager.isNodeInJob(node)
        );

        // Skip if no available nodes
        if (!availableNode) {
          console.log(`No available nodes of type ${req.type} (all in use)`);
          continue;
        }

        // Calculate how much we need
        const amountNeeded = req.amount - req.current;

        // Calculate how much we can get from this node
        const amountAvailable = Math.min(
          availableNode.getAmount(),
          amountNeeded
        );

        // Skip if node is empty
        if (amountAvailable <= 0) {
          console.log(`Node of type ${req.type} is empty`);
          continue;
        }

        console.log(`Creating delivery job for ${amountAvailable} ${req.type}`);

        // Create a resource delivery job
        jobManager.createResourceDeliveryJob(
          availableNode,
          blueprint,
          req.type,
          amountAvailable
        );

        // Only create one job at a time to avoid overwhelming the system
        return;
      }
    }
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
      }
    });
  }

  // Clean up resources when the scene is destroyed
  shutdown() {
    // Clean up player dust effects
    if (this.player) {
      // Player class handles its own cleanup
    } else if (gameState.player) {
      cleanupPlayerDustEffects(gameState.player);
    }

    // Clean up the resource display
    if (this.resourceDisplay) {
      this.resourceDisplay.destroy();
    }

    // Clean up other resources as needed
  }

  private updateRobotsListInMenu() {
    // Get all robots and their information
    const robotsInfo = this.robots.map((robot) => {
      let carrying = "";

      // Check if the robot is an Optimus
      if (robot instanceof Optimus) {
        // Get the resource type and amount if carrying something
        if (robot.getCarriedResource()) {
          const resourceType = robot.getResourceType();
          const resourceAmount = robot.getResourceAmount();
          carrying = `${resourceType} (${resourceAmount})`;
        }
      }

      // Check if the robot is a MiningDrone
      if (robot instanceof MiningDrone) {
        // Get the resource type and amount if carrying something
        const resourceAmount = robot.getResourceAmount();
        if (resourceAmount > 0) {
          carrying = `${robot.getResourceType()} (${resourceAmount})`;
        }
      }

      return {
        name: robot.getRobotName(),
        type: robot instanceof Optimus ? "optimus" : "mining-drone",
        state: robot.getRobotState(),
        carrying: carrying,
      };
    });

    // Update the robots list in the menu
    this.actionMenu.updateRobotsList(robotsInfo);
  }

  // Create enemies
  private createEnemies(): void {
    // Create UFO enemies at random positions around the map
    const enemyCount = 5;

    for (let i = 0; i < enemyCount; i++) {
      // Generate random position at the edges of the map
      let x, y;
      const mapWidth = this.map.widthInPixels;
      const mapHeight = this.map.heightInPixels;
      const margin = 200; // Keep enemies away from the center initially

      // Randomly choose which edge to spawn on
      const edge = Phaser.Math.Between(0, 3);

      switch (edge) {
        case 0: // Top edge
          x = Phaser.Math.Between(margin, mapWidth - margin);
          y = Phaser.Math.Between(margin, margin * 2);
          break;
        case 1: // Right edge
          x = Phaser.Math.Between(mapWidth - margin * 2, mapWidth - margin);
          y = Phaser.Math.Between(margin, mapHeight - margin);
          break;
        case 2: // Bottom edge
          x = Phaser.Math.Between(margin, mapWidth - margin);
          y = Phaser.Math.Between(mapHeight - margin * 2, mapHeight - margin);
          break;
        case 3: // Left edge
          x = Phaser.Math.Between(margin, margin * 2);
          y = Phaser.Math.Between(margin, mapHeight - margin);
          break;
        default:
          x = margin;
          y = margin;
      }

      // Create a UFO enemy
      const ufo = new Alien(
        this,
        x,
        y,
        80, // maxHealth
        70 + Phaser.Math.Between(-10, 10), // speed with slight variation
        120, // attackRange
        15, // attackDamage
        1500 // attackCooldown
      );

      this.enemies.push(ufo);
    }

    // Add enemies to gameState
    gameState.enemies = this.enemies;

    console.log(`Created ${this.enemies.length} enemies`);
  }

  // Update enemies
  private updateEnemies(time: number, delta: number): void {
    // Update each enemy
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];

      // Update the enemy
      enemy.update(time, delta);
    }

    // Update gameState.enemies
    gameState.enemies = this.enemies;
  }
}
