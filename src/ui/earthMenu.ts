import Phaser from "phaser";
import { ResourceType, ResourceManager } from "../data/resources";
import { DEFAULT_FONT } from "../constants";
import { CloseButton } from "./closeButton";
import { DEPTH } from "../depth";

// Define the transfer item interface
export interface TransferItem {
  resourceType: ResourceType;
  amount: number;
  cost: number;
  isRobot?: boolean;
  isStarlink?: boolean;
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
  private escKey: Phaser.Input.Keyboard.Key;

  // Available items to purchase
  private availableItems: {
    name: string;
    resourceType: ResourceType;
    cost: number;
    emoji: string;
    isRobot?: boolean;
    isStarlink?: boolean;
  }[] = [
    {
      name: "Optimus Robot",
      resourceType: "iron",
      cost: 100_000,
      emoji: "🤖",
      isRobot: true,
    },
    { name: "Iron", resourceType: "iron", cost: 2_000, emoji: "🔘" },
    { name: "Aluminium", resourceType: "aluminium", cost: 1_000, emoji: "🔩" },
    { name: "Silicon", resourceType: "silicon", cost: 1_000, emoji: "🧱" },
    { name: "Potato", resourceType: "potatoes", cost: 1_000, emoji: "🥔" },
    {
      name: "Starlink Satellite",
      resourceType: "silicon",
      cost: 50_000,
      emoji: "🛰️",
      isStarlink: true,
    },
  ];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Create the container and add it to the scene
    this.container = this.scene.add.container(0, 0);
    this.container.setVisible(false);
    this.container.setDepth(DEPTH.UI); // Match the Build menu's depth
    this.container.setScrollFactor(0); // Fix to camera

    // Set up escape key
    if (this.scene.input && this.scene.input.keyboard) {
      this.escKey = this.scene.input.keyboard.addKey(
        Phaser.Input.Keyboard.KeyCodes.ESC
      );
    }

    console.log(
      "Earth menu container created with depth:",
      this.container.depth
    );

