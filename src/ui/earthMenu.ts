import Phaser from "phaser";
import { ResourceType, RESOURCE_DEFINITIONS } from "../data/resources";
import { DEFAULT_FONT } from "../constants";
import { CloseButton } from "./closeButton";
import { DEPTH } from "../depth";

// Define the transfer item interface
export interface TransferItem {
  resourceType: ResourceType;
  amount: number;
  cost: number;
}

// Define the Earth menu class
export class EarthMenu {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private background: Phaser.GameObjects.Rectangle;
  private titleText: Phaser.GameObjects.Text;
  private closeButton: CloseButton;
  private contentContainer: Phaser.GameObjects.Container;
  private transferQueue: TransferItem[] = [];
  private queueContainer: Phaser.GameObjects.Container;
  private earthCredits: number = 1000; // Starting credits
  private creditsText: Phaser.GameObjects.Text;

  // Available items to purchase
  private availableItems: {
    resourceType: ResourceType;
    cost: number;
    maxAmount: number;
  }[] = [
    { resourceType: "iron", cost: 10, maxAmount: 100 },
    { resourceType: "silicon", cost: 15, maxAmount: 100 },
    { resourceType: "titanium", cost: 30, maxAmount: 50 },
    { resourceType: "aluminium", cost: 20, maxAmount: 75 },
    { resourceType: "water", cost: 5, maxAmount: 200 },
    { resourceType: "oxygen", cost: 25, maxAmount: 100 },
    { resourceType: "energy", cost: 15, maxAmount: 150 },
  ];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Create the container and add it to the scene
    this.container = this.scene.add.container(0, 0);
    this.container.setVisible(false);
    this.container.setDepth(DEPTH.UI);

    console.log("Earth menu container created");

    // Create the panel
    this.createPanel();

