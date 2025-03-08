import * as Phaser from "phaser";
import { Building } from "../entities/buildings/Building";
import { Robot, RobotState } from "../entities/robots/Robot";
import { Starship } from "../entities/starship";
import { ResourceNode } from "../entities/resourceNode";
import { TILE_SIZE } from "../constants";
import { CloseButton } from "./closeButton";
import { Blueprint } from "../entities/buildings/Blueprint";
import { RESOURCE_DEFINITIONS, ResourceType } from "../data/resources";
import { Tool } from "../entities/tools";
import { JobManager } from "../entities/robots/JobManager";
import {
  GrowZone,
  GrowthStage,
  CropType,
} from "../entities/buildings/GrowZone";
import { RangeSelectionBuilding } from "../entities/buildings/RangeSelectionBuilding";
import { DEFAULT_FONT } from "../constants";
import { DEPTH } from "../depth";

// Define a type for selectable entities
export type SelectableEntity =
  | Building
  | Robot
  | Starship
  | ResourceNode
  | Blueprint
  | Tool;

export class DetailView {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private selectedEntity: SelectableEntity | null = null;
  private selectionHighlight: Phaser.GameObjects.Rectangle | null = null;
  private closeButton: CloseButton;
  private escKey: Phaser.Input.Keyboard.Key;

  // UI elements
  private background: Phaser.GameObjects.Rectangle;
  private titleText: Phaser.GameObjects.Text;
  private profileImage: Phaser.GameObjects.Sprite;
  private propertiesContainer: Phaser.GameObjects.Container;
  private propertyTexts: Phaser.GameObjects.Text[] = [];
  private actionButtonsContainer: Phaser.GameObjects.Container;

  // Constants for styling
  private readonly COLORS = {
    background: 0x222222,
    border: 0x444444,
    text: 0xffffff,
    highlight: 0x4caf50, // Green highlight for selected entity
    propertyLabel: 0xaaaaaa,
    propertyValue: 0xffffff,
    buttonBackground: 0x336699,
    buttonHover: 0x4477aa,
    buttonText: 0xffffff,
    dangerButton: 0x993333,
    dangerButtonHover: 0xbb4444,
  };

  // Constants for layout
  private readonly PANEL_WIDTH = 300;
  private readonly PANEL_HEIGHT = 400;
  private readonly PADDING = 20;
  private readonly PROFILE_SIZE = TILE_SIZE;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Create container for all detail view elements
    this.container = scene.add.container(0, 0);
    this.container.name = "detailViewContainer"; // Add a name for debugging
    this.container.setDepth(DEPTH.UI); // Set a high depth to ensure it's on top

    // Create background panel - we'll resize it dynamically based on content
    this.background = scene.add.rectangle(
      0,
      0,
      this.PANEL_WIDTH,
      100, // Initial height, will be updated dynamically
      0x2a2a2a // Darker background for better contrast
    );
    this.background.setStrokeStyle(2, 0x666666); // More visible border
    this.background.setOrigin(0);
    this.container.add(this.background);

    // Create profile image placeholder - positioned in top left
    this.profileImage = scene.add.sprite(
      this.PADDING,
      this.PADDING,
      "habitat" // Default texture, will be replaced when entity is selected
    );
    this.profileImage.setOrigin(0, 0); // Set origin to top-left
    this.profileImage.setVisible(false); // Hide until entity is selected
    this.container.add(this.profileImage);

    // Create title text - positioned under the profile image
    this.titleText = scene.add.text(
      this.PADDING,
      this.PADDING + this.PROFILE_SIZE + 10,
      "Select an entity",
      {
        fontSize: "18px",
        color: "#ffffff",
        fontStyle: "bold",
        fontFamily: DEFAULT_FONT,
      }
    );
    this.container.add(this.titleText);

    // Create container for property texts - positioned below the title
    this.propertiesContainer = scene.add.container(
      this.PADDING,
      this.PADDING + this.PROFILE_SIZE + 40
    );
    this.container.add(this.propertiesContainer);

    // Create container for action buttons - positioned below the properties
    this.actionButtonsContainer = scene.add.container(
      this.PADDING,
      this.PADDING + this.PROFILE_SIZE + 40
    );
    this.container.add(this.actionButtonsContainer);

    // Add close button
    this.closeButton = new CloseButton(
      scene,
      this.PANEL_WIDTH - this.PADDING,
      this.PADDING,
      24,
      () => this.clearSelection()
    );
    this.container.add(this.closeButton);

    // Position in bottom right corner - do this AFTER adding all elements
    this.positionPanel();

    // Hide the panel initially
    this.container.setVisible(false);

    // Add to scene
    scene.add.existing(this.container);

    // IMPORTANT: Set the container to be fixed to the camera
    this.container.setScrollFactor(0);

    // Add click listener to the scene for entity selection
    this.setupClickListener();

    // Add ESC key listener
    if (scene.input.keyboard) {
      this.escKey = scene.input.keyboard.addKey(
        Phaser.Input.Keyboard.KeyCodes.ESC
      );
    }

    // Initialize event listeners
    this.initEventListeners();

