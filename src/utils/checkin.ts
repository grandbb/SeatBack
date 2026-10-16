/**
 * EIP-712 helpers for SeatBack QR check-in authorization.
 *
 * The attendee signs a CheckInAuthorization struct.  The payload is
 * bound to the verifying contract address and chain ID via the EIP-712
 * domain, so signatures cannot be replayed on other contracts or chains.
 *
 * Supported wallets:
 *   - EOA wallets (ECDSA): sign via signTypedData (EIP-712 hardware/software wallets)
 *   - Smart-contract accounts implementing ERC-1271: the contract calls
 *     isValidSignature on the wallet after ECDSA recovery fails.
 *
 * The QR code payload is a compact JSON-serialised CheckInPayload.
 * Never navigate to a URL from scanned content; always parse as JSON only.
 */

import { type WalletClient, type Address } from 'viem'
import { ACTIVE_CHAIN_ID, SEATBACK_ADDRESS } from '@/contract'

// ─── EIP-712 type definitions ────────────────────────────────────────────────

export const CHECK_IN_DOMAIN = {
  name: 'SeatBack',
  version: '1',
  chainId: ACTIVE_CHAIN_ID,
  verifyingContract: SEATBACK_ADDRESS as Address,
} as const

export const CHECK_IN_TYPES = {
  CheckInAuthorization: [
    { name: 'eventId',       type: 'uint256' },
    { name: 'reservationId', type: 'uint256' },
    { name: 'attendee',      type: 'address' },
    { name: 'nonce',         type: 'uint256' },
    { name: 'validAfter',    type: 'uint256' },
    { name: 'validUntil',    type: 'uint256' },
  ],
} as const

/** Maximum QR validity in seconds — must match the contract constant */
export const MAX_QR_VALIDITY_S = 5 * 60

// ─── Payload type ─────────────────────────────────────────────────────────────

/**
 * The full JSON payload stored inside the QR code.
 * Fields use string representations of bigints for JSON safety.
 */
export interface CheckInPayload {
  /** Semver of this payload schema */
  v: '1'
  /** Verifying contract address (checksummed) */
  contract: Address
  /** Chain ID as decimal string */
  chainId: string
  /** Event ID as decimal string */
  eventId: string
  /** Reservation ID as decimal string */
  reservationId: string
  /** Attendee wallet address */
  attendee: Address
  /** Nonce as decimal string (random 128-bit) */
  nonce: string
  /** Unix timestamp — QR valid from (seconds) */
  validAfter: string
  /** Unix timestamp — QR expires at (seconds) */
  validUntil: string
  /** EIP-712 signature (0x-prefixed hex) */
  sig: `0x${string}`
}

// ─── Nonce ────────────────────────────────────────────────────────────────────

/** Generate a cryptographically random 128-bit nonce as a bigint */
export function generateNonce(): bigint {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  let n = 0n
  for (const b of bytes) {
    n = (n << 8n) | BigInt(b)
  }
  return n
}

// ─── Signing ──────────────────────────────────────────────────────────────────

export interface SignCheckInArgs {
  walletClient: WalletClient
  eventId: bigint
  reservationId: bigint
  attendee: Address
  /** Check-in window end (Unix seconds) — limits validUntil */
  checkInEnd: bigint
}

/**
 * Request a single EIP-712 signature from the attendee's wallet.
 * Returns a ready-to-encode CheckInPayload.
 * Throws if the user rejects the signature.
 *
 * Note: This function is called only once, on explicit user action.
 * Do NOT call it in a background loop or useEffect.
 */
