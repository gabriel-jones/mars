import * as Phaser from "phaser";
import {
  createPlayer,
  setupControls,
  updatePlayerMovement,
} from "../entities/player";
import { createTileHighlight, updateTileHighlight } from "../ui";
import { gameState } from "../state";
import { BuildMenu } from "../ui/buildMenu";
import { ResourceDisplay } from "../ui/resourceDisplay";
import { TerrainHighlight } from "../ui/terrainHighlight";
import { createMarsTileset, createTerrain } from "../terrain";
import { ResourceNode, ResourceNodeType } from "../entities/resourceNode";
import { RESOURCE_DEFINITIONS } from "../data/resources";
import { TILE_SIZE } from "../config";
import { TileType, tileData } from "../data/tiles";
import { BUILDING_DEFINITIONS, BuildingType } from "../data/buildings";

export class MainScene extends Phaser.Scene {
  private buildMenu: BuildMenu;
  private resourceDisplay: ResourceDisplay;
  private uiCamera: Phaser.Cameras.Scene2D.Camera;
  private terrainHighlight: TerrainHighlight;
  private resourceNodes: ResourceNode[] = [];
  private spawnPoint: Phaser.Math.Vector2;
  private map: Phaser.Tilemaps.Tilemap;
  private tileGroup: Phaser.GameObjects.Group | null = null;

  constructor() {
    super({ key: "MainScene" });
  }

  preload() {
    this.load.image("player", "assets/player.png");

    // Load construction assets
    this.load.image("habitat", "assets/habitat.png");
    this.load.image("solar-panel", "assets/solar-panel.png");

    // Load resource icons
    this.load.image("iron-icon", "assets/iron-icon.png");
    this.load.image("water-icon", "assets/water-icon.png");
    this.load.image("oxygen-icon", "assets/oxygen-icon.png");

    // Tileset
    createMarsTileset(this);

    this.load.image("ice_deposit", "assets/ice_deposit.png");
    this.load.image("ice_drill", "assets/ice_drill.png");

    // Load resource node sprites
    this.load.image("ice_deposit", "assets/ice_deposit.png");
    this.load.image("coal_deposit", "assets/coal_deposit.png");
    this.load.image("iron_deposit", "assets/iron_deposit.png");

    // Load building sprites
    this.load.image("ice-drill", "assets/ice-drill.png");
    this.load.image("coal-mine", "assets/coal-mine.png");
  }

  create() {
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

    // Create terrain highlight
    this.terrainHighlight = new TerrainHighlight(this);

    // Create the player at the spawn point
    this.spawnPoint = new Phaser.Math.Vector2(
      gameState.player.x,
      gameState.player.y
    );

    // Add resource nodes near the spawn point
    this.addResourceNodesNearSpawn();

    // Place ice deposits on specific tiles
    this.placeIceDepositsOnTiles();
  }

  update(time: number, delta: number) {
    // Update player movement
    updatePlayerMovement(
      gameState.player,
      gameState.cursors,
      gameState.wasdKeys
    );

    // Update tile highlight
    gameState.currentTilePos = updateTileHighlight(
      this,
      gameState.highlightRect,
      gameState.map,
      gameState.currentTilePos
    );

    // Update build menu
    this.buildMenu.update();

    // Update resource display
    this.resourceDisplay.update();

    // Make resource nodes react to player movement
    this.updateResourceNodePhysics();
  }

  private handleItemPlaced(itemName: string, x: number, y: number) {
    // Create the actual building/item sprite
    const newBuilding = this.add.sprite(x, y, itemName).setDisplaySize(64, 64); // Set to tile size

    console.log(
      `Placed ${itemName} at tile (${Math.floor(x / 64)}, ${Math.floor(
        y / 64
      )})`
    );
  }

  private addResourceNodesNearSpawn(): void {
    // Add water nodes
    for (let i = 0; i < 3; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 100 + Math.random() * 150;
      const x = this.spawnPoint.x + Math.cos(angle) * distance;
      const y = this.spawnPoint.y + Math.sin(angle) * distance;

      const waterNode = new ResourceNode(
        this,
        x,
        y,
        RESOURCE_DEFINITIONS.find((x) => x.type === "water")!,
        1000 + Math.floor(Math.random() * 1000)
      );
      this.resourceNodes.push(waterNode);
    }
  }

  private updateResourceNodePhysics(): void {
    const playerX = gameState.player.x;
    const playerY = gameState.player.y;
    const proximityRadius = 80; // Reduce radius for more localized effect

    // Only proceed if player is moving
    if (
      gameState.player.body!.velocity.x !== 0 ||
      gameState.player.body!.velocity.y !== 0
    ) {
      // Check each resource node
      this.resourceNodes.forEach((node) => {
        const distance = Phaser.Math.Distance.Between(
          playerX,
          playerY,
          node.x,
          node.y
        );

        // If player is close to the node, apply gentle force
        if (distance < proximityRadius) {
          // Force strength is inversely proportional to distance
          // Use a smaller multiplier for gentler movement
          const strength = 16 * (1 - distance / proximityRadius);
          node.applyForce(playerX, playerY, strength);
        }
      });
    }
    // Add collisions between resource nodes
    // this.physics.add.collider(this.resourceNodes, this.resourceNodes);
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
        // You might want to check specific tile properties or types
        if (tile && this.isValidTileForIceDeposit(tile)) {
          validTiles.push(tile);
        }
      }
    }

    // Create the tile group if it doesn't exist
    if (!this.tileGroup) {
      this.tileGroup = this.add.group();
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

        // Create the ice deposit at this position
        const iceDeposit = this.add.rectangle(
          worldX,
          worldY,
          TILE_SIZE,
          TILE_SIZE,
          parseInt(tileData[TileType.ICE_DEPOSIT].color.replace("#", "0x")),
          0.7 // Add some transparency to see the underlying tile
        );

        // Add an icon if available
        if (tileData[TileType.ICE_DEPOSIT].icon) {
          this.add
            .text(worldX, worldY, tileData[TileType.ICE_DEPOSIT].icon, {
              fontSize: "20px",
            })
            .setOrigin(0.5);
        }

        // Store the tile type information
        iceDeposit.setData("type", TileType.ICE_DEPOSIT);

        // Add to the group for easier management
        this.tileGroup.add(iceDeposit);

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
}
