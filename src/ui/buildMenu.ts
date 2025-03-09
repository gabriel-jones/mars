import Phaser from "phaser";
import { BuildingType, BUILDING_DEFINITIONS } from "../data/buildings";
import { DEFAULT_FONT } from "../constants";
import { CloseButton } from "./closeButton";
import { BuildingPlacer } from "../mechanics/buildingPlacer";
import { ResourceManager, ResourceType } from "../data/resources";
import { DEPTH } from "../depth";

export class BuildMenu {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private background: Phaser.GameObjects.Rectangle;
  private titleText: Phaser.GameObjects.Text;
  private closeButton: CloseButton;
  private contentContainer: Phaser.GameObjects.Container;
  private buildingPlacer: BuildingPlacer;
  private bulldozeButton: Phaser.GameObjects.Container;
  private isBulldozeModeActive: boolean = false;
  private onMenuClosed: () => void;
  private buildingButtons: Map<
    BuildingType,
    {
      background: Phaser.GameObjects.Rectangle;
      nameText: Phaser.GameObjects.Text;
      image: Phaser.GameObjects.Sprite;
      costTexts: Phaser.GameObjects.Text[];
    }
  > = new Map();
  private tooltipContainer: Phaser.GameObjects.Container | null = null;

  constructor(
    scene: Phaser.Scene,
    buildingPlacer: BuildingPlacer,
    onMenuClosed?: () => void
  ) {
    this.scene = scene;
    this.buildingPlacer = buildingPlacer;
    this.onMenuClosed = onMenuClosed || (() => {});
    this.container = this.scene.add.container(0, 0);
    this.container.setVisible(false);
    this.container.setDepth(DEPTH.UI);
    this.container.setScrollFactor(0);

    // Create the panel
    this.createPanel();

    // Listen for resource changes to update button states
    const gameState = (window as any).gameState;
    if (gameState && gameState.resources && gameState.resources.events) {
      gameState.resources.events.on(
        ResourceManager.EVENTS.INVENTORY_CHANGED,
        () => {
          if (this.isVisible()) {
            this.updateAllButtonStates();
          }
        }
      );
    }
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
    this.titleText = this.scene.add.text(0, -height / 2 + 25, "CONSTRUCTION", {
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

    // Create building buttons (bulldoze button will be added at the end)
    this.createBuildingButtons();

    // Position the container
    this.container.setPosition(x, y);
  }

  private createBulldozeButton(
    x: number,
    y: number
  ): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y);

    // Create button background
    const buttonWidth = 140;
    const buttonHeight = 120;
    const buttonBg = this.scene.add.rectangle(
      0,
      0,
      buttonWidth,
      buttonHeight,
      0x333333
    );
    buttonBg.setStrokeStyle(2, 0x666666);
    buttonBg.setInteractive({ useHandCursor: true });
    container.add(buttonBg);

    // Add bulldozer icon
    const bulldozerIcon = this.scene.add.sprite(
      0,
      -35, // Position image at the top of the button
      "bulldozer"
    );
    bulldozerIcon.setDisplaySize(48, 48);
    container.add(bulldozerIcon);

    // Add text
    const text = this.scene.add.text(0, -5, "Bulldoze", {
      fontSize: "14px",
      fontStyle: "bold",
      color: "#ffffff",
      align: "center",
    });
    text.setOrigin(0.5);
    container.add(text);

    // Add description
    const descText = this.scene.add.text(
      0,
      20,
      "Remove buildings\nand structures",
      {
        fontSize: "12px",
        color: "#ffffff",
        align: "center",
      }
    );
    descText.setOrigin(0.5);
    container.add(descText);

    // Add hover and click effects
    buttonBg.on("pointerover", () => {
      buttonBg.setFillStyle(0x555555);
    });

    buttonBg.on("pointerout", () => {
      if (!this.isBulldozeModeActive) {
        buttonBg.setFillStyle(0x333333);
      }
    });

    buttonBg.on("pointerdown", () => {
      buttonBg.setFillStyle(0x222222);
    });

    buttonBg.on("pointerup", () => {
      this.toggleBulldozeMode();
      if (this.isBulldozeModeActive) {
        buttonBg.setFillStyle(0x994400);
      } else {
        buttonBg.setFillStyle(0x555555);
      }
    });

    return container;
  }

