import Phaser from "phaser";
import { gameState } from "../state";
import { DEFAULT_FONT } from "../constants";
import { ResourceManager } from "../data/resources";
import { DEPTH } from "../depth";

export class MoneyDisplay {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private moneyText: Phaser.GameObjects.Text;
  private dollarSign: Phaser.GameObjects.Text;
  private background: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = this.scene.add
      .container(10, 10)
      .setScrollFactor(0)
      .setDepth(DEPTH.UI);
    this.container.setName("moneyDisplay");
    this.createMoneyDisplay();

    // Listen for money changes
    gameState.resources.events.on(
      ResourceManager.EVENTS.MONEY_CHANGED,
      this.handleMoneyChanged,
      this
    );
  }

  private createMoneyDisplay() {
    // Background panel
    this.background = this.scene.add
      .rectangle(0, 0, 200, 40, 0x000000, 0.5)
      .setOrigin(0, 0);

    // Dollar sign in green
    this.dollarSign = this.scene.add
      .text(20, 20, "$", {
        fontSize: "24px",
        fontFamily: DEFAULT_FONT,
        color: "#00AA00", // Green color
        fontStyle: "bold",
      })
      .setOrigin(0, 0.5);

    // Money amount with comma separation
    this.moneyText = this.scene.add
      .text(40, 20, this.formatMoney(gameState.money), {
        fontSize: "24px",
        fontFamily: DEFAULT_FONT,
        color: "#FFFFFF",
        fontStyle: "bold",
      })
      .setOrigin(0, 0.5);

    this.container.add([this.background, this.dollarSign, this.moneyText]);
  }

  /**
   * Format money with commas for thousands separators
   */
  private formatMoney(amount: number): string {
    return amount.toLocaleString();
  }

  private showMoneySpentAnimation(amount: number): void {
    // Find the position of the money display
    const moneyDisplay = this.scene.children
      .getAll()
      .find((child) => child.name === "moneyDisplay");

    let startX = this.scene.cameras.main.width / 2;
    let startY = 30;

    // If we found the money display, use its position
    if (moneyDisplay) {
      startX = (moneyDisplay as any).x + 100;
      startY = (moneyDisplay as any).y + 20;
    }

    // Create the animation text
    const animText = this.scene.add.text(
      startX,
      startY,
      `- $${this.formatMoney(amount)}`,
      {
        fontSize: "24px",
        fontFamily: DEFAULT_FONT,
        color: "#FF0000",
        fontStyle: "bold",
      }
    );
    animText.setOrigin(0, 0.5);
    animText.setScrollFactor(0);
    animText.setDepth(DEPTH.UI + 1);

    // Animate it
    this.scene.tweens.add({
      targets: animText,
      y: startY - 50,
      alpha: 0,
      duration: 2000,
      ease: "Power2",
      onComplete: () => {
        animText.destroy();
      },
    });
  }

  /**
   * Handle money changed event
   */
  private handleMoneyChanged(newAmount: number) {
    if (this.moneyText && this.moneyText.scene) {
      this.showMoneySpentAnimation(newAmount - gameState.money);
      this.moneyText.setText(this.formatMoney(newAmount));

      // Adjust background width based on text width
      const totalWidth = this.dollarSign.width + this.moneyText.width + 50; // Add padding
      this.background.width = Math.max(200, totalWidth);
    }
  }

  /**
   * Update the money display
   */
  update() {
    // This is now handled by the event listener, but we keep this method
    // for manual updates if needed
    if (this.moneyText && this.moneyText.scene) {
      this.moneyText.setText(this.formatMoney(gameState.money));

      // Adjust background width based on text width
      const totalWidth = this.dollarSign.width + this.moneyText.width + 50; // Add padding
      this.background.width = Math.max(200, totalWidth);
    }
  }

  /**
   * Get the container for camera management
   */
  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  /**
   * Get the height of the money display for positioning other UI elements
   */
  getHeight(): number {
    return this.background.height;
  }

  /**
   * Clean up resources when destroying
   */
  destroy() {
    // Remove event listener
    gameState.resources.events.off(
      ResourceManager.EVENTS.MONEY_CHANGED,
      this.handleMoneyChanged,
      this
    );

    if (this.container && this.container.scene) {
      this.container.destroy();
    }
  }
}
