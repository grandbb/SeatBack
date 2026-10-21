/**
 * usePoints — read-only Points calculation from onchain events
 *
 * Rules (v2):
 * 1. PENDING vs CONFIRMED
 *    - Points are "confirmed" only from events that have finalised or been cancelled.
 *    - Events not yet closed = pending (shown separately, not counted in total).
 *    - Cancelled reservations (ReservationCancelled) = 0 pts.
 *    - No-shows (Reserved but no CheckedIn, event finalised) = 0 pts.
 *
 * 2. Organiser earn condition
 *    - Event must pass the campaign allowlist (CAMPAIGN_ALLOWLIST) — set by admin in early phase.
 *    - Event must have >= MIN_CHECKED_IN_FOR_ORGANISER real check-ins.
 *
 * 3. Per-event cap + per-wallet cap
 *    - Reserve: max 1 per event per wallet.
 *    - Check-in: max 1 per event per wallet.
 *    - Create: 1 per event (must be the organiser in EventCreated log).
 *    - Per-wallet total cap: MAX_POINTS_PER_WALLET.
 *
 * 4. Campaign allowlist
 *    - Early phase: list approved eventIds in CAMPAIGN_ALLOWLIST.
 *    - [] = open to all events (disable allowlist for production).
 *
 * 5. Suspicious behaviour detection (informational — snapshot processor handles final decision)
 *    - Flags wallets but does NOT automatically disqualify.
 *    - Flagged if: same wallet reserves the same event > REPEAT_BOOKING_THRESHOLD times.
 *
 * 6. Rules published before snapshot
 *    - All exported constants here are read directly by Docs for transparency.
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { createPublicClient, http, parseAbiItem } from 'viem'
import { arc } from 'viem/chains'
import { SEATBACK_ADDRESS } from '@/contract'

// ─── Campaign & Rule Constants (exported for Docs) ───────────────────────────

/** Approved eventIds for the campaign. [] = all events qualify. */
export const CAMPAIGN_ALLOWLIST: bigint[] = []

/** Minimum real check-ins an event must have for the organiser to earn points. */
export const MIN_CHECKED_IN_FOR_ORGANISER = 5

/** Maximum total points per wallet (basic Sybil resistance). */
export const MAX_POINTS_PER_WALLET = 50_000

/** Max reserve points per event per wallet (1 reservation = 100 pts). */
export const MAX_RESERVE_PER_EVENT = 1

/** Max check-in points per event per wallet (1 check-in = 300 pts). */
export const MAX_CHECKIN_PER_EVENT = 1

/** Reservation repeat count above which a wallet is flagged as suspicious (not auto-disqualified). */
export const REPEAT_BOOKING_THRESHOLD = 3

export const POINTS_RULES = {
  CREATE_EVENT: 500,  // organiser — event must pass allowlist + ≥5 check-ins
  RESERVE: 100,       // attendee — counted after event finalises, only if attended
  CHECK_IN: 300,      // attendee who checked in — event must be finalised
} as const

const POLL_INTERVAL = 60_000

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PointsBreakdown {
  /** Confirmed points (event finalised + all conditions met). */
  total: number
  /** Pending points (events not yet closed). */
  pending: number
  createEvent: number
  reserve: number
  checkIn: number
  eventCount: number
  reserveCount: number
  checkInCount: number
  /** Number of events still pending finalisation. */
  pendingEvents: number
  /** True when a suspicious reservation pattern was detected. */
  suspiciousFlag: boolean
}

// ─── Client ───────────────────────────────────────────────────────────────────

const client = createPublicClient({
  chain: arc,
  transport: http('https://rpc.mainnet.arc.io'),
})

// ─── ABI items ────────────────────────────────────────────────────────────────