  private toggleBulldozeMode(
    forceState?: boolean,
    shouldHideMenu: boolean = true
  ): void {
    // If forceState is provided, use it, otherwise toggle the current state
    this.isBulldozeModeActive =
      forceState !== undefined ? forceState : !this.isBulldozeModeActive;

    // Get the button background
    const buttonBg = this.bulldozeButton.getByName(
      "bulldozerBg"
    ) as Phaser.GameObjects.Rectangle;

    if (this.isBulldozeModeActive) {
      // Activate bulldoze mode
      this.buildingPlacer.enterBulldozeMode();

      // Update button appearance
      if (buttonBg) {
        buttonBg.setFillStyle(0x884444); // Red background when active
        buttonBg.setStrokeStyle(2, 0xff6666); // Brighter red border
      }

      // Change cursor
      this.scene.input.setDefaultCursor(
        "url(assets/bulldozer-cursor.png), auto"
      );

      // Hide the menu and notify the action menu
      if (shouldHideMenu) {
        this.hide(true);
      }
    } else {
      // Deactivate bulldoze mode
      this.buildingPlacer.exitBulldozeMode();

      // Reset button appearance
      if (buttonBg) {
        buttonBg.setFillStyle(0x444444); // Default background
        buttonBg.setStrokeStyle(2, 0x666666); // Default border
      }

      // Reset cursor
      this.scene.input.setDefaultCursor("default");
    }
  }

  private createBuildingButtons(): void {
    // Filter out habitat-expansion from available buildings
    const availableBuildings = BUILDING_DEFINITIONS.filter(
      (building) =>
        building.buildingType !== ("habitat-expansion" as BuildingType)
    );

    // Create a button for each building type
    const buttonWidth = 140;
    const buttonHeight = 120; // Increased height to accommodate image
    const padding = 15;
    const columns = 5;

    // Calculate the total width needed for all buttons
    const totalWidth = columns * (buttonWidth + padding) - padding;

    // Position the first button - reduced Y offset to move buttons higher
    let startX = -totalWidth / 2 + buttonWidth / 2;
    let startY = -64; // Reduced from 80 to 20 to move buttons higher up

    // Create buttons for each building type
    availableBuildings.forEach((building, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);

      const x = startX + col * (buttonWidth + padding);
      const y = startY + row * (buttonHeight + padding);

      // Create button background
      const buttonBg = this.scene.add.rectangle(
        x,
        y,
        buttonWidth,
        buttonHeight,
        0x333333
      );
      buttonBg.setStrokeStyle(2, 0x666666);
      buttonBg.setInteractive({ useHandCursor: true });
      this.contentContainer.add(buttonBg);

      // Add building image above the text
      const buildingImage = this.scene.add.sprite(
        x,
        y - 35, // Position image at the top of the button
        building.buildingType
      );
      buildingImage.setDisplaySize(48, 48);
      this.contentContainer.add(buildingImage);

      // Add building name text
      const nameText = this.scene.add.text(
        x,
        y - 5, // Position below the image
        building.name,
        {
          fontSize: "14px",
          fontStyle: "bold",
          color: "#ffffff",
          align: "center",
        }
      );
      nameText.setOrigin(0.5);
      this.contentContainer.add(nameText);

      // Add resource costs in two columns
      const costs = building.cost;
      const costTexts: Phaser.GameObjects.Text[] = [];

      // Split costs into two columns
      const leftColumnCosts = costs.slice(0, Math.ceil(costs.length / 2));
      const rightColumnCosts = costs.slice(Math.ceil(costs.length / 2));

      // Left column
      leftColumnCosts.forEach((cost, costIndex) => {
        const resource = ResourceManager.getResource(cost.type);
        const resourceEmoji = resource ? resource.emoji : "❓";
        const costText = this.scene.add.text(
          x - 30, // Left column
          y + 15 + costIndex * 18, // Start below the name, with spacing between costs
          `${resourceEmoji} ${cost.amount}`,
          {
            fontSize: "12px",
            color: "#ffffff",
          }
        );
        costText.setOrigin(0, 0.5);
        this.contentContainer.add(costText);
        costTexts.push(costText);
      });

      // Right column
      rightColumnCosts.forEach((cost, costIndex) => {
        const resource = ResourceManager.getResource(cost.type);
        const resourceEmoji = resource ? resource.emoji : "❓";
        const costText = this.scene.add.text(
          x + 10, // Right column
          y + 15 + costIndex * 18, // Start below the name, with spacing between costs
          `${resourceEmoji} ${cost.amount}`,
          {
            fontSize: "12px",
            color: "#ffffff",
          }
        );
        costText.setOrigin(0, 0.5);
        this.contentContainer.add(costText);
        costTexts.push(costText);
      });

      // Store button elements for later updates
      this.buildingButtons.set(building.buildingType, {
        background: buttonBg,
        nameText: nameText,
        image: buildingImage,
        costTexts: costTexts,
      });

      // Add hover and click effects
      buttonBg.on("pointerover", () => {
        // Only change color if button is enabled
        if (buttonBg.getData("enabled")) {
          buttonBg.setFillStyle(0x555555);
        } else {
          // Show tooltip for disabled buttons
          this.showResourceTooltip(building, x, y - buttonHeight / 2 - 20);
        }
      });

      buttonBg.on("pointerout", () => {
        // Restore original color based on enabled state
        if (buttonBg.getData("enabled")) {
          buttonBg.setFillStyle(0x333333);
        } else {
          buttonBg.setFillStyle(0x222222);
        }
        // Hide tooltip
        this.hideTooltip();
      });

      buttonBg.on("pointerdown", () => {
        // Only respond if button is enabled
        if (buttonBg.getData("enabled")) {
          buttonBg.setFillStyle(0x222222);
        }
      });

      buttonBg.on("pointerup", () => {
        // Only respond if button is enabled
        if (buttonBg.getData("enabled")) {
          buttonBg.setFillStyle(0x555555);
          this.selectBuildingItem(building.buildingType);
        }
      });

      // Set initial button state
      this.updateButtonState(building.buildingType);
    });

