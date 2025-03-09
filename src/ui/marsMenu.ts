import Phaser from "phaser";
import { DEFAULT_FONT } from "../constants";
import { CloseButton } from "./closeButton";
import { DEPTH } from "../depth";
import { ResourceType, RESOURCE_DEFINITIONS } from "../data/resources";

// Define moon resources and yields
interface MoonResource {
  resourceType: ResourceType;
  baseYield: number;
  currentYield: number;
  allocatedStarships: number;
}

interface MoonData {
  name: string;
  resources: MoonResource[];
}

export class MarsMenu {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private background: Phaser.GameObjects.Rectangle;
  private titleText: Phaser.GameObjects.Text;
  private closeButton: CloseButton;
  private contentContainer: Phaser.GameObjects.Container;
  private escKey: Phaser.Input.Keyboard.Key;

  // Starlink status
  private starlinkStatusText: Phaser.GameObjects.Text;
  private starlinkStatusValue: Phaser.GameObjects.Text;
  private starlinkCount: number = 1;

  // Mars visualization
  private marsSprite: Phaser.GameObjects.Image;
  private satelliteCountText: Phaser.GameObjects.Text;

  // Moon data
  private phobosData: MoonData = {
    name: "Phobos",
    resources: [
      {
        resourceType: "water",
        baseYield: 10,
        currentYield: 0,
        allocatedStarships: 0,
      },
      {
        resourceType: "iron",
        baseYield: 15,
        currentYield: 0,
        allocatedStarships: 0,
      },
      {
        resourceType: "aluminium",
        baseYield: 8,
        currentYield: 0,
        allocatedStarships: 0,
      },
    ],
  };

  private deimosData: MoonData = {
    name: "Deimos",
    resources: [
      {
        resourceType: "silicon",
        baseYield: 12,
        currentYield: 0,
        allocatedStarships: 0,
      },
      {
        resourceType: "magnesium",
        baseYield: 7,
        currentYield: 0,
        allocatedStarships: 0,
      },
      {
        resourceType: "titanium",
        baseYield: 9,
        currentYield: 0,
        allocatedStarships: 0,
      },
    ],
  };

  // Containers for moon sections
  private phobosContainer: Phaser.GameObjects.Container;
  private deimosContainer: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Create the container and add it to the scene
    this.container = this.scene.add.container(0, 0);
    this.container.setVisible(false);
    this.container.setDepth(DEPTH.UI); // Match the other menus' depth
    this.container.setScrollFactor(0); // Fix to camera

    // Set up escape key
    if (this.scene.input && this.scene.input.keyboard) {
      this.escKey = this.scene.input.keyboard.addKey(
        Phaser.Input.Keyboard.KeyCodes.ESC
      );
    }

    console.log(
      "Mars menu container created with depth:",
      this.container.depth
    );

