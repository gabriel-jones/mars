import Phaser from "phaser";
import { gameState } from "../state";
import { DEFAULT_FONT } from "../constants";
import { DEPTH } from "../depth";
import {
  ResourceType,
  ResourceCount,
  RESOURCE_DEFINITIONS,
} from "../data/resources";
import { EnemyManager } from "../mechanics/EnemyManager";
import { RaidManager } from "../mechanics/RaidManager";
import { RobotManager } from "../mechanics/RobotManager";

export class DebugMenu {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private isVisible: boolean = false;
  private enemyManager: EnemyManager;
  private raidManager: RaidManager;
  private robotManager: RobotManager;
  private buttons: Phaser.GameObjects.Container[] = [];

  constructor(
    scene: Phaser.Scene,
    enemyManager: EnemyManager,
    raidManager: RaidManager,
    robotManager: RobotManager
  ) {
    this.scene = scene;
    this.enemyManager = enemyManager;
    this.raidManager = raidManager;
    this.robotManager = robotManager;

    // Create container for the debug menu
    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(DEPTH.UI + 200); // Ensure it's on top of everything

    // Create background
    const background = this.scene.add.rectangle(
      0,
      0,
      300,
      500,
      0x000000,
      0.9 // Increased opacity for better visibility
    );
    background.setOrigin(0, 0);
    this.container.add(background);

    // Create title
    const title = this.scene.add.text(10, 10, "DEBUG MENU", {
      fontFamily: DEFAULT_FONT,
      fontSize: "24px",
      color: "#FF0000",
      fontStyle: "bold",
    });
    this.container.add(title);

    // Create close button
    const closeButton = this.scene.add.text(270, 10, "X", {
      fontFamily: DEFAULT_FONT,
      fontSize: "24px",
      color: "#FFFFFF",
      fontStyle: "bold",
    });
    closeButton.setInteractive({ useHandCursor: true });
    closeButton.on("pointerdown", () => {
      console.log("Close button clicked, hiding debug menu");
      this.hide();
    });
    this.container.add(closeButton);

    // Create buttons
    this.createButtons();

    // Position the container in the top right corner
    this.container.setPosition(this.scene.cameras.main.width - 310, 10);

    // Hide the menu initially
    this.isVisible = false;
    this.container.setVisible(false);

    // Make sure the container is not ignored by the UI camera
    const mainScene = this.scene as any;
    if (mainScene.uiCamera) {
      // Ensure the UI camera doesn't ignore the debug menu
      const objectsToIgnore = [
        mainScene.gameState?.player,
        mainScene.gameState?.groundLayer,
      ].filter(Boolean);
      mainScene.uiCamera.ignore(objectsToIgnore);

      // Make sure the main camera ignores the debug menu
      mainScene.cameras.main.ignore([this.container]);
    }

    // Log that the debug menu was created
    console.log("Debug menu initialized:", {
      position: { x: this.scene.cameras.main.width - 310, y: 10 },
      isVisible: this.isVisible,
      depth: this.container.depth,
    });
  }

  private createButtons(): void {
    // Start a raid button
    this.addButton("Start a Raid", 60, () => {
      if (this.raidManager) {
        (this.raidManager as any).spawnRaid();
      }
    });

    // Spawn enemy button
    this.addButton("Spawn Enemy", 110, () => {
      if (this.enemyManager) {
        this.enemyManager.createEnemies(1);
      }
    });

    // Add money button
    this.addButton("Add 1,000,000 Money", 160, () => {
      gameState.money += 1_000_000;
    });

    // Add Optimus robot button
    this.addButton("Spawn Optimus Robot", 210, () => {
      if (this.robotManager) {
        const spawnPoint = gameState.player.getCenter();
        this.robotManager.createOptimusRobots(1);
      }
    });

    // Add Mining Drone button
    this.addButton("Spawn Mining Drone", 260, () => {
      if (this.robotManager) {
        console.log(
          "Mining drone creation not directly available in RobotManager"
        );
      }
    });

    // Add resource buttons
    let yPos = 310;
    const resourceTypes: ResourceType[] = [
      "iron",
      "silicon",
      "titanium",
      "aluminium",
      "water",
      "oxygen",
    ];

    resourceTypes.forEach((resourceType) => {
      this.addButton(
        `Add 100 ${this.capitalizeFirstLetter(resourceType)}`,
        yPos,
        () => {
          // Find the resource in the inventory or add it
          const resourceIndex = gameState.resources.inventory.findIndex(
            (r: ResourceCount) => r.type === resourceType
          );

          if (resourceIndex >= 0) {
            gameState.resources.inventory[resourceIndex].amount += 100;
          } else {
            gameState.resources.inventory.push({
              type: resourceType,
              amount: 100,
            });
          }

          // Emit resource change event
          gameState.resources.events.emit("resourcesChanged");
        }
      );

      yPos += 50;
    });

    // Adjust background height based on number of buttons
    const background = this.container.getAt(0) as Phaser.GameObjects.Rectangle;
    background.height = yPos + 10;
  }

  private addButton(
    text: string,
    yPosition: number,
    callback: () => void
  ): void {
    // Create button container
    const buttonContainer = this.scene.add.container(10, yPosition);

    // Create button background
    const buttonBg = this.scene.add.rectangle(0, 0, 280, 40, 0x333333, 1);
    buttonBg.setOrigin(0, 0);
    buttonContainer.add(buttonBg);

    // Create button text
    const buttonText = this.scene.add.text(10, 10, text, {
      fontFamily: DEFAULT_FONT,
      fontSize: "16px",
      color: "#FFFFFF",
    });
    buttonContainer.add(buttonText);

    // Make button interactive
    buttonBg.setInteractive({ useHandCursor: true });
    buttonBg.on("pointerdown", callback);

    // Add hover effect
    buttonBg.on("pointerover", () => {
      buttonBg.setFillStyle(0x555555);
    });

    buttonBg.on("pointerout", () => {
      buttonBg.setFillStyle(0x333333);
    });

    // Add to container and buttons array
    this.container.add(buttonContainer);
    this.buttons.push(buttonContainer);
  }

  public toggle(): void {
    this.isVisible = !this.isVisible;
    this.container.setVisible(this.isVisible);
    this.container.setDepth(DEPTH.UI + 200); // Ensure it's on top of everything
    console.log(`Debug menu toggled: ${this.isVisible ? "visible" : "hidden"}`);

    // Log the container's position and visibility
    console.log("Debug menu container:", {
      x: this.container.x,
      y: this.container.y,
      visible: this.container.visible,
      depth: this.container.depth,
      width: (this.container.getAt(0) as Phaser.GameObjects.Rectangle).width,
      height: (this.container.getAt(0) as Phaser.GameObjects.Rectangle).height,
    });
  }

  public show(): void {
    this.isVisible = true;
    this.container.setVisible(true);
    this.container.setDepth(DEPTH.UI + 200); // Ensure it's on top of everything
    console.log("Debug menu shown");
  }

  public hide(): void {
    this.isVisible = false;
    this.container.setVisible(false);
    console.log("Debug menu hidden");
  }

  public getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  public handleResize(width: number, height: number): void {
    // Reposition the container in the top right corner
    this.container.setPosition(width - 310, 10);
  }

  private capitalizeFirstLetter(string: string): string {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }
}
