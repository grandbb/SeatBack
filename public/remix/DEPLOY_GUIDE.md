# SeatBack v2 — Remix Deploy Guide

Deploy order: **1 → 2 → 3 → 4 (wire)**

---

## Global Remix Settings (apply once)

| Setting | Value |
|---|---|
| **Compiler** | `0.8.20` (or any `^0.8.20`) |
| **EVM Version** | `paris` |
| **Optimiser** | ✅ ON — 200 runs |
| **Environment** | Injected Provider — MetaMask (must be on Arc Mainnet, chainId 5042) |

---

## Arc Mainnet Details

| | Value |
|---|---|
| **Network name** | Arc Mainnet |
| **Chain ID** | `5042` |
| **RPC URL** | `https://rpc.mainnet.arc.io` |
| **Explorer** | `https://explorer.arc.io` |
| **USDC address** | `0x3600000000000000000000000000000000000000` |

Add Arc Mainnet to MetaMask:
> Settings → Networks → Add network manually → fill in the values above, currency symbol: USDC

---

## Step 1 — Deploy SeatBackToken.sol

**File:** `SeatBackToken.sol`
**Contract to select:** `SeatBackToken`

### Constructor arguments
| Argument | Value | Notes |
|---|---|---|
| `initialOwner` | `YOUR_WALLET_ADDRESS` | The wallet deploying — receives all 100M SBK |

### After deploy
- Copy the deployed address → save as **TOKEN_ADDRESS**
- Verify on explorer: `https://explorer.arc.io/address/TOKEN_ADDRESS`

---

## Step 2 — Deploy SeatBackStaking.sol

**File:** `SeatBackStaking.sol`
**Contract to select:** `SeatBackStaking`

### Constructor arguments
| Argument | Value | Notes |
|---|---|---|
| `_sbkToken` | **TOKEN_ADDRESS** | Address from Step 1 |
| `_usdc` | `0x3600000000000000000000000000000000000000` | Arc Mainnet USDC |
| `_owner` | `YOUR_WALLET_ADDRESS` | Admin of the staking contract |

### After deploy
- Copy the deployed address → save as **STAKING_ADDRESS**

---

## Step 3 — Deploy SeatBack.sol

**File:** `SeatBack.sol`
**Contract to select:** `SeatBack`

### Constructor arguments
| Argument | Value | Notes |
|---|---|---|
| `_usdc` | `0x3600000000000000000000000000000000000000` | Arc Mainnet USDC |
| `_admin` | `YOUR_WALLET_ADDRESS` | Can call setStakingPool once |

### After deploy
- Copy the deployed address → save as **SEATBACK_ADDRESS**

---

## Step 4 — Wire: SeatBack.setStakingPool()

In Remix, after deploying SeatBack:

1. In the **Deployed Contracts** panel, expand `SeatBack` at **SEATBACK_ADDRESS**
2. Find function **`setStakingPool`**
3. Enter argument: **STAKING_ADDRESS** (from Step 2)
4. Click **transact** → confirm in MetaMask

✅ This wires the 50/50 split: no-show USDC now routes 50% to SeatBackStaking automatically.

---

## Step 5 — Wire: SeatBackStaking.setSeatBack()

In Remix, expand `SeatBackStaking` at **STAKING_ADDRESS**:

1. Find function **`setSeatBack`**
2. Enter argument: **SEATBACK_ADDRESS** (from Step 3)
3. Click **transact** → confirm in MetaMask

✅ Now only SeatBack can call `receiveProceeds()` on the staking contract.

---

## Step 6 — Verify on Explorer

For each contract, go to:
```
https://explorer.arc.io/address/CONTRACT_ADDRESS
```
Upload the flattened `.sol` file with the same compiler settings to verify source code.

---

## After Deploy — Update the App

Send these 3 addresses to Max Play / Arc Studio to wire into the frontend:

```
TOKEN_ADDRESS   = 0x...
STAKING_ADDRESS = 0x...
SEATBACK_ADDRESS = 0x...   ← replace the old 0x5edD...fDA7
```

The new SEATBACK_ADDRESS replaces `0x5edD40f2817D5ADd1E991dAfa6852521ef19fDA7` in `VITE_MAINNET_SEATBACK_ADDRESS`.

---

## No-show proceeds flow (after wiring)

```
Attendee no-show deposit (USDC)
        ↓
SeatBack.withdrawNoShowProceeds()
        ↓
  ┌─────────────┬─────────────────┐
  │  50% USDC   │    50% USDC     │
  │  → Organiser│  → SeatBackStaking
  │  payoutWallet│   (stakers claim)
  └─────────────┴─────────────────┘
```
