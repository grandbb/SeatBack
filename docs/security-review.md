# SeatBack — Full Security & Functional Review
**Date:** 2026-10-18  
**Scope:** SeatBack.sol + React frontend + Vercel deployment  
**Severity scale:** Critical > High > Medium > Low > Info

---

## Executive Summary

| Layer | Status | Issues Fixed | Remaining |
|---|---|---|---|
| Smart Contract | ✅ Clean | 0 | 0 |
| Frontend Security | ✅ Fixed | 4 | 0 |
| Infrastructure (CSP/Headers) | ✅ Fixed | 5 | 0 |
| Dev Environment | ✅ Fixed | 1 (duplicate vite) | 0 |
| Design/Trust Model | ⚠️ Documented | 1 (by design) | 0 |

---

## Smart Contract (SeatBack.sol)

### ✅ No vulnerabilities found

**Checks performed:**
| Check | Result |
|---|---|
| Reentrancy | Protected — `nonReentrant` on all fund-moving functions (reserve, cancelReservation, checkInWithSig, claimRefund, withdrawNoShowProceeds) |
| EIP-712 domain separator | Correct — bound to `chainId + address(this)`, fork-safe (recomputed on chain fork) |
| Nonce replay protection | Complete — `usedNonces[reservationId][nonce]` consumed before state change |
| ERC-1271 smart wallet support | Correct — `isValidSignature` return value checked against `0x1626ba7e`, reverts handled with try/catch |
| Access control | All state-changing functions check `msg.sender` correctly |
| Integer overflow/underflow | Protected by Solidity 0.8.20 + no unchecked blocks on accounting |
| Token transfer safety | `SafeERC20.safeTransfer` / `safeTransferFrom` — reverts on failure |
| Cross-event contamination | Impossible — all mappings are keyed by `eventId` |
| Organizer self-dealing | Prevented — organizer cannot have an active reservation (would need a separate wallet) |
| Unbounded loops | Only in `getEventReservations` view (read-only, paginated) |
| Rebook + stale QR attack | Blocked — `activeReservationId[eventId][attendee]` must equal `reservationId` in auth |
| Cross-chain replay | Blocked — domain separator binds `chainId` and `address(this)` |
| Double-refund | Blocked — `refundClaimed` flag checked before transfer |
| Double-finalize | Blocked — `finalized` flag + `AlreadyFinalized` error in `_finalizeEvent` |
| Withdraw before finalize | Blocked — `withdrawNoShowProceeds` calls `_finalizeEvent` if not yet finalized |
| QR validity enforcement | `validUntil - validAfter <= MAX_QR_VALIDITY (300s)` checked explicitly |
| USDC address | Injected via constructor, immutable, validated non-zero |
| Fund conservation invariant | `activeDeposits + outstandingRefunds + organizerCredit + refundsPaid + organizerPaid = total received` holds across all paths |

### ⚠️ Design Risk (documented, not a bug)

**Title:** Organizer is sole attendance attester  
**Risk:** A malicious organizer can withhold check-ins to convert attendee deposits to no-show proceeds.  
**Mitigation applied:** Warning displayed prominently in the QR generation UI. This is an inherent property of the escrow model — attendees are informed before generating a QR.  
**Future mitigation:** Could be reduced with a dispute/grace period mechanism (out of MVP scope).

---

## Frontend Security

### Fixed Issues

#### [HIGH] XSS via dangerouslySetInnerHTML — FIXED
- **Location:** `src/components/CheckInQR.tsx`
- **Was:** `dangerouslySetInnerHTML={{ __html: qrSvg }}` — SVG rendered as HTML
- **Fix:** Changed to `QRCode.toDataURL()` + `<img src={dataUrl}>` — rendered as a sandboxed image, cannot execute scripts

#### [MEDIUM] Insufficient QR payload validation — FIXED
- **Location:** `src/utils/checkin.ts` → `decodePayload()`
- **Was:** Only type-checked string fields, no format/length validation
- **Fix:** Added:
  - Max payload size: 4096 bytes
  - Reject URLs and HTML-like content
  - Ethereum address regex: `0x` + 40 hex chars
  - uint256 regex: decimal, max 78 digits, no leading zeros
  - Signature regex: `0x` + exactly 130 hex chars (65 bytes)
  - Time sanity: `validUntil > validAfter`
  - Chain ID and contract address matching before any onchain action

#### [MEDIUM] Duplicate React instances in dev — FIXED
- **Was:** Two vite processes running simultaneously causing `useState = null` crash
- **Fix:** Killed duplicate processes, cleared Vite optimizeDeps cache, fresh restart

#### [LOW] CSP missing several directives — FIXED
- **Was:** CSP had `unsafe-eval`, `X-Frame-Options: SAMEORIGIN`, missing HSTS, missing `Permissions-Policy`
- **Fix:** 
  - Removed `unsafe-eval`
  - `X-Frame-Options: DENY`
  - Added `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
  - Added `Permissions-Policy: camera=(self), microphone=(), geolocation=(), payment=()`
  - Added `X-XSS-Protection: 1; mode=block`
  - Added `default-src 'none'` (deny-by-default)
  - Added `base-uri 'self'`, `form-action 'none'`, `object-src 'none'`
  - Added WalletConnect relay endpoints to `connect-src`
  - Added `worker-src blob:` for jsQR Web Worker

---

## Infrastructure

### Vercel Headers (vercel.json)
| Header | Value |
|---|---|
| X-Content-Type-Options | nosniff |
| X-Frame-Options | DENY |
| X-XSS-Protection | 1; mode=block |
| Referrer-Policy | strict-origin-when-cross-origin |
| Strict-Transport-Security | max-age=63072000; includeSubDomains; preload |
| Permissions-Policy | camera=(self), microphone=(), geolocation=(), payment=() |
| Content-Security-Policy | See vercel.json |
| Cache-Control (assets) | public, max-age=31536000, immutable |

---

## Remaining Known Issues (Informational)

| Issue | Severity | Notes |
|---|---|---|
| WalletConnect IPFS requests failing | Info | WalletConnect SDK fetches wallet metadata from IPFS; failures are non-blocking, UX cosmetic only |
| Organizer trust model | Design risk | Documented in UI; requires organizer accountability at product/social layer |
| No on-chain dispute mechanism | Design risk | Out of MVP scope |

---

## Contract Addresses
- **Arc Testnet:** `0x807f6bef741e807472e9f07d6d0fbaf061dba6ba`
- **Arc Mainnet:** `0x5edD40f2817D5ADd1E991dAfa6852521ef19fDA7`

---

*Review performed with dual static analysis (rule corpus + functional adversarial), manual contract line-by-line review, and live console/trace inspection.*
