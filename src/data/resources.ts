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
  | "regolith"
  // Metals
  | "iron"
  | "aluminium"
  | "magnesium"
  | "calcium"
  | "titanium"
  | "potassium"
  | "sodium"
  // Life Support
  | "energy"
  | "oxygen"
  | "water";

export interface Resource {
  type: ResourceType;
  category?: ResourceCategory;
  name: string;
  emoji: string;
  occurrenceRate?: number; // Rate at which this resource occurs in regolith (0-1)
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
    occurrenceRate: 0.4, // 40% occurrence in regolith
  },
  {
    type: "regolith",
    category: "elements",
    name: "Regolith",
    emoji: "🪨",
  },
  {
    type: "sulphur",
    category: "elements",
    name: "Sulphur",
    emoji: "🟡",
    occurrenceRate: 0.05, // 5% occurrence in regolith
  },

  // Metals
  {
    type: "iron",
    category: "metals",
    name: "Iron",
    emoji: "🔘",
    occurrenceRate: 0.2, // 20% occurrence in regolith
  },
  {
    type: "aluminium",
    category: "metals",
    name: "Aluminium",
    emoji: "🔩",
    occurrenceRate: 0.1, // 10% occurrence in regolith
  },
  {
    type: "magnesium",
    category: "metals",
    name: "Magnesium",
    emoji: "✨",
    occurrenceRate: 0.1, // 10% occurrence in regolith
  },
  {
    type: "calcium",
    category: "metals",
    name: "Calcium",
    emoji: "🦴",
    occurrenceRate: 0.08, // 8% occurrence in regolith
  },
  {
    type: "titanium",
    category: "metals",
    name: "Titanium",
    emoji: "🔩",
    occurrenceRate: 0.02, // 2% occurrence in regolith
  },
  {
    type: "potassium",
    category: "metals",
    name: "Potassium",
    emoji: "🧪",
    occurrenceRate: 0.01, // 1% occurrence in regolith
  },
  {
    type: "sodium",
    category: "metals",
    name: "Sodium",
    emoji: "🧂",
    occurrenceRate: 0.02, // 2% occurrence in regolith
  },
  // Life Support
  {
    type: "energy",
    category: "life-support",
    name: "Energy",
    emoji: "⚡️",
  },
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
