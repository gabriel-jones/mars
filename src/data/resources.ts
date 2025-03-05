// Define resource IDs as a string literal union type
export type ResourceCategory = "food" | "metals" | "elements" | "life-support";
export type ResourceType =
  // Food
  | "carrots"
  | "tomatoes"
  | "potatoes"
  | "beans"
  // Elements
  | "silicon"
  | "sulphur"
  // Metals
  | "iron"
  | "aluminium"
  | "magnesium"
  | "calcium"
  | "titanium"
  | "potassium"
  | "sodium"
  // Life Support
  | "oxygen"
  | "water";

export interface Resource {
  type: ResourceType;
  category?: ResourceCategory;
  name: string;
  emoji: string;
}

export interface ResourceCount {
  type: ResourceType;
  amount: number;
}

export interface InventoryItem {
  type: ResourceType;
  amount: number;
}

export const RESOURCE_DEFINITIONS: Resource[] = [
  // Food
  {
    type: "carrots",
    category: "food",
    name: "Carrots",
    emoji: "🥕",
  },
  {
    type: "tomatoes",
    category: "food",
    name: "Tomatoes",
    emoji: "🍅",
  },
  {
    type: "potatoes",
    category: "food",
    name: "Potatoes",
    emoji: "🥔",
  },
  {
    type: "beans",
    category: "food",
    name: "Beans",
    emoji: "🫘",
  },
  // Elements
  {
    type: "silicon",
    category: "elements",
    name: "Silicon",
    emoji: "🧱",
  },
  {
    type: "sulphur",
    category: "elements",
    name: "Sulphur",
    emoji: "🟡",
  },

  // Metals
  {
    type: "iron",
    category: "metals",
    name: "Iron",
    emoji: "🔘",
  },
  {
    type: "aluminium",
    category: "metals",
    name: "Aluminium",
    emoji: "🔩",
  },
  {
    type: "magnesium",
    category: "metals",
    name: "Magnesium",
    emoji: "✨",
  },
  {
    type: "calcium",
    category: "metals",
    name: "Calcium",
    emoji: "🦴",
  },
  {
    type: "titanium",
    category: "metals",
    name: "Titanium",
    emoji: "🔩",
  },
  {
    type: "potassium",
    category: "metals",
    name: "Potassium",
    emoji: "🧪",
  },
  {
    type: "sodium",
    category: "metals",
    name: "Sodium",
    emoji: "🧂",
  },
  // Life Support
  {
    type: "water",
    category: "life-support",
    name: "Water",
    emoji: "💧",
  },
  {
    type: "oxygen",
    category: "life-support",
    name: "Oxygen",
    emoji: "🅾️",
  },
];

export class ResourceManager {
  private static inventory: ResourceCount[] = [
    { type: "silicon", amount: 500 },
    { type: "aluminium", amount: 500 },
    { type: "iron", amount: 500 },
    { type: "water", amount: 100 },
    { type: "oxygen", amount: 75 },
  ];

  static getResources(): Resource[] {
    return RESOURCE_DEFINITIONS;
  }

  static getResource(type: ResourceType): Resource | undefined {
    return RESOURCE_DEFINITIONS.find((resource) => resource.type === type);
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
