# Security Review: Final Pre-Deploy Status (Round 7)

Target: Arc Mainnet (chain 5042). Contracts: SeatBack.sol, SeatBackStaking.sol. Deploy files: public/remix/3_SeatBack.sol, public/remix/2_SeatBackStaking.sol.

This replaces earlier versions of this file, which wrongly marked several items safe.

## Fixed in this round (all covered by tests; 53 pass, fuzz at 1000 runs)

| # | Severity | Problem | Fix |
|---|---|---|---|
| 1 | Critical | Organiser could withdraw 100% of no-show deposits, skipping the 50/50 staker split | Withdrawal requires settlement first |
| 2 | Critical | Staking rounding remainder was counted twice, creating unbacked rewards | Remainder carried once in scaled units |
| 3 | High | Only the organiser could trigger the split, so an absent organiser blocked stakers | Anyone can settle, once; caller gets nothing |
| 4 | High | Admin could swap the staking pool or redirect failed staker payments | Pool is set once and checked (same escrow, same USDC); admin redirect removed; anyone can retry delivery to the original pool |
| 5 | High | Organiser proceeds went to the caller, not the payout wallet the form promised | Always paid to the payout wallet; organiser can change it (covers a wallet that cannot receive USDC) |
| 6 | Medium | Ownership of the staking contract could be renounced (stranding owner reserve) or sent to a wrong address in one step | Renounce disabled; two-step transfer |
| 7 | Critical (app) | Staking page was never reachable in the app | Added a Stake tab |
| 8 | Critical (app) | After cancelling or checking in, the app could no longer find the reservation, so the refund could not be claimed from the UI | Reservations are found from onchain logs |
| 9 | High (app) | Organiser dashboard and My Tickets only looked at the newest 50/100 events | Found from onchain logs by wallet |
| 10 | High (app) | An event with an out-of-range date could crash the page | Safe date display plus an error boundary |
| 11 | Medium (app) | Deposit input accepted "1e3" as 1,000 USDC; Max buttons rounded SBK; create form missed contract limits (byte lengths, schedule); cancel button disappeared early; screens refreshed before transactions were mined; smart-wallet QR signatures rejected | All fixed |

## Accepted limitations (not bugs)

- USDC issuer can freeze the escrow or staking contract; code cannot prevent that.
- Attendance is decided by the organiser. There is no dispute process.
- A staker with large capital can stake just before a settlement and claim after the 24h lock.
- Many wallets can reserve all seats and cancel before the refund cutoff.
- The first pool choice is trusted: the admin picks the staking contract once, before any event exists. The setting cannot be changed afterwards, so verify the address before calling it.
- Rewards lose less than 0.000001 USDC per claim to rounding.
- Log lookups read from DEPLOY_BLOCK to the latest block. Set DEPLOY_BLOCK to the real deployment block after deploying.

## Not done

- No independent human audit.
- Deployed mainnet bytecode could not be checked from here: the addresses currently in src/contract.ts are the OLD, unsafe deployments. They must be replaced after redeploying.
