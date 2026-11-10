# SeatBack — Project Memory

> Built with Arc Studio — https://studio.arc.io

## What this app does

SeatBack is an onchain event attendance escrow on Arc Mainnet (chain 5042). Attendees lock a USDC deposit to
reserve a seat. They get it back if the organiser checks them in (EIP-712 QR, valid 10 minutes) or if they cancel
before the refund cutoff. No-show deposits are split 50% to SBK stakers (SeatBackStaking) and 50% to the organiser.
The organiser alone decides attendance (trust assumption, no dispute process).

## Live deployment (Arc Mainnet, 2026-11-10)

| Contract | Address |
|---|---|
| SeatBack v4 | `0xAD55d8959c56da02E730A2354CE430bfD42976FA` (deploy block 30541040) |
| SeatBackStaking v3 | `0xa9442b3d23DDAA65D5cE7cc766ABbCb1f7720099` |
| SBK token | `0x6AB94508cB97756873316f6819F258BCE444363f` (100,000,000 fixed supply, all held by the deployer wallet) |
| USDC (ERC-20, 6 decimals; also native gas) | `0x3600000000000000000000000000000000000000` |

- Admin of SeatBack and owner of SeatBackStaking: `0x11315Cce8f009e4CB4234FFEAF2E860b84E5b0f6`.
- `SeatBack.setStakingPool` has been called (pool = Staking v3). It can only be called once.
- Every earlier SeatBack/Staking deployment (including v3/v2 at 0x6Fdb06A9…, 0x4ae8f1dA…, 0x5edD40f2…, 0xDB60571D…) is superseded and unsafe. Do not use.
- Arc Testnet SeatBack v1 `0x807f6bef…` is a legacy test deployment only.

## How money moves

- Settlement: after `checkInEnd` anyone calls `finalizeEvent`, then anyone calls `withdrawNoShowProceeds` once (50/50 split), then the organiser or payout wallet calls `withdrawOrganizerCredit` (paid to the event payout wallet). A failed delivery to the pool is retried by anyone with `retryStakerCredit`.
- Checked-in and cancelled attendees can claim refunds immediately; if check-in was never opened everyone is refunded after `checkInEnd`.
- Staking: claim/unstake/exit are locked 24 h after the last stake; minimum total stake 1 SBK. If nobody is staking when an event settles, that staker half goes to an owner reserve only the staking owner can withdraw.
- Admin powers: set the staking pool once. Nothing else. No upgrade proxy.
- The organiser can change an event payout wallet (`updatePayoutWallet`). Deposit, capacity and deadlines are immutable.

## Product decisions (from the owner)

English only. Light mode default. Warning/callout colour is teal. Create Event takes UTC times; all other dates are shown in local time with offset. Footer: built by Max Play + studio.arc.io, email, contract address with explorer link, live indicator. Nav: Events, Create, My Tickets, Organiser, Stake; Docs and Demo in the hamburger menu; the logo goes to Home. No fake data or testimonials. Points are read-only offchain: Reserve 100, Check-in 300, Create 500 (needs 5 check-ins from other wallets), early adopter x2 for the first 500 wallets, cap 50,000. The airdrop (30M SBK), token allocation and team vesting are PLANNED only: no contract exists. The contracts have NOT had an independent third-party audit.

## Tech

React + Vite + TypeScript, Tailwind, wagmi v2 + viem + ConnectKit, Sonner. Contracts: Solidity 0.8.28, Foundry (`forge build`, `forge test`). Tests: 53 passing.

## Key files

- `src/contract.ts` addresses, ABIs, `DEPLOY_BLOCK`; `src/config.ts` wagmi (Arc Mainnet only)
- `src/App.tsx` routing; `src/components/*` pages; `src/hooks/useMyLogs.ts` log-based discovery; `src/hooks/usePoints.ts` points
- `contracts/SeatBack.sol`, `contracts/SeatBackStaking.sol`, `contracts/SeatBackToken.sol`, tests in `contracts/test/`
- `public/remix/` flattened deploy sources (see `DEPLOY_GUIDE.md`)
- `docs/pre-deploy-audit-round5.md` current internal review; other files in `docs/` are historical

## Live URLs

- App: https://arc-studio-seatback.vercel.app (connected to GitHub main)
- GitHub: https://github.com/grandbb/SeatBack
- Explorer: https://explorer.arc.io

## Run

```bash
bun install
bun run dev
```
