/*
 * SeatBack contract config — Arc Mainnet production build.
 * SeatBack v3 + SeatBackStaking v2 + SeatBackToken (SBK)
 *
 * Contract addresses (Arc Mainnet, chain 5042):
 *   SeatBack v3:        0x6Fdb06A9Ce387937C2261F489E502e53cA1F0Bbc
 *   SeatBackStaking v2: 0x4ae8f1dA7699f3a78a12f8fD28C83F159c84F177
 *   SeatBackToken (SBK):0x6AB94508cB97756873316f6819F258BCE444363f
 */
import { getUsdc, requireChain } from '@/onchain-facts'

// ─── Network ──────────────────────────────────────────────────────────────────

export const IS_MAINNET = true
export const NETWORK_LABEL = 'Arc Mainnet'
export const ARC_TESTNET_CHAIN_ID = 5042002
export const ARC_MAINNET_CHAIN_ID = 5042
export const ACTIVE_CHAIN_ID: number = ARC_MAINNET_CHAIN_ID
export const USDC_ADDRESS = getUsdc(ACTIVE_CHAIN_ID)!.address
export const USDC_DECIMALS = getUsdc(ACTIVE_CHAIN_ID)!.decimals // 6
export const CHAIN = requireChain(ACTIVE_CHAIN_ID)

// ─── Contract addresses ───────────────────────────────────────────────────────

/** SeatBack v3 — deployed 2026-10-21, with 50/50 staking split + poolSnapshot */
export const SEATBACK_ADDRESS: `0x${string}` = '0x6Fdb06A9Ce387937C2261F489E502e53cA1F0Bbc'

/** SeatBackStaking v2 — deployed 2026-10-21, with 24h cooldown + MIN_STAKE */
export const STAKING_ADDRESS: `0x${string}` = '0x4ae8f1dA7699f3a78a12f8fD28C83F159c84F177'

/** SeatBackToken (SBK) — 100M fixed supply */
export const SBK_ADDRESS: `0x${string}` = '0x6AB94508cB97756873316f6819F258BCE444363f'

// ─── SeatBack ABI ─────────────────────────────────────────────────────────────

