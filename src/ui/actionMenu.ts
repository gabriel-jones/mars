import Phaser from "phaser";
import { BuildingType } from "../data/buildings";
import { DEFAULT_FONT } from "../constants";
import { BuildingPlacer } from "../mechanics/buildingPlacer";
import { BuildMenu } from "./buildMenu";
import { RobotsMenu, RobotInfo } from "./robotsMenu";
import { ShipsMenu, StarshipInfo } from "./shipsMenu";
import { EarthMenu } from "./earthMenu";

interface ButtonConfig {
  text: string;
  x: number;
  y: number;
  onClick: () => void;
  icon?: string; // Optional icon key
}

// Define menu types
type MenuType = "construction" | "robots" | "starships" | "earth" | "none";

export class ActionMenu {
  private scene: Phaser.Scene;
  private buildButton: Phaser.GameObjects.Container;
  private robotsButton: Phaser.GameObjects.Container;
  private starshipsButton: Phaser.GameObjects.Container;
  private earthButton: Phaser.GameObjects.Container;

  // Menu instances
  private buildMenu: BuildMenu;
  private robotsMenu: RobotsMenu;
  private shipsMenu: ShipsMenu;
  private earthMenu: EarthMenu;

  // State tracking
  private activeMenu: MenuType = "none";
  private buildingPlacer: BuildingPlacer;

  // Public properties for panel state
  public get isRobotsPanelOpen(): boolean {
    return this.activeMenu === "robots";
  }

  public get isStarshipsPanelOpen(): boolean {
    return this.activeMenu === "starships";
  }

  public get isEarthMenuOpen(): boolean {
    return this.activeMenu === "earth";
  }

  constructor(
    scene: Phaser.Scene,
    map: Phaser.Tilemaps.Tilemap,
    onItemPlaced: (itemName: string, x: number, y: number) => void
  ) {
    this.scene = scene;

    // Create the building placer
    this.buildingPlacer = new BuildingPlacer(scene, map, onItemPlaced);

    // Add keyboard listener for Escape key
    if (this.scene.input && this.scene.input.keyboard) {
      this.scene.input.keyboard.on("keydown-ESC", () => {
        if (this.activeMenu !== "none") {
          this.closeAllMenus();
        }
      });
    }

    // Create buttons with fixed position - centered at the bottom
    const buttonSpacing = 120; // Spacing between buttons
    const buttonY = this.scene.cameras.main.height - 50;

    // Build button
    this.buildButton = this.createButton({
      text: "BUILD",
      x: this.scene.cameras.main.width / 2 - buttonSpacing * 1.5,
      y: buttonY,
      onClick: () => this.toggleMenu("construction"),
      icon: "build-mini",
    });
    this.buildButton.setScrollFactor(0);

    // Robots button
    this.robotsButton = this.createButton({
      text: "ROBOTS",
      x: this.scene.cameras.main.width / 2 - buttonSpacing * 0.5,
      y: buttonY,
      onClick: () => this.toggleMenu("robots"),
      icon: "optimus-mini",
    });
    this.robotsButton.setScrollFactor(0);

    // Starships button
    this.starshipsButton = this.createButton({
      text: "SHIPS",
      x: this.scene.cameras.main.width / 2 + buttonSpacing * 0.5,
      y: buttonY,
      onClick: () => this.toggleMenu("starships"),
      icon: "starship-mini",
    });
    this.starshipsButton.setScrollFactor(0);

    // Earth button
    this.earthButton = this.createButton({
      text: "EARTH",
      x: this.scene.cameras.main.width / 2 + buttonSpacing * 1.5,
      y: buttonY,
      onClick: () => this.toggleMenu("earth"),
      icon: "earth-mini",
    });
    this.earthButton.setScrollFactor(0);

    // Create menu instances
    this.buildMenu = new BuildMenu(scene, this.buildingPlacer);
    this.robotsMenu = new RobotsMenu(scene);
    this.shipsMenu = new ShipsMenu(scene);

    // Create Earth menu with explicit initialization
    try {
      console.log("Initializing Earth menu");
      this.earthMenu = new EarthMenu(scene);
      console.log("Earth menu initialized successfully");
    } catch (error) {
      console.error("Error initializing Earth menu:", error);
    }

    // Add all buttons to the scene
    scene.add.existing(this.buildButton);
    scene.add.existing(this.robotsButton);
    scene.add.existing(this.starshipsButton);
    scene.add.existing(this.earthButton);
  }

