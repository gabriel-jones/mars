import Phaser from "phaser";
import { gameState } from "../state";
import { DEFAULT_FONT } from "../constants";
import { DEPTH } from "../depth";
import {
  ResourceType,
  ResourceCount,
  RESOURCE_DEFINITIONS,
  ResourceManager,
} from "../data/resources";
import { EnemyManager } from "../mechanics/EnemyManager";
import { RaidManager } from "../mechanics/RaidManager";
import { RobotManager } from "../mechanics/RobotManager";
import { EnergyManager } from "../mechanics/EnergyManager";
import { ResourceDisplay } from "../ui/resourceDisplay";

export class DebugMenu {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private isVisible: boolean = false;
  private enemyManager: EnemyManager;
  private raidManager: RaidManager;
  private robotManager: RobotManager;
  private resourceDisplay: ResourceDisplay | null = null;
  private buttons: Phaser.GameObjects.Container[] = [];
  private debugButtonBg: Phaser.GameObjects.Rectangle | null = null;
  private debugButtonText: Phaser.GameObjects.Text | null = null;

  constructor(
    scene: Phaser.Scene,
    enemyManager: EnemyManager,
    raidManager: RaidManager,
    robotManager: RobotManager,
    resourceDisplay?: ResourceDisplay
  ) {
    this.scene = scene;
    this.enemyManager = enemyManager;
    this.raidManager = raidManager;
    this.robotManager = robotManager;
    this.resourceDisplay = resourceDisplay || null;

    console.log("Creating debug menu with managers:", {
      enemyManager: !!enemyManager,
      raidManager: !!raidManager,
      robotManager: !!robotManager,
      resourceDisplay: !!resourceDisplay,
    });

    // Create container for the debug menu
    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(DEPTH.UI + 200); // Ensure it's on top of everything
    this.container.setName("debugMenuContainer");
    this.container.setScrollFactor(0);

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
    background.setScrollFactor(0);
    this.container.add(background);

    // Create title background
    const titleBg = this.scene.add.rectangle(0, 0, 300, 40, 0xff0000, 0.8);
    titleBg.setOrigin(0, 0);
    titleBg.setScrollFactor(0);
    this.container.add(titleBg);

    // Create title
    const title = this.scene.add.text(10, 10, "DEBUG MENU", {
      fontFamily: DEFAULT_FONT,
      fontSize: "24px",
      color: "#FFFFFF",
      fontStyle: "bold",
    });
    title.setScrollFactor(0);
    this.container.add(title);

    // Create close button
    const closeButton = this.scene.add.text(270, 10, "X", {
      fontFamily: DEFAULT_FONT,
      fontSize: "24px",
      color: "#FFFFFF",
      fontStyle: "bold",
    });
    closeButton.setScrollFactor(0);
    closeButton.setInteractive({ useHandCursor: true });
    closeButton.on("pointerdown", () => {
      console.log("Close button clicked, hiding debug menu");
      this.hide();
      // Reset debug button appearance if it exists
      if (this.debugButtonBg && this.debugButtonText) {
        this.debugButtonBg.setFillStyle(0xff0000, 0.8);
        this.debugButtonText.setText("DEBUG");
      }
    });
    this.container.add(closeButton);

    // Create buttons
    this.createButtons();

    // Position the container in the top right corner
    this.container.setPosition(this.scene.cameras.main.width - 310, 10);

    // Hide the menu initially
    this.isVisible = false;
    this.container.setVisible(false);

    // Handle camera setup
    const mainScene = this.scene as any;
    if (mainScene.uiCamera) {
      // Make sure the UI camera doesn't ignore the debug menu
      mainScene.uiCamera.ignore([]);

      // Make sure the main camera ignores the debug menu
      mainScene.cameras.main.ignore([this.container]);
    }

    // Log that the debug menu was created
    console.log("Debug menu initialized:", {
      position: { x: this.scene.cameras.main.width - 310, y: 10 },
      isVisible: this.isVisible,
      depth: this.container.depth,
      containerChildren: this.container.length,
      containerVisible: this.container.visible,
    });

    // Schedule a delayed check to ensure the menu is properly initialized
    this.scene.time.delayedCall(500, this.checkMenuVisibility, [], this);
  }

