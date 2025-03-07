import Phaser from "phaser";
import { Tool, ToolInventory } from "../entities/tools";
import { TILE_SIZE, DEFAULT_FONT } from "../constants";

export class ToolInventoryDisplay {
  private scene: Phaser.Scene;
  private toolInventory: ToolInventory;
  private slotBackgrounds: Phaser.GameObjects.Rectangle[] = [];
  private slotIcons: Phaser.GameObjects.Sprite[] = [];
  private slotNumbers: Phaser.GameObjects.Text[] = [];
  private slotSize: number = 64;
  private padding: number = 10;
  private container: Phaser.GameObjects.Container | undefined;

  // Theme colors to match the BUILD button
  private readonly COLORS = {
    border: 0x777777, // Green border
    slotBg: 0x444444, // Darker gray for slots
    slotBorder: 0xffffff, // White border for slots
    selectedBorder: 0x4caf50, // Green border for selected slot
    text: 0xffffff, // White text
  };

  constructor(scene: Phaser.Scene, toolInventory: ToolInventory) {
    this.scene = scene;
    this.toolInventory = toolInventory;

    // Create a simple inventory display
    this.createSimpleInventory();

    // Log debug info
    console.log(
      "Tool inventory created with tools:",
      toolInventory.getAllTools()
    );
  }

  private createSimpleInventory(): void {
    const tools = this.toolInventory.getAllTools();

    // Calculate positions
    const screenWidth = this.scene.cameras.main.width;
    const screenHeight = this.scene.cameras.main.height;
    const totalWidth =
      tools.length * (this.slotSize + this.padding) - this.padding;

    // Position in bottom left with some margin
    const startX = 20; // 20px from left edge
    const y = screenHeight - this.slotSize - 20; // 20px from bottom

    console.log(
      `Creating inventory at startX: ${startX}, y: ${y}, totalWidth: ${totalWidth}`
    );

    // Create slots for each tool
    for (let i = 0; i < tools.length; i++) {
      const x = startX + i * (this.slotSize + this.padding) + this.slotSize / 2;

      // Create slot background (dark gray square)
      const background = this.scene.add.rectangle(
        x,
        y,
        this.slotSize,
        this.slotSize,
        this.COLORS.slotBg,
        1
      );
      background.setStrokeStyle(2, this.COLORS.slotBorder, 0.7);
      background.setScrollFactor(0);
      background.setDepth(95);
      this.slotBackgrounds.push(background);

      // Create slot number (1, 2, 3)
      const numberText = this.scene.add.text(
        x - this.slotSize / 2 + 5,
        y - this.slotSize / 2 + 5,
        `${i + 1}`,
        {
          fontSize: "16px",
          color: "#FFFFFF",
          fontStyle: "bold",
          fontFamily: DEFAULT_FONT,
        }
      );
      numberText.setScrollFactor(0);
      numberText.setDepth(96);
      this.slotNumbers.push(numberText);

      // Create icon if tool exists
      const tool = tools[i];
      if (tool) {
        // Try different texture keys
        const textureKeys = [`${tool.type}-icon`, `${tool.type}-icon-rect`];

        let icon: Phaser.GameObjects.Sprite | null = null;

        // Try each texture key
        for (const key of textureKeys) {
          if (this.scene.textures.exists(key)) {
            console.log(`Using texture ${key} for tool ${tool.type}`);
            icon = this.scene.add.sprite(x, y, key);
            icon.setDisplaySize(this.slotSize * 0.7, this.slotSize * 0.7);
            icon.setScrollFactor(0);
            icon.setDepth(97);
            this.slotIcons.push(icon);
            break;
          }
        }

        // If no texture worked, create a placeholder
        if (!icon) {
          console.log(
            `No texture found for tool ${tool.type}, using placeholder`
          );
          const placeholder = this.scene.add.rectangle(
            x,
            y,
            this.slotSize * 0.7,
            this.slotSize * 0.7,
            this.COLORS.border, // Use the green color for placeholder
            0.7
          );
          placeholder.setScrollFactor(0);
          placeholder.setDepth(97);
          this.slotIcons.push(placeholder as any);
        }
      } else {
        // Empty slot
        this.slotIcons.push(null as any);
      }
    }
  }

  // Get the container (for compatibility with existing code)
  public getContainer(): Phaser.GameObjects.Container {
    // Create a dummy container if needed for compatibility
    if (!this.container) {
      this.container = this.scene.add.container(0, 0);
    }
    return this.container;
  }

  // Update the display when a tool is selected or deselected
  public updateSelection(selectedIndex: number): void {
    // Reset all slot backgrounds
    for (let i = 0; i < this.slotBackgrounds.length; i++) {
      this.slotBackgrounds[i].setStrokeStyle(2, this.COLORS.slotBorder, 0.7);
    }

    // Highlight the selected slot
    if (selectedIndex >= 0 && selectedIndex < this.slotBackgrounds.length) {
      this.slotBackgrounds[selectedIndex].setStrokeStyle(
        3,
        this.COLORS.selectedBorder,
        1
      );
    }
  }

  // Update the display when the window is resized
  public resize(): void {
    // Destroy all existing elements
    this.destroy();

    // Recreate the inventory
    this.createSimpleInventory();
  }

  // Clean up resources
  public destroy(): void {
    // Destroy all game objects

    this.slotBackgrounds.forEach((bg) => bg.destroy());
    this.slotBackgrounds = [];

    this.slotNumbers.forEach((text) => text.destroy());
    this.slotNumbers = [];

    this.slotIcons.forEach((icon) => icon?.destroy());
    this.slotIcons = [];

    if (this.container) {
      this.container.destroy();
      this.container = undefined;
    }
  }
}
