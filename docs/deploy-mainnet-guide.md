# SeatBack — คู่มือ Deploy บน Arc Mainnet (ด้วย Wallet ของคุณ)

> Arc Studio ไม่ได้ deploy mainnet แทนคุณ  
> ทุกขั้นตอนด้านล่างทำบนเครื่องของคุณเอง

---

## ข้อมูล Arc Mainnet

| รายการ | ค่า |
|---|---|
| Chain ID | `5042` |
| RPC URL | `https://rpc.mainnet.arc.io` |
| Explorer | `https://explorer.arc.io` |
| USDC (ERC-20) | `0x3600000000000000000000000000000000000000` |
| USDC decimals | 6 (ERC-20 view) |
| Gas token | USDC (native, 18 decimals — same pool) |

---

## ขั้นตอนที่ 1 — ติดตั้ง Foundry บนเครื่องของคุณ

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

ตรวจสอบ:
```bash
forge --version
```

---

## ขั้นตอนที่ 2 — Clone repo และ build

```bash
git clone https://github.com/grandbb/SeatBack.git
cd SeatBack
forge install   # ติดตั้ง dependencies (forge-std, openzeppelin)
forge build     # compile contract
```

ต้องเห็น `Compiler run successful` ไม่มี error

---

## ขั้นตอนที่ 3 — เตรียม environment

สร้างไฟล์ `.env` ในโฟลเดอร์ `SeatBack/` (ห้าม commit):

```bash
# สร้างจาก template
cp .env.example .env
```

แก้ไขค่าใน `.env`:

```
USDC_ADDRESS=0x3600000000000000000000000000000000000000
```

> **อย่าใส่ PRIVATE_KEY ใน .env** — ใช้ flag `--interactive` หรือ hardware wallet แทน (ดูขั้นตอน 4)

---

## ขั้นตอนที่ 4 — Deploy

### วิธี A: Metamask / Software Wallet (แนะนำสำหรับทดสอบ)

```bash
# Dry run ก่อน — ไม่มี broadcast จริง
forge script contracts/script/DeploySeatBack.s.sol \
  --rpc-url https://rpc.mainnet.arc.io \
  --sender <YOUR_WALLET_ADDRESS> \
  -vvv

# Deploy จริง — ระบบจะขอ private key แบบ interactive (ไม่เก็บใน history)
forge script contracts/script/DeploySeatBack.s.sol \
  --rpc-url https://rpc.mainnet.arc.io \
  --broadcast \
  --interactive \
  -vvv
```

### วิธี B: Ledger Hardware Wallet (แนะนำสำหรับ production)

```bash
forge script contracts/script/DeploySeatBack.s.sol \
  --rpc-url https://rpc.mainnet.arc.io \
  --broadcast \
  --ledger \
  --hd-paths "m/44'/60'/0'/0/0" \
  -vvv
```

---

## ขั้นตอนที่ 5 — บันทึก Contract Address

หลัง deploy สำเร็จ ใน terminal จะเห็น:

```
== Return ==
seatback: address 0x<CONTRACT_ADDRESS>
```

Copy address นั้นไว้ แล้วตรวจสอบบน explorer:
```
https://explorer.arc.io/address/0x<CONTRACT_ADDRESS>
```

ตรวจสอบ USDC ที่ contract ใช้:
```bash
cast call 0x<CONTRACT_ADDRESS> "usdc()(address)" \
  --rpc-url https://rpc.mainnet.arc.io
# ต้องได้: 0x3600000000000000000000000000000000000000
```

---

## ขั้นตอนที่ 6 — Wire address เข้า Frontend

แจ้ง Arc Studio ว่า contract deploy แล้ว:

> "deploy mainnet สำเร็จ contract address คือ `0x<ADDRESS>`"

Arc Studio จะ:
1. ใส่ address ใน `VITE_MAINNET_SEATBACK_ADDRESS` ใน `src/contract.ts`
2. Push โค้ดอัปเดตขึ้น GitHub
3. Build production frontend

หรือทำเองได้โดยตั้ง environment variable ใน hosting provider:
```
VITE_NETWORK=mainnet
VITE_MAINNET_SEATBACK_ADDRESS=0x<CONTRACT_ADDRESS>
```

---

## ขั้นตอนที่ 7 — Smoke Test บน Mainnet

ทำด้วยจำนวนเงินน้อยๆ ก่อน:

1. สร้าง event ที่มี deposit 0.01 USDC, capacity 1
2. Reserve 1 seat (approve + reserve)
3. Open check-in → Generate QR → Scan → Submit `checkInWithSig`
4. ตรวจสอบ transaction ใน explorer
5. Claim refund และตรวจสอบว่าได้รับ USDC กลับ

---

## Gas estimate (Arc Mainnet, 20 Gwei base fee)

| Transaction | Gas | ค่าใช้จ่าย (USDC) |
|---|---|---|
| `createEvent` | ~120,000 | ~0.0000024 |
| `reserve` | ~80,000 | ~0.0000016 |
| `checkInWithSig` | ~60,000 | ~0.0000012 |
| `claimRefund` | ~50,000 | ~0.0000010 |

ค่า gas ถูกมากเพราะ Arc ใช้ USDC เป็น gas token ที่มีค่าคงที่

---

## Checklist ก่อน Deploy จริง

- [ ] `forge build` ผ่านไม่มี error
- [ ] ตรวจสอบ USDC address ถูกต้อง (`0x3600000000000000000000000000000000000000`)
- [ ] Wallet มี USDC เพียงพอสำหรับ gas (~0.01 USDC พอแล้ว)
- [ ] ทำ dry run ก่อน (`-vvv` ไม่มี `--broadcast`)
- [ ] บันทึก deployed address ไว้
- [ ] ตรวจสอบ bytecode บน explorer ตรงกับ source
- [ ] ทำ smoke test ด้วยเงินน้อยก่อนเปิดให้ public