  private createButtons(): void {
    // Start a raid button
    this.addButton("Start a Raid", 60, () => {
      if (this.raidManager) {
        console.log("Starting a raid");
        (this.raidManager as any).spawnRaid();
      }
    });

    // Spawn enemy button
    this.addButton("Spawn Enemy", 110, () => {
      if (this.enemyManager) {
        console.log("Spawning an enemy");
        this.enemyManager.createEnemies(1);
      }
    });

    // Add money button
    this.addButton("Add 1,000,000 Money", 160, () => {
      console.log("Adding money");
      gameState.money += 1_000_000;
    });

    // Add Optimus robot button
    this.addButton("Spawn Optimus Robot", 210, () => {
      if (this.robotManager) {
        console.log("Spawning Optimus robot");
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
        `Add 1000 ${this.capitalizeFirstLetter(resourceType)}`,
        yPos,
        () => {
          console.log(`Adding 1000 ${resourceType}`);
          ResourceManager.addResource(resourceType, 1000);
        }
      );
      yPos += 50;
    });

    // Add resource display check button
    if (this.resourceDisplay) {
      this.addButton("Check Resource Display", yPos, () => {
        console.log(
          "Resource display containers:",
          this.resourceDisplay?.getContainer().length
        );
        console.log(
          "Resource display map:",
          (this.resourceDisplay as any)["resourceDisplays"]
        );

        // Force update the resource display
        this.resourceDisplay?.update();
      });
      yPos += 50;
    }

    // Add energy display update button
    this.addButton("Update Energy Display", yPos, () => {
      // Force add energy if it doesn't exist
      if (ResourceManager.getResourceAmount("energy") === 0) {
        ResourceManager.addResource("energy", 1000);
      }

      // Force update the resource display
      this.resourceDisplay?.update();

      // Log the current energy state
      console.log("Energy production:", EnergyManager.getEnergyProduction());
      console.log("Energy consumption:", EnergyManager.getEnergyConsumption());
      console.log("Energy balance:", EnergyManager.getEnergyBalance());
    });
    yPos += 50;

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
    buttonContainer.setScrollFactor(0);

    // Create button background
    const buttonBg = this.scene.add.rectangle(0, 0, 280, 40, 0x333333, 1);
    buttonBg.setOrigin(0, 0);
    buttonBg.setScrollFactor(0);
    buttonContainer.add(buttonBg);

    // Create button text
    const buttonText = this.scene.add.text(10, 10, text, {
      fontFamily: DEFAULT_FONT,
      fontSize: "16px",
      color: "#FFFFFF",
    });
    buttonText.setScrollFactor(0);
    buttonContainer.add(buttonText);

    // Make button interactive
    buttonBg.setInteractive({ useHandCursor: true });
    buttonBg.on("pointerdown", () => {
      console.log(`Button clicked: ${text}`);
      callback();
    });

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

    console.log(
      `Added button: ${text} at y=${yPosition}, container now has ${this.container.length} children`
    );
  }

  public createDebugButton(): void {
    console.log("Creating debug button");

    // Create debug button in the top right corner
    const buttonX = this.scene.cameras.main.width - 100;
    const buttonY = 10;

    // Create button background
    this.debugButtonBg = this.scene.add.rectangle(
      buttonX,
      buttonY,
      90,
      30,
      0xff0000,
      0.8
    );
    this.debugButtonBg.setOrigin(0, 0);
    this.debugButtonBg.setScrollFactor(0);
    this.debugButtonBg.setDepth(DEPTH.UI + 150);
    this.debugButtonBg.setInteractive({ useHandCursor: true });

    // Create button text
    this.debugButtonText = this.scene.add.text(
      buttonX + 10,
      buttonY + 5,
      "DEBUG",
      {
        fontFamily: DEFAULT_FONT,
        fontSize: "16px",
        color: "#FFFFFF",
        fontStyle: "bold",
      }
    );
    this.debugButtonText.setScrollFactor(0);
    this.debugButtonText.setDepth(DEPTH.UI + 151);

    // Make sure the button is visible in the UI camera
    const mainScene = this.scene as any;
    if (mainScene.uiCamera) {
      mainScene.uiCamera.ignore([]);
    }

    // Add click handler to the button background
    this.debugButtonBg.on("pointerdown", () => {
      console.log("Debug button clicked!");
      // Toggle menu visibility
      this.toggle();
      console.log("Debug menu visible after toggle:", this.isVisible);
      console.log("Container visible after toggle:", this.container.visible);

      // Force show the menu if it's supposed to be visible
      if (this.isVisible && !this.container.visible) {
        console.log("Forcing container to be visible from button click");
        this.forceShow();
      }
    });

    // Add hover effects
    this.debugButtonBg.on("pointerover", () => {
      if (!this.isVisible) {
        this.debugButtonBg?.setFillStyle(0xdd0000, 0.9); // Darker red on hover when menu is hidden
      } else {
        this.debugButtonBg?.setFillStyle(0x00dd00, 0.9); // Darker green on hover when menu is visible
      }
    });

    this.debugButtonBg.on("pointerout", () => {
      if (!this.isVisible) {
        this.debugButtonBg?.setFillStyle(0xff0000, 0.8); // Red when menu is hidden
      } else {
        this.debugButtonBg?.setFillStyle(0x00ff00, 0.8); // Green when menu is visible
      }
    });

    console.log("Debug button created:", {
      x: buttonX,
      y: buttonY,
      width: 90,
      height: 30,
      depth: this.debugButtonBg.depth,
      interactive: this.debugButtonBg.input?.enabled,
    });
  }

