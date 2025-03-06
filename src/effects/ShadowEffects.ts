import * as Phaser from "phaser";

export class ShadowEffects {
  private scene: Phaser.Scene;
  private entity: Phaser.GameObjects.GameObject;
  private shadowSprite: Phaser.GameObjects.Sprite;
  private shadowColor: number = 0x000000;
  private shadowAlpha: number = 0.5;
  private shadowScale: number = 4.0;
  private shadowOffsetX: number = -64;
  private shadowOffsetY: number = 0;
  private shadowDepth: number = -1; // Ensure shadow is below the entity

  constructor(
    scene: Phaser.Scene,
    entity: Phaser.GameObjects.GameObject,
    options: {
      shadowColor?: number;
      shadowAlpha?: number;
      shadowScale?: number;
      shadowOffsetX?: number;
      shadowOffsetY?: number;
      shadowTexture?: string;
      debug?: boolean;
    } = {}
  ) {
    this.scene = scene;
    this.entity = entity;

    // Apply custom options
    if (options.shadowColor !== undefined)
      this.shadowColor = options.shadowColor;
    if (options.shadowAlpha !== undefined)
      this.shadowAlpha = options.shadowAlpha;
    if (options.shadowScale !== undefined)
      this.shadowScale = options.shadowScale;
    if (options.shadowOffsetX !== undefined)
      this.shadowOffsetX = options.shadowOffsetX;
    if (options.shadowOffsetY !== undefined)
      this.shadowOffsetY = options.shadowOffsetY;

    // Create the shadow sprite
    const shadowTexture = options.shadowTexture || "shadow";
    this.createShadow(shadowTexture);
  }

  private createShadow(textureName: string): void {
    // Get entity position
    const x = (this.entity as any).x || 0;
    const y = (this.entity as any).y || 0;

    // Check if the texture exists
    if (!this.scene.textures.exists(textureName)) {
      console.warn(
        `Shadow texture '${textureName}' does not exist, creating default`
      );
      this.createDefaultShadowTexture(textureName);
    }

    // Create shadow sprite
    this.shadowSprite = this.scene.add.sprite(
      x + this.shadowOffsetX,
      y + this.shadowOffsetY,
      textureName
    );

    // Set shadow properties
    this.shadowSprite.setTint(this.shadowColor);
    this.shadowSprite.setAlpha(this.shadowAlpha);
    this.shadowSprite.setScale(this.shadowScale);

    // Get the entity's depth if available, otherwise use a default depth
    const entityDepth =
      (this.entity as any).depth !== undefined
        ? (this.entity as any).depth
        : (this.entity as any).sprite?.depth !== undefined
        ? (this.entity as any).sprite.depth
        : 5;

    // Set shadow depth to be below the entity
    this.shadowSprite.setDepth(entityDepth - 1);

    // Make sure the shadow is visible
    this.shadowSprite.setVisible(true);
  }

  private createDefaultShadowTexture(textureName: string): void {
    // Create a default shadow texture if one doesn't exist
    const graphics = this.scene.make.graphics({ x: 0, y: 0 });

    // Draw a pixelated oval shadow
    graphics.fillStyle(0xffffff);

    // Draw a MASSIVE pixelated oval (64x32 pixels)
    graphics.fillRect(0, 8, 64, 16);
    graphics.fillRect(8, 4, 48, 24);
    graphics.fillRect(16, 0, 32, 32);

    // Generate texture
    graphics.generateTexture(textureName, 64, 32);
    graphics.destroy();

    console.log(
      `Created default shadow texture: ${textureName} (MASSIVE SIZE)`
    );
  }

  public update(): void {
    if (!this.shadowSprite || !this.shadowSprite.active) {
      return;
    }

    // Get current entity position
    const x = (this.entity as any).x || 0;
    const y = (this.entity as any).y || 0;

    // Update shadow position
    this.shadowSprite.setPosition(
      x + this.shadowOffsetX,
      y + this.shadowOffsetY
    );

    // If entity has scale or rotation, apply it to shadow (with modifications)
    if ((this.entity as any).scaleX !== undefined) {
      // Apply a more dramatic flattening effect for the shadow
      this.shadowSprite.setScale(
        (this.entity as any).scaleX * this.shadowScale,
        (this.entity as any).scaleY * this.shadowScale * 0.4 // More flattened vertically
      );
    } else {
      // If no entity scale, just use our default scale
      this.shadowSprite.setScale(this.shadowScale, this.shadowScale * 0.4);
    }

    // Ensure the shadow is visible
    if (!this.shadowSprite.visible) {
      this.shadowSprite.setVisible(true);
    }

    // Force the shadow to be below the entity
    const entityDepth =
      (this.entity as any).depth !== undefined
        ? (this.entity as any).depth
        : (this.entity as any).sprite?.depth !== undefined
        ? (this.entity as any).sprite.depth
        : 5;

    this.shadowSprite.setDepth(entityDepth - 5); // Ensure it's well below the entity
  }

  public setVisible(visible: boolean): void {
    if (this.shadowSprite) {
      this.shadowSprite.setVisible(visible);
    }
  }

  public destroy(): void {
    if (this.shadowSprite) {
      this.shadowSprite.destroy();
    }
  }
}
