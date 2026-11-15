const NETWORKS = {
  local: {
    name: "Coworking Local",
    label: "LOCAL",
    chainId: 31337n,
    address: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    explorer: "",
  },

  sepolia: {
    name: "Sepolia",
    label: "SEPOLIA",
    chainId: 11155111n,
    address: "0x18C7e3631f9F619ed8c158Cd21587C73302f96D0",
    explorer: "https://sepolia.etherscan.io",
  },
};

// Change to "local" to use the local deployment.
export const ACTIVE_NETWORK = "sepolia";

const network = NETWORKS[ACTIVE_NETWORK];

export const CONTRACT_ADDRESS = network.address;
export const CHAIN_ID = network.chainId;
export const NETWORK_NAME = network.name;
export const NETWORK_LABEL = network.label;
export const EXPLORER_URL = network.explorer;

export const CONTRACT_ABI = [
  "function dailyRate() view returns (uint256)",
  "function manager() view returns (address)",
  "function getBookingOwner(uint256 deskId, uint256 bookingDate) view returns (address)",
  "function isDeskAvailable(uint256 deskId, uint256 bookingDate) view returns (bool)",
  "function bookDesk(uint256 deskId, uint256 bookingDate) payable",
];