  // Create a button with text and optional icon
  private createButton(config: ButtonConfig): Phaser.GameObjects.Container {
    const button = this.scene.add.container(config.x, config.y);

    // Button width based on text length
    const buttonWidth = config.text.length * 15 + (config.icon ? 40 : 0);

    // Create button background and border
    const buttonBg = this.scene.add.rectangle(0, 0, buttonWidth, 40, 0x444444);
    buttonBg.setStrokeStyle(2, 0x666666);
    buttonBg.setName("buttonBg");
    button.add(buttonBg);

    const buttonBorder = this.scene.add.rectangle(
      0,
      0,
      buttonWidth,
      40,
      0x000000,
      0
    );
    buttonBorder.setStrokeStyle(2, 0x666666);
    buttonBorder.setName("buttonBorder");
    button.add(buttonBorder);

    // Add icon if provided
    if (config.icon) {
      const icon = this.scene.add.image(-buttonWidth / 2 + 20, 0, config.icon);
      icon.setDisplaySize(32, 32);
      button.add(icon);
    }

    // Add text with offset if icon is present
    const textX = config.icon ? 10 : 0;
    const buttonText = this.scene.add.text(textX, 0, config.text, {
      fontSize: "20px",
      color: "#ffffff",
      fontStyle: "bold",
      fontFamily: DEFAULT_FONT,
    });
    buttonText.setOrigin(0.5);
    buttonText.setName("buttonText");
    button.add(buttonText);

    // Make the button interactive
    button.setInteractive(
      new Phaser.Geom.Rectangle(-buttonWidth / 2, -20, buttonWidth, 40),
      Phaser.Geom.Rectangle.Contains
    );

    // Add hover effects
    button.on("pointerover", () => {
      buttonBg.setFillStyle(0x666666);
      buttonBorder.setStrokeStyle(2, 0xffffff);
    });

    button.on("pointerout", () => {
      buttonBg.setFillStyle(0x444444);
      buttonBorder.setStrokeStyle(2, 0x666666);
    });

    // Add click handler
    button.on("pointerdown", config.onClick);

    return button;
  }

  // Toggle menu visibility
  private toggleMenu(menuType: MenuType): void {
    // If the same menu is clicked again, close it
    if (this.activeMenu === menuType) {
      this.closeAllMenus();
      return;
    }

    // Close all menus first
    this.closeAllMenus();

    // Then open the selected menu
    this.activeMenu = menuType;
    console.log(`Toggling menu: ${menuType}`);

    switch (menuType) {
      case "construction":
        this.buildMenu.show();
        this.highlightButton(this.buildButton);
        break;
      case "robots":
        this.robotsMenu.show();
        this.highlightButton(this.robotsButton);
        this.updateRobotsList();
        break;
      case "starships":
        this.shipsMenu.show();
        this.highlightButton(this.starshipsButton);
        this.updateStarshipsList();
        break;
      case "earth":
        console.log("Showing Earth menu");
        if (this.earthMenu) {
          this.earthMenu.show();
          this.highlightButton(this.earthButton);
        } else {
          console.error("Earth menu is not initialized");
        }
        break;
    }
  }

  // Close all menus
  private closeAllMenus(): void {
    this.buildMenu.hide();
    this.robotsMenu.hide();
    this.shipsMenu.hide();
    this.earthMenu.hide();

    this.resetButtonHighlights();
    this.activeMenu = "none";
  }

  // Highlight the active button
  private highlightButton(button: Phaser.GameObjects.Container): void {
    try {
      // Find elements by name
      const buttonBg = button.getByName(
        "buttonBg"
      ) as Phaser.GameObjects.Rectangle;
      const buttonBorder = button.getByName(
        "buttonBorder"
      ) as Phaser.GameObjects.Rectangle;
      const buttonText = button.getByName(
        "buttonText"
      ) as Phaser.GameObjects.Text;

      if (buttonBg && buttonBorder) {
        // More distinct active button style
        buttonBg.setFillStyle(0x336633); // Darker green background
        buttonBorder.setStrokeStyle(3, 0x88ff88); // Brighter green border
      }

      // Always recreate the text to avoid setColor issues
      if (buttonText) {
        // Get the text properties
        const oldText = buttonText.text;
        const oldX = buttonText.x;
        const oldY = buttonText.y;

        // Remove the old text
        button.remove(buttonText, true);

        // Create new text with white color and glow effect
        const newText = this.scene.add
          .text(oldX, oldY, oldText, {
            fontSize: "20px",
            color: "#ffffff",
            fontStyle: "bold",
            fontFamily: DEFAULT_FONT,
            stroke: "#00ff00",
            strokeThickness: 1,
            shadow: {
              offsetX: 0,
              offsetY: 0,
              color: "#00ff00",
              blur: 6,
              stroke: true,
              fill: true,
            },
          })
          .setOrigin(0.5)
          .setName("buttonText");

        button.add(newText);
      }
    } catch (error) {
      console.error("Error highlighting button:", error);
    }
  }

