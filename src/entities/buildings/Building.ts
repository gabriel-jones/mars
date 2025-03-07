import Phaser from "phaser";
import { BuildingType } from "../../data/buildings";
import { TILE_SIZE, DEFAULT_FONT } from "../../constants";
import { ResourceType } from "../../data/resources";
import { HasHealth } from "../../interfaces/Health";

// Base Building class
export class Building
  extends Phaser.GameObjects.Container
  implements HasHealth
{
  protected sprite: Phaser.GameObjects.Sprite;
  protected buildingType: BuildingType;
  protected label: Phaser.GameObjects.Text;
  public tileWidth: number = 1;
  public tileHeight: number = 1;
  protected inventory: { [key in ResourceType]?: number } = {};
  protected hasInventory: boolean = false;
  protected maxHealth: number = 100;
  protected currentHealth: number = 100;
  protected healthBar: Phaser.GameObjects.Container | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    buildingType: BuildingType,
    tileWidth: number = 1,
    tileHeight: number = 1,
    hasInventory: boolean = false,
    maxHealth: number = 100
  ) {
    // The x and y coordinates are the center of the building
    super(scene, x, y);
    this.buildingType = buildingType;
    this.tileWidth = tileWidth;
    this.tileHeight = tileHeight;
    this.hasInventory = hasInventory;
    this.maxHealth = maxHealth;
    this.currentHealth = maxHealth;

    // Create the building sprite at the origin (0,0) of the container
    this.sprite = scene.add.sprite(0, 0, buildingType);

    // Set the display size based on the tile dimensions
    this.sprite.setDisplaySize(TILE_SIZE * tileWidth, TILE_SIZE * tileHeight);

    // Center the sprite within the container
    this.sprite.setOrigin(0.5, 0.5);

    // Add the sprite to the container
    this.add(this.sprite);

    // Create a label for the building
    this.label = scene.add.text(
      0,
      (-TILE_SIZE * tileHeight) / 2 - 10,
      this.getBuildingName(),
      {
        fontSize: "14px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 3,
        fontFamily: DEFAULT_FONT,
      }
    );
    this.label.setOrigin(0.5);
    this.add(this.label);

    // Add to scene
    scene.add.existing(this);
  }

  public getBuildingType(): BuildingType {
    return this.buildingType;
  }

  protected getBuildingName(): string {
    // Default implementation, should be overridden by subclasses
    return this.buildingType;
  }

  public update(time?: number, delta?: number): void {
    // Base implementation does nothing
  }

  /**
   * Check if this building has inventory capability
   */
  public getHasInventory(): boolean {
    return this.hasInventory;
  }

  /**
   * Get the building's inventory
   */
  public getInventory(): { [key in ResourceType]?: number } {
    return this.inventory;
  }

  /**
   * Add a resource to the building's inventory
   * @param type The resource type
   * @param amount The amount to add
   * @returns The amount that was actually added
   */
  public addResource(type: ResourceType, amount: number): number {
    if (!this.hasInventory) return 0;

    // Initialize if not exists
    if (!this.inventory[type]) {
      this.inventory[type] = 0;
    }

    this.inventory[type]! += amount;
    return amount;
  }

  /**
   * Remove a resource from the building's inventory
   * @param type The resource type
   * @param amount The amount to remove
   * @returns The amount that was actually removed
   */
  public removeResource(type: ResourceType, amount: number): number {
    if (!this.hasInventory || !this.inventory[type]) return 0;

    const currentAmount = this.inventory[type]!;
    const amountToRemove = Math.min(currentAmount, amount);

    this.inventory[type]! -= amountToRemove;

    // Remove the key if amount is 0
    if (this.inventory[type] === 0) {
      delete this.inventory[type];
    }

    return amountToRemove;
  }

  /**
   * Check if the building has a specific resource
   * @param type The resource type
   * @param amount The amount to check for
   * @returns True if the building has at least the specified amount
   */
  public hasResource(type: ResourceType, amount: number): boolean {
    if (!this.hasInventory || !this.inventory[type]) return false;
    return this.inventory[type]! >= amount;
  }

  /**
   * Get the amount of a specific resource in the inventory
   * @param type The resource type
   * @returns The amount of the resource
   */
  public getResourceAmount(type: ResourceType): number {
    if (!this.hasInventory || !this.inventory[type]) return 0;
    return this.inventory[type]!;
  }

  /**
   * Get the maximum health of the building
   */
  public getMaxHealth(): number {
    return this.maxHealth;
  }

  /**
   * Get the current health of the building
   */
  public getCurrentHealth(): number {
    return this.currentHealth;
  }

  /**
   * Set the health of the building
   * @param value The new health value
   */
  public setHealth(value: number): void {
    this.currentHealth = Math.max(0, Math.min(value, this.maxHealth));
  }

  /**
   * Damage the building
   * @param amount The amount of damage to deal
   */
  public damage(amount: number): void {
    this.currentHealth = Math.max(0, this.currentHealth - amount);

    // If the building is destroyed, emit an event
    if (this.currentHealth <= 0) {
      // Hide the health bar immediately
      if (this.healthBar) {
        this.healthBar.setVisible(false);
      }

      this.scene.events.emit("buildingDestroyed", this);
    }
  }

  /**
   * Heal the building
   * @param amount The amount to heal
   */
  public heal(amount: number): void {
    this.currentHealth = Math.min(this.maxHealth, this.currentHealth + amount);
  }

  /**
   * Check if the building is alive
   */
  public isAlive(): boolean {
    return this.currentHealth > 0;
  }

  /**
   * Set the health bar for this building
   * @param healthBar The health bar container
   */
  public setHealthBar(healthBar: Phaser.GameObjects.Container): void {
    this.healthBar = healthBar;
    this.add(healthBar);
  }

  /**
   * Get the health bar container
   */
  public getHealthBar(): Phaser.GameObjects.Container | null {
    return this.healthBar;
  }

  /**
   * Clean up resources when the building is destroyed
   */
  public destroy(): void {
    // Destroy the health bar if it exists
    if (this.healthBar) {
      this.healthBar.destroy();
      this.healthBar = null;
    }

    // Call the parent destroy method
    super.destroy();
  }

  // Shield-related methods (buildings don't have shields)
  public hasShield(): boolean {
    return false;
  }

  public getMaxShield(): number {
    return 0;
  }

  public getCurrentShield(): number {
    return 0;
  }

  public setShield(value: number): void {
    // Buildings don't have shields, so this is a no-op
  }

  public damageShield(amount: number): void {
    // Buildings don't have shields, so damage goes directly to health
    this.damage(amount);
  }

  public rechargeShield(amount: number): void {
    // Buildings don't have shields, so this is a no-op
  }

  /**
   * Get the sprite for this building
   */
  public getSprite(): Phaser.GameObjects.Sprite {
    return this.sprite;
  }

  /**
   * Get the tile dimensions of the building
   */
  public getTileDimensions(): { width: number; height: number } {
    return { width: this.tileWidth, height: this.tileHeight };
  }
}
