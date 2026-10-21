# SeatBack — Project Memory

> Built with Arc Studio — money-powered apps in minutes

This is the **project memory** — what Arc Studio remembers about building this app.

---

## What This App Does

SeatBack is an onchain event attendance escrow dApp on Arc Mainnet.
Attendees reserve seats by paying a USDC deposit into an escrow contract.
They receive a full refund if they attend (organiser-attested via EIP-712 QR check-in)
or cancel before the refund cutoff. No-shows forfeit their deposit — 50% goes to
the organiser and 50% is routed to SBK stakers via SeatBackStaking.

## Deployed Contracts — Arc Mainnet (chain 5042)

| Contract | Address | Deployed | Notes |
|---|---|---|---|
| SeatBack v3 | `0x6Fdb06A9Ce387937C2261F489E502e53cA1F0Bbc` | 2026-10-21 | Active production contract |
| SeatBackStaking v2 | `0x4ae8f1dA7699f3a78a12f8fD28C83F159c84F177` | 2026-10-21 | SBK staking, USDC rewards |
| SeatBackToken (SBK) | `0x6AB94508cB97756873316f6819F258BCE444363f` | 2026-10-18 | 100M fixed supply |
| SeatBack v1 (old) | `0x5edD40f2817D5ADd1E991dAfa6852521ef19fDA7` | 2026-10-16 | Superseded by v3, DO NOT USE |
| SeatBackStaking v1 (buggy) | `0xDB60571DB9027768660B48173bb9feEc204495FA` | — | DO NOT USE |

## Wiring Status

SeatBack v3 `stakingPool` is currently `address(0)` — owner must call:
1. **`SeatBack.setStakingPool(0x4ae8f1dA7699f3a78a12f8fD28C83F159c84F177)`** via Remix
2. **`SeatBackStaking.setSeatBack(0x6Fdb06A9Ce387937C2261F489E502e53cA1F0Bbc)`** via Remix

Both calls must come from `0x11315Cce8f009e4CB4234FFEAF2E860b84E5b0f6`.

## Contract Addresses

- USDC (Arc Mainnet): `0x3600000000000000000000000000000000000000` — 6 decimals
- USDC (Arc Testnet): `0x3600000000000000000000000000000000000000` — same address
- Admin/owner wallet: `0x11315Cce8f009e4CB4234FFEAF2E860b84E5b0f6`

## Deployed Contracts — Arc Testnet (chain 5042002)

| Contract | Address |
|---|---|
| SeatBack v1 (testnet) | `0x807f6bef741e807472e9f07d6d0fbaf061dba6ba` |

## Network

App is hardcoded to **Arc Mainnet** (`IS_MAINNET = true`, `ACTIVE_CHAIN_ID = 5042`).
SEATBACK_ADDRESS points to v3: `0x6Fdb06A9Ce387937C2261F489E502e53cA1F0Bbc`.

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS (dark/light mode)
- Web3: wagmi v2, viem v2, ConnectKit
- Contracts: Solidity 0.8.28 + Foundry. `forge build` in `contracts/`
- Token: USDC (6 decimals) at `0x3600000000000000000000000000000000000000`
- Toasts: Sonner

## Live URLs

- App: https://arc-studio-seatback.vercel.app
- GitHub: https://github.com/grandbb/SeatBack
- Arc Mainnet explorer: https://explorer.arc.io
- SeatBack v3 explorer: https://explorer.arc.io/address/0x6Fdb06A9Ce387937C2261F489E502e53cA1F0Bbc
- SeatBackStaking explorer: https://explorer.arc.io/address/0x4ae8f1dA7699f3a78a12f8fD28C83F159c84F177
- SBK token explorer: https://explorer.arc.io/address/0x6AB94508cB97756873316f6819F258BCE444363f

## Key Files

- `src/contract.ts` — All contract addresses + ABIs (SeatBack, Staking, SBK)
- `src/config.ts` — wagmi config (Arc Mainnet first)
- `src/App.tsx` — 6-tab routing
- `src/views/Staking.tsx` — SBK staking UI
- `src/views/Docs.tsx` — Full documentation
- `contracts/SeatBack.sol` — v3 source
- `contracts/SeatBackStaking.sol` — v2 source
- `contracts/SeatBackToken.sol` — SBK source
- `public/remix/` — Flatten+pragma-fixed files for Remix deploy

## To Run

```bash
bun install
bun run dev
```
