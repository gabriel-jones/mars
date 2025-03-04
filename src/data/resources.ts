// Define resource IDs as a string literal union type
export type ResourceType = "iron" | "oxygen" | "water" | "energy" | "food";

// Or as an enum
// export enum ResourceId {
//   Iron = 'iron',
//   Oxygen = 'oxygen',
//   Water = 'water',
//   Energy = 'energy',
//   Food = 'food'
// }

export interface Resource {
  type: ResourceType;
  name: string;
  displayName: string;
  description: string;
  icon: string; // Image key for the resource icon
}

export interface ResourceCount {
  type: ResourceType;
  amount: number;
}

export interface InventoryItem {
  type: ResourceType;
  amount: number;
}

export class ResourceManager {
  private static resources: Resource[] = [
    {
      type: "iron",
      name: "iron",
      displayName: "Iron",
      description: "Basic building material",
      icon: "iron-icon",
    },
    {
      type: "water",
      name: "water",
      displayName: "Water",
      description: "Essential for life support",
      icon: "water-icon",
    },
    {
      type: "oxygen",
      name: "oxygen",
      displayName: "Oxygen",
      description: "Required for breathing",
      icon: "oxygen-icon",
    },
  ];

  private static inventory: ResourceCount[] = [
    { type: "iron", amount: 50 },
    { type: "water", amount: 100 },
    { type: "oxygen", amount: 75 },
  ];

  static getResources(): Resource[] {
    return this.resources;
  }

  static getResource(type: ResourceType): Resource | undefined {
    return this.resources.find((resource) => resource.type === type);
  }

  static getInventory(): ResourceCount[] {
    return this.inventory;
  }

  static getResourceAmount(type: ResourceType): number {
    const resource = this.inventory.find((item) => item.type === type);
    return resource ? resource.amount : 0;
  }

  static addResource(type: ResourceType, amount: number): void {
    const resource = this.inventory.find((item) => item.type === type);
    if (resource) {
      resource.amount += amount;
    } else {
      this.inventory.push({ type, amount });
    }
  }

  static useResource(type: ResourceType, amount: number): boolean {
    const resource = this.inventory.find((item) => item.type === type);
    if (resource && resource.amount >= amount) {
      resource.amount -= amount;
      return true;
    }
    return false;
  }

  static hasResources(requirements: ResourceCount[]): boolean {
    return requirements.every((req) => {
      const currentAmount = this.getResourceAmount(req.type);
      return currentAmount >= req.amount;
    });
  }
}