    // Ensure the container is added to the scene
    scene.add.existing(this.container);
  }

  private createPanel(): void {
    try {
      console.log("Creating Earth menu panel");
      const width = 600;
      const height = 500;
      const x = this.scene.cameras.main.width / 2;
      const y = this.scene.cameras.main.height / 2;

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
      this.titleText = this.scene.add.text(
        0,
        -height / 2 + 25,
        "EARTH SUPPLY DEPOT",
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

      // Create credits display
      this.creditsText = this.scene.add.text(
        -width / 2 + 20,
        -height / 2 + 60,
        `Credits: ${this.earthCredits}`,
        {
          fontSize: "18px",
          color: "#ffffff",
          fontFamily: DEFAULT_FONT,
        }
      );
      this.container.add(this.creditsText);

      // Create available items
      this.createAvailableItems();

      // Create queue container
      this.queueContainer = this.scene.add.container(0, 0);
      this.container.add(this.queueContainer);
      this.updateQueueDisplay();

      // Position the container
      this.container.setPosition(x, y);

      console.log("Earth menu panel created successfully");
    } catch (error) {
      console.error("Error creating Earth menu panel:", error);
    }
  }

  private createAvailableItems(): void {
    try {
      console.log("Creating available items for Earth menu");
      const startY = -180;
      const itemHeight = 50;
      const width = 560;

      // Create header
      const headerBg = this.scene.add.rectangle(
        0,
        startY - 30,
        width,
        30,
        0x555555
      );
      this.contentContainer.add(headerBg);

      const headerText = this.scene.add.text(
        -width / 2 + 20,
        startY - 30 - 8,
        "Available Resources",
        {
          fontSize: "16px",
          color: "#ffffff",
          fontFamily: DEFAULT_FONT,
        }
      );
      this.contentContainer.add(headerText);

      // Create items
      this.availableItems.forEach((item, index) => {
        const y = startY + index * itemHeight;

        // Item background
        const itemBg = this.scene.add.rectangle(
          0,
          y,
          width,
          itemHeight - 5,
          0x444444
        );
        itemBg.setStrokeStyle(1, 0x666666);
        this.contentContainer.add(itemBg);

        // Get resource definition
        const resourceDef = RESOURCE_DEFINITIONS.find(
          (def) => def.type === item.resourceType
        );

        // Resource name with emoji
        const resourceName = resourceDef
          ? `${resourceDef.emoji} ${resourceDef.name}`
          : item.resourceType;

        const nameText = this.scene.add.text(
          -width / 2 + 20,
          y - 10,
          resourceName,
          {
            fontSize: "16px",
            color: "#ffffff",
            fontFamily: DEFAULT_FONT,
          }
        );
        this.contentContainer.add(nameText);

        // Cost
        const costText = this.scene.add.text(
          -width / 2 + 200,
          y - 10,
          `Cost: ${item.cost} credits/unit`,
          {
            fontSize: "14px",
            color: "#ffffff",
            fontFamily: DEFAULT_FONT,
          }
        );
        this.contentContainer.add(costText);

        // Create buttons for different quantities
        const quantities = [1, 5, 10, 25];
        quantities.forEach((qty, qtyIndex) => {
          const buttonX = width / 2 - 200 + qtyIndex * 60;
          const button = this.createButton(buttonX, y, `Buy ${qty}`, () =>
            this.addToQueue(item.resourceType, qty, item.cost)
          );
          this.contentContainer.add(button);
        });
      });

      // Create queue header
      const queueHeaderBg = this.scene.add.rectangle(
        0,
        startY + this.availableItems.length * itemHeight + 20,
        width,
        30,
        0x555555
      );
      this.contentContainer.add(queueHeaderBg);

      const queueHeaderText = this.scene.add.text(
        -width / 2 + 20,
        startY + this.availableItems.length * itemHeight + 20 - 8,
        "Transfer Queue",
        {
          fontSize: "16px",
          color: "#ffffff",
          fontFamily: DEFAULT_FONT,
        }
      );
      this.contentContainer.add(queueHeaderText);

      console.log("Available items created successfully");
    } catch (error) {
      console.error("Error creating available items:", error);
    }
  }

  private createButton(
    x: number,
    y: number,
    text: string,
    onClick: () => void
  ): Phaser.GameObjects.Container {
    try {
      // Create button container
      const button = this.scene.add.container(x, y);

      // Button background
      const buttonBg = this.scene.add.rectangle(0, 0, 100, 30, 0x444444);
      buttonBg.setStrokeStyle(1, 0x666666);
      button.add(buttonBg);

      // Button text
      const buttonText = this.scene.add.text(0, 0, text, {
        fontSize: "12px",
        color: "#ffffff",
        fontFamily: DEFAULT_FONT,
      });
      buttonText.setOrigin(0.5);
      button.add(buttonText);

      // Adjust button width based on text width
      const padding = 20;
      const buttonWidth = buttonText.width + padding;
      buttonBg.width = buttonWidth;

      // Make interactive
      buttonBg.setInteractive({ useHandCursor: true });
      buttonBg.on("pointerover", () => buttonBg.setFillStyle(0x666666));
      buttonBg.on("pointerout", () => buttonBg.setFillStyle(0x444444));
      buttonBg.on("pointerdown", onClick);

      return button;
    } catch (error) {
      console.error("Error creating button:", error);
      // Return a minimal container to avoid errors
      return this.scene.add.container(x, y);
    }
  }

  private addToQueue(
    resourceType: ResourceType,
    amount: number,
    costPerUnit: number
  ): void {
    const totalCost = amount * costPerUnit;

    // Check if we have enough credits
    if (this.earthCredits < totalCost) {
      console.log("Not enough credits!");
      return;
    }

    // Deduct credits
    this.earthCredits -= totalCost;
    this.creditsText.setText(`Credits: ${this.earthCredits}`);

    // Add to queue
    this.transferQueue.push({
      resourceType,
      amount,
      cost: totalCost,
    });

    // Update queue display
    this.updateQueueDisplay();
  }

  private updateQueueDisplay(): void {
    try {
      console.log("Updating queue display");
      // Clear existing queue display
      this.queueContainer.removeAll(true);

      const width = 560;
      const itemHeight = 40;
      const startY = 50;

      // If queue is empty, show a message
      if (this.transferQueue.length === 0) {
        const emptyText = this.scene.add.text(
          0,
          startY,
          "Queue is empty. Add resources to transfer.",
          {
            fontSize: "16px",
            color: "#cccccc",
            fontFamily: DEFAULT_FONT,
            align: "center",
          }
        );
        emptyText.setOrigin(0.5);
        this.queueContainer.add(emptyText);
        return;
      }

      // Create items for each queued resource
      this.transferQueue.forEach((item, index) => {
        const y = startY + index * itemHeight;

        // Item background
        const itemBg = this.scene.add.rectangle(
          0,
          y,
          width,
          itemHeight - 5,
          0x444444
        );
        itemBg.setStrokeStyle(1, 0x666666);
        this.queueContainer.add(itemBg);

        // Get resource definition
        const resourceDef = RESOURCE_DEFINITIONS.find(
          (def) => def.type === item.resourceType
        );

        // Resource name with emoji
        const resourceName = resourceDef
          ? `${resourceDef.emoji} ${resourceDef.name}`
          : item.resourceType;

        const nameText = this.scene.add.text(
          -width / 2 + 20,
          y - 10,
          `${resourceName} x${item.amount}`,
          {
            fontSize: "16px",
            color: "#ffffff",
            fontFamily: DEFAULT_FONT,
          }
        );
        this.queueContainer.add(nameText);

        // Cost
        const costText = this.scene.add.text(
          -width / 2 + 300,
          y - 10,
          `Cost: ${item.cost * item.amount} credits`,
          {
            fontSize: "14px",
            color: "#ffffff",
            fontFamily: DEFAULT_FONT,
          }
        );
        this.queueContainer.add(costText);

        // Remove button
        const removeButton = this.scene.add.text(width / 2 - 30, y - 10, "X", {
          fontSize: "16px",
          color: "#ff0000",
          fontFamily: DEFAULT_FONT,
        });
        removeButton.setInteractive({ useHandCursor: true });
        removeButton.on("pointerdown", () => this.removeFromQueue(index));
        this.queueContainer.add(removeButton);
      });

      // Add a "Process Queue" button if there are items in the queue
      if (this.transferQueue.length > 0) {
        const totalCost = this.transferQueue.reduce(
          (sum, item) => sum + item.cost * item.amount,
          0
        );

        const processButton = this.createButton(
          0,
          startY + this.transferQueue.length * itemHeight + 30,
          `Process Queue (${totalCost} credits)`,
          () => {
            // This will be handled by the starship when it reaches Earth orbit
            console.log("Queue ready for processing");
          }
        );
        this.queueContainer.add(processButton);
      }

      console.log("Queue display updated successfully");
    } catch (error) {
      console.error("Error updating queue display:", error);
    }
  }

  private removeFromQueue(index: number): void {
    // Refund credits
    const item = this.transferQueue[index];
    this.earthCredits += item.cost;
    this.creditsText.setText(`Credits: ${this.earthCredits}`);

    // Remove from queue
    this.transferQueue.splice(index, 1);

    // Update queue display
    this.updateQueueDisplay();
  }

  public getTransferQueue(): TransferItem[] {
    return this.transferQueue;
  }

  public clearTransferQueue(): void {
    this.transferQueue = [];
    this.updateQueueDisplay();
  }

  public show(): void {
    // Ensure the container is visible
    this.container.setVisible(true);

    // Make sure it's positioned correctly
    const x = this.scene.cameras.main.width / 2;
    const y = this.scene.cameras.main.height / 2;
    this.container.setPosition(x, y);

    // Ensure it's at the front
    this.container.setDepth(DEPTH.UI);

    // Log to confirm the menu is being shown
    console.log("Earth menu shown");
  }

  public hide(): void {
    this.container.setVisible(false);
  }

  public isVisible(): boolean {
    return this.container.visible;
  }

  public destroy(): void {
    this.container.destroy();
  }
}
