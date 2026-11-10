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

## Security Audit History

| Round | Commit | Key Fixes |
|---|---|---|
| Round 3 | `12a45b5` | Cooldown semantics, push→pull payout, createEvent timing |
| Round 4 | `9387f5f` | withdrawNoShowProceeds settled flag, formatUsdc BigInt, clipboard, TxButton, circular import, getLogs parallel, chainId, CSS vars |
| Pentest | `df28a9a` | CSP unsafe-inline removed, parseUsdc BigInt, capacity cap, QR pre-validate, event-not-found, confirmation dialogs |
| Round 5 | `6a6ed51` | Cooldown gate moved to claim/unstake, isInCooldown view, Staking UI lockout |
| Round 6 | `0791534` | Organizer split bypass (Critical), reward double-count (Critical), permissionless settlement, one-time pool, 29 tests. See docs/pre-deploy-audit-round5.md |
| Round 7 | current | Payout wallet fix + updatePayoutWallet, reclaimStakerCredit removed, Stake tab mounted, reservation/event discovery via logs, safe dates, strict USDC parsing, 53 tests |

## Cooldown Design Note

SeatBackStaking cooldown (24h) **gates claim and unstake** — stakers cannot claim or unstake within 24h of their last stake. Rewards accrue normally during the cooldown window; they become claimable once 24h passes. This blocks same-block flash-stake attacks. Truly forfeiting mid-cooldown accruals would require O(n) updates on every `receiveProceeds()` call — not feasible at scale with accumulator-based distribution.

## Deployed (Arc Mainnet, 2026-11-10)

- SeatBack v4: `0xAD55d8959c56da02E730A2354CE430bfD42976FA` (block 30541040, admin 0x11315Cce8f009e4CB4234FFEAF2E860b84E5b0f6)
- SeatBackStaking v3: `0xa9442b3d23DDAA65D5cE7cc766ABbCb1f7720099` (owner = same wallet)
- SBK: `0x6AB94508cB97756873316f6819F258BCE444363f`
- PENDING: admin must call `SeatBack.setStakingPool(<Staking v3>)` once; until then createEvent reverts.
- Old v3/v2 and earlier deployments are unsafe. Do not use.

## Contracts to Redeploy (historical notes)

Round 6 fixed two Critical bugs, so ALL earlier deployments of SeatBack and SeatBackStaking are unsafe. Do not use them.
Files ready: `public/remix/2_SeatBackStaking.sol` and `public/remix/3_SeatBack.sol`.

Remix compiler settings: Solidity 0.8.28. No special config needed: the files compile with Remix defaults (verified with optimizer on/off and EVM paris/cancun, no via-IR). The public `events` getter was made internal to avoid 'Stack too deep'; read events with `getEvent`.

Deploy order (important):
1. Deploy `3_SeatBack.sol` (usdc, admin) -> address A
2. Deploy `2_SeatBackStaking.sol` (sbk, usdc, A, owner) -> address B
3. Admin calls `SeatBack.setStakingPool(B)` (verify the address first). This works only once and cannot be undone, so double-check B first.
4. Only then create events (createEvent reverts until the pool is set).
5. Update addresses in `src/contract.ts` and set `DEPLOY_BLOCK` in `src/hooks/usePoints.ts`.

Settlement flow: finalize, then anyone calls `withdrawNoShowProceeds(eventId)` once (splits 50/50),
then the organizer calls `withdrawOrganizerCredit(eventId)`. Failed pool deliveries: anyone calls `retryStakerCredit`. Organiser proceeds always go to the event's payout wallet; the organiser can change it with `updatePayoutWallet`.

## To Run

```bash
bun install
bun run dev
```
