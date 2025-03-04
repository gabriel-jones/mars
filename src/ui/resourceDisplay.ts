import Phaser from "phaser";
import { ResourceManager, ResourceType } from "../data/resources";

export class ResourceDisplay {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private resourceDisplays: Map<ResourceType, Phaser.GameObjects.Text> =
    new Map();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = this.scene.add.container(10, 10).setScrollFactor(0);
    this.createResourceDisplay();
  }

  private createResourceDisplay() {
    // Background panel
    const panel = this.scene.add
      .rectangle(0, 0, 200, 100, 0x000000, 0.5)
      .setOrigin(0, 0);
    this.container.add(panel);

    // Create display for each resource
    const resources = ResourceManager.getResources();
    resources.forEach((resource, index) => {
      const y = 15 + index * 25; // Adjusted y position since title is removed

      // Resource icon
      const icon = this.scene.add
        .image(20, y, resource.icon)
        .setOrigin(0, 0.5)
        .setScale(0.5);

      // Resource name and amount
      const text = this.scene.add
        .text(50, y, `${resource.displayName}: 0`, {
          fontSize: "16px",
          color: "#ffffff",
        })
        .setOrigin(0, 0.5);

      this.resourceDisplays.set(resource.type, text);
      this.container.add([icon, text]);
    });

    // Update the display initially
    this.update();
  }

  update() {
    const inventory = ResourceManager.getInventory();
    inventory.forEach((item) => {
      const display = this.resourceDisplays.get(item.type);
      if (display) {
        const resource = ResourceManager.getResource(item.type);
        if (resource) {
          display.setText(`${resource.displayName}: ${item.amount}`);
        }
      }
    });
  }
}