export const SEATBACK_ABI = [
  // === Events ===
  {
    type: 'event', name: 'EventCreated',
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
    type: 'event', name: 'Reserved',
    inputs: [
      { name: 'eventId', type: 'uint256', indexed: true },
      { name: 'reservationId', type: 'uint256', indexed: true },
      { name: 'attendee', type: 'address', indexed: true },
      { name: 'depositAmount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event', name: 'ReservationCancelled',
    inputs: [
      { name: 'eventId', type: 'uint256', indexed: true },
      { name: 'reservationId', type: 'uint256', indexed: true },
      { name: 'attendee', type: 'address', indexed: true },
    ],
  },
  { type: 'event', name: 'CheckInOpened', inputs: [{ name: 'eventId', type: 'uint256', indexed: true }] },
  {
    type: 'event', name: 'CheckedIn',
    inputs: [
      { name: 'eventId', type: 'uint256', indexed: true },
      { name: 'reservationId', type: 'uint256', indexed: true },
      { name: 'attendee', type: 'address', indexed: true },
    ],
  },
  { type: 'event', name: 'EventCancelled', inputs: [{ name: 'eventId', type: 'uint256', indexed: true }] },
  {
    type: 'event', name: 'EventFinalized',
    inputs: [
      { name: 'eventId', type: 'uint256', indexed: true },
      { name: 'noShowProceeds', type: 'uint256', indexed: false },
      { name: 'refundLiability', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event', name: 'RefundClaimed',
    inputs: [
      { name: 'eventId', type: 'uint256', indexed: true },
      { name: 'reservationId', type: 'uint256', indexed: true },
      { name: 'attendee', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event', name: 'ProceedsWithdrawn',
    inputs: [
      { name: 'eventId', type: 'uint256', indexed: true },
      { name: 'payoutWallet', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event', name: 'StakingPoolSet',
    inputs: [{ name: 'pool', type: 'address', indexed: true }],
  },
  {
    type: 'event', name: 'StakerProceedsRouted',
    inputs: [
      { name: 'eventId', type: 'uint256', indexed: true },
      { name: 'pool', type: 'address', indexed: true },
      { name: 'stakerAmount', type: 'uint256', indexed: false },
      { name: 'organiserAmount', type: 'uint256', indexed: false },
    ],
  },

  // === Constructor ===
  {
    type: 'constructor',
    inputs: [{ name: '_usdc', type: 'address' }, { name: '_admin', type: 'address' }],
    stateMutability: 'nonpayable',
  },

  // === Read ===
  { type: 'function', name: 'usdc', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'admin', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'stakingPool', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'stakerShareBps', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'eventCount', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'reservationCount', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  {
    type: 'function', name: 'getEvent',
    inputs: [{ name: 'eventId', type: 'uint256' }],
    outputs: [{
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
    }],
    stateMutability: 'view',
  },
  {
    type: 'function', name: 'getAccounting',
    inputs: [{ name: 'eventId', type: 'uint256' }],
    outputs: [{
      type: 'tuple',
      components: [
        { name: 'activeDeposits', type: 'uint256' },
        { name: 'outstandingRefunds', type: 'uint256' },
        { name: 'organizerCredit', type: 'uint256' },
        { name: 'refundsPaid', type: 'uint256' },
        { name: 'organizerPaid', type: 'uint256' },
        { name: 'stakerPaid', type: 'uint256' },
        { name: 'poolSnapshot', type: 'address' },
      ],
    }],
    stateMutability: 'view',
  },
  {
    type: 'function', name: 'getReservation',
    inputs: [{ name: 'reservationId', type: 'uint256' }],
    outputs: [{
      type: 'tuple',
      components: [
        { name: 'eventId', type: 'uint256' },
        { name: 'attendee', type: 'address' },
        { name: 'active', type: 'bool' },
        { name: 'refundable', type: 'bool' },
        { name: 'refundClaimed', type: 'bool' },
      ],
    }],
    stateMutability: 'view',
  },
  {
    type: 'function', name: 'getActiveReservation',
    inputs: [{ name: 'eventId', type: 'uint256' }, { name: 'attendee', type: 'address' }],
    outputs: [{ name: 'reservationId', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function', name: 'getEventReservations',
    inputs: [{ name: 'eventId', type: 'uint256' }, { name: 'offset', type: 'uint256' }, { name: 'limit', type: 'uint256' }],
    outputs: [{ name: 'ids', type: 'uint256[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function', name: 'reservedSeats',
    inputs: [{ name: 'eventId', type: 'uint256' }],
    outputs: [{ type: 'uint32' }],
    stateMutability: 'view',
  },
  {
    type: 'function', name: 'activeReservationId',
    inputs: [{ name: 'eventId', type: 'uint256' }, { name: 'attendee', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },

  // === EIP-712 / QR ===
  { type: 'function', name: 'DOMAIN_SEPARATOR', inputs: [], outputs: [{ type: 'bytes32' }], stateMutability: 'view' },
  { type: 'function', name: 'MAX_QR_VALIDITY', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  {
    type: 'function', name: 'getCheckInDigest',
    inputs: [{
      name: 'auth', type: 'tuple',
      components: [
        { name: 'eventId', type: 'uint256' },
        { name: 'reservationId', type: 'uint256' },
        { name: 'attendee', type: 'address' },
        { name: 'nonce', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validUntil', type: 'uint256' },
      ],
    }],
    outputs: [{ type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function', name: 'usedNonces',
    inputs: [{ name: 'reservationId', type: 'uint256' }, { name: 'nonce', type: 'uint256' }],
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
  },

  // === Write ===
  {
    type: 'function', name: 'setStakingPool',
    inputs: [{ name: '_pool', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function', name: 'checkInWithSig',
    inputs: [{
      name: 'auth', type: 'tuple',
      components: [
        { name: 'eventId', type: 'uint256' },
        { name: 'reservationId', type: 'uint256' },
        { name: 'attendee', type: 'address' },
        { name: 'nonce', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validUntil', type: 'uint256' },
      ],
    }, { name: 'sig', type: 'bytes' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function', name: 'createEvent',
    inputs: [{
      name: 'p', type: 'tuple',
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
    }],
    outputs: [{ name: 'eventId', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  { type: 'function', name: 'reserve', inputs: [{ name: 'eventId', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'cancelReservation', inputs: [{ name: 'reservationId', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'openCheckIn', inputs: [{ name: 'eventId', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
  {
    type: 'function', name: 'checkIn',
    inputs: [{ name: 'eventId', type: 'uint256' }, { name: 'attendee', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  { type: 'function', name: 'cancelEvent', inputs: [{ name: 'eventId', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'finalizeEvent', inputs: [{ name: 'eventId', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'claimRefund', inputs: [{ name: 'reservationId', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'withdrawNoShowProceeds', inputs: [{ name: 'eventId', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
] as const

// ─── SeatBackStaking ABI ──────────────────────────────────────────────────────

export const STAKING_ABI = [
  { type: 'function', name: 'sbk', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'usdc', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'seatBack', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'owner', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'totalStaked', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'rewardPerTokenStored', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'undistributedProceeds', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'MIN_STAKE', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'STAKE_COOLDOWN_BLOCKS', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  {
    type: 'function', name: 'stakedBalance',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function', name: 'pendingReward',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  { type: 'function', name: 'stake', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'unstake', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'claimReward', inputs: [], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'exit', inputs: [], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'syncUndistributed', inputs: [], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'setSeatBack', inputs: [{ name: '_seatBack', type: 'address' }], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'receiveProceeds', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
  {
    type: 'event', name: 'Staked',
    inputs: [{ name: 'user', type: 'address', indexed: true }, { name: 'amount', type: 'uint256', indexed: false }],
  },
  {
    type: 'event', name: 'Unstaked',
    inputs: [{ name: 'user', type: 'address', indexed: true }, { name: 'amount', type: 'uint256', indexed: false }],
  },
  {
    type: 'event', name: 'RewardClaimed',
    inputs: [{ name: 'user', type: 'address', indexed: true }, { name: 'amount', type: 'uint256', indexed: false }],
  },
  {
    type: 'event', name: 'ProceedsReceived',
    inputs: [{ name: 'amount', type: 'uint256', indexed: false }, { name: 'rewardPerToken', type: 'uint256', indexed: false }],
  },
] as const

// ─── SeatBackToken ABI ────────────────────────────────────────────────────────

export const SBK_ABI = [
  { type: 'function', name: 'name', inputs: [], outputs: [{ type: 'string' }], stateMutability: 'view' },
  { type: 'function', name: 'symbol', inputs: [], outputs: [{ type: 'string' }], stateMutability: 'view' },
  { type: 'function', name: 'decimals', inputs: [], outputs: [{ type: 'uint8' }], stateMutability: 'view' },
  { type: 'function', name: 'totalSupply', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'owner', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
  {
    type: 'function', name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function', name: 'allowance',
    inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function', name: 'approve',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'value', type: 'uint256' }],
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function', name: 'transfer',
    inputs: [{ name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }],
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event', name: 'Transfer',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event', name: 'Approval',
    inputs: [
      { name: 'owner', type: 'address', indexed: true },
      { name: 'spender', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
] as const
