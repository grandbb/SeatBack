/**
 * SeatBack contract config — network-agnostic.
 *
 * Network selection is driven by VITE_NETWORK env var:
 *   VITE_NETWORK=mainnet  → Arc Mainnet (chain 5042)
 *   VITE_NETWORK=testnet  → Arc Testnet (chain 5042002) [default]
 *
 * The deployed contract address is set per network:
 *   VITE_TESTNET_SEATBACK_ADDRESS  — testnet contract (already deployed)
 *   VITE_MAINNET_SEATBACK_ADDRESS  — mainnet contract (must be set after mainnet deploy)
 *
 * Never hard-code a mainnet address here. It must be injected from .env.
 * VITE_ prefix means the value is bundled into the browser build — these are
 * public addresses only, never signing credentials or API secrets.
 */
import { getUsdc, requireChain } from '@/onchain-facts'

// ─── Network selection ────────────────────────────────────────────────────────

const NETWORK: string = (import.meta.env.VITE_NETWORK as string | undefined) ?? 'testnet'

export const IS_MAINNET = NETWORK === 'mainnet'

/** Human-readable label for the active network shown in UI strings. */
export const NETWORK_LABEL = IS_MAINNET ? 'Arc Mainnet' : 'Arc Testnet'

export const ARC_TESTNET_CHAIN_ID = 5042002
export const ARC_MAINNET_CHAIN_ID = 5042

/** Chain ID the app is currently configured for */
export const ACTIVE_CHAIN_ID: number = IS_MAINNET
  ? ARC_MAINNET_CHAIN_ID
  : ARC_TESTNET_CHAIN_ID

export const USDC_ADDRESS = getUsdc(ACTIVE_CHAIN_ID)!.address
export const USDC_DECIMALS = getUsdc(ACTIVE_CHAIN_ID)!.decimals // always 6

export const CHAIN = requireChain(ACTIVE_CHAIN_ID)

// ─── Contract address ─────────────────────────────────────────────────────────

/**
 * Returns the SeatBack address for the active network, or null if not yet deployed.
 *
 * Testnet address is the one already deployed.  Mainnet address must come from
 * VITE_MAINNET_SEATBACK_ADDRESS — it is intentionally left null here so that
 * a misconfigured mainnet build fails loudly rather than silently pointing at
 * the testnet contract.
 */
function resolveAddress(): `0x${string}` | null {
  if (IS_MAINNET) {
    const v =
      (import.meta.env.VITE_MAINNET_SEATBACK_ADDRESS as string | undefined) ??
      '0x5edD40f2817D5ADd1E991dAfa6852521ef19fDA7'
    if (v && /^0x[0-9a-fA-F]{40}$/.test(v)) return v as `0x${string}`
    return null
  }
  const v: string =
    (import.meta.env.VITE_TESTNET_SEATBACK_ADDRESS as string | undefined) ??
    '0x807f6bef741e807472e9f07d6d0fbaf061dba6ba'
  if (v && /^0x[0-9a-fA-F]{40}$/.test(v)) return v as `0x${string}`
  return null
}

export const SEATBACK_ADDRESS: `0x${string}` | null = resolveAddress()

// ─── ABI ──────────────────────────────────────────────────────────────────────

