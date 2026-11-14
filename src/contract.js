export const CONTRACT_ADDRESS =
  "0x5FbDB2315678afecb367f032d93F642f64180aa3";

export const CHAIN_ID = 31337n;

// ABI mo ta cac ham ma giao dien duoc phep goi.
export const CONTRACT_ABI = [
  "function dailyRate() view returns (uint256)",
  "function manager() view returns (address)",
  "function getBookingOwner(uint256 deskId, uint256 bookingDate) view returns (address)",
  "function isDeskAvailable(uint256 deskId, uint256 bookingDate) view returns (bool)",
  "function bookDesk(uint256 deskId, uint256 bookingDate) payable",
];