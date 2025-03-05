import * as Phaser from "phaser";
import { Resource, ResourceType } from "../data/resources";

export enum ResourceNodeType {
  IceDeposit = "ice_deposit",
}

export class ResourceNode extends Phaser.GameObjects.Container {
  private resource: Resource;
  private amount: number;
  private emojiText: Phaser.GameObjects.Text;
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

    // Create the emoji text instead of orb graphic
    this.emojiText = scene.add
      .text(0, 0, resource.emoji, {
        fontSize: "32px",
      })
      .setOrigin(0.5);
    this.add(this.emojiText);

    // Add a label showing the resource type
    const labelText = `${resource.type} (${amount})`;
    this.label = scene.add
      .text(0, 30, labelText, {
        fontSize: "14px",
        color: "#FFFFFF",
        // stroke: "#000000",
        // strokeThickness: 2,
        align: "center",
      })
      .setOrigin(0.5);
    this.add(this.label);

    // Add a pulsing effect to the emoji
    this.pulseEffect = scene.tweens.add({
      targets: this.emojiText,
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
