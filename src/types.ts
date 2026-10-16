/** Mirrors SeatBack.EventInfo from the contract */
export interface EventInfo {
  organizer: `0x${string}`
  payoutWallet: `0x${string}`
  title: string
  description: string
  venue: string
  eventStart: bigint
  eventEnd: bigint
  capacity: number
  depositAmount: bigint
  bookingClose: bigint
  refundCutoff: bigint
  checkInStart: bigint
  checkInEnd: bigint
  cancelled: boolean
  checkInOpened: boolean
  finalized: boolean
}

/** Mirrors SeatBack.EventAccounting */
export interface EventAccounting {
  activeDeposits: bigint
  outstandingRefunds: bigint
  organizerCredit: bigint
  refundsPaid: bigint
  organizerPaid: bigint
}

/** Mirrors SeatBack.ReservationInfo */
export interface ReservationInfo {
  eventId: bigint
  attendee: `0x${string}`
  active: boolean
  refundable: boolean
  refundClaimed: boolean
}

/** UI-only tab enum */
export type AppTab = 'events' | 'create' | 'organizer'

/** Current phase of an event, computed from onchain state and block.timestamp */
export type EventPhase =
  | 'booking_open'
  | 'booking_closed'
  | 'check_in_open'
  | 'check_in_closed'
  | 'finalized'
  | 'cancelled'

export function computeEventPhase(evt: EventInfo): EventPhase {
  const now = BigInt(Math.floor(Date.now() / 1000))
  if (evt.cancelled) return 'cancelled'
  if (evt.finalized) return 'finalized'
  if (now >= evt.checkInEnd) return 'finalized' // eligible for finalization
  if (evt.checkInOpened || now >= evt.checkInStart) return 'check_in_open'
  if (now >= evt.bookingClose) return 'booking_closed'
  return 'booking_open'
}