  // Reset all button highlights
  private resetButtonHighlights(): void {
    [
      this.buildButton,
      this.robotsButton,
      this.starshipsButton,
      this.earthButton,
    ].forEach((button) => {
      try {
        // Find elements by name
        const buttonBg = button.getByName(
          "buttonBg"
        ) as Phaser.GameObjects.Rectangle;
        const buttonBorder = button.getByName(
          "buttonBorder"
        ) as Phaser.GameObjects.Rectangle;
        const buttonText = button.getByName(
          "buttonText"
        ) as Phaser.GameObjects.Text;

        if (buttonBg && buttonBorder) {
          // Reset to default style
          buttonBg.setFillStyle(0x444444);
          buttonBorder.setStrokeStyle(2, 0x666666);
        }

        // Always recreate the text to avoid setColor issues
        if (buttonText) {
          // Get the text properties
          const oldText = buttonText.text;
          const oldX = buttonText.x;
          const oldY = buttonText.y;

          // Remove the old text
          button.remove(buttonText, true);

          // Create new text with white color
          const newText = this.scene.add
            .text(oldX, oldY, oldText, {
              fontSize: "20px",
              color: "#ffffff",
              fontStyle: "bold",
              fontFamily: DEFAULT_FONT,
            })
            .setOrigin(0.5)
            .setName("buttonText");

          button.add(newText);
        }
      } catch (error) {
        console.error("Error resetting button:", error);
      }
    });
  }

  // Update the robots list in the robots menu
  public updateRobotsList(robots: RobotInfo[] = []): void {
    this.robotsMenu.updateRobotsList(robots);
  }

  // Update the starships list in the ships menu
  public updateStarshipsList(): void {
    // Get starships from the scene
    const mainScene = this.scene as any;
    const starships = this.getStarships();

    // Update the ships menu
    this.shipsMenu.updateStarshipsList(starships);
  }

  // Get all starships from landing pads
  private getStarships(): StarshipInfo[] {
    // Get all landing pads
    const mainScene = this.scene as any;
    const landingPads = mainScene.buildings.filter(
      (b: any) => b.getBuildingType && b.getBuildingType() === "landing-pad"
    );

    // Get starships from landing pads
    const starships: StarshipInfo[] = [];
    landingPads.forEach((landingPad: any, index: number) => {
      // For each landing pad, get the starship
      if (landingPad.getStarship) {
        const starship = landingPad.getStarship();
        if (starship) {
          starships.push({
            id: index,
            name: `Starship ${index + 1}`,
            type: "starship",
            state: starship.getState(),
            inventory: starship.getInventory(),
            location: this.getStarshipLocation(starship),
            robotsToDeliver: starship.getRobotsToDeliver
              ? starship.getRobotsToDeliver()
              : 2, // Use getter method
          });
        }
      }
    });

    return starships;
  }

  // Get the location of a starship based on its state
  private getStarshipLocation(starship: any): string {
    // Use type assertion to avoid type errors
    const state = starship.getState() as any;

    switch (state) {
      case "mars_landed":
        return "Mars Surface";
      case "mars_takeoff":
        return "Leaving Mars";
      case "mars_orbit":
        return "Mars Orbit";
      case "mars_to_earth":
        return "Mars → Earth";
      case "earth_orbit":
        return "Earth Orbit";
      case "earth_to_mars":
        return "Earth → Mars";
      case "mars_landing":
        return "Landing on Mars";
      default:
        return "Unknown";
    }
  }

  // Update method
  update(): void {
    // Update the building placer
    this.buildingPlacer.update();

    // If the Earth menu is open, check if any starships are in Earth orbit
    // to process the transfer queue
    if (this.isEarthMenuOpen) {
      const starships = this.getStarships();
      const earthOrbitStarships = starships.filter(
        (ship) => (ship.state as any) === "earth_orbit"
      );

      if (earthOrbitStarships.length > 0) {
        // Get the first starship in Earth orbit
        const starship = earthOrbitStarships[0];

        // Get the landing pad for this starship
        const mainScene = this.scene as any;
        const landingPads = mainScene.buildings.filter(
          (b: any) => b.getBuildingType && b.getBuildingType() === "landing-pad"
        );

        if (landingPads.length > 0) {
          const landingPad = landingPads.find(
            (pad: any) =>
              (pad.getStarship().getState() as any) === "earth_orbit"
          );

          if (landingPad) {
            // Set the transfer queue for the starship
            const transferQueue = this.earthMenu.getTransferQueue();
            landingPad.getStarship().setTransferQueue(transferQueue);

            // Clear the Earth menu's transfer queue
            this.earthMenu.clearTransferQueue();
          }
        }
      }
    }
  }

  // Clean up resources
  public destroy(): void {
    this.buildMenu.destroy();
    this.robotsMenu.destroy();
    this.shipsMenu.destroy();
    this.earthMenu.destroy();

    this.buildButton.destroy();
    this.robotsButton.destroy();
    this.starshipsButton.destroy();
    this.earthButton.destroy();
  }
}
