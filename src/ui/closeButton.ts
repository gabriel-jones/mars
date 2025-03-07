import Phaser from "phaser";
import { DEFAULT_FONT } from "../constants";

export class CloseButton extends Phaser.GameObjects.Container {
  private background: Phaser.GameObjects.Rectangle;
  private xText: Phaser.GameObjects.Text;
  private onClickCallback: () => void;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    size: number = 24,
    onClickCallback: () => void
  ) {
    super(scene, x, y);
    this.onClickCallback = onClickCallback;

    // Create background
    this.background = scene.add.rectangle(0, 0, size, size, 0x444444);
    this.background.setStrokeStyle(1, 0x666666);
    this.background.setInteractive({ useHandCursor: true });
    this.add(this.background);

    // Create X text
    this.xText = scene.add.text(0, 0, "X", {
      fontSize: `${Math.floor(size * 0.7)}px`,
      color: "#ffffff",
      fontStyle: "bold",
      fontFamily: DEFAULT_FONT,
    });
    this.xText.setOrigin(0.5);
    this.add(this.xText);

    // Add hover effects
    this.background.on("pointerover", this.onPointerOver, this);
    this.background.on("pointerout", this.onPointerOut, this);
    this.background.on("pointerdown", this.onPointerDown, this);
    this.background.on("pointerup", this.onPointerUp, this);

    // Add to scene
    scene.add.existing(this);
  }

  private onPointerOver(): void {
    this.background.fillColor = 0x666666;
    this.scene.input.setDefaultCursor("pointer");
  }

  private onPointerOut(): void {
    this.background.fillColor = 0x444444;
    this.scene.input.setDefaultCursor("default");
  }

  private onPointerDown(): void {
    this.background.fillColor = 0x888888;
  }

  private onPointerUp(): void {
    this.background.fillColor = 0x666666;
    if (this.onClickCallback) {
      this.onClickCallback();
    }
  }

  public setPosition(x: number, y: number): this {
    super.setPosition(x, y);
    return this;
  }

  public destroy(): void {
    // Clean up event listeners
    this.background.off("pointerover", this.onPointerOver, this);
    this.background.off("pointerout", this.onPointerOut, this);
    this.background.off("pointerdown", this.onPointerDown, this);
    this.background.off("pointerup", this.onPointerUp, this);

    // Call parent destroy
    super.destroy();
  }
}