    // Create the panel
    this.createPanel();
  }

  private createPanel(): void {
    try {
      console.log("Creating Earth menu panel");
      const width = 600;
      const height = 400; // Match the Build menu's height exactly

      // Position the container exactly like the Build menu
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
        0.9 // Match Build menu opacity
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

      // Create available items
      this.createAvailableItems();

      // Create queue container - position it at the bottom of the panel
      this.queueContainer = this.scene.add.container(0, height / 2 - 50); // Position near the bottom of the panel
      this.container.add(this.queueContainer);
      this.updateQueueDisplay();

      // Set the container's depth to ensure it's above other UI elements
      this.container.setDepth(DEPTH.UI + 10);

      // Make sure the container is initially invisible
      this.container.setVisible(false);

      console.log("Earth menu panel created successfully");
    } catch (error) {
      console.error("Error creating Earth menu panel:", error);
    }
  }

  private createAvailableItems(): void {
    try {
      console.log("Creating available items for Earth menu");
      const width = 560;
      const startY = -150; // Moved up to fit in the smaller container

      // Grid layout settings
      const itemsPerRow = 5;
      const itemWidth = 100;
      const itemHeight = 120; // Keep the same item height
      const itemPadding = 8; // Reduced padding to fit more items vertically
      const gridWidth =
        itemWidth * itemsPerRow + itemPadding * (itemsPerRow - 1);

      // Create items in a grid
      this.availableItems.forEach((item, index) => {
        const row = Math.floor(index / itemsPerRow);
        const col = index % itemsPerRow;

        const x =
          -width / 2 + col * (itemWidth + itemPadding) + itemWidth / 2 + 20;
        const y = startY + row * (itemHeight + itemPadding) + itemHeight / 2;

        // Item container
        const itemContainer = this.scene.add.container(x, y);

        // Item background
        const itemBg = this.scene.add.rectangle(
          0,
          0,
          itemWidth,
          itemHeight,
          0x444444
        );
        itemBg.setStrokeStyle(1, 0x666666);
        itemContainer.add(itemBg);

        // Resource icon (emoji)
        const iconText = this.scene.add.text(0, -45, item.emoji, {
          fontSize: "28px", // Slightly smaller
          fontFamily: DEFAULT_FONT,
        });
        iconText.setOrigin(0.5);
        itemContainer.add(iconText);

        // Resource name
        const nameText = this.scene.add.text(0, -18, item.name, {
          fontSize: "12px", // Slightly smaller
          color: "#ffffff",
          fontFamily: DEFAULT_FONT,
          fontStyle: "bold",
        });
        nameText.setOrigin(0.5);
        itemContainer.add(nameText);

        // Cost with green dollar sign
        const costContainer = this.scene.add.container(0, 0);

        // Dollar sign in green
        const dollarSign = this.scene.add.text(-2, 0, "$", {
          fontSize: "12px", // Slightly smaller
          fontFamily: DEFAULT_FONT,
          color: "#00AA00", // Green color
          fontStyle: "bold",
        });
        dollarSign.setOrigin(1, 0.5);

        // Cost amount
        const costText = this.scene.add.text(
          0,
          0,
          this.formatMoney(item.cost),
          {
            fontSize: "12px", // Slightly smaller
            color: "#ffffff",
            fontFamily: DEFAULT_FONT,
          }
        );
        costText.setOrigin(0, 0.5);

        costContainer.add([dollarSign, costText]);

        // Center the cost container
        costContainer.setPosition(0, 0);
        itemContainer.add(costContainer);

        // Create buy button(s)
        if (item.isRobot) {
          // Only Buy (1) button for robots
          const button = this.createButton(0, 25, "Buy (1)", () => {
            console.log("Buying robot:", item.name, "isRobot =", item.isRobot);
            this.addToQueue(
              item.resourceType,
              1,
              item.cost,
              item.isRobot,
              item.isStarlink
            );
          });
          itemContainer.add(button);
        } else {
          // Stack Buy (1) and Buy (64) buttons vertically
          const button1 = this.createButton(0, 20, "Buy (1)", () => {
            console.log(
              "Buying resource (1):",
              item.name,
              "isRobot =",
              item.isRobot
            );
            this.addToQueue(
              item.resourceType,
              1,
              item.cost,
              false,
              item.isStarlink
            );
          });

          const button64 = this.createButton(0, 45, "Buy (64)", () => {
            console.log(
              "Buying resource (64):",
              item.name,
              "isRobot =",
              item.isRobot
            );
            this.addToQueue(
              item.resourceType,
              64,
              item.cost,
              false,
              item.isStarlink
            );
          });

          itemContainer.add([button1, button64]);
        }

        this.contentContainer.add(itemContainer);
      });

      // Calculate the total height of the grid
      const totalRows = Math.ceil(this.availableItems.length / itemsPerRow);
      const gridHeight = totalRows * (itemHeight + itemPadding);

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
      const buttonBg = this.scene.add.rectangle(0, 0, 80, 24, 0x444444);
      buttonBg.setStrokeStyle(1, 0x666666);
      button.add(buttonBg);

      // Button text
      const buttonText = this.scene.add.text(0, 0, text, {
        fontSize: "14px",
        color: "#ffffff",
        fontFamily: DEFAULT_FONT,
      });
      buttonText.setOrigin(0.5);
      button.add(buttonText);

      // Adjust button width based on text width
      const padding = 12;
      const buttonWidth = buttonText.width + padding;
      buttonBg.width = buttonWidth;

      // Make the button background interactive with proper cursor
      buttonBg.setInteractive({ useHandCursor: true });

      // Set up hover and click events
      buttonBg.on("pointerover", () => {
        buttonBg.setFillStyle(0x666666);
        this.scene.input.setDefaultCursor("pointer");
      });

      buttonBg.on("pointerout", () => {
        buttonBg.setFillStyle(0x444444);
        this.scene.input.setDefaultCursor("default");
      });

      buttonBg.on("pointerdown", onClick);

      return button;
    } catch (error) {
      console.error("Error creating button:", error);
      // Return a minimal container to avoid errors
      return this.scene.add.container(x, y);
    }
  }

  public addToQueue(
    resourceType: ResourceType,
    amount: number,
    costPerUnit: number,
    isRobot: boolean = false,
    isStarlink: boolean = false
  ): void {
    console.log(
      `Adding to queue: ${amount} ${resourceType}${isRobot ? " (robot)" : ""}${
        isStarlink ? " (starlink)" : ""
      } at ${costPerUnit} each`
    );

    const totalCost = amount * costPerUnit;

    // Check if we have enough money
    if (!ResourceManager.hasMoney(totalCost)) {
      console.log("Not enough credits!");
      this.showNotEnoughMoneyMessage();
      return;
    }

    // Deduct money
    ResourceManager.spendMoney(totalCost);

    // Add to queue
    this.transferQueue.push({
      resourceType,
      amount,
      cost: costPerUnit,
      isRobot: isRobot || false,
      isStarlink: isStarlink || false,
    });

    console.log(
      `Queue updated, now contains ${this.transferQueue.length} items`
    );

    // Update queue display
    this.updateQueueDisplay();

    // Notify any landed starships that there's a new item in the queue
    // This is important to ensure the starship takes off when items are added
    this.notifyStarshipsOfQueueUpdate();

    // Double-check after a short delay to ensure the notification went through
    setTimeout(() => {
      if (this.transferQueue.length > 0) {
        console.log("Double-checking starship notification after delay");
        this.notifyStarshipsOfQueueUpdate();
      }
    }, 1000);
  }

  // Notify any landed starships that there's a new item in the queue
  private notifyStarshipsOfQueueUpdate(): void {
    // Get the main scene
    const mainScene = this.scene as any;

    // Check if the scene has a starship
    if (mainScene.starship) {
      console.log("Found starship in main scene, checking state");

      // Check if the starship is landed on Mars
      const starshipState = mainScene.starship.getState();
      console.log(`Current starship state: ${starshipState}`);

      if (starshipState === "mars_landed") {
        console.log("Starship is landed on Mars, notifying of queue update");

        // Directly trigger takeoff if there are items in the queue
        if (this.transferQueue.length > 0) {
          console.log(
            `Queue has ${this.transferQueue.length} items, triggering immediate takeoff`
          );

          // Try to force immediate takeoff
          if (typeof mainScene.starship.forceImmediateTakeoff === "function") {
            mainScene.starship.forceImmediateTakeoff();
          } else {
            console.log(
              "forceImmediateTakeoff not available, falling back to checkForEarthTransferQueue"
            );
            // Fall back to the check method
            if (
              typeof mainScene.starship.checkForEarthTransferQueue ===
              "function"
            ) {
              mainScene.starship.checkForEarthTransferQueue();
            } else {
              console.error("No takeoff methods found on starship");
            }
          }
        } else {
          console.log("Queue is empty, no need to notify starship");
        }
      } else {
        console.log(
          `Starship is not landed (current state: ${starshipState}), not notifying`
        );
      }
    } else {
      console.log("No starship found in main scene");
    }
  }

  private showNotEnoughMoneyMessage(): void {
    // Create the message text
    const messageText = this.scene.add.text(
      this.container.x,
      this.container.y - 100,
      "Not enough money!",
      {
        fontSize: "24px",
        fontFamily: DEFAULT_FONT,
        color: "#FF0000",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 4,
      }
    );
    messageText.setOrigin(0.5);
    messageText.setScrollFactor(0);
    messageText.setDepth(DEPTH.UI - 1);

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

  private updateQueueDisplay(): void {
    try {
      console.log("Updating queue display");
      console.log(
        "Transfer queue contents:",
        JSON.stringify(this.transferQueue)
      );
      // Clear existing queue display
      this.queueContainer.removeAll(true);

      // Add a header for the transfer queue
      const queueHeaderText = this.scene.add.text(0, -30, "TRANSFER QUEUE", {
        fontSize: "16px",
        color: "#ffffff",
        fontStyle: "bold",
        fontFamily: DEFAULT_FONT,
      });
      queueHeaderText.setOrigin(0.5);
      this.queueContainer.add(queueHeaderText);

      // Group items by type
      const groupedItems = new Map<
        string,
        {
          emoji: string;
          amount: number;
          resourceType: ResourceType;
          isRobot?: boolean;
          isStarlink?: boolean;
        }
      >();

      this.transferQueue.forEach((item) => {
        // Get item definition from our available items
        const itemDef = this.availableItems.find((def) => {
          // For Starlink satellites
          if (item.isStarlink) {
            return def.resourceType === item.resourceType && def.isStarlink;
          }
          // For robots
          if (item.isRobot) {
            return def.resourceType === item.resourceType && def.isRobot;
          }
          // For regular resources
          return (
            def.resourceType === item.resourceType &&
            !def.isRobot &&
            !def.isStarlink
          );
        });

        console.log("Item:", JSON.stringify(item));
        console.log(
          "Found itemDef:",
          itemDef ? JSON.stringify(itemDef) : "null"
        );

        if (!itemDef) return;

        // Ensure isRobot and isStarlink are booleans for consistent key generation
        const isRobotBool = item.isRobot === true;
        const isStarlinkBool = item.isStarlink === true;

        const key = `${item.resourceType}-${
          isRobotBool ? "robot" : isStarlinkBool ? "starlink" : "resource"
        }`;

        if (groupedItems.has(key)) {
          const existing = groupedItems.get(key)!;
          existing.amount += item.amount;
        } else {
          groupedItems.set(key, {
            emoji: itemDef.emoji,
            amount: item.amount,
            resourceType: item.resourceType,
            isRobot: item.isRobot,
            isStarlink: item.isStarlink,
          });
        }
      });

      console.log("Grouped items:", Array.from(groupedItems.entries()));

      // Display items in a horizontal row underneath the queue header
      const itemsPerRow = 8;
      const itemSize = 60;
      const itemPadding = 10;
      const startY = 0; // Position relative to queueContainer, just below the header

      // Create a container for the items
      const itemsContainer = this.scene.add.container(0, startY);
      this.queueContainer.add(itemsContainer);

      let index = 0;
      groupedItems.forEach((item) => {
        const row = Math.floor(index / itemsPerRow);
        const col = index % itemsPerRow;

        // Calculate position in the grid
        const x =
          -((itemsPerRow * (itemSize + itemPadding)) / 2) +
          col * (itemSize + itemPadding) +
          itemSize / 2;
        const y = row * (itemSize + itemPadding);

        // Create item container
        const itemContainer = this.scene.add.container(x, y);

        // Item emoji
        const emojiText = this.scene.add.text(0, 0, item.emoji, {
          fontSize: "24px",
          fontFamily: DEFAULT_FONT,
        });
        emojiText.setOrigin(0.5);
        itemContainer.add(emojiText);

        // Item count
        const countText = this.scene.add.text(0, 20, `x${item.amount}`, {
          fontSize: "14px",
          color: "#ffffff",
          fontFamily: DEFAULT_FONT,
        });
        countText.setOrigin(0.5);
        itemContainer.add(countText);

        itemsContainer.add(itemContainer);
        index++;
      });

      console.log("Queue display updated successfully");
    } catch (error) {
      console.error("Error updating queue display:", error);
    }
  }

  private removeItemsOfType(
    resourceType: ResourceType,
    isRobot?: boolean,
    isStarlink?: boolean
  ): void {
    // This method is now a no-op as we've removed the remove functionality
    console.log("removeItemsOfType is now disabled");
    return;
  }

  private removeFromQueue(index: number): void {
    // This method is now a no-op as we've removed the remove functionality
    console.log("removeFromQueue is now disabled");
    return;
  }

  private formatMoney(amount: number): string {
    return amount.toLocaleString();
  }

  public getTransferQueue(): TransferItem[] {
    console.log(
      "Earth menu transfer queue requested:",
      JSON.stringify(this.transferQueue)
    );
    return this.transferQueue;
  }

  public clearTransferQueue(): void {
    console.log("Clearing Earth menu transfer queue");
    this.transferQueue = [];
    this.updateQueueDisplay();

    // Notify any landed starships that the queue has been cleared
    this.notifyStarshipsOfQueueUpdate();
  }

  public show(): void {
    console.log("EarthMenu show method called");

    // Simply make the container visible, like the Build menu does
    this.container.setVisible(true);

    // Log the container's state for debugging
    console.log("Earth menu shown", {
      visible: this.container.visible,
      x: this.container.x,
      y: this.container.y,
      depth: this.container.depth,
      alpha: this.container.alpha,
      active: this.container.active,
    });
  }

  public hide(): void {
    console.log("Hiding Earth menu");
    this.container.setVisible(false);
    console.log("Earth menu hidden, visibility:", this.container.visible);
  }

  public isVisible(): boolean {
    return this.container.visible;
  }

  public update(): void {
    // Check for ESC key to close the panel
    if (this.escKey && Phaser.Input.Keyboard.JustDown(this.escKey)) {
      if (this.isVisible()) {
        this.hide();
      }
    }
  }

  public destroy(): void {
    // Clean up the escape key
    if (this.escKey) {
      this.escKey.destroy();
    }
    this.container.destroy();
  }
}