    // Debug message to confirm creation
    console.log(
      "DetailView created and positioned at",
      this.container.x,
      this.container.y
    );
    console.log("DetailView dimensions:", this.PANEL_WIDTH, this.PANEL_HEIGHT);
    console.log("Scene dimensions:", scene.scale.width, scene.scale.height);
  }

  private positionPanel(): void {
    // Position in bottom right corner with minimal padding
    const screenWidth = this.scene.scale.width;
    const screenHeight = this.scene.scale.height;

    const x = screenWidth - this.PANEL_WIDTH - 10; // Reduced padding
    const y = screenHeight - this.background.height - 10; // Use actual height with minimal padding

    this.container.setPosition(x, y);
  }

  private setupClickListener(): void {
    this.scene.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      // Only handle left clicks
      if (pointer.leftButtonDown()) {
        console.log("Click detected at", pointer.x, pointer.y);

        // Convert pointer position to world coordinates
        const worldPoint = this.scene.cameras.main.getWorldPoint(
          pointer.x,
          pointer.y
        );

        console.log("World coordinates:", worldPoint.x, worldPoint.y);

        // Check if click is on the detail view panel itself
        const panelBounds = {
          x: this.container.x,
          y: this.container.y,
          width: this.PANEL_WIDTH,
          height: this.background.height,
        };

        // If the click is within the panel, don't process it for entity selection
        if (
          pointer.x >= panelBounds.x &&
          pointer.x <= panelBounds.x + panelBounds.width &&
          pointer.y >= panelBounds.y &&
          pointer.y <= panelBounds.y + panelBounds.height
        ) {
          console.log(
            "Click is on the detail view panel, ignoring for entity selection"
          );
          return;
        }

        // Check if a tool is currently selected
        const scene = this.scene as any;
        if (scene.player && scene.player.getToolInventory().getSelectedTool()) {
          console.log("Tool is selected, ignoring entity selection");
          return;
        }

        // Check if click is on an entity
        const entity = this.findEntityAtPosition(worldPoint.x, worldPoint.y);

        if (entity) {
          console.log("Entity selected:", entity);
          this.selectEntity(entity);
        } else {
          // If clicked outside any entity, deselect
          console.log("No entity found at click position");
          this.clearSelection();
        }
      }
    });
  }

  private findEntityAtPosition(x: number, y: number): SelectableEntity | null {
    const scene = this.scene as any; // Cast to any to access MainScene properties

    console.log("Searching for entity at", x, y);
    console.log("Available entities:", {
      buildings: scene.buildings ? scene.buildings.length : 0,
      blueprints: scene.blueprints ? scene.blueprints.length : 0,
      robots: scene.robots ? scene.robots.length : 0,
      hasStarship: !!scene.starship,
      resourceNodes: scene.resourceNodes ? scene.resourceNodes.length : 0,
    });

    // Check if clicked on starship - if so, find the associated landing pad
    if (scene.starship) {
      const distance = Phaser.Math.Distance.Between(
        x,
        y,
        scene.starship.x,
        scene.starship.y
      );
      if (distance < TILE_SIZE) {
        console.log("Clicked on starship, finding associated landing pad");

        // Find the landing pad that owns this starship
        if (scene.buildings) {
          for (const building of scene.buildings) {
            if (building.buildingType === "landing-pad") {
              const landingPad = building as any; // Cast to any to access getStarship
              if (
                landingPad.getStarship &&
                landingPad.getStarship() === scene.starship
              ) {
                console.log("Found landing pad for starship:", landingPad);
                return landingPad;
              }
            }
          }
        }
      }
    }

    // Check buildings (including multi-tile buildings)
    if (scene.buildings) {
      for (const building of scene.buildings) {
        const buildingWidth = building.tileWidth * TILE_SIZE;
        const buildingHeight = building.tileHeight * TILE_SIZE;

        // Check if this is a RangeSelectionBuilding
        const isRangeSelection = building instanceof RangeSelectionBuilding;

        if (isRangeSelection) {
          // For RangeSelectionBuilding, use the top-left corner
          const tileGridX = Math.floor(building.x / TILE_SIZE);
          const tileGridY = Math.floor(building.y / TILE_SIZE);

          // Calculate the top-left corner of the building in world coordinates
          const topLeftX = tileGridX * TILE_SIZE;
          const topLeftY = tileGridY * TILE_SIZE;

          // Check if click is within the building's bounds using the top-left corner
          if (
            x >= topLeftX &&
            x <= topLeftX + buildingWidth &&
            y >= topLeftY &&
            y <= topLeftY + buildingHeight
          ) {
            console.log("RangeSelectionBuilding found:", building);
            return building;
          }
        } else {
          // For regular buildings, check if click is within the bounds centered on the building
          if (
            x >= building.x - buildingWidth / 2 &&
            x <= building.x + buildingWidth / 2 &&
            y >= building.y - buildingHeight / 2 &&
            y <= building.y + buildingHeight / 2
          ) {
            console.log("Regular Building found:", building);
            return building;
          }
        }
      }
    }

    // Check blueprints (including multi-tile blueprints)
    if (scene.blueprints) {
      for (const blueprint of scene.blueprints) {
        const blueprintWidth = blueprint.tileWidth * TILE_SIZE;
        const blueprintHeight = blueprint.tileHeight * TILE_SIZE;

        // For blueprints, always use the top-left corner approach
        // since they're always positioned at their center
        if (
          x >= blueprint.x - blueprintWidth / 2 &&
          x <= blueprint.x + blueprintWidth / 2 &&
          y >= blueprint.y - blueprintHeight / 2 &&
          y <= blueprint.y + blueprintHeight / 2
        ) {
          console.log("Blueprint found:", blueprint);
          return blueprint;
        }
      }
    }

    // Check robots
    if (scene.robots) {
      for (const robot of scene.robots) {
        // Use the robot's position from the scene
        const robotPosition = this.getRobotPosition(robot);
        const distance = Phaser.Math.Distance.Between(
          x,
          y,
          robotPosition.x,
          robotPosition.y
        );
        if (distance < TILE_SIZE / 2) {
          console.log("Robot found:", robot);
          return robot;
        }
      }
    }

    // Check resource nodes
    if (scene.resourceNodes) {
      for (const node of scene.resourceNodes) {
        const distance = Phaser.Math.Distance.Between(x, y, node.x, node.y);
        if (distance < TILE_SIZE / 2) {
          console.log("Resource node found:", node);
          return node;
        }
      }
    }

    console.log("No entity found at position");
    return null;
  }

  // Helper method to get robot position
  private getRobotPosition(robot: Robot): { x: number; y: number } {
    // Since robot.container is protected, we need to use the scene to find the robot's position
    // We'll use the robot's parent container position
    const robotAsAny = robot as any;

    // Try to get position from the container if it exists
    if (robotAsAny.container) {
      return {
        x: robotAsAny.container.x,
        y: robotAsAny.container.y,
      };
    }

    // Fallback to the robot's position if available
    if (typeof robotAsAny.x === "number" && typeof robotAsAny.y === "number") {
      return {
        x: robotAsAny.x,
        y: robotAsAny.y,
      };
    }

    // Last resort: return a default position
    return { x: 0, y: 0 };
  }

  public selectEntity(entity: SelectableEntity): void {
    // Clear previous selection
    this.clearSelection();

    // Set new selection
    this.selectedEntity = entity;

    // Show the panel
    this.container.setVisible(true);

    // Create highlight for selected entity
    this.createSelectionHighlight(entity);

    // Update panel content
    this.updatePanelContent();
  }

  private createSelectionHighlight(entity: SelectableEntity): void {
    // Remove previous highlight if exists
    if (this.selectionHighlight) {
      this.selectionHighlight.destroy();
      this.selectionHighlight = null;
    }

    // Don't create highlight for tools since they follow the player
    if (entity instanceof Tool) {
      return;
    }

    // Determine size based on entity type
    let width = TILE_SIZE;
    let height = TILE_SIZE;
    let entityPosition = { x: 0, y: 0 };
    let useTopLeftOrigin = false;

    if (entity instanceof Building || entity instanceof Blueprint) {
      width = entity.tileWidth * TILE_SIZE;
      height = entity.tileHeight * TILE_SIZE;

      // Check if this is a RangeSelectionBuilding
      const isRangeSelection = entity instanceof RangeSelectionBuilding;

      if (isRangeSelection) {
        // For RangeSelectionBuilding, use the top-left corner
        const tileGridX = Math.floor(entity.x / TILE_SIZE);
        const tileGridY = Math.floor(entity.y / TILE_SIZE);

        // Calculate the top-left corner of the building in world coordinates
        const topLeftX = tileGridX * TILE_SIZE;
        const topLeftY = tileGridY * TILE_SIZE;

        entityPosition = { x: topLeftX, y: topLeftY };
        useTopLeftOrigin = true;

        console.log(
          `Creating selection highlight for RangeSelectionBuilding ${entity.constructor.name}:`
        );
      } else {
        // For regular buildings, center the highlight on the building
        entityPosition = { x: entity.x, y: entity.y };
        useTopLeftOrigin = false;

        console.log(
          `Creating selection highlight for regular Building ${entity.constructor.name}:`
        );
      }

      console.log(`  Entity position: (${entity.x}, ${entity.y})`);
      console.log(
        `  Entity dimensions: ${entity.tileWidth}x${entity.tileHeight} tiles`
      );
      console.log(
        `  Highlight position: (${entityPosition.x}, ${entityPosition.y})`
      );
      console.log(`  Highlight dimensions: ${width}x${height} pixels`);
      console.log(`  Using top-left origin: ${useTopLeftOrigin}`);
    } else if (entity instanceof Robot) {
      entityPosition = this.getRobotPosition(entity);
    } else {
      // For other entities
      entityPosition = { x: entity.x, y: entity.y };
    }

    // Create highlight rectangle
    this.selectionHighlight = this.scene.add.rectangle(
      entityPosition.x,
      entityPosition.y,
      width,
      height,
      this.COLORS.highlight,
      0.3
    );

    // Add stroke for better visibility
    this.selectionHighlight.setStrokeStyle(3, this.COLORS.highlight, 0.8);

    // Set the origin based on the entity type
    if (useTopLeftOrigin) {
      // For RangeSelectionBuilding, use top-left origin
      this.selectionHighlight.setOrigin(0, 0);
    } else {
      // For other entities, center the highlight
      this.selectionHighlight.setOrigin(0.5);
    }
  }

  private updatePanelContent(): void {
    if (!this.selectedEntity) return;

    // Update title with entity name
    this.titleText.setText(this.getEntityName(this.selectedEntity));

    // Adjust layout based on entity type
    if (this.selectedEntity instanceof ResourceNode) {
      // For resource nodes, show profile image and position title under it
      this.titleText.setPosition(
        this.PADDING,
        this.PADDING + this.PROFILE_SIZE + 10
      );
    } else {
      // For other entities, position title under the profile image
      this.titleText.setPosition(
        this.PADDING,
        this.PADDING + this.PROFILE_SIZE + 10
      );
    }

    // Update profile image
    this.updateProfileImage();

    // Clear existing buttons
    this.actionButtonsContainer.removeAll(true);

    // Add action buttons (only for blueprints)
    if (this.selectedEntity instanceof Blueprint) {
      this.addActionButtons();

      // Position the action buttons container below the title
      this.actionButtonsContainer.setPosition(
        this.PADDING,
        this.PADDING + this.PROFILE_SIZE + 40
      );

      // Position properties container below the action buttons
      this.propertiesContainer.setPosition(
        this.PADDING,
        this.PADDING +
          this.PROFILE_SIZE +
          40 +
          this.actionButtonsContainer.height +
          20
      );
    } else {
      // For other entities, position properties directly below the title
      this.propertiesContainer.setPosition(
        this.PADDING,
        this.PADDING + this.PROFILE_SIZE + 40
      );
    }

    // Clear existing properties
    this.clearProperties();

    // Add entity properties
    this.addEntityProperties();

    // Update panel height based on content
    this.updatePanelHeight();

    // Reposition panel after height update
    this.positionPanel();
  }

  private updatePanelHeight(): void {
    // Calculate total height based on properties
    let totalHeight = this.PADDING * 2 + this.PROFILE_SIZE + 40; // Initial height with padding, profile, and title

    // Add height for action buttons if they exist (only for blueprints)
    if (
      this.selectedEntity instanceof Blueprint &&
      this.actionButtonsContainer.length > 0
    ) {
      totalHeight += 60; // Height for action buttons
    }

    // Add height of properties container
    if (this.propertiesContainer.length > 0) {
      // Find the lowest y position of any property text
      let lowestY = 0;
      this.propertyTexts.forEach((text) => {
        const textBottom = text.y + text.height;
        if (textBottom > lowestY) {
          lowestY = textBottom;
        }
      });
      totalHeight += lowestY;
    }

    // Add some padding at the bottom
    totalHeight += 20;

    // Set minimum height
    totalHeight = Math.max(totalHeight, this.PANEL_HEIGHT);

    // Update background height
    this.background.height = totalHeight;
  }

  private getEntityName(entity: SelectableEntity): string {
    if (entity instanceof Building) {
      // Use type assertion to access protected property
      const buildingAsAny = entity as any;
      return buildingAsAny.buildingType || "Building";
    } else if (entity instanceof Blueprint) {
      // Use type assertion to access protected property
      const blueprintAsAny = entity as any;
      return `${blueprintAsAny.buildingType || "Building"} (Blueprint)`;
    } else if (entity instanceof Robot) {
      return entity.getRobotName();
    } else if (entity instanceof Starship) {
      return "Starship";
    } else if (entity instanceof ResourceNode) {
      const resource = entity.getResource();
      return `${resource.name} Deposit`;
    } else if (entity instanceof Tool) {
      return entity.name;
    }

    return "Unknown Entity";
  }

  private updateProfileImage(): void {
    if (!this.selectedEntity) return;

    // Set texture based on entity type
    let texture = "";
    let preserveAspectRatio = false;
    let useEmoji = false;
    let emoji = "";

    if (this.selectedEntity instanceof Building) {
      // Get the texture key from the sprite if possible
      const sprite = (this.selectedEntity as any).sprite;
      texture = sprite && sprite.texture ? sprite.texture.key : "habitat";
    } else if (this.selectedEntity instanceof Blueprint) {
      // Get the texture key from the sprite if possible
      const sprite = (this.selectedEntity as any).sprite;
      texture = sprite && sprite.texture ? sprite.texture.key : "habitat";
    } else if (this.selectedEntity instanceof Robot) {
      // Check if it's a mining drone or optimus
      const robotName = this.selectedEntity.getRobotName().toLowerCase();
      if (robotName.includes("mining") || robotName.includes("drone")) {
        texture = "mining-drone";
      } else {
        texture = "optimus";
      }
    } else if (this.selectedEntity instanceof Starship) {
      texture = "starship";
      preserveAspectRatio = true; // Preserve aspect ratio for starship
    } else if (this.selectedEntity instanceof ResourceNode) {
      // For resource nodes, use the emoji instead of a texture
      useEmoji = true;
      const resource = this.selectedEntity.getResource();
      const resourceDef = this.getResourceDefinition(resource.type);
      emoji = resourceDef?.emoji || resource.type.charAt(0).toUpperCase();
    } else if (this.selectedEntity instanceof Tool) {
      // For tools, use the tool's type as the texture
      texture = this.selectedEntity.type;
      preserveAspectRatio = true;
    }

    if (useEmoji) {
      // Hide the sprite and create a text object with the emoji
      this.profileImage.setVisible(false);

      // Remove any existing emoji text
      const existingEmojiText = this.container.getByName(
        "resourceEmoji"
      ) as Phaser.GameObjects.Text;
      if (existingEmojiText) {
        existingEmojiText.destroy();
      }

      // Create a new emoji text
      const emojiText = this.scene.add.text(
        this.PADDING + this.PROFILE_SIZE / 2,
        this.PADDING + this.PROFILE_SIZE / 2,
        emoji,
        {
          fontSize: "48px",
          color: "#ffffff",
        }
      );
      emojiText.setOrigin(0.5);
      emojiText.setName("resourceEmoji");
      this.container.add(emojiText);
    } else {
      // Remove any existing emoji text
      const existingEmojiText = this.container.getByName(
        "resourceEmoji"
      ) as Phaser.GameObjects.Text;
      if (existingEmojiText) {
        existingEmojiText.destroy();
      }

      // Update sprite texture if it exists in the cache
      if (this.scene.textures.exists(texture)) {
        this.profileImage.setTexture(texture);

        if (preserveAspectRatio) {
          // Preserve aspect ratio by setting only the width or height
          const textureFrame = this.scene.textures.getFrame(texture);
          const aspectRatio = textureFrame.width / textureFrame.height;

          if (aspectRatio >= 1) {
            // Wider than tall
            this.profileImage.setDisplaySize(
              this.PROFILE_SIZE,
              this.PROFILE_SIZE / aspectRatio
            );
          } else {
            // Taller than wide
            this.profileImage.setDisplaySize(
              this.PROFILE_SIZE * aspectRatio,
              this.PROFILE_SIZE
            );
          }
        } else {
          // Use fixed size for other entities
          this.profileImage.setDisplaySize(
            this.PROFILE_SIZE,
            this.PROFILE_SIZE
          );
        }

        this.profileImage.setVisible(true);
      } else {
        console.warn(`Texture '${texture}' not found for entity`);
        this.profileImage.setVisible(false);
      }
    }
  }

  private clearProperties(): void {
    // Remove all property texts
    this.propertyTexts.forEach((text) => text.destroy());
    this.propertyTexts = [];

    // Clear the properties container
    this.propertiesContainer.removeAll(true);
  }

  private addEntityProperties(): void {
    if (!this.selectedEntity) return;

    // Get properties based on entity type
    let properties: { label: string; value: string }[] = [];

    if (this.selectedEntity instanceof Building) {
      properties = this.getBuildingProperties(this.selectedEntity);
    } else if (this.selectedEntity instanceof Robot) {
      properties = this.getRobotProperties(this.selectedEntity);
    } else if (this.selectedEntity instanceof Starship) {
      properties = this.getStarshipProperties(this.selectedEntity);
    } else if (this.selectedEntity instanceof ResourceNode) {
      properties = this.getResourceNodeProperties(this.selectedEntity);
    } else if (this.selectedEntity instanceof Blueprint) {
      properties = this.getBlueprintProperties(this.selectedEntity);
    } else if (this.selectedEntity instanceof Tool) {
      properties = this.getToolProperties(this.selectedEntity);
    }

    // Add properties to the container
    let yOffset = 0;
    properties.forEach((property) => {
      // Create label text
      const labelText = this.scene.add.text(0, yOffset, `${property.label}:`, {
        fontSize: "16px",
        color: `#${this.COLORS.propertyLabel.toString(16)}`,
        fontStyle: "bold",
        fontFamily: DEFAULT_FONT,
      });

      // Create value text
      const valueText = this.scene.add.text(150, yOffset, property.value, {
        fontSize: "16px",
        color: `#${this.COLORS.propertyValue.toString(16)}`,
        fontFamily: DEFAULT_FONT,
      });

      // Add to container
      this.propertiesContainer.add([labelText, valueText]);
      this.propertyTexts.push(labelText, valueText);

      // Move down for next property
      yOffset += 25;
    });
  }

  private getResourceDefinition(
    resourceType: ResourceType
  ): { name: string; emoji: string } | null {
    // Try to find the resource in the imported RESOURCE_DEFINITIONS
    const resourceDef = RESOURCE_DEFINITIONS.find(
      (r) => r.type === resourceType
    );
    if (resourceDef) {
      return { name: resourceDef.name, emoji: resourceDef.emoji };
    }
    return null;
  }

  private getBuildingProperties(
    building: Building
  ): { label: string; value: string }[] {
    const properties: { label: string; value: string }[] = [];

    try {
      // Add building type
      properties.push({
        label: "Type",
        value: building.getBuildingType(),
      });

      // Add health information
      if ("getHealth" in building && typeof building.getHealth === "function") {
        properties.push({
          label: "Health",
          value: `${building.getHealth()} / ${building.getMaxHealth()}`,
        });
      }

      // Add grow zone specific information
      if (building.getBuildingType() === "grow-zone") {
        // Check if the building is actually a GrowZone instance
        if (building instanceof GrowZone) {
          const growZone = building as GrowZone;

          // Safely access methods with error handling
          try {
            // Add selected crop type
            if (typeof growZone.getSelectedCropType === "function") {
              const cropType = growZone.getSelectedCropType();
              properties.push({
                label: "Selected Crop",
                value: cropType.charAt(0).toUpperCase() + cropType.slice(1),
              });
            } else {
              console.error(
                "GrowZone missing getSelectedCropType method:",
                growZone
              );
              properties.push({
                label: "Selected Crop",
                value: "Unknown (Error)",
              });
            }

            // Add yield information
            if (
              typeof growZone.getPotentialYield === "function" &&
              typeof growZone.getCurrentYield === "function"
            ) {
              const potentialYield = growZone.getPotentialYield();
              const currentYield = growZone.getCurrentYield();

              properties.push({
                label: "Potential Yield",
                value: `${potentialYield} units`,
              });

              properties.push({
                label: "Current Yield",
                value: `${currentYield} units`,
              });
            }

            // Add growth stage information
            if (typeof growZone.getGrowthInfo === "function") {
              try {
                const growthInfo = growZone.getGrowthInfo();

                properties.push({
                  label: "Dry Tiles",
                  value:
                    growthInfo
                      .find((info) => info.stage === GrowthStage.DRY)
                      ?.count.toString() || "0",
                });

                properties.push({
                  label: "Wet Tiles",
                  value:
                    growthInfo
                      .find((info) => info.stage === GrowthStage.WET)
                      ?.count.toString() || "0",
                });

                properties.push({
                  label: "Growing Tiles",
                  value:
                    growthInfo
                      .find((info) => info.stage === GrowthStage.GROWING)
                      ?.count.toString() || "0",
                });
              } catch (error) {
                console.error("Error getting growth info:", error);
                properties.push({
                  label: "Growth Stages",
                  value: "Error retrieving data",
                });
              }
            }

            // Add growth progress
            if (typeof growZone.getAverageGrowthProgress === "function") {
              try {
                const progress = growZone.getAverageGrowthProgress();
                properties.push({
                  label: "Growth Progress",
                  value: `${Math.floor(progress * 100)}%`,
                });
              } catch (error) {
                console.error("Error getting growth progress:", error);
                properties.push({
                  label: "Growth Progress",
                  value: "Error retrieving data",
                });
              }
            }

            // Add time until next harvest
            if (typeof growZone.getTimeUntilNextHarvest === "function") {
              const timeUntilHarvest = growZone.getTimeUntilNextHarvest();
              if (timeUntilHarvest > 0) {
                properties.push({
                  label: "Time Until Harvest",
                  value: `${Math.ceil(timeUntilHarvest / 1000)} seconds`,
                });
              }
            }
          } catch (error) {
            console.error("Error accessing GrowZone methods:", error);
            properties.push({
              label: "Error",
              value: "Failed to access GrowZone data",
            });
          }
        } else {
          // Log an error if the building is not a GrowZone instance
          console.error(
            "Building has type 'grow-zone' but is not a GrowZone instance:",
            building
          );

          // Add a fallback property
          properties.push({
            label: "Type",
            value: "Grow Zone (Error: Invalid instance)",
          });
        }
      }

      // Add other building-specific properties here...

      // Add inventory if the building has one
      if (
        "getInventory" in building &&
        typeof building.getInventory === "function"
      ) {
        properties.push({
          label: "Inventory",
          value: "See below",
        });
      }
    } catch (error) {
      console.error("Error in getBuildingProperties:", error);
      properties.push({
        label: "Error",
        value: "Failed to get building properties",
      });
    }

    return properties;
  }

  private getBlueprintProperties(
    blueprint: Blueprint
  ): { label: string; value: string }[] {
    // Get the building type using any to access protected property
    const buildingType = blueprint.getBuildingType();

    const properties: { label: string; value: string }[] = [
      { label: "Type", value: `${buildingType || "Unknown"} (Blueprint)` },
      { label: "Status", value: "Under Construction" },
    ];

    // Add size information for multi-tile blueprints
    if (blueprint.tileWidth > 1 || blueprint.tileHeight > 1) {
      properties.push({
        label: "Size",
        value: `${blueprint.tileWidth}x${blueprint.tileHeight} tiles`,
      });
    }

    // Try to get construction progress
    const blueprintAny = blueprint as any;
    if (typeof blueprintAny.buildProgress === "number") {
      const progress = Math.floor(blueprintAny.buildProgress * 100);
      properties.push({ label: "Progress", value: `${progress}%` });
    }

    // Try to get required resources
    if (
      blueprintAny.requiredResources &&
      blueprintAny.requiredResources.length > 0
    ) {
      blueprintAny.requiredResources.forEach((resource: any) => {
        properties.push({
          label: `${resource.type}`,
          value: `${resource.current}/${resource.amount}`,
        });
      });
    }

    return properties;
  }

  private getRobotProperties(robot: Robot): { label: string; value: string }[] {
    // Get the robot state
    const state = robot.getRobotState();

    // Format the state to be more readable
    let stateDisplay = state;
    switch (state) {
      case RobotState.IDLE:
        stateDisplay = "Idle";
        break;
      case RobotState.MOVING:
        stateDisplay = "Moving";
        break;
      case RobotState.WORKING:
        stateDisplay = "Working";
        break;
      case RobotState.RETURNING:
        stateDisplay = "Returning to base";
        break;
      case RobotState.CARRYING:
        stateDisplay = "Carrying resources";
        break;
    }

    return [
      { label: "Type", value: robot.getRobotName() },
      { label: "Status", value: stateDisplay },
      { label: "Health", value: `${robot.getHealth()}%` },
      { label: "Job", value: this.getRobotJobDescription(robot) },
    ];
  }

  private getRobotJobDescription(robot: Robot): string {
    const state = robot.getRobotState();

    switch (state) {
      case RobotState.IDLE:
        return "Idle";
      case RobotState.MOVING:
        return "Moving";
      case RobotState.WORKING:
        return "Working";
      case RobotState.RETURNING:
        return "Returning to base";
      case RobotState.CARRYING:
        return "Carrying resources";
      default:
        return "Unknown";
    }
  }

  private getStarshipProperties(
    starship: Starship
  ): { label: string; value: string }[] {
    // Try to get more detailed information if available
    const starshipAny = starship as any;
    const fuel = starshipAny.fuel ? `${starshipAny.fuel}%` : "85%";
    const status = starshipAny.status ? starshipAny.status : "Landed";

    return [
      { label: "Status", value: status },
      { label: "Fuel", value: fuel },
      // Inventory will be displayed as a grid
    ];
  }

  private getResourceNodeProperties(
    node: ResourceNode
  ): { label: string; value: string }[] {
    const resource = node.getResource();
    const amount = node.getAmount();

    // Calculate quality based on amount
    let quality = "Low";
    if (amount > 50) {
      quality = "High";
    } else if (amount > 20) {
      quality = "Medium";
    }

    return [
      { label: "Resource", value: resource.name },
      { label: "Amount", value: `${amount} units` },
      { label: "Quality", value: quality },
    ];
  }

  public clearSelection(): void {
    // Clear the selected entity
    this.selectedEntity = null;

    // Hide the panel
    this.container.setVisible(false);

    // Remove the selection highlight if it exists
    if (this.selectionHighlight) {
      this.selectionHighlight.destroy();
      this.selectionHighlight = null;
    }

    // Clear properties
    this.clearProperties();

    // Clear action buttons
    this.actionButtonsContainer.removeAll(true);
  }

  public update(time: number, delta: number): void {
    // Check for ESC key to close the panel
    if (this.escKey && this.escKey.isDown) {
      this.clearSelection();
    }

    // Update the selection highlight position for moving entities like robots
    this.updateSelectionHighlight();

    // Update properties if needed (for dynamic values)
    if (this.selectedEntity && this.container.visible) {
      this.updatePanelContent();
    }
  }

  private updateSelectionHighlight(): void {
    // If no entity is selected or no highlight exists, return
    if (!this.selectedEntity || !this.selectionHighlight) return;

    // Only update for robots which can move
    if (this.selectedEntity instanceof Robot) {
      const position = this.getRobotPosition(this.selectedEntity);
      this.selectionHighlight.setPosition(position.x, position.y);
    }
  }

  private handleResize(): void {
    // Reposition panel when window is resized
    this.positionPanel();
    console.log(
      "Window resized, repositioning panel to:",
      this.container.x,
      this.container.y
    );
  }

  public destroy(): void {
    // Clean up event listeners
    this.scene.scale.off("resize", this.handleResize, this);

    // Clean up ESC key
    if (this.escKey) {
      this.escKey.destroy();
    }

    // Remove all game objects
    if (this.selectionHighlight) {
      this.selectionHighlight.destroy();
    }

    // Remove any resource emoji text
    const emojiText = this.container.getByName(
      "resourceEmoji"
    ) as Phaser.GameObjects.Text;
    if (emojiText) {
      emojiText.destroy();
    }

    // Destroy close button
    this.closeButton.destroy();

    this.container.destroy();
  }

  // Getter for the container
  public getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  // Handle tool selection event
  private handleToolSelected(tool: Tool): void {
    console.log("Tool selected event received:", tool);
    this.selectEntity(tool);
  }

  // Get properties for a tool
  private getToolProperties(tool: Tool): { label: string; value: string }[] {
    return [
      { label: "Type", value: tool.type },
      { label: "Name", value: tool.name },
      { label: "Description", value: this.getToolDescription(tool) },
      { label: "Controls", value: "Left-click or Space to fire" },
    ];
  }

  // Get description for a tool
  private getToolDescription(tool: Tool): string {
    switch (tool.type) {
      case "assault-rifle":
        return "Standard issue assault rifle. Effective against aliens.";
      default:
        return "A useful tool for Mars colonization.";
    }
  }

  // Create an action button
  private createActionButton(
    text: string,
    onClick: () => void,
    isDanger: boolean = false
  ): Phaser.GameObjects.Container {
    const buttonWidth = 160;
    const buttonHeight = 40;

    // Create container for the button
    const button = this.scene.add.container(0, 0);

    // Button background
    const buttonBg = this.scene.add
      .rectangle(
        buttonWidth / 2,
        buttonHeight / 2,
        buttonWidth,
        buttonHeight,
        isDanger ? this.COLORS.dangerButton : this.COLORS.buttonBackground
      )
      .setOrigin(0.5);

    // Add a border to the button
    const buttonBorder = this.scene.add
      .rectangle(
        buttonWidth / 2,
        buttonHeight / 2,
        buttonWidth,
        buttonHeight,
        0xffffff,
        0
      )
      .setOrigin(0.5)
      .setStrokeStyle(2, 0xffffff, 0.5);

    // Button text
    const buttonText = this.scene.add
      .text(buttonWidth / 2, buttonHeight / 2, text, {
        fontSize: "14px",
        color: "#ffffff",
        fontStyle: "bold",
        fontFamily: DEFAULT_FONT,
      })
      .setOrigin(0.5);

    // Add elements to the container
    button.add([buttonBorder, buttonBg, buttonText]);

    // Make the button interactive with cursor pointer
    const hitArea = new Phaser.Geom.Rectangle(0, 0, buttonWidth, buttonHeight);
    button.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);

    // Use a sprite to set the cursor style
    const cursorSprite = this.scene.add
      .sprite(buttonWidth / 2, buttonHeight / 2, "__DEFAULT")
      .setAlpha(0);
    cursorSprite.setInteractive({ cursor: "pointer" });
    button.add(cursorSprite);

    // Add hover effects
    button.on("pointerover", () => {
      buttonBg.setFillStyle(
        isDanger ? this.COLORS.dangerButtonHover : this.COLORS.buttonHover
      );
      buttonBorder.setStrokeStyle(2, 0xffffff, 1);
      buttonText.setShadow(0, 0, "#ffffff", 5);
    });

    button.on("pointerout", () => {
      buttonBg.setFillStyle(
        isDanger ? this.COLORS.dangerButton : this.COLORS.buttonBackground
      );
      buttonBorder.setStrokeStyle(2, 0xffffff, 0.5);
      buttonText.setShadow(0, 0, "transparent", 0);
    });

    // Add down effect (when button is pressed)
    button.on("pointerdown", () => {
      buttonBg.setFillStyle(isDanger ? 0x772222 : 0x224477);
      buttonText.setY(buttonHeight / 2 + 2); // Move text down slightly to show press effect
      buttonBorder.setStrokeStyle(2, 0xffffff, 0.8);
    });

    // Add click handler and reset the button state
    button.on("pointerup", () => {
      buttonBg.setFillStyle(
        isDanger ? this.COLORS.dangerButton : this.COLORS.buttonBackground
      );
      buttonText.setY(buttonHeight / 2); // Reset text position
      onClick();
    });

    // Also reset on pointer out after down
    button.on("pointerout", () => {
      buttonText.setY(buttonHeight / 2); // Reset text position
    });

    return button;
  }

  // Add action buttons based on the selected entity type
  private addActionButtons(): void {
    // Handle blueprints
    if (this.selectedEntity instanceof Blueprint) {
      // Create cancel button for blueprints
      const cancelButton = this.createActionButton(
        "Cancel Blueprint",
        () => this.cancelBlueprint(this.selectedEntity as Blueprint),
        true // isDanger = true for red button
      );

      // Add button to container
      this.actionButtonsContainer.add(cancelButton);
      return;
    }

    // Handle grow zones
    if (
      this.selectedEntity instanceof Building &&
      this.selectedEntity.getBuildingType() === "grow-zone"
    ) {
      const growZone = this.selectedEntity as GrowZone;
      if (!growZone.setSelectedCropType) return;

      // Create crop selection buttons
      const crops: CropType[] = ["carrots", "tomatoes", "potatoes", "beans"];
      const buttonWidth = 120;
      const buttonSpacing = 10;
      let xOffset = 0;

      crops.forEach((crop, index) => {
        const cropButton = this.createActionButton(
          crop.charAt(0).toUpperCase() + crop.slice(1),
          () => {
            growZone.setSelectedCropType(crop);
            this.updatePanelContent(); // Refresh the panel to show the new selection
          },
          false // Not a danger button
        );

        // Position the button
        cropButton.setPosition(xOffset, 0);
        xOffset += buttonWidth + buttonSpacing;

        // Highlight the currently selected crop
        if (
          growZone.getSelectedCropType &&
          growZone.getSelectedCropType() === crop
        ) {
          const buttonBg = cropButton.list[1] as Phaser.GameObjects.Rectangle;
          buttonBg.setFillStyle(0x00aa00); // Green for selected crop
        }

        // Add button to container
        this.actionButtonsContainer.add(cropButton);
      });

      // Add farming action buttons
      const waterAllButton = this.createActionButton(
        "Water All",
        () => {
          const wateredCount = growZone.waterAllTiles();
          console.log(`Watered ${wateredCount} tiles`);
          this.updatePanelContent(); // Refresh the panel
        },
        false // Not a danger button
      );

      const plantAllButton = this.createActionButton(
        "Plant All",
        () => {
          const plantedCount = growZone.plantAllSeeds();
          console.log(
            `Planted ${plantedCount} tiles with ${growZone.getSelectedCropType()}`
          );
          this.updatePanelContent(); // Refresh the panel
        },
        false // Not a danger button
      );

      const harvestAllButton = this.createActionButton(
        "Harvest All",
        () => {
          const harvested = growZone.harvestAllTiles();
          const totalHarvested = Object.values(harvested).reduce(
            (sum, count) => sum + count,
            0
          );
          console.log(`Harvested ${totalHarvested} crops`);
          this.updatePanelContent(); // Refresh the panel
        },
        false // Not a danger button
      );

      // Position the farming action buttons
      waterAllButton.setPosition(0, 50);
      plantAllButton.setPosition(130, 50);
      harvestAllButton.setPosition(260, 50);

      this.actionButtonsContainer.add(waterAllButton);
      this.actionButtonsContainer.add(plantAllButton);
      this.actionButtonsContainer.add(harvestAllButton);

      // Add a test button for debugging
      // Set to true to enable the test button, false to disable it
      const showTestButton = true;

      if (showTestButton) {
        const testButton = this.createActionButton(
          "Test Growth",
          () => {
            // Get all tiles and advance their growth stage
            const tiles = growZone.getTiles();
            tiles.forEach((tile, index) => {
              if (tile.stage === GrowthStage.DRY) {
                growZone.waterTile(index);
              } else if (tile.stage === GrowthStage.WET) {
                growZone.plantSeed(index);
              } else if (tile.stage === GrowthStage.GROWING) {
                // Force the tile to be ready
                const tileObj = tiles[index];
                if (tileObj) {
                  tileObj.stage = GrowthStage.READY;
                  tileObj.sprite.setTexture(
                    `plant-${
                      tileObj.cropType || growZone.getSelectedCropType()
                    }`
                  );
                }
              }
            });
            this.updatePanelContent(); // Refresh the panel
          },
          false // Not a danger button
        );

        // Position the test button below the other buttons
        testButton.setPosition(0, 100);
        this.actionButtonsContainer.add(testButton);
      }

      return;
    }
  }

  // Cancel a blueprint
  private cancelBlueprint(blueprint: Blueprint): void {
    console.log("Canceling blueprint", blueprint);

    try {
      // Find the blueprint in the scene's blueprints array
      const mainScene = this.scene as any;

      // Log the current blueprints for debugging
      console.log("Current blueprints:", mainScene.blueprints);

      if (mainScene.blueprints && Array.isArray(mainScene.blueprints)) {
        const index = mainScene.blueprints.indexOf(blueprint);
        console.log("Blueprint index in array:", index);

        if (index !== -1) {
          // Remove from the array
          mainScene.blueprints.splice(index, 1);
          console.log("Blueprint removed from array");
        } else {
          console.warn("Blueprint not found in the blueprints array");

          // Try to find the blueprint by position
          const blueprintAtSamePosition = mainScene.blueprints.find(
            (b: any) => b.x === blueprint.x && b.y === blueprint.y
          );

          if (blueprintAtSamePosition) {
            const posIndex = mainScene.blueprints.indexOf(
              blueprintAtSamePosition
            );
            mainScene.blueprints.splice(posIndex, 1);
            console.log("Blueprint removed by position match");
          }
        }
      } else {
        console.warn("mainScene.blueprints is not an array or doesn't exist");
      }

      // Cancel the building job if it exists
      const blueprintAny = blueprint as any;
      if (blueprintAny.buildingJob) {
        console.log("Canceling building job:", blueprintAny.buildingJob);
        const jobManager = JobManager.getInstance();
        jobManager.cancelJob(blueprintAny.buildingJob);
      }

      // Remove the blueprint from the scene
      blueprint.destroy();
      console.log("Blueprint destroyed");

      // Clear the selection
      this.clearSelection();
      console.log("Selection cleared");

      // Force a scene update to refresh the display
      this.scene.events.emit("blueprint:canceled", blueprint);
    } catch (error) {
      console.error("Error canceling blueprint:", error);
    }
  }

  // Initialize event listeners
  private initEventListeners(): void {
    // Listen for tool selection events
    this.scene.events.on("tool:selected", this.handleToolSelected, this);
    this.scene.events.on("tool:deselected", this.clearSelection, this);

    // Listen for window resize events
    this.scene.scale.on("resize", this.handleResize, this);
  }
}