    // Add bulldoze button at the end
    const bulldozeIndex = availableBuildings.length;
    const bulldozeCol = bulldozeIndex % columns;
    const bulldozeRow = Math.floor(bulldozeIndex / columns);

    const bulldozeX = startX + bulldozeCol * (buttonWidth + padding);
    const bulldozeY = startY + bulldozeRow * (buttonHeight + padding);

    this.bulldozeButton = this.createBulldozeButton(bulldozeX, bulldozeY);
    this.contentContainer.add(this.bulldozeButton);
  }

  /**
   * Shows a tooltip explaining which resources are missing
   */
  private showResourceTooltip(building: any, x: number, y: number): void {
    // Hide any existing tooltip
    this.hideTooltip();

    // Create tooltip container
    this.tooltipContainer = this.scene.add.container(x, y);
    this.tooltipContainer!.setDepth(DEPTH.UI + 10);
    this.contentContainer.add(this.tooltipContainer!);

    // Find missing resources
    const missingResources: {
      type: ResourceType;
      amount: number;
      current: number;
    }[] = [];

    for (const cost of building.cost) {
      const currentAmount = ResourceManager.getResourceAmount(cost.type);
      if (currentAmount < cost.amount) {
        missingResources.push({
          type: cost.type,
          amount: cost.amount,
          current: currentAmount,
        });
      }
    }

    // Create tooltip background
    const padding = 10;
    const lineHeight = 20;
    const tooltipWidth = 200;
    const tooltipHeight = 50 + missingResources.length * lineHeight;

    const tooltipBg = this.scene.add.rectangle(
      0,
      0,
      tooltipWidth,
      tooltipHeight,
      0x000000,
      0.8
    );
    tooltipBg.setStrokeStyle(1, 0xffffff);
    this.tooltipContainer!.add(tooltipBg);

    // Add title
    const titleText = this.scene.add.text(
      0,
      -tooltipHeight / 2 + padding + 5,
      "Missing Resources:",
      {
        fontSize: "14px",
        fontStyle: "bold",
        color: "#ff5555",
        align: "center",
      }
    );
    titleText.setOrigin(0.5, 0);
    this.tooltipContainer!.add(titleText);

    // Add missing resource details
    missingResources.forEach((resource, index) => {
      const resourceDef = ResourceManager.getResource(resource.type);
      const resourceEmoji = resourceDef ? resourceDef.emoji : "❓";
      const resourceName = resourceDef ? resourceDef.name : resource.type;

      const resourceText = this.scene.add.text(
        -tooltipWidth / 2 + padding,
        -tooltipHeight / 2 + padding + 30 + index * lineHeight,
        `${resourceEmoji} ${resourceName}: ${resource.current}/${resource.amount}`,
        {
          fontSize: "12px",
          color: "#ffffff",
        }
      );
      resourceText.setOrigin(0, 0);
      this.tooltipContainer!.add(resourceText);
    });
  }

  /**
   * Hides the tooltip
   */
  private hideTooltip(): void {
    if (this.tooltipContainer) {
      this.tooltipContainer.destroy();
      this.tooltipContainer = null;
    }
  }

  /**
   * Updates the state of a building button based on resource availability
   * @param buildingType The type of building to update
   */
  private updateButtonState(buildingType: BuildingType): void {
    const buttonData = this.buildingButtons.get(buildingType);
    if (!buttonData) return;

    // Get the building definition
    const building = BUILDING_DEFINITIONS.find(
      (b) => b.buildingType === buildingType
    );
    if (!building) return;

    // Check if we have enough resources
    const hasEnoughResources = ResourceManager.hasResources(building.cost);

    // Update button state
    buttonData.background.setData("enabled", hasEnoughResources);

    if (hasEnoughResources) {
      // Enable button
      buttonData.background.setFillStyle(0x333333);
      buttonData.nameText.setAlpha(1);
      buttonData.image.setAlpha(1);
      buttonData.costTexts.forEach((text) => text.setAlpha(1));
    } else {
      // Disable button
      buttonData.background.setFillStyle(0x222222);
      buttonData.nameText.setAlpha(0.5);
      buttonData.image.setAlpha(0.5);
      buttonData.costTexts.forEach((text) => text.setAlpha(0.5));
    }
  }

  /**
   * Updates all building buttons based on current resource availability
   */
  public updateAllButtonStates(): void {
    for (const buildingType of this.buildingButtons.keys()) {
      this.updateButtonState(buildingType);
    }
  }

  private selectBuildingItem(buildingType: BuildingType): void {
    // Deactivate bulldoze mode if it's active
    if (this.isBulldozeModeActive) {
      this.toggleBulldozeMode(false, false);
    }

    // Set the building placer to place this building type
    this.buildingPlacer.selectBuildingType(buildingType);

    // Hide the menu and notify the action menu
    this.hide(true);
  }

  /**
   * Shows the build menu and updates button states
   */
  public show(): void {
    this.container.setVisible(true);
    this.updateAllButtonStates();
  }

  public hide(notifyActionMenu: boolean = false): void {
    this.container.setVisible(false);

    // Deactivate bulldoze mode if it's active
    if (this.isBulldozeModeActive) {
      this.toggleBulldozeMode(false, false);
    }

    // Notify the action menu if requested
    if (notifyActionMenu) {
      this.onMenuClosed();
    }
  }

  public isVisible(): boolean {
    return this.container.visible;
  }

  public destroy(): void {
    // Remove event listeners
    const gameState = (window as any).gameState;
    if (gameState && gameState.resources && gameState.resources.events) {
      gameState.resources.events.off(
        ResourceManager.EVENTS.INVENTORY_CHANGED,
        this.updateAllButtonStates,
        this
      );
    }

    // Destroy all components
    this.container.destroy();
  }
}