export const SEATBACK_ABI = [
  // === Events ===
  {
    type: 'event',
    name: 'EventCreated',
    inputs: [
      { name: 'eventId', type: 'uint256', indexed: true },
      { name: 'organizer', type: 'address', indexed: true },
      { name: 'payoutWallet', type: 'address', indexed: false },
      { name: 'depositAmount', type: 'uint256', indexed: false },
      { name: 'capacity', type: 'uint256', indexed: false },
      { name: 'bookingClose', type: 'uint256', indexed: false },
      { name: 'refundCutoff', type: 'uint256', indexed: false },
      { name: 'checkInStart', type: 'uint256', indexed: false },
      { name: 'checkInEnd', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Reserved',
    inputs: [
      { name: 'eventId', type: 'uint256', indexed: true },
      { name: 'reservationId', type: 'uint256', indexed: true },
      { name: 'attendee', type: 'address', indexed: true },
      { name: 'depositAmount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ReservationCancelled',
    inputs: [
      { name: 'eventId', type: 'uint256', indexed: true },
      { name: 'reservationId', type: 'uint256', indexed: true },
      { name: 'attendee', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'CheckInOpened',
    inputs: [{ name: 'eventId', type: 'uint256', indexed: true }],
  },
  {
    type: 'event',
    name: 'CheckedIn',
    inputs: [
      { name: 'eventId', type: 'uint256', indexed: true },
      { name: 'reservationId', type: 'uint256', indexed: true },
      { name: 'attendee', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'EventCancelled',
    inputs: [{ name: 'eventId', type: 'uint256', indexed: true }],
  },
  {
    type: 'event',
    name: 'EventFinalized',
    inputs: [
      { name: 'eventId', type: 'uint256', indexed: true },
      { name: 'noShowProceeds', type: 'uint256', indexed: false },
      { name: 'refundLiability', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'RefundClaimed',
    inputs: [
      { name: 'eventId', type: 'uint256', indexed: true },
      { name: 'reservationId', type: 'uint256', indexed: true },
      { name: 'attendee', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'ProceedsWithdrawn',
    inputs: [
      { name: 'eventId', type: 'uint256', indexed: true },
      { name: 'payoutWallet', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },

  // === Constructor ===
  { type: 'constructor', inputs: [{ name: '_usdc', type: 'address' }], stateMutability: 'nonpayable' },

  // === Read ===
  { type: 'function', name: 'usdc', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'eventCount', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'reservationCount', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  {
    type: 'function',
    name: 'getEvent',
    inputs: [{ name: 'eventId', type: 'uint256' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'organizer', type: 'address' },
          { name: 'payoutWallet', type: 'address' },
          { name: 'title', type: 'string' },
          { name: 'description', type: 'string' },
          { name: 'venue', type: 'string' },
          { name: 'eventStart', type: 'uint256' },
          { name: 'eventEnd', type: 'uint256' },
          { name: 'capacity', type: 'uint32' },
          { name: 'depositAmount', type: 'uint256' },
          { name: 'bookingClose', type: 'uint256' },
          { name: 'refundCutoff', type: 'uint256' },
          { name: 'checkInStart', type: 'uint256' },
          { name: 'checkInEnd', type: 'uint256' },
          { name: 'cancelled', type: 'bool' },
          { name: 'checkInOpened', type: 'bool' },
          { name: 'finalized', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getAccounting',
    inputs: [{ name: 'eventId', type: 'uint256' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'activeDeposits', type: 'uint256' },
          { name: 'outstandingRefunds', type: 'uint256' },
          { name: 'organizerCredit', type: 'uint256' },
          { name: 'refundsPaid', type: 'uint256' },
          { name: 'organizerPaid', type: 'uint256' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getReservation',
    inputs: [{ name: 'reservationId', type: 'uint256' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'eventId', type: 'uint256' },
          { name: 'attendee', type: 'address' },
          { name: 'active', type: 'bool' },
          { name: 'refundable', type: 'bool' },
          { name: 'refundClaimed', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getActiveReservation',
    inputs: [
      { name: 'eventId', type: 'uint256' },
      { name: 'attendee', type: 'address' },
    ],
    outputs: [{ name: 'reservationId', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getEventReservations',
    inputs: [
      { name: 'eventId', type: 'uint256' },
      { name: 'offset', type: 'uint256' },
      { name: 'limit', type: 'uint256' },
    ],
    outputs: [{ name: 'ids', type: 'uint256[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'reservedSeats',
    inputs: [{ name: 'eventId', type: 'uint256' }],
    outputs: [{ type: 'uint32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'activeReservationId',
    inputs: [
      { name: 'eventId', type: 'uint256' },
      { name: 'attendee', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },

  // === EIP-712 / QR ===
  { type: 'function', name: 'DOMAIN_SEPARATOR', inputs: [], outputs: [{ type: 'bytes32' }], stateMutability: 'view' },
  { type: 'function', name: 'MAX_QR_VALIDITY', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  {
    type: 'function',
    name: 'getCheckInDigest',
    inputs: [
      {
        name: 'auth',
        type: 'tuple',
        components: [
          { name: 'eventId', type: 'uint256' },
          { name: 'reservationId', type: 'uint256' },
          { name: 'attendee', type: 'address' },
          { name: 'nonce', type: 'uint256' },
          { name: 'validAfter', type: 'uint256' },
          { name: 'validUntil', type: 'uint256' },
        ],
      },
    ],
    outputs: [{ type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'usedNonces',
    inputs: [
      { name: 'reservationId', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },

  // === Write ===
  {
    type: 'function',
    name: 'checkInWithSig',
    inputs: [
      {
        name: 'auth',
        type: 'tuple',
        components: [
          { name: 'eventId', type: 'uint256' },
          { name: 'reservationId', type: 'uint256' },
          { name: 'attendee', type: 'address' },
          { name: 'nonce', type: 'uint256' },
          { name: 'validAfter', type: 'uint256' },
          { name: 'validUntil', type: 'uint256' },
        ],
      },
      { name: 'sig', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'createEvent',
    inputs: [
      {
        name: 'p',
        type: 'tuple',
        components: [
          { name: 'payoutWallet', type: 'address' },
          { name: 'title', type: 'string' },
          { name: 'description', type: 'string' },
          { name: 'venue', type: 'string' },
          { name: 'eventStart', type: 'uint256' },
          { name: 'eventEnd', type: 'uint256' },
          { name: 'capacity', type: 'uint32' },
          { name: 'depositAmount', type: 'uint256' },
          { name: 'bookingClose', type: 'uint256' },
          { name: 'refundCutoff', type: 'uint256' },
          { name: 'checkInStart', type: 'uint256' },
          { name: 'checkInEnd', type: 'uint256' },
        ],
      },
    ],
    outputs: [{ name: 'eventId', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'reserve',
    inputs: [{ name: 'eventId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'cancelReservation',
    inputs: [{ name: 'reservationId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'openCheckIn',
    inputs: [{ name: 'eventId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'checkIn',
    inputs: [
      { name: 'eventId', type: 'uint256' },
      { name: 'attendee', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'cancelEvent',
    inputs: [{ name: 'eventId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'finalizeEvent',
    inputs: [{ name: 'eventId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'claimRefund',
    inputs: [{ name: 'reservationId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'withdrawNoShowProceeds',
    inputs: [{ name: 'eventId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const
