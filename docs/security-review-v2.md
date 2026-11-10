> **Historical document.** Written for earlier contract versions (v1 to v3). Addresses, functions and findings here may be outdated or refer to code that was removed. The current review is `docs/pre-deploy-audit-round5.md`.

# SeatBack Security Review — Round 2
**Date:** November 1, 2026  
**Contracts audited:** SeatBack.sol v3, SeatBackStaking.sol v2, SeatBackToken.sol  
**Chain:** Arc Mainnet (chain ID 5042)  
**Status:** All findings fixed. Contracts must be redeployed.

---

## Summary

| Severity | Count | Fixed |
|---|---|---|
| Critical | 1 | ✅ |
| High | 2 | ✅ |
| Medium | 1 | ✅ |
| Low/Info | 0 | — |

---

## Finding 1 — Critical — Staker Transfer Failure Locks All Proceeds

**Contract:** SeatBack.sol  
**Function:** `withdrawNoShowProceeds` / `_finalizeEvent`

**Description:**  
At finalization, `poolSnapshot[eventId]` is frozen to the current `stakingPool` address. If that address later fails to receive USDC (e.g., blocklisted, contract self-destructed, or rejects the transfer), the entire `withdrawNoShowProceeds` call reverts — including the organiser's 50% share. No-show proceeds are permanently locked with no recovery path.

**Fix applied:**  
Wrapped the staker transfer in a try/catch via `_routeStakerProceeds()` internal helper. If the transfer fails, the staker amount is stored in `unclaimedStakerCredit[eventId]`. The organiser share is always paid regardless. Added `reclaimStakerCredit(uint256 eventId, address newPool)` for admin to redirect stuck credit to a verified replacement pool.

**New storage added:**
- `mapping(uint256 => uint256) public unclaimedStakerCredit`

**New functions added:**
- `_routeStakerProceeds(uint256 eventId, address pool, uint256 amount) internal`
- `reclaimStakerCredit(uint256 eventId, address newPool) external onlyAdmin`

---

## Finding 2 — High — setStakingPool Accepts Any Contract

**Contract:** SeatBack.sol  
**Function:** `setStakingPool`

**Description:**  
The previous `code.length > 0` check allows any deployed contract to be set as `stakingPool`. An admin could (accidentally or maliciously) point proceeds to a contract that does not route funds to SBK stakers.

**Fix applied:**  
`setStakingPool` now calls `ISeatBackStaking(newPool).seatBack()` and requires it to return `address(this)`. This verifies the pool is a genuine `SeatBackStaking` deployment wired to this SeatBack contract. Added `seatBack() external view returns (address)` to the `ISeatBackStaking` interface.

---

## Finding 3 — High — Block-Based Cooldown Assumes Stable Block Time

**Contract:** SeatBackStaking.sol  
**Variables:** `STAKE_COOLDOWN_BLOCKS`, `stakeBlock`

**Description:**  
`STAKE_COOLDOWN_BLOCKS = 7200` assumes ~1 block/12s = 24h. If Arc's block cadence differs (faster or slower), the actual cooldown in wall-clock time can be materially shorter or longer than intended. This undermines the anti-flash-stake MEV protection.

**Fix applied:**  
- Replaced `STAKE_COOLDOWN_BLOCKS = 7200` with `STAKE_COOLDOWN_SECONDS = 24 hours` (86400)
- Replaced `mapping(address => uint256) public stakeBlock` with `mapping(address => uint256) public stakeTimestamp`
- Updated `stake()` to set `stakeTimestamp[msg.sender] = block.timestamp`
- Updated `_updateReward()` cooldown gate to `block.timestamp >= stakeTimestamp[user] + STAKE_COOLDOWN_SECONDS`

---

## Finding 4 — Medium — Integer Truncation Loses USDC Dust

**Contract:** SeatBackStaking.sol  
**Functions:** `receiveProceeds`, `syncUndistributed`

**Description:**  
`delta = (total * PRECISION) / totalStaked` causes truncation. The remainder `total - (delta * totalStaked / PRECISION)` is lost on each distribution call. Over many small distributions, this accumulates as unclaimable USDC dust in the contract balance.

**Fix applied:**  
After computing `delta`, compute `distributed = (delta * totalStaked) / PRECISION` and set `undistributedProceeds = total - distributed`. This carries the truncation remainder forward to the next distribution cycle. Same pattern applied in `syncUndistributed`.

---

## Deployment Required

Both `SeatBack.sol` and `SeatBackStaking.sol` have been modified. New deployments are required:

1. Deploy `SeatBackStaking` (new — uses `stakeTimestamp` instead of `stakeBlock`)
2. Deploy `SeatBack` (new — has `unclaimedStakerCredit` + stronger `setStakingPool` check)
3. Call `SeatBack.setStakingPool(newStakingAddress)` — will now verify `seatBack()` returns correct address
4. Call `SeatBackStaking.setSeatBack(newSeatBackAddress)`
5. Update frontend with new addresses

**SeatBackToken** is unchanged — no redeployment needed.