const EVENT_CREATED = parseAbiItem(
  'event EventCreated(uint256 indexed eventId, address indexed organizer, address payoutWallet, uint256 depositAmount, uint256 capacity, uint256 bookingClose, uint256 refundCutoff, uint256 checkInStart, uint256 checkInEnd)'
)
const RESERVED = parseAbiItem(
  'event Reserved(uint256 indexed eventId, uint256 indexed reservationId, address indexed attendee, uint256 depositAmount)'
)
const CHECKED_IN = parseAbiItem(
  'event CheckedIn(uint256 indexed eventId, uint256 indexed reservationId, address indexed attendee)'
)
const RESERVATION_CANCELLED = parseAbiItem(
  'event ReservationCancelled(uint256 indexed eventId, uint256 indexed reservationId, address indexed attendee)'
)
const EVENT_FINALIZED = parseAbiItem(
  'event EventFinalized(uint256 indexed eventId, uint256 noShowCount, uint256 stakerPayout, uint256 organiserPayout)'
)
const EVENT_CANCELLED = parseAbiItem(
  'event EventCancelled(uint256 indexed eventId)'
)

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePoints(address: `0x${string}` | undefined) {
  const [breakdown, setBreakdown] = useState<PointsBreakdown>({
    total: 0, pending: 0,
    createEvent: 0, reserve: 0, checkIn: 0,
    eventCount: 0, reserveCount: 0, checkInCount: 0,
    pendingEvents: 0, suspiciousFlag: false,
  })
  const [loading, setLoading] = useState(false)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchPoints = useCallback(async () => {
    if (!address) return
    setLoading(true)
    try {
      // ── Fetch all event logs in parallel ──────────────────────────────────
      const [
        created,
        reserved,
        checkedIn,
        cancelled,
        finalized,
        eventCancelled,
      ] = await Promise.all([
        client.getLogs({ address: SEATBACK_ADDRESS, event: EVENT_CREATED,
          args: { organizer: address }, fromBlock: 0n, toBlock: 'latest' }),
        client.getLogs({ address: SEATBACK_ADDRESS, event: RESERVED,
          args: { attendee: address }, fromBlock: 0n, toBlock: 'latest' }),
        client.getLogs({ address: SEATBACK_ADDRESS, event: CHECKED_IN,
          args: { attendee: address }, fromBlock: 0n, toBlock: 'latest' }),
        client.getLogs({ address: SEATBACK_ADDRESS, event: RESERVATION_CANCELLED,
          args: { attendee: address }, fromBlock: 0n, toBlock: 'latest' }),
        client.getLogs({ address: SEATBACK_ADDRESS, event: EVENT_FINALIZED,
          fromBlock: 0n, toBlock: 'latest' }),
        client.getLogs({ address: SEATBACK_ADDRESS, event: EVENT_CANCELLED,
          fromBlock: 0n, toBlock: 'latest' }),
      ])

      // ── Build lookup sets ─────────────────────────────────────────────────

      /** eventId → total check-in count across all attendees */
      const allCheckedIn = await client.getLogs({
        address: SEATBACK_ADDRESS, event: CHECKED_IN,
        fromBlock: 0n, toBlock: 'latest',
      })
      const eventCheckInCount = new Map<string, number>()
      for (const log of allCheckedIn) {
        const eid = String(log.args.eventId)
        eventCheckInCount.set(eid, (eventCheckInCount.get(eid) ?? 0) + 1)
      }

      /** eventIds that are finalised or cancelled = closed */
      const finalizedIds = new Set<string>(
        finalized.map(l => String(l.args.eventId))
      )
      const cancelledIds = new Set<string>(
        eventCancelled.map(l => String(l.args.eventId))
      )
      const closedIds = new Set<string>([...finalizedIds, ...cancelledIds])

      /** Returns true if eventId passes the campaign allowlist (empty = all events qualify). */
      const inAllowlist = (eid: bigint) =>
        CAMPAIGN_ALLOWLIST.length === 0 ||
        CAMPAIGN_ALLOWLIST.some(a => a === eid)

      /** reservationId keys for cancelled reservations (eventId-reservationId). */
      const cancelledReservations = new Set<string>(
        cancelled.map(l => `${l.args.eventId}-${l.args.reservationId}`)
      )

      // ── Check for suspicious patterns ────────────────────────────────────
      const reservePerEvent = new Map<string, number>()
      for (const log of reserved) {
        const eid = String(log.args.eventId)
        reservePerEvent.set(eid, (reservePerEvent.get(eid) ?? 0) + 1)
      }
      const suspiciousFlag = [...reservePerEvent.values()].some(
        n => n > REPEAT_BOOKING_THRESHOLD
      )

      // ── Reserve points ────────────────────────────────────────────────────
      // - Max 1 per event (MAX_RESERVE_PER_EVENT)
      // - Closed event + not cancelled = confirmed
      // - Event still open = pending
      let confirmedReserve = 0
      let pendingReserve = 0
      let reserveCount = 0
      const seenReserveEvents = new Set<string>()

      for (const log of reserved) {
        const eid = String(log.args.eventId)
        const rid = `${eid}-${log.args.reservationId}`
        if (seenReserveEvents.has(eid)) continue // per-event cap
        if (cancelledReservations.has(rid)) continue // cancelled = 0 pts
        if (!inAllowlist(log.args.eventId!)) continue
        seenReserveEvents.add(eid)
        reserveCount++
        if (closedIds.has(eid)) {
          confirmedReserve += POINTS_RULES.RESERVE
        } else {
          pendingReserve += POINTS_RULES.RESERVE
        }
      }

      // ── Check-in points ───────────────────────────────────────────────────
      // - Max 1 per event
      // - Event must be closed (finalised or cancelled)
      let confirmedCheckIn = 0
      let pendingCheckIn = 0
      let checkInCount = 0
      const seenCheckInEvents = new Set<string>()

      for (const log of checkedIn) {
        const eid = String(log.args.eventId)
        if (seenCheckInEvents.has(eid)) continue
        if (!inAllowlist(log.args.eventId!)) continue
        seenCheckInEvents.add(eid)
        checkInCount++
        if (closedIds.has(eid)) {
          confirmedCheckIn += POINTS_RULES.CHECK_IN
        } else {
          pendingCheckIn += POINTS_RULES.CHECK_IN
        }
      }

      // ── Create points ─────────────────────────────────────────────────────
      // - Event must pass allowlist
      // - Must have >= MIN_CHECKED_IN_FOR_ORGANISER real check-ins
      // - Event must be finalised
      let confirmedCreate = 0
      let pendingCreate = 0
      let eventCount = 0
      let pendingEvents = 0

      for (const log of created) {
        const eid = String(log.args.eventId)
        if (!inAllowlist(log.args.eventId!)) continue
        const checkInTotal = eventCheckInCount.get(eid) ?? 0
        const meetsThreshold = checkInTotal >= MIN_CHECKED_IN_FOR_ORGANISER
        eventCount++
        if (finalizedIds.has(eid) && meetsThreshold) {
          // closed + meets threshold = confirmed
          confirmedCreate += POINTS_RULES.CREATE_EVENT
        } else if (!closedIds.has(eid)) {
          // still open = pending
          pendingCreate += POINTS_RULES.CREATE_EVENT
          pendingEvents++
        }
        // closed but below threshold = 0 pts
      }

      // ── Totals ────────────────────────────────────────────────────────────
      const rawTotal = confirmedCreate + confirmedReserve + confirmedCheckIn
      const total = Math.min(rawTotal, MAX_POINTS_PER_WALLET)
      const pending = pendingCreate + pendingReserve + pendingCheckIn

      setBreakdown({
        total,
        pending,
        createEvent: confirmedCreate,
        reserve: confirmedReserve,
        checkIn: confirmedCheckIn,
        eventCount,
        reserveCount,
        checkInCount,
        pendingEvents,
        suspiciousFlag,
      })
      setLastFetched(new Date())
    } catch {
      // Non-critical: Points display fails gracefully
    } finally {
      setLoading(false)
    }
  }, [address])

  // oxlint-disable-next-line react/set-state-in-effect -- async fetch pattern
  useEffect(() => {
    if (!address) return
    void fetchPoints()
    timerRef.current = setInterval(() => { void fetchPoints() }, POLL_INTERVAL)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [address, fetchPoints])

  return { breakdown, loading, lastFetched, refresh: fetchPoints }
}
