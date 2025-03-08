// Define resource IDs as a string literal union type
export type ResourceCategory =
  | "food"
  | "metals"
  | "elements"
  | "life-support"
  | "robots";
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
  | "water"
  // Robots
  | "robot";

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
    emoji: "🔳",
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

import { gameState } from "../state";

export class ResourceManager {
  // Track all resource nodes in the game
  private static resourceNodes: any[] = [];

  // Event constants
  static readonly EVENTS = {
    RESOURCE_ADDED: "resource-added",
    RESOURCE_USED: "resource-used",
    INVENTORY_CHANGED: "inventory-changed",
    MONEY_CHANGED: "money-changed",
  };

  static getResources(): Resource[] {
    return RESOURCE_DEFINITIONS;
  }

  static getResource(type: ResourceType): Resource | undefined {
    return RESOURCE_DEFINITIONS.find((resource) => resource.type === type);
  }

  static getInventory(): ResourceCount[] {
    return gameState.resources.inventory;
  }

  static getResourceAmount(type: ResourceType): number {
    const resource = gameState.resources.inventory.find(
      (item) => item.type === type
    );
    return resource ? resource.amount : 0;
  }

  static addResource(type: ResourceType, amount: number): void {
    const resource = gameState.resources.inventory.find(
      (item) => item.type === type
    );
    if (resource) {
      resource.amount += amount;
    } else {
      gameState.resources.inventory.push({ type, amount });
    }

    // Emit events
    gameState.resources.events.emit(this.EVENTS.RESOURCE_ADDED, {
      type,
      amount,
    });
    gameState.resources.events.emit(
      this.EVENTS.INVENTORY_CHANGED,
      gameState.resources.inventory
    );
  }

  static useResource(type: ResourceType, amount: number): boolean {
    const resource = gameState.resources.inventory.find(
      (item) => item.type === type
    );
    if (resource && resource.amount >= amount) {
      resource.amount -= amount;

      // Emit events
      gameState.resources.events.emit(this.EVENTS.RESOURCE_USED, {
        type,
        amount,
      });
      gameState.resources.events.emit(
        this.EVENTS.INVENTORY_CHANGED,
        gameState.resources.inventory
      );
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

  static registerResourceNode(node: any): void {
    // Add the node to our tracking array if it's not already there
    if (!this.resourceNodes.includes(node)) {
      this.resourceNodes.push(node);
    }
  }

  static unregisterResourceNode(node: any): void {
    // Remove the node from our tracking array
    const index = this.resourceNodes.indexOf(node);
    if (index !== -1) {
      this.resourceNodes.splice(index, 1);
    }
  }

  static getAllResourceNodes(): any[] {
    return this.resourceNodes;
  }

  /**
   * Get the current money amount
   */
  static getMoney(): number {
    return gameState.money;
  }

  /**
   * Add money to the player's account
   * @param amount Amount to add (positive number)
   */
  static addMoney(amount: number): void {
    if (amount <= 0) return;

    gameState.money += amount;

    // Emit money changed event
    gameState.resources.events.emit(this.EVENTS.MONEY_CHANGED, gameState.money);
  }

  /**
   * Spend money from the player's account
   * @param amount Amount to spend (positive number)
   * @returns true if successful, false if insufficient funds
   */
  static spendMoney(amount: number): boolean {
    if (amount <= 0) return true;

    if (gameState.money >= amount) {
      gameState.money -= amount;

      // Emit money changed event
      gameState.resources.events.emit(
        this.EVENTS.MONEY_CHANGED,
        gameState.money
      );
      return true;
    }

    return false;
  }

  /**
   * Check if player has enough money
   * @param amount Amount to check
   * @returns true if player has enough money
   */
  static hasMoney(amount: number): boolean {
    return gameState.money >= amount;
  }
}