  public toggle(): void {
    this.isVisible = !this.isVisible;

    if (this.isVisible) {
      // Show the menu
      this.forceShow();
    } else {
      // Hide the menu
      this.container.setVisible(false);

      // Update debug button appearance
      if (this.debugButtonBg && this.debugButtonText) {
        this.debugButtonBg.setFillStyle(0xff0000, 0.8); // Red when menu is hidden
        this.debugButtonText.setText("DEBUG");
      }
    }

    console.log(`Debug menu toggled: ${this.isVisible ? "visible" : "hidden"}`);

    // Log the container's position and visibility
    console.log("Debug menu container:", {
      x: this.container.x,
      y: this.container.y,
      visible: this.container.visible,
      depth: this.container.depth,
      width: (this.container.getAt(0) as Phaser.GameObjects.Rectangle).width,
      height: (this.container.getAt(0) as Phaser.GameObjects.Rectangle).height,
      alpha: this.container.alpha,
      scaleX: this.container.scaleX,
      scaleY: this.container.scaleY,
    });
  }

  public show(): void {
    this.isVisible = true;
    this.container.setVisible(true);
    this.container.setDepth(DEPTH.UI + 200); // Ensure it's on top of everything
    this.container.setAlpha(1);
    this.scene.children.bringToTop(this.container);

    console.log("Debug menu shown");
    console.log("Container details:", {
      visible: this.container.visible,
      depth: this.container.depth,
      alpha: this.container.alpha,
      x: this.container.x,
      y: this.container.y,
      children: this.container.length,
    });

    // Update debug button appearance
    if (this.debugButtonBg && this.debugButtonText) {
      this.debugButtonBg.setFillStyle(0x00ff00, 0.8); // Green when menu is visible
      this.debugButtonText.setText("CLOSE");
    }
  }

  public hide(): void {
    this.isVisible = false;
    this.container.setVisible(false);
    console.log("Debug menu hidden");

    // Update debug button appearance
    if (this.debugButtonBg && this.debugButtonText) {
      this.debugButtonBg.setFillStyle(0xff0000, 0.8); // Red when menu is hidden
      this.debugButtonText.setText("DEBUG");
    }
  }

  public getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  public handleResize(width: number, height: number): void {
    // Update the position of the debug menu
    this.container.setPosition(width - 310, 10);

    // Update the position of the debug button
    if (this.debugButtonBg && this.debugButtonText) {
      const buttonX = width - 100;
      const buttonY = 10;
      this.debugButtonBg.setPosition(buttonX, buttonY);
      this.debugButtonText.setPosition(buttonX + 10, buttonY + 5);
    }
  }

  private capitalizeFirstLetter(string: string): string {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  private checkMenuVisibility(): void {
    console.log("Checking menu visibility:", {
      isVisible: this.isVisible,
      containerVisible: this.container.visible,
      containerChildren: this.container.length,
      containerDepth: this.container.depth,
    });

    // If the debug button is clicked and the menu should be visible but isn't,
    // force it to be visible
    if (this.isVisible && !this.container.visible) {
      console.log("Forcing container to be visible");
      this.forceShow();
    }
  }

  public forceShow(): void {
    console.log("Force showing debug menu");
    this.isVisible = true;
    this.container.setVisible(true);
    this.container.setDepth(DEPTH.UI + 200);
    this.container.setAlpha(1);
    this.scene.children.bringToTop(this.container);

    // Update debug button appearance
    if (this.debugButtonBg && this.debugButtonText) {
      this.debugButtonBg.setFillStyle(0x00ff00, 0.8);
      this.debugButtonText.setText("CLOSE");
    }
  }
}
