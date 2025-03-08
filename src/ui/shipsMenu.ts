import Phaser from "phaser";
import { DEFAULT_FONT } from "../constants";
import { CloseButton } from "./closeButton";
import {
  ResourceType,
  RESOURCE_DEFINITIONS,
  Resource,
} from "../data/resources";
import { StarshipState } from "../entities/starship";
import { DEPTH } from "../depth";

export interface StarshipInfo {
  id: number;
  name: string;
  type: string;
  state: StarshipState;
  inventory: { [key in ResourceType]?: number };
  location: string;
  robotsToDeliver: number;
}

export class ShipsMenu {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private background: Phaser.GameObjects.Rectangle;
  private titleText: Phaser.GameObjects.Text;
  private closeButton: CloseButton;
  private contentContainer: Phaser.GameObjects.Container;
  private listContainer: Phaser.GameObjects.Container;
  private noShipsText: Phaser.GameObjects.Text;
  private starshipAnimations: Phaser.Tweens.Tween[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = this.scene.add.container(0, 0);
    this.container.setVisible(false);
    this.container.setDepth(DEPTH.UI);
    this.container.setScrollFactor(0);

    // Create the panel
    this.createPanel();
  }

  private createPanel(): void {
    const width = 600;
    const height = 400;
    const x = this.scene.cameras.main.width / 2;
    const y = this.scene.cameras.main.height - 300;

    // Create background
    this.background = this.scene.add.rectangle(
      0,
      0,
      width,
      height,
      0x333333,
      0.9
    );
    this.background.setStrokeStyle(2, 0x888888);
    this.container.add(this.background);

    // Create title
    this.titleText = this.scene.add.text(0, -height / 2 + 25, "STARSHIPS", {
      fontSize: "24px",
      color: "#ffffff",
      fontStyle: "bold",
      fontFamily: DEFAULT_FONT,
    });
    this.titleText.setOrigin(0.5);
    this.container.add(this.titleText);

    // Create close button
    this.closeButton = new CloseButton(
      this.scene,
      width / 2 - 20,
      -height / 2 + 20,
      24,
      () => this.hide()
    );
    this.container.add(this.closeButton);

    // Create content container
    this.contentContainer = this.scene.add.container(0, 0);
    this.container.add(this.contentContainer);

    // Create list container
    this.listContainer = this.scene.add.container(0, 0);
    this.contentContainer.add(this.listContainer);

    // Create "no ships" text
    this.noShipsText = this.scene.add.text(0, 0, "No starships available", {
      fontSize: "18px",
      color: "#888888",
      fontFamily: DEFAULT_FONT,
    });
    this.noShipsText.setOrigin(0.5);
    this.noShipsText.setVisible(false);
    this.contentContainer.add(this.noShipsText);

    // Position the container
    this.container.setPosition(x, y);
  }

