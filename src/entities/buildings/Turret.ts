import Phaser from "phaser";
import { Building } from "./Building";
import { TILE_SIZE, ROBOT_FIRE_RATE } from "../../constants";
import { Tool, ToolType } from "../tools";
import { Enemy } from "../enemies/Enemy";
import { DEPTH } from "../../depth";

// Constants for turret
const TURRET_DETECTION_RANGE = 600;
const TURRET_ATTACK_RANGE = 500;
const TURRET_MAX_SHOOTING_RANGE = 700;
const TURRET_IMPRECISION_FACTOR = 15;
const TURRET_SCAN_INTERVAL = 500; // ms between enemy scans
const TURRET_FIRE_RATE = 800; // ms between shots

export class Turret extends Building {
  private assaultRifle: Tool | null = null;
  private enemyTarget: Enemy | null = null;
  private lastScanTime: number = 0;
  private lastFireTime: number = 0;
  private detectionRange: number = TURRET_DETECTION_RANGE;
  private attackRange: number = TURRET_ATTACK_RANGE;
  private maxShootingRange: number = TURRET_MAX_SHOOTING_RANGE;
  private imprecisionFactor: number = TURRET_IMPRECISION_FACTOR;
  private scanInterval: number = TURRET_SCAN_INTERVAL;
  private fireRate: number = TURRET_FIRE_RATE;
  private turretBase: Phaser.GameObjects.Sprite;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    tileWidth: number = 1,
    tileHeight: number = 1
  ) {
    super(scene, x, y, "turret", tileWidth, tileHeight, false, 150);

    // Create turret base
    this.turretBase = scene.add.sprite(0, 0, "turret");
    this.turretBase.setDisplaySize(TILE_SIZE, TILE_SIZE);
    this.turretBase.setOrigin(0.5, 0.5);

    // Add base to container
    this.add(this.turretBase);

    // Remove the default sprite since we're using custom sprites
    this.sprite.destroy();

    // Equip the turret with an assault rifle (this will be our turret top)
    this.equipWeapon();
  }

  protected getBuildingName(): string {
    return "Defense Turret";
  }

  private equipWeapon(): void {
    // Create an assault rifle for the turret
    this.assaultRifle = new Tool(
      ToolType.ASSAULT_RIFLE,
      "Turret Gun",
      this.scene,
      "assault-rifle"
    );
  }

  private scanForEnemies(time: number): void {
    // Only scan periodically to save performance
    if (time - this.lastScanTime < this.scanInterval) {
      return;
    }

    this.lastScanTime = time;

    // Get all enemies from game state
    const gameState = (window as any).gameState;
    if (!gameState || !gameState.enemies || gameState.enemies.length === 0) {
      return;
    }

    // Find the closest enemy within detection range
    let closestEnemy: Enemy | null = null;
    let closestDistance = this.detectionRange;

    for (const enemy of gameState.enemies) {
      if (!enemy || !enemy.isAlive()) continue;

      const enemySprite = enemy.getSprite();
      if (!enemySprite || !enemySprite.active) continue;

      // Get enemy position
      let enemyX, enemyY;
      if (enemySprite instanceof Phaser.GameObjects.Container) {
        enemyX = enemySprite.x;
        enemyY = enemySprite.y;
      } else {
        enemyX = enemySprite.x;
        enemyY = enemySprite.y;
      }

      // Calculate distance to enemy
      const distance = Phaser.Math.Distance.Between(
        this.x,
        this.y,
        enemyX,
        enemyY
      );

      // If this enemy is closer than the current closest, update
      if (distance < closestDistance) {
        closestDistance = distance;
        closestEnemy = enemy;
      }
    }

    // Update the enemy target
    this.enemyTarget = closestEnemy;
  }

  private attackEnemyTarget(time: number): void {
    if (
      !this.enemyTarget ||
      !this.enemyTarget.isAlive() ||
      !this.assaultRifle
    ) {
      return;
    }

    const enemySprite = this.enemyTarget.getSprite();
    if (!enemySprite || !enemySprite.active) return;

    // Get enemy position
    let enemyX, enemyY;
    if (enemySprite instanceof Phaser.GameObjects.Container) {
      enemyX = enemySprite.x;
      enemyY = enemySprite.y;
    } else {
      enemyX = enemySprite.x;
      enemyY = enemySprite.y;
    }

    // Calculate distance to enemy
    const distance = Phaser.Math.Distance.Between(
      this.x,
      this.y,
      enemyX,
      enemyY
    );

    // Only attack if within attack range AND maximum shooting range
    if (distance > this.attackRange || distance > this.maxShootingRange) {
      return;
    }

    // Calculate angle to enemy
    const angle = Phaser.Math.Angle.Between(this.x, this.y, enemyX, enemyY);

    // Update tool position and rotation
    this.updateToolPosition(angle);

    // Add imprecision to the target position
    const imprecision = this.imprecisionFactor;
    const targetX = enemyX + (Math.random() * 2 - 1) * imprecision;
    const targetY = enemyY + (Math.random() * 2 - 1) * imprecision;

    // Only fire if enough time has passed since last shot
    if (time - this.lastFireTime >= this.fireRate) {
      this.lastFireTime = time;

      // Fire the tool
      this.fireTool(targetX, targetY);
    }
  }

  private updateToolPosition(angle: number): void {
    if (!this.assaultRifle) return;

    // Show the tool at the turret's position
    this.assaultRifle.show(this.x, this.y, false);

    // Update tool rotation to face the enemy
    this.assaultRifle.setRotation(angle);
  }

  private fireTool(targetX: number, targetY: number): void {
    if (!this.assaultRifle) return;

    // Use the assault rifle's fire method
    this.assaultRifle.updateLaserPointer(
      this.x,
      this.y,
      targetX,
      targetY,
      false
    );

    // Check if the weapon can fire based on its burst logic
    const currentTime = this.scene.time.now;
    if (this.assaultRifle.canFire(currentTime)) {
      // Update the burst state
      this.assaultRifle.updateBurstState(currentTime);

      // Fire the tool
      this.assaultRifle.fire(false);
    }
  }

  public update(time: number, delta: number): void {
    super.update(time, delta);

    // Scan for enemies
    this.scanForEnemies(time);

    // Attack if we have a target
    if (this.enemyTarget) {
      this.attackEnemyTarget(time);
    }
  }

  public destroy(): void {
    // Clean up the weapon
    if (this.assaultRifle) {
      this.assaultRifle.destroy();
      this.assaultRifle = null;
    }

    super.destroy();
  }
}
