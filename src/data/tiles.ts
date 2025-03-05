export enum TileType {
  ICE_DEPOSIT = "ice_deposit",
  // Add other tile types as needed
}

export const tileData = {
  [TileType.ICE_DEPOSIT]: {
    name: "Ice Deposit",
    color: "#ADD8E6", // Light blue for ice
    icon: "🧊",
    walkable: true,
  },
};
