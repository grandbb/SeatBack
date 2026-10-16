# SeatBack — Mainnet Deployment Checklist

> Arc Studio does not deploy or sign mainnet transactions on your behalf.
> All steps below must be carried out by you from your own wallet and terminal.

---

## 1. Pre-deployment requirements

- [ ] Contract audited by an independent third party (security + functional).
- [ ] All unit and integration tests pass against a local Arc fork (`arc-anvil --fork-url https://rpc.mainnet.arc.io`).
- [ ] You have reviewed the [Arc EVM differences](https://docs.arc.io/arc/references/evm-differences) — especially the 18-decimal native USDC vs 6-decimal ERC-20 USDC distinction.
- [ ] Install Arc Foundry (`arc-forge` / `arc-cast`) for Arc-native deployment: https://docs.arc.io/arc/tutorials/install-arc-foundry

---

## 2. Deploy the contract

```bash
# Set in your shell — never commit private keys
export DEPLOYER_PRIVATE_KEY=0x...
export ARC_RPC=https://rpc.mainnet.arc.io

# Build
forge build

# Deploy (dry run first)
forge script contracts/script/DeploySeatBack.s.sol \
  --rpc-url $ARC_RPC \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast \
  --verify          # optional — submits source to the Arc explorer
```

The script prints the deployed contract address. Copy it.

---

## 3. Wire the address into the frontend

Add to `.env` (or your hosting provider's environment variables):

```
VITE_NETWORK=mainnet
VITE_MAINNET_SEATBACK_ADDRESS=0x<your-deployed-address>
```

**Do not hard-code the address in source.** The `.env` approach means a
misconfigured build fails loudly at runtime rather than silently pointing at a
wrong contract.

---

## 4. Verify on-chain state

```bash
# Confirm the USDC address the contract was initialised with
cast call <contract-address> "usdc()(address)" --rpc-url $ARC_RPC
# Expected: 0x3600000000000000000000000000000000000000

# Confirm the domain separator (binds signatures to this contract + chain)
cast call <contract-address> "DOMAIN_SEPARATOR()(bytes32)" --rpc-url $ARC_RPC
```

---

## 5. Small-value smoke test

1. Create a test event with a 0.01 USDC deposit and capacity 1.
2. Reserve a seat (approve + reserve).
3. Open check-in, generate a QR, scan and submit `checkInWithSig`.
4. Verify `CheckedIn` event in the Arc explorer.
5. Claim the refund and verify the USDC arrives.

---

## 6. Gas budget guidance

- On Arc, USDC is the gas token.
- Each transaction type (approximate, measure on testnet first):
  - `createEvent`: ~120 000 gas
  - `reserve`: ~80 000 gas
  - `checkIn` / `checkInWithSig`: ~60 000 gas
  - `claimRefund` / `withdrawNoShowProceeds`: ~50 000 gas
- Arc mempool enforces a minimum `maxFeePerGas` of 20 Gwei.
- At 20 Gwei, 120 000 gas ≈ 0.0000024 USDC (sub-cent).

---

## 7. Production build

```bash
# In this repo
VITE_NETWORK=mainnet \
VITE_MAINNET_SEATBACK_ADDRESS=0x... \
  bun run build

# Preview locally
bun run preview
```

---

## 8. Mainnet contract addresses (from official Arc docs)

| Asset | Address | Network |
|---|---|---|
| USDC (ERC-20) | `0x3600000000000000000000000000000000000000` | Arc Mainnet |
| USDC (ERC-20) | `0x3600000000000000000000000000000000000000` | Arc Testnet |

Explorer: https://explorer.arc.io
RPC: https://rpc.mainnet.arc.io
Chain ID: 5042

---

## 9. Submission evidence slots

| Slot | Value |
|---|---|
| Arc Studio project URL | _fill in_ |
| Public app URL | _fill in_ |
| Public repository URL | _fill in_ |
| SeatBack contract (Arc Testnet) | `0x807f6bef741e807472e9f07d6d0fbaf061dba6ba` |
| SeatBack contract (Arc Mainnet) | _fill in after deploy_ |
| Mainnet USDC tx hashes | _fill in_ |
| Builder profile | _fill in_ |
| Demo video URL | _fill in_ |
