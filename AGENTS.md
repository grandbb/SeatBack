# SeatBack

> Built with Arc Studio - money-powered apps in minutes

This is the **project memory** — what Arc Studio remembers about building this app.

---

## What This App Does

SeatBack is an event attendance escrow dApp on Arc Testnet.
Attendees reserve seats by paying a USDC deposit into an escrow contract.
They receive a full refund if they attend (organiser-attested via EIP-712 QR check-in)
or cancel before the refund cutoff. No-shows forfeit their deposit to the organiser.
Organiser-cancelled events and never-opened check-in windows both refund everyone.

## Deployed Contracts

| Contract | Network | Address | Explorer |
|---|---|---|---|
| SeatBack | Arc Testnet | `0x807f6bef741e807472e9f07d6d0fbaf061dba6ba` | [View](https://explorer.testnet.arc.io/address/0x807f6bef741e807472e9f07d6d0fbaf061dba6ba) |

Deploy tx: `0x03668f1fa0a35c2d4a84454a7b058f5b14d73ad17dbc653cd9be47752c039a53`
Deployed: 2026-10-16

| SeatBack | Arc Mainnet | `0x5edD40f2817D5ADd1E991dAfa6852521ef19fDA7` | [View](https://explorer.arc.io/address/0x5edD40f2817D5ADd1E991dAfa6852521ef19fDA7) |

## Network switching

The app is dual-network. Switch via `.env`:

```
VITE_NETWORK=testnet   # Arc Testnet (default, for development)
VITE_NETWORK=mainnet   # Arc Mainnet (requires VITE_MAINNET_SEATBACK_ADDRESS)
```

Mainnet contract address must be set in `VITE_MAINNET_SEATBACK_ADDRESS` after you deploy.
See `docs/mainnet-deploy-checklist.md` for the full deploy flow.

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Web3: wagmi v2, viem v2, ConnectKit
- Contracts: Solidity 0.8.28 + Foundry. Sources in `contracts/`, unit tests in `contracts/test/*.t.sol`. Build with `bun run contracts:build` (`forge build`), test with `bun run contracts:test` (`forge test`).
- Wallet: injected (MetaMask, etc.)
- Chain: Arc Testnet (Chain ID: 5042002, imported from `viem/chains`)
- Token: USDC (6 decimals) (Address: 0x3600000000000000000000000000000000000000, Chain: Arc Testnet)
- Toasts: Sonner

## Key Files

- `src/App.tsx` - Main application logic
- `src/components/` - UI components
- `src/config.ts` - wagmi config (chains, connectors, transports)

## To Run

```bash
bun install
bun run dev
```
