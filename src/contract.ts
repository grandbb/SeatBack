/*
 * SeatBack contract config — Arc Mainnet production build.
 * SeatBack v4 + SeatBackStaking v3 + SeatBackToken (SBK)
 *
 * Contract addresses (Arc Mainnet, chain 5042):
 *   SeatBack v4:        0xAD55d8959c56da02E730A2354CE430bfD42976FA
 *   SeatBackStaking v3: 0xa9442b3d23DDAA65D5cE7cc766ABbCb1f7720099
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

/** SeatBack v4 — deployed 2026-11-10 (block 30541040). Admin must call setStakingPool once. */
export const SEATBACK_ADDRESS: `0x${string}` = '0xAD55d8959c56da02E730A2354CE430bfD42976FA'

/** SeatBackStaking v3 — deployed 2026-11-10, bound to SeatBack v4 */
export const STAKING_ADDRESS: `0x${string}` = '0xa9442b3d23DDAA65D5cE7cc766ABbCb1f7720099'

/**
 * Block at which SeatBack was deployed. Lower bound for all log queries
 * (reservations, organiser events, points). UPDATE after every deployment.
 */
export const DEPLOY_BLOCK = 30541040n

/** SeatBackToken (SBK) — 100M fixed supply */
export const SBK_ADDRESS: `0x${string}` = '0x6AB94508cB97756873316f6819F258BCE444363f'

// ─── SeatBack ABI ─────────────────────────────────────────────────────────────

