import Phaser from "phaser";
import { createMarsTileset, createTerrain } from "../terrain";
import { createPlayer, setupControls, updatePlayerMovement } from "../player";
import { createTileHighlight, updateTileHighlight } from "../ui";
import { gameState } from "../state";
import { BuildMenu } from "../ui/buildMenu";
import { BuildingManager } from "../data/buildings";
import { ResourceDisplay } from "../ui/resourceDisplay";
import Player from "../player";

export class MainScene extends Phaser.Scene {
  private buildMenu: BuildMenu;
  private resourceDisplay: ResourceDisplay;
  player: Player;
  private uiCamera: Phaser.Cameras.Scene2D.Camera;

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
      this.handleItemPlaced.bind(this),
      this.uiCamera
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
}