export async function signCheckInAuth(args: SignCheckInArgs): Promise<CheckInPayload> {
  const { walletClient, eventId, reservationId, attendee, checkInEnd } = args

  if (!SEATBACK_ADDRESS) throw new Error('Contract not deployed')

  const now = BigInt(Math.floor(Date.now() / 1000))
  const validAfter = now
  // 5-minute window, but never beyond checkInEnd
  const fiveMin = now + BigInt(MAX_QR_VALIDITY_S)
  const validUntil = fiveMin < checkInEnd ? fiveMin : checkInEnd

  if (validUntil <= validAfter) {
    throw new Error('Check-in window has closed — cannot generate QR.')
  }

  const nonce = generateNonce()

  const message = {
    eventId,
    reservationId,
    attendee,
    nonce,
    validAfter,
    validUntil,
  }

  const sig = await walletClient.signTypedData({
    account: attendee,
    domain: CHECK_IN_DOMAIN,
    types: CHECK_IN_TYPES,
    primaryType: 'CheckInAuthorization',
    message,
  })

  return {
    v: '1',
    contract: SEATBACK_ADDRESS,
    chainId: String(ACTIVE_CHAIN_ID),
    eventId: String(eventId),
    reservationId: String(reservationId),
    attendee,
    nonce: String(nonce),
    validAfter: String(validAfter),
    validUntil: String(validUntil),
    sig,
  }
}

// ─── Encode / Decode ──────────────────────────────────────────────────────────

/** Encode the payload to a compact JSON string for the QR code */
export function encodePayload(payload: CheckInPayload): string {
  return JSON.stringify(payload)
}

export class PayloadDecodeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PayloadDecodeError'
  }
}

/**
 * Parse and validate a raw QR/paste string into a CheckInPayload.
 * Throws PayloadDecodeError on any malformed input.
 * NEVER navigates to a URL or executes content.
 */
export function decodePayload(raw: string): CheckInPayload {
  // Reject anything that looks like a URL
  const trimmed = raw.trim()
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    throw new PayloadDecodeError('QR content is a URL — refusing to navigate.')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    throw new PayloadDecodeError('QR content is not valid JSON.')
  }

  const p = parsed as Record<string, unknown>

  if (p.v !== '1') throw new PayloadDecodeError('Unknown payload version.')
  if (typeof p.contract !== 'string') throw new PayloadDecodeError('Missing contract field.')
  if (typeof p.chainId !== 'string') throw new PayloadDecodeError('Missing chainId field.')
  if (typeof p.eventId !== 'string') throw new PayloadDecodeError('Missing eventId field.')
  if (typeof p.reservationId !== 'string') throw new PayloadDecodeError('Missing reservationId field.')
  if (typeof p.attendee !== 'string') throw new PayloadDecodeError('Missing attendee field.')
  if (typeof p.nonce !== 'string') throw new PayloadDecodeError('Missing nonce field.')
  if (typeof p.validAfter !== 'string') throw new PayloadDecodeError('Missing validAfter field.')
  if (typeof p.validUntil !== 'string') throw new PayloadDecodeError('Missing validUntil field.')
  if (typeof p.sig !== 'string' || !p.sig.startsWith('0x')) throw new PayloadDecodeError('Missing or invalid sig field.')

  // Validate contract / chainId match current deployment
  if (SEATBACK_ADDRESS && p.contract.toLowerCase() !== SEATBACK_ADDRESS.toLowerCase()) {
    throw new PayloadDecodeError('QR is for a different contract address.')
  }
  if (p.chainId !== String(ACTIVE_CHAIN_ID)) {
    throw new PayloadDecodeError('QR is for a different chain.')
  }

  return p as unknown as CheckInPayload
}

/** Convert a CheckInPayload to the ABI-compatible struct for checkInWithSig */
export function payloadToAuthArgs(p: CheckInPayload) {
  return {
    eventId: BigInt(p.eventId),
    reservationId: BigInt(p.reservationId),
    attendee: p.attendee,
    nonce: BigInt(p.nonce),
    validAfter: BigInt(p.validAfter),
    validUntil: BigInt(p.validUntil),
  } as const
}

/** Seconds until a QR expires (negative = already expired) */
export function qrSecondsLeft(payload: CheckInPayload): number {
  const expiry = Number(payload.validUntil)
  return expiry - Math.floor(Date.now() / 1000)
}
