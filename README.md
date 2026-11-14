# Coworking Desk Booking DApp

A mini-project using Solidity, React, Vite, ethers.js,
MetaMask, and Hardhat.

## Features

- 12 desks, numbered 1–12.
- Initial rate: 0.02 ETH per desk per day.
- Only the manager can set a positive rate.
- Exact payment required; gas is paid separately.
- One booking per desk per future UTC date.
- Live availability and blockchain booking confirmation.

## Requirements

Node.js 24 LTS, npm, MetaMask, and Remix IDE.

## Installation

```sh
npm ci
```

## Start the local blockchain

```sh
npx hardhat node
```

Keep this terminal running.

Configure MetaMask:
- RPC URL: http://127.0.0.1:8545
- Chain ID: 31337
- Currency symbol: ETH

Import a test account using a private key printed by Hardhat.
Never use these public test keys for real funds.

## Deploy

1. Open CoworkingDeskBooking.sol in Remix.
2. Compile with Solidity 0.8.24.
3. Select Browser Extension / MetaMask.
4. Select the local network and manager account.
5. Deploy with value 0 wei.
6. Update CONTRACT_ADDRESS in src/contract.js.

## Start the frontend

In a second terminal:

```sh
npm run dev
```

Open the URL printed by Vite, connect the wallet on
the local network, select a future UTC date, and book a desk.

## Testing

Manual tests cover successful booking, duplicate booking,
incorrect payment, invalid desks and dates, manager permissions,
rate updates, wallet cancellation, multiple accounts,
and persistence after refreshing the frontend.

## Limitations

Restarting the default Hardhat network resets blockchain data.
Redeploy and check the configured contract address afterward.

Funds remain in the contract. Withdrawals, refunds,
and booking cancellation are not implemented.