# Security Review: Round 6 (supersedes the earlier "Round 5 final" report)

Target: Arc Mainnet (chain ID 5042). Contracts: `SeatBack.sol`, `SeatBackStaking.sol`.

The earlier version of this file said the contracts had no new bugs. That was wrong.
A fresh, deeper review found two Critical bugs, both now fixed and covered by tests.

## Fixed in this round

| # | Severity | Problem | Fix |
|---|---|---|---|
| 1 | Critical | The organizer (or payout wallet) could call `withdrawOrganizerCredit` right after finalize and take 100% of the no-show deposits, skipping the 50% staker share. | `withdrawOrganizerCredit` now requires the no-show split to have run first. `organizerPaid` now updates at the real payout. |
| 2 | Critical | Staking rounding carry was counted twice. Calling `syncUndistributed` repeatedly created rewards not backed by USDC (pool insolvency). | Carry is now kept as a scaled remainder and added exactly once. `syncUndistributed` and `undistributedProceeds` are removed. |
| 3 | High | Only the organizer could run the 50/50 split, so an absent organizer could withhold the staker share forever. | Anyone can run the split once. The caller gets nothing and cannot change the result. |
| 4 | High | Admin could swap the staking pool and redirect staker money. | The pool can be set only once, must point back to this escrow and use the same USDC. Events cannot be created until it is set. Failed deliveries can be retried by anyone to the original pool. |
| 5 | Medium | Renouncing ownership of the staking contract would strand the owner reserve. | `renounceOwnership` is disabled. Ownership handover is two-step. |
| 6 | App bug | The organizer screen never called the payout function, so the organizer could not collect funds from the UI. | Dashboard now has two steps: "Settle no-show proceeds", then "Withdraw". |

## Tests

29 Foundry tests pass (escrow end to end, split gate, solvency, one-time pool, failed delivery and retry, cancelled events, reward-solvency fuzz with 1000 runs).

## Known limitations (not bugs, you should know them)

- **USDC blocklist (issuer risk):** if Circle blocklists the SeatBack or SeatBackStaking address, USDC moving in or out of it reverts. No contract code can bypass this.
- **Staking cooldown:** the 24h cooldown stops same-block flash staking. A wealthy staker can still stake before a large settlement, earn a share, and exit 24h later.
- **Sybil seat hoarding:** one person with many wallets can reserve every seat during booking and cancel before the refund cutoff. Costs only gas and temporary capital.
- **Organizer trust:** the organizer decides who is checked in. There is no dispute process.
- **Pool is trusted:** the pool is chosen once by the admin. Choose and verify it before binding, because it cannot be changed.
- **Dust:** each stake checkpoint can round away less than 0.000001 USDC per user.
- **Zero stakers:** proceeds that arrive while nobody stakes go to the staking owner's reserve, not to future stakers.
- **Early refunds:** checked-in attendees can claim their refund before finalize.
