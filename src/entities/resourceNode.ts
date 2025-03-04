import * as Phaser from "phaser";
import { Resource, ResourceType } from "../data/resources";

export enum ResourceNodeType {
  IceDeposit = "ice_deposit",
}

export class ResourceNode extends Phaser.GameObjects.Container {
  private resource: Resource;
  private amount: number;
  private orb: Phaser.GameObjects.Graphics;
  private pulseEffect: Phaser.Tweens.Tween;
  private label: Phaser.GameObjects.Text;
  public tileX: number;
  public tileY: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    resource: Resource,
    amount: number = 1000
  ) {
    super(scene, x, y);

    this.resource = resource;
    this.amount = amount;

    // Create the orb graphic
    this.orb = scene.add.graphics();
    this.drawOrb();
    this.add(this.orb);

    // Add a label showing the resource type
    this.label = scene.add
      .text(0, 30, resource.type, {
        fontSize: "14px",
        color: "#FFFFFF",
        stroke: "#000000",
        strokeThickness: 3,
        align: "center",
      })
      .setOrigin(0.5);
    this.add(this.label);

    // Add a pulsing effect
    this.pulseEffect = scene.tweens.add({
      targets: this.orb,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // Add physics to the resource node
    scene.physics.world.enable(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCircle(20); // Set collision radius
    body.setBounce(0.3); // Reduce bounciness for more gentle movement
    body.setDamping(true);
    body.setDrag(0.95); // Increase drag for quicker stopping
    body.setMass(2); // Increase mass for more resistance to movement

    // Start with zero velocity
    body.setVelocity(0, 0);

    scene.add.existing(this);
  }

  private drawOrb(): void {
    const color = this.getResourceColor();
    const radius = 15;

    this.orb.clear();

    // Draw the main orb
    this.orb.fillStyle(color, 1);
    this.orb.fillCircle(0, 0, radius);

    // Add a highlight effect
    this.orb.fillStyle(0xffffff, 0.5);
    this.orb.fillCircle(-radius / 3, -radius / 3, radius / 3);

    // Add a subtle glow
    for (let i = 1; i <= 3; i++) {
      this.orb.fillStyle(color, 0.1 - i * 0.03);
      this.orb.fillCircle(0, 0, radius + i * 5);
    }
  }

  private getResourceColor(): number {
    switch (this.resource.category) {
      case "food":
        return 0x2ecc71; // Green
      case "metals":
        return 0xbdc3c7; // Silver
      case "elements":
        return 0x9b59b6; // Purple
      case "life-support":
        switch (this.resource.type) {
          case "oxygen":
            return 0xff0000; // Red
          case "water":
            return 0x3498db; // Blue
          default:
            return 0xffffff; // White
        }
      default:
        return 0xffffff; // White
    }
  }

  public getAmount(): number {
    return this.amount;
  }

  public harvest(amount: number): number {
    const harvestedAmount = Math.min(amount, this.amount);
    this.amount -= harvestedAmount;

    // If the node is depleted, destroy it
    if (this.amount <= 0) {
      this.destroy();
    }

    return harvestedAmount;
  }

  // Apply force when player walks by
  public applyForce(
    playerX: number,
    playerY: number,
    strength: number = 5
  ): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (!body) return;

    // Calculate direction away from player
    const angle = Phaser.Math.Angle.Between(playerX, playerY, this.x, this.y);

    // Apply gentle force in that direction
    const forceX = Math.cos(angle) * strength;
    const forceY = Math.sin(angle) * strength;

    body.setVelocity(forceX, forceY);
  }
}
