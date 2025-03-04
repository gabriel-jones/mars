export enum TileType {
  GROUND = "ground",
  ICE_DEPOSIT = "ice_deposit",
  // Add other tile types as needed
}

export const tileData = {
  [TileType.GROUND]: {
    name: "Ground",
    color: "#8B7355", // Brown color for ground
    walkable: true,
  },
  [TileType.ICE_DEPOSIT]: {
    name: "Ice Deposit",
    color: "#ADD8E6", // Light blue for ice
    icon: "❄️",
    walkable: true,
  },
};