  public updateStarshipsList(starships: StarshipInfo[] = []): void {
    // Clean up any existing animations
    this.cleanupStarshipAnimations();

    // Clear existing list
    this.listContainer.removeAll(true);

    // If no starships, show message
    if (starships.length === 0) {
      this.noShipsText.setVisible(true);
      return;
    }

    // Hide "no ships" text
    this.noShipsText.setVisible(false);

    // Create a scrollable container for starship entries
    const panelWidth = 600;
    const entryHeight = 80;
    const listY = -150; // Start below the title

    // Add starship entries
    starships.forEach((starship, index) => {
      const entryY = listY + index * (entryHeight + 10);

      // Create entry background
      const entryBg = this.scene.add.rectangle(
        0,
        entryY,
        panelWidth - 40,
        entryHeight,
        0x444444
      );
      entryBg.setOrigin(0.5, 0);
      this.listContainer.add(entryBg);

      // Create a container for the starship visualization
      const visualContainer = this.scene.add.container(
        -panelWidth / 2 + 40,
        entryY + entryHeight / 2
      );
      visualContainer.name = `visual-container-${index}`;
      this.listContainer.add(visualContainer);

      // Use string comparison for state to avoid TypeScript errors
      const state = starship.state as unknown as string;

      // Add appropriate planet sprite based on state
      if (state.includes("earth")) {
        // Show Earth sprite
        const earthSprite = this.scene.add.image(0, 0, "earth-mini");
        earthSprite.setDisplaySize(32, 32);
        visualContainer.add(earthSprite);
      } else {
        // Show Mars sprite
        const marsSprite = this.scene.add.image(0, 0, "mars-mini");
        marsSprite.setDisplaySize(32, 32);
        visualContainer.add(marsSprite);
      }

      // Add sun-mini texture for transit between planets
      if (state.includes("to_")) {
        // Show sun-mini sprite
        const sunSprite = this.scene.add.image(0, 0, "sun-mini");
        sunSprite.setDisplaySize(24, 24);
        sunSprite.setAlpha(0.8);

        // Position the sun sprite slightly offset from the planet
        sunSprite.setPosition(-20, -20);

        visualContainer.add(sunSprite);

        // Add a subtle pulsing animation to the sun
        const sunTween = this.scene.tweens.add({
          targets: sunSprite,
          scaleX: { from: 0.7, to: 0.9 },
          scaleY: { from: 0.7, to: 0.9 },
          alpha: { from: 0.7, to: 0.9 },
          duration: 1000,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
        this.starshipAnimations.push(sunTween);
      }

      // Add starship image with appropriate positioning
      const starshipX = 50; // Position to the right of the planet
      const starshipImage = this.scene.add.image(starshipX, 0, "starship-mini");
      starshipImage.setDisplaySize(32, 32);

      // Rotate starship based on state
      if (state.includes("orbit") || state.includes("to_")) {
        // Horizontal orientation for orbit or transit
        starshipImage.setRotation(Math.PI / 2);
      } else if (state.includes("takeoff")) {
        // 45-degree angle for takeoff
        starshipImage.setRotation(Math.PI / 4);
      } else if (state.includes("landing")) {
        // 45-degree angle for landing
        starshipImage.setRotation(Math.PI / 4);
      } else {
        // Vertical orientation for landed
        starshipImage.setRotation(0);
      }

      visualContainer.add(starshipImage);

      // Add engine flame if in transit
      if (
        state.includes("to_") ||
        state.includes("takeoff") ||
        state.includes("landing")
      ) {
        // Position flame based on starship rotation
        let flameX = starshipX;
        let flameY = 16;
        let flameRotation = 0;

        if (state.includes("orbit") || state.includes("to_")) {
          // Flame to the left for horizontal orientation
          flameX = starshipX - 16;
          flameY = 0;
          flameRotation = Math.PI / 2;
        } else if (state.includes("takeoff") || state.includes("landing")) {
          // Angled flame for takeoff/landing
          flameX = starshipX - 8;
          flameY = 8;
          flameRotation = Math.PI / 4;
        }

        const engineFlame = this.scene.add.image(
          flameX,
          flameY,
          "engine-flame"
        );
        engineFlame.setDisplaySize(16, 16);
        engineFlame.setOrigin(0.5, 0);
        engineFlame.setRotation(flameRotation);
        visualContainer.add(engineFlame);

        // Add flame animation
        const flameTween = this.scene.tweens.add({
          targets: engineFlame,
          scaleX: { from: 0.8, to: 1.2 },
          scaleY: { from: 0.8, to: 1.2 },
          alpha: { from: 0.7, to: 1 },
          duration: 400,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
        this.starshipAnimations.push(flameTween);
      }

      // Create starship name - increased spacing from icon
      const nameText = this.scene.add.text(
        -panelWidth / 2 + 140,
        entryY + 15,
        starship.name,
        {
          fontSize: "16px",
          color: "#ffffff",
          fontStyle: "bold",
          fontFamily: DEFAULT_FONT,
        }
      );
      this.listContainer.add(nameText);

      // Create starship state
      const stateText = this.scene.add.text(
        -panelWidth / 2 + 140,
        entryY + 40,
        `Status: ${this.formatState(state)}`,
        {
          fontSize: "14px",
          color: "#aaaaaa",
          fontFamily: DEFAULT_FONT,
        }
      );
      this.listContainer.add(stateText);

      // Create robots to deliver info
      if (starship.robotsToDeliver > 0) {
        const robotsText = this.scene.add.text(
          -panelWidth / 2 + 140,
          entryY + 60,
          `Robots to deliver: ${starship.robotsToDeliver}`,
          {
            fontSize: "14px",
            color: "#aaaaaa",
            fontFamily: DEFAULT_FONT,
          }
        );
        this.listContainer.add(robotsText);
      }

      // Create inventory summary on the right side
      const inventoryText = this.scene.add.text(
        panelWidth / 2 - 200,
        entryY + 15,
        "Cargo:",
        {
          fontSize: "14px",
          color: "#ffffff",
          fontFamily: DEFAULT_FONT,
        }
      );
      this.listContainer.add(inventoryText);

      // Display inventory items with emojis
      let inventoryY = 35;
      const inventoryItems = Object.entries(starship.inventory);

      if (inventoryItems.length === 0) {
        const emptyText = this.scene.add.text(
          panelWidth / 2 - 200,
          entryY + inventoryY,
          "Empty",
          {
            fontSize: "12px",
            color: "#aaaaaa",
            fontFamily: DEFAULT_FONT,
          }
        );
        this.listContainer.add(emptyText);
      } else {
        // Show up to 3 inventory items with emojis
        inventoryItems.slice(0, 3).forEach(([resourceType, amount]) => {
          // Find the resource definition to get the emoji
          const resourceDef = RESOURCE_DEFINITIONS.find(
            (def: Resource) => def.type === (resourceType as ResourceType)
          );
          const emoji = resourceDef ? resourceDef.emoji : "❓";

          const itemText = this.scene.add.text(
            panelWidth / 2 - 200,
            entryY + inventoryY,
            `${emoji} ${resourceType}: ${amount}`,
            {
              fontSize: "12px",
              color: "#aaaaaa",
              fontFamily: DEFAULT_FONT,
            }
          );
          this.listContainer.add(itemText);
          inventoryY += 15;
        });
      }
    });
  }

  // Format state for display
  private formatState(state: string): string {
    switch (state) {
      case "mars_landed":
        return "Landed on Mars";
      case "mars_takeoff":
        return "Taking off from Mars";
      case "mars_orbit":
        return "In Mars orbit";
      case "mars_to_earth":
        return "En route to Earth";
      case "earth_orbit":
        return "In Earth orbit";
      case "earth_to_mars":
        return "En route to Mars";
      case "mars_landing":
        return "Landing on Mars";
      default:
        return state.replace(/_/g, " ");
    }
  }

  private cleanupStarshipAnimations(): void {
    // Stop and destroy all animations
    this.starshipAnimations.forEach((tween) => {
      if (tween && tween.isPlaying()) {
        tween.stop();
        tween.remove();
      }
    });
    this.starshipAnimations = [];
  }

  public show(): void {
    this.container.setVisible(true);
  }

  public hide(): void {
    this.container.setVisible(false);
  }

  public isVisible(): boolean {
    return this.container.visible;
  }

  public destroy(): void {
    this.cleanupStarshipAnimations();
    this.container.destroy();
  }
}