export const SEATBACK_ABI = [
  // === Custom errors (so reverts are decoded by name) ===
  { type: 'error', name: 'AlreadyCancelled', inputs: [] },
  { type: 'error', name: 'AlreadyClaimed', inputs: [] },
  { type: 'error', name: 'AlreadyFinalized', inputs: [] },
  { type: 'error', name: 'AlreadyOpened', inputs: [] },
  { type: 'error', name: 'AlreadyReserved', inputs: [] },
  { type: 'error', name: 'AttendeeWalletMismatch', inputs: [] },
  { type: 'error', name: 'BookingClosed', inputs: [] },
  { type: 'error', name: 'CapacityFull', inputs: [] },
  { type: 'error', name: 'CheckInNotOpen', inputs: [] },
  { type: 'error', name: 'CheckInNotStarted', inputs: [] },
  { type: 'error', name: 'CheckInWindowClosed', inputs: [] },
  { type: 'error', name: 'CheckInWindowTooShort', inputs: [] },
  { type: 'error', name: 'EventCancelled_', inputs: [] },
  { type: 'error', name: 'EventNotCancelled', inputs: [] },
  { type: 'error', name: 'EventNotFound', inputs: [] },
  { type: 'error', name: 'InternalCallOnly', inputs: [] },
  { type: 'error', name: 'InvalidAddress', inputs: [] },
  { type: 'error', name: 'InvalidCapacity', inputs: [] },
  { type: 'error', name: 'InvalidDeposit', inputs: [] },
  { type: 'error', name: 'InvalidEventTimes', inputs: [] },
  { type: 'error', name: 'InvalidMetadata', inputs: [{ name: 'field', type: 'string' }] },
  { type: 'error', name: 'InvalidSignature', inputs: [] },
  { type: 'error', name: 'InvalidStakingPool', inputs: [] },
  { type: 'error', name: 'InvalidTimestamps', inputs: [] },
  { type: 'error', name: 'NoProceeds', inputs: [] },
  { type: 'error', name: 'NoShowAlreadySettled', inputs: [] },
  { type: 'error', name: 'NoShowNotSettled', inputs: [] },
  { type: 'error', name: 'NonceAlreadyUsed', inputs: [] },
  { type: 'error', name: 'NotActive', inputs: [] },
  { type: 'error', name: 'NotAdmin', inputs: [] },
  { type: 'error', name: 'NotAttendee', inputs: [] },
  { type: 'error', name: 'NotOrganizer', inputs: [] },
  { type: 'error', name: 'NotRefundable', inputs: [] },
  { type: 'error', name: 'QrExpired', inputs: [] },
  { type: 'error', name: 'QrNotYetValid', inputs: [] },
  { type: 'error', name: 'QrValidityTooLong', inputs: [] },
  { type: 'error', name: 'ReentrancyGuardReentrantCall', inputs: [] },
  { type: 'error', name: 'SafeERC20FailedOperation', inputs: [{ name: 'token', type: 'address' }] },
  { type: 'error', name: 'StakerCreditTransferFailed', inputs: [] },
  { type: 'error', name: 'StakingPoolAlreadySet', inputs: [] },
  { type: 'error', name: 'StakingPoolNotSet', inputs: [] },
  { type: 'error', name: 'TooEarlyToFinalize', inputs: [] },
  { type: 'error', name: 'ZeroAddress', inputs: [] },
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
      { name: 'eventId',          type: 'uint256', indexed: true  },
      { name: 'noShowProceeds',   type: 'uint256', indexed: false },
      { name: 'refundLiability',  type: 'uint256', indexed: false },
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
    type: 'event', name: 'NoShowSettled',
    inputs: [
      { name: 'eventId', type: 'uint256', indexed: true },
      { name: 'organiserAmount', type: 'uint256', indexed: false },
      { name: 'stakerAmount', type: 'uint256', indexed: false },
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
        { name: 'noShowSettled', type: 'bool' },
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
  { type: 'function', name: 'stakingPool', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'withdrawNoShowProceeds', inputs: [{ name: 'eventId', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'withdrawOrganizerCredit', inputs: [{ name: 'eventId', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'updatePayoutWallet', inputs: [{ name: 'eventId', type: 'uint256' }, { name: 'newWallet', type: 'address' }], outputs: [], stateMutability: 'nonpayable' },
  { type: 'function', name: 'retryStakerCredit', inputs: [{ name: 'eventId', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
  {
    type: 'function', name: 'unclaimedStakerCredit',
    inputs: [{ name: 'eventId', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'event', name: 'StakerCreditAccrued',
    inputs: [
      { name: 'eventId', type: 'uint256', indexed: true  },
      { name: 'pool',    type: 'address', indexed: true  },
      { name: 'amount',  type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event', name: 'StakerCreditReclaimed',
    inputs: [
      { name: 'eventId', type: 'uint256', indexed: true  },
      { name: 'pool',    type: 'address', indexed: true  },
      { name: 'amount',  type: 'uint256', indexed: false },
    ],
  },
] as const

// ─── SeatBackStaking ABI ──────────────────────────────────────────────────────

export const STAKING_ABI = [
  // === Custom errors ===
  { type: 'error', name: 'BelowMinStake', inputs: [] },
  { type: 'error', name: 'InsufficientStake', inputs: [] },
  { type: 'error', name: 'InvalidAddress', inputs: [] },
  { type: 'error', name: 'NoPendingReward', inputs: [] },
  { type: 'error', name: 'NoStakers', inputs: [] },
  { type: 'error', name: 'OwnableInvalidOwner', inputs: [{ name: 'owner', type: 'address' }] },
  { type: 'error', name: 'OwnableUnauthorizedAccount', inputs: [{ name: 'account', type: 'address' }] },
  { type: 'error', name: 'OwnershipRenunciationDisabled', inputs: [] },
  { type: 'error', name: 'ReentrancyGuardReentrantCall', inputs: [] },
  { type: 'error', name: 'SafeERC20FailedOperation', inputs: [{ name: 'token', type: 'address' }] },
  { type: 'error', name: 'StillInCooldown', inputs: [] },
  { type: 'error', name: 'Unauthorized', inputs: [] },
  { type: 'error', name: 'ZeroAmount', inputs: [] },
  { type: 'function', name: 'sbk', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'usdc', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'seatBack', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'owner', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'totalStaked', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'rewardPerTokenStored', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'rewardRemainderScaled', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'MIN_STAKE', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'STAKE_COOLDOWN_SECONDS', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'ownerReserve', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
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
  { type: 'function', name: 'stakeTimestamp', inputs: [{ name: 'user', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'isInCooldown', inputs: [{ name: 'user', type: 'address' }], outputs: [{ type: 'bool' }], stateMutability: 'view' },
  { type: 'function', name: 'receiveProceeds',   inputs: [{ name: 'amount', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
  {
    type: 'function', name: 'withdrawOwnerReserve',
    inputs: [{ name: 'to', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
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
    inputs: [{ name: 'amount', type: 'uint256', indexed: false }, { name: 'newRewardPerToken', type: 'uint256', indexed: false }],
  },
  {
    type: 'event', name: 'OwnerReserveWithdrawn',
    inputs: [{ name: 'to', type: 'address', indexed: true }, { name: 'amount', type: 'uint256', indexed: false }],
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