    // Create the panel
    this.createPanel();
  }

  private createPanel(): void {
    try {
      console.log("Creating Mars menu panel");
      const width = 600;
      const height = 400; // Match the other menus' height

      // Position the container like the other menus
      const x = this.scene.cameras.main.width / 2;
      const y = this.scene.cameras.main.height - 300;
      this.container.setPosition(x, y);

      // Create background
      this.background = this.scene.add.rectangle(
        0,
        0,
        width,
        height,
        0x333333, // Darker background color
        0.9 // Match other menu opacity
      );
      this.background.setStrokeStyle(2, 0x888888);
      this.container.add(this.background);

      // Create title
      this.titleText = this.scene.add.text(
        0,
        -height / 2 + 25,
        "MARS OPERATIONS",
        {
          fontSize: "24px",
          color: "#ffffff",
          fontStyle: "bold",
          fontFamily: DEFAULT_FONT,
        }
      );
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

      // Create Starlink status section
      this.createStarlinkStatus(width, height);

      // Create Mars visualization
      this.createMarsVisualization();

      // Create moon sections
      this.createMoonSections(width);

      // Set the container's depth to ensure it's above other UI elements
      this.container.setDepth(DEPTH.UI + 10);

      // Make sure the container is initially invisible
      this.container.setVisible(false);

      console.log("Mars menu panel created successfully");
    } catch (error) {
      console.error("Error creating Mars menu panel:", error);
    }
  }

  private createStarlinkStatus(width: number, height: number): void {
    // Create Starlink status section - moved to top left
    const statusContainer = this.scene.add.container(
      -width / 2 + 20,
      -height / 2 + 20
    );

    // Create status label
    this.starlinkStatusText = this.scene.add.text(0, 0, "STARLINK", {
      fontSize: "18px",
      color: "#ffffff",
      fontFamily: DEFAULT_FONT,
      fontStyle: "bold",
    });
    this.starlinkStatusText.setOrigin(0, 0.5);
    statusContainer.add(this.starlinkStatusText);

    // Create status value - moved below the label
    this.starlinkStatusValue = this.scene.add.text(0, 25, "OFFLINE", {
      fontSize: "18px",
      color: "#ff4444", // Red color for offline
      fontFamily: DEFAULT_FONT,
      fontStyle: "bold",
    });
    this.starlinkStatusValue.setOrigin(0, 0.5);
    statusContainer.add(this.starlinkStatusValue);

    this.contentContainer.add(statusContainer);
  }

  private createMarsVisualization(): void {
    // Create Mars visualization container
    const marsContainer = this.scene.add.container(0, -120);
    marsContainer.setName("mars-container");

    // Add a subtle glow effect for Mars
    const marsGlow = this.scene.add.graphics();
    marsGlow.fillStyle(0xff6600, 0.1);
    marsGlow.fillCircle(0, 0, 50); // Increased glow radius
    marsContainer.add(marsGlow);

    // Add Mars sprite
    this.marsSprite = this.scene.add.image(0, 0, "mars-mini");
    this.marsSprite.setDisplaySize(80, 80); // Increased size from 64 to 80
    marsContainer.add(this.marsSprite);

    // Create a container for the satellite count display
    // Increased vertical position from 50 to 70 to add more spacing
    const satelliteCountContainer = this.scene.add.container(0, 70);

    // Add satellite icon
    // Centered the icon (changed from -40 to 0)
    const satelliteIcon = this.scene.add.image(0, 0, "starlink-mini");
    // Doubled the display size from 16x16 to 32x32
    satelliteIcon.setDisplaySize(32, 32);
    satelliteCountContainer.add(satelliteIcon);

    // Add satellite count text
    this.satelliteCountText = this.scene.add.text(
      35, // Adjusted position to account for centered and larger icon
      0,
      `${this.starlinkCount}`,
      {
        fontSize: "14px",
        color: "#ffffff",
        fontFamily: DEFAULT_FONT,
      }
    );
    this.satelliteCountText.setOrigin(0, 0.5);
    satelliteCountContainer.add(this.satelliteCountText);

    marsContainer.add(satelliteCountContainer);

    // Add satellite visualization if there are any
    if (this.starlinkCount > 0) {
      this.renderSatellites(marsContainer);
    }

    this.contentContainer.add(marsContainer);
  }

  private renderSatellites(container: Phaser.GameObjects.Container): void {
    // Clear any existing satellite sprites
    container.getAll().forEach((child) => {
      if (
        child.name &&
        (child.name.startsWith("satellite-") ||
          child.name.startsWith("satellite-glow-"))
      ) {
        container.remove(child, true);
      }
    });

    // Add satellite sprites in orbit around Mars
    const count = Math.min(this.starlinkCount, 8); // Limit visual satellites to 8
    const radius = 55; // Increased orbit radius from 45 to 55 to match larger Mars

    for (let i = 0; i < count; i++) {
      // Calculate position in orbit
      const angle = (i / count) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;

      // Create a satellite sprite using the starlink-mini texture
      const satellite = this.scene.add.image(x, y, "starlink-mini");
      satellite.setName(`satellite-${i}`);
      satellite.setDisplaySize(12, 12); // Increased size from 8x8 to 12x12

      // Add a small glow
      const satGlow = this.scene.add.graphics();
      satGlow.fillStyle(0x44ff44, 0.3);
      satGlow.fillCircle(x, y, 6); // Increased from 4 to 6
      satGlow.setName(`satellite-glow-${i}`);

      container.add(satGlow);
      container.add(satellite);

      // Add orbit animation
      this.scene.tweens.add({
        targets: [satellite, satGlow],
        angle: 360,
        duration: 20000 + i * 2000, // Different speeds for each satellite
        repeat: -1,
        ease: "Linear",
      });
    }
  }

  private createMoonSections(width: number): void {
    // Create Phobos section - moved closer to center
    this.phobosContainer = this.scene.add.container(-160, 0); // Adjusted from -180 to -160
    this.createMoonSection(
      this.phobosContainer,
      this.phobosData,
      -width / 4,
      0,
      "phobos-mini"
    );
    this.contentContainer.add(this.phobosContainer);

    // Create Deimos section - moved closer to center
    this.deimosContainer = this.scene.add.container(160, 0); // Adjusted from 180 to 160
    this.createMoonSection(
      this.deimosContainer,
      this.deimosData,
      width / 4,
      0,
      "deimos-mini"
    );
    this.contentContainer.add(this.deimosContainer);
  }

  private createMoonSection(
    container: Phaser.GameObjects.Container,
    moonData: MoonData,
    x: number,
    y: number,
    moonTexture: string
  ): void {
    // Add moon sprite above the name
    let moonSprite;
    try {
      // Try to use the specific moon texture
      moonSprite = this.scene.add.image(0, -100, moonTexture);

      // Apply a slight rotation to make it more dynamic
      const rotation = moonData.name === "Phobos" ? -0.1 : 0.1;
      moonSprite.setRotation(rotation);

      // Set appropriate size based on the moon - increased sizes
      const size = moonData.name === "Phobos" ? 50 : 45; // Increased from 40/32 to 50/45
      moonSprite.setDisplaySize(size, size);
    } catch (error) {
      console.error(`Failed to load ${moonTexture}, using fallback`, error);
      // Fallback to starship-mini if the moon texture isn't available
      moonSprite = this.scene.add.image(0, -100, "starship-mini");
      moonSprite.setDisplaySize(45, 45); // Increased fallback size
    }

    // Add a subtle glow effect to the moon
    const glowGraphics = this.scene.add.graphics();
    glowGraphics.fillStyle(0xffffff, 0.2);
    glowGraphics.fillCircle(0, -100, moonData.name === "Phobos" ? 30 : 25); // Increased glow radius
    container.add(glowGraphics);

    container.add(moonSprite);

    // Create moon title
    const moonTitle = this.scene.add.text(
      0,
      -60, // Moved down to accommodate larger moon sprite
      moonData.name,
      {
        fontSize: "20px", // Increased from 18px
        color: "#ffffff",
        fontFamily: DEFAULT_FONT,
        fontStyle: "bold",
      }
    );
    moonTitle.setOrigin(0.5);
    container.add(moonTitle);

    // Create resource list with more compact layout
    moonData.resources.forEach((resource, index) => {
      const yPos = -10 + index * 35; // Increased spacing between rows from 30 to 35

      // Get resource definition for emoji
      const resourceDef = RESOURCE_DEFINITIONS.find(
        (def) => def.type === resource.resourceType
      );
      const emoji = resourceDef ? resourceDef.emoji : "📦";

      // Resource emoji - adjusted position
      const resourceEmoji = this.scene.add.text(
        -110, // Adjusted from -120 to -110
        yPos,
        emoji,
        {
          fontSize: "18px",
          fontFamily: DEFAULT_FONT,
        }
      );
      resourceEmoji.setOrigin(0.5);
      container.add(resourceEmoji);

      // Resource name - adjusted position
      const resourceName = this.scene.add.text(
        -85, // Adjusted from -90 to -85
        yPos,
        this.capitalizeFirstLetter(resource.resourceType),
        {
          fontSize: "16px",
          color: "#ffffff",
          fontFamily: DEFAULT_FONT,
        }
      );
      resourceName.setOrigin(0, 0.5);

      // Ensure resource names don't overlap with yield text by limiting width
      const maxNameWidth = 75; // Reduced from 80 to 75
      if (resourceName.width > maxNameWidth) {
        resourceName.setDisplaySize(maxNameWidth, resourceName.height);
      }

      container.add(resourceName);

      // Yield text - adjusted position
      const yieldText = this.scene.add.text(
        -5, // Adjusted from 0 to -5
        yPos,
        `${resource.currentYield}/h`,
        {
          fontSize: "16px",
          color: "#ffffff",
          fontFamily: DEFAULT_FONT,
        }
      );
      yieldText.setOrigin(0.5);
      container.add(yieldText);

      // Starship allocation - adjusted position
      const shipCount = this.scene.add.text(
        50, // Adjusted from 60 to 50
        yPos,
        resource.allocatedStarships.toString(),
        {
          fontSize: "16px",
          color: "#ffffff",
          fontFamily: DEFAULT_FONT,
        }
      );
      shipCount.setOrigin(0.5);
      container.add(shipCount);

      // Minus button - adjusted position
      const minusButton = this.createButton(
        70, // Adjusted from 75 to 70
        yPos,
        "-",
        () => this.adjustStarshipAllocation(moonData, resource, -1)
      );
      container.add(minusButton);

      // Plus button - adjusted position
      const plusButton = this.createButton(
        95, // Adjusted from 100 to 95
        yPos,
        "+",
        () => this.adjustStarshipAllocation(moonData, resource, 1)
      );
      container.add(plusButton);
    });
  }

  private createButton(
    x: number,
    y: number,
    text: string,
    onClick: () => void
  ): Phaser.GameObjects.Container {
    const button = this.scene.add.container(x, y);

    // Button background - reduced size for more compact layout
    const buttonBg = this.scene.add.rectangle(0, 0, 22, 22, 0x444444); // Reduced from 24x24 to 22x22
    buttonBg.setStrokeStyle(1, 0x666666);
    button.add(buttonBg);

    // Button text - slightly reduced font size
    const buttonText = this.scene.add.text(0, 0, text, {
      fontSize: "15px", // Reduced from 16px to 15px
      color: "#ffffff",
      fontFamily: DEFAULT_FONT,
    });
    buttonText.setOrigin(0.5);
    button.add(buttonText);

    // Make button interactive
    buttonBg.setInteractive();
    buttonBg.on("pointerdown", onClick);

    // Add hover effects
    buttonBg.on("pointerover", () => {
      buttonBg.setFillStyle(0x666666);
    });

    buttonBg.on("pointerout", () => {
      buttonBg.setFillStyle(0x444444);
    });

    return button;
  }

  private adjustStarshipAllocation(
    moonData: MoonData,
    resource: MoonResource,
    change: number
  ): void {
    // Get total allocated starships for this moon
    const totalAllocated = moonData.resources.reduce(
      (sum, res) => sum + res.allocatedStarships,
      0
    );

    // Get total available starships (this would come from game state)
    const availableStarships = this.getAvailableStarships();
    const totalAllocatedAllMoons = this.getTotalAllocatedStarships();

    // Ensure we always keep at least one starship for Earth runs
    const maxAllowedAllocation = availableStarships - 1;
    const remainingAvailable =
      maxAllowedAllocation -
      totalAllocatedAllMoons +
      resource.allocatedStarships;

    // Calculate new allocation
    let newAllocation = Math.max(0, resource.allocatedStarships + change);

    // Check if we have enough starships available
    if (
      change > 0 &&
      newAllocation > resource.allocatedStarships &&
      remainingAvailable <= 0
    ) {
      console.log("Not enough starships available");
      this.showNotEnoughStarshipsMessage();
      return;
    }

    // Update allocation
    resource.allocatedStarships = newAllocation;

    // Update yield based on allocation - only generate yield if starships are allocated
    resource.currentYield =
      resource.allocatedStarships > 0
        ? resource.baseYield + resource.allocatedStarships * 5
        : 0;

    // Update the UI
    this.updateMoonSections();

    // Start starship missions (this would be implemented in game logic)
    this.startStarshipMissions(
      moonData.name,
      resource.resourceType,
      newAllocation
    );
  }

  private getAvailableStarships(): number {
    // Get the number of landing pads from the main scene
    const mainScene = this.scene as any;
    let landingPadCount = 1; // Default to 1

    if (mainScene.buildings) {
      const landingPads = mainScene.buildings.filter(
        (b: any) => b.getBuildingType && b.getBuildingType() === "landing-pad"
      );
      landingPadCount = Math.max(1, landingPads.length);
    }

    return landingPadCount;
  }

  private getTotalAllocatedStarships(): number {
    // Calculate total allocated starships across all moons
    const phobosTotal = this.phobosData.resources.reduce(
      (sum, res) => sum + res.allocatedStarships,
      0
    );

    const deimosTotal = this.deimosData.resources.reduce(
      (sum, res) => sum + res.allocatedStarships,
      0
    );

    return phobosTotal + deimosTotal;
  }

  private startStarshipMissions(
    moonName: string,
    resourceType: ResourceType,
    count: number
  ): void {
    // This would be implemented to start actual starship missions in the game
    console.log(
      `Starting ${count} starship missions to ${moonName} for ${resourceType}`
    );
  }

  private updateMoonSections(): void {
    // This would update the UI to reflect changes in allocations and yields
    // For now, just recreate the moon sections
    this.contentContainer.remove(this.phobosContainer);
    this.contentContainer.remove(this.deimosContainer);
    this.createMoonSections(600); // Use the standard width
  }

  private capitalizeFirstLetter(string: string): string {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  public updateStarlinkStatus(count: number): void {
    this.starlinkCount = count;

    // Update satellite count text
    this.satelliteCountText.setText(`${count}`);

    // Update status based on count
    if (count >= 3) {
      this.starlinkStatusValue.setText("ONLINE");
      this.starlinkStatusValue.setColor("#44ff44"); // Green for online
    } else {
      this.starlinkStatusValue.setText("OFFLINE");
      this.starlinkStatusValue.setColor("#ff4444"); // Red for offline
    }

    // Update satellite visualization
    const marsContainer = this.contentContainer.getByName(
      "mars-container"
    ) as Phaser.GameObjects.Container;
    if (marsContainer) {
      this.renderSatellites(marsContainer);
    }
  }

  public show(): void {
    this.container.setVisible(true);
    console.log("Mars menu shown");
  }

  public hide(): void {
    this.container.setVisible(false);
    console.log("Mars menu hidden");
  }

  public isVisible(): boolean {
    return this.container.visible;
  }

  public update(time: number, delta: number): void {
    // Check for ESC key press
    if (this.escKey && this.escKey.isDown && this.isVisible()) {
      this.hide();
    }

    // Animate satellites orbiting Mars if the menu is visible
    if (this.isVisible() && this.starlinkCount > 0) {
      const marsContainer = this.contentContainer.getByName(
        "mars-container"
      ) as Phaser.GameObjects.Container;
      if (marsContainer) {
        // Update satellite positions
        marsContainer.getAll().forEach((child) => {
          if (
            child.name &&
            child.name.startsWith("satellite-") &&
            !child.name.startsWith("satellite-glow-")
          ) {
            // Get the satellite index
            const index = parseInt(child.name.split("-")[1]);
            // Calculate new position in orbit
            const speed = 0.0005 * (1 + index * 0.2); // Different speeds for each satellite
            const angle =
              time * speed + (index / this.starlinkCount) * Math.PI * 2;
            const radius = 55; // Increased from 45 to 55 to match larger Mars
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;

            // Update satellite position - cast to proper type
            (child as Phaser.GameObjects.Rectangle).setPosition(x, y);

            // Update glow position
            const glowName = `satellite-glow-${index}`;
            const glow = marsContainer.getByName(glowName);
            if (glow) {
              (glow as Phaser.GameObjects.Graphics).setPosition(x, y);
            }
          }
        });
      }
    }
  }

  public destroy(): void {
    if (this.container) {
      this.container.destroy();
    }
  }

  public getStarlinkCount(): number {
    return this.starlinkCount;
  }

  private showNotEnoughStarshipsMessage(): void {
    // Create the message text
    const messageText = this.scene.add.text(
      this.container.x,
      this.container.y - 100,
      "Not enough starships available!",
      {
        fontSize: "20px",
        fontFamily: DEFAULT_FONT,
        color: "#FF0000",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 4,
      }
    );
    messageText.setOrigin(0.5);
    messageText.setScrollFactor(0);
    messageText.setDepth(DEPTH.UI + 20);

    // Animate it
    this.scene.tweens.add({
      targets: messageText,
      y: messageText.y - 30,
      alpha: 0,
      duration: 2000,
      ease: "Power2",
      onComplete: () => {
        messageText.destroy();
      },
    });
  }
}
