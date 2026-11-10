# SeatBack deployment record (Arc Mainnet, chain 5042)

Current deployment (2026-11-10). Deploy files in this folder are the exact sources used:

- `1_SeatBackToken.sol`: SBK token (already deployed, 100,000,000 fixed supply)
- `2_SeatBackStaking.sol`: SeatBackStaking
- `3_SeatBack.sol`: SeatBack escrow

| Contract | Address |
|---|---|
| SeatBack v4 | 0xAD55d8959c56da02E730A2354CE430bfD42976FA (block 30541040) |
| SeatBackStaking v3 | 0xa9442b3d23DDAA65D5cE7cc766ABbCb1f7720099 |
| SBK token | 0x6AB94508cB97756873316f6819F258BCE444363f |
| USDC (ERC-20, 6 decimals) | 0x3600000000000000000000000000000000000000 |

Order if you ever redeploy: (1) SeatBack(usdc, admin), (2) SeatBackStaking(sbk, usdc, seatBack, owner),
(3) the admin calls SeatBack.setStakingPool(staking) exactly once. Events cannot be created before step 3.
Compile with Solidity 0.8.28 (Remix default settings work).

Older contracts deployed before 2026-11-10 are superseded and unsafe. Do not use them.
These contracts have not had an independent third-party audit.
