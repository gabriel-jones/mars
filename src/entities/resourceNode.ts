import Phaser from "phaser";
import { ResourceType, ResourceManager } from "../data/resources";

export class ResourceNode extends Phaser.GameObjects.Sprite {
  private resourceType: ResourceType;
  private amount: number;
  private isCollectible: boolean = true;
  private collectRadius: number = 100;
  private collectKey: Phaser.Input.Keyboard.Key;
  private collectPrompt: Phaser.GameObjects.Text | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    resourceType: ResourceType,
    amount: number
  ) {
    super(scene, x, y, `${resourceType}-node`);
    this.resourceType = resourceType;
    this.amount = amount;

    scene.add.existing(this);

    // Set up interaction
    this.setInteractive();

    // Add E key for collection
    this.collectKey = scene.input.keyboard!.addKey("E");
  }

  update(player: Phaser.GameObjects.Sprite) {
    if (!this.isCollectible) return;

    // Check if player is within collection radius
    const distance = Phaser.Math.Distance.Between(
      this.x,
      this.y,
      player.x,
      player.y
    );

    const isNearby = distance < this.collectRadius;

    // Show/hide collection prompt
    if (isNearby && !this.collectPrompt) {
      this.collectPrompt = this.scene.add
        .text(this.x, this.y - 40, "Press E to collect", {
          fontSize: "14px",
          color: "#ffffff",
        })
        .setOrigin(0.5);
    } else if (!isNearby && this.collectPrompt) {
      this.collectPrompt.destroy();
      this.collectPrompt = null;
    }

    // Check for collection input
    if (isNearby && Phaser.Input.Keyboard.JustDown(this.collectKey)) {
      this.collectResource();
    }
  }

  private collectResource() {
    // Add resource to inventory
    ResourceManager.addResource(this.resourceType, this.amount);

    // Show collection message
    const resource = ResourceManager.getResource(this.resourceType);
    const collectText = this.scene.add
      .text(
        this.x,
        this.y - 20,
        `+${this.amount} ${resource?.displayName || this.resourceType}`,
        { fontSize: "16px", color: "#ffff00" }
      )
      .setOrigin(0.5);

    // Animate the text upward and fade out
    this.scene.tweens.add({
      targets: collectText,
      y: this.y - 60,
      alpha: 0,
      duration: 1500,
      onComplete: () => {
        collectText.destroy();
      },
    });

    // Remove the collection prompt
    if (this.collectPrompt) {
      this.collectPrompt.destroy();
      this.collectPrompt = null;
    }

    // Either remove the node or make it non-collectible for a while
    this.isCollectible = false;
    this.setAlpha(0.5);

    // Respawn after a delay
    this.scene.time.delayedCall(30000, () => {
      this.isCollectible = true;
      this.setAlpha(1);
    });
  }
}
