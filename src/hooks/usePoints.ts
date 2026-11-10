/**
 * usePoints — read-only Points calculation from onchain events (computed in the browser).
 *
 * Rules:
 * 1. PENDING vs CONFIRMED
 *    - Points are confirmed only once the event is finalised. Events still running = pending.
 *    - Cancelled events and cancelled reservations = 0 pts. No-shows = 0 pts.
 *
 * 2. Organiser earn condition
 *    - Event must be finalised and have >= MIN_CHECKED_IN_FOR_ORGANISER check-ins from
 *      distinct wallets other than the organiser.
 *
 * 3. Per-event and per-wallet caps
 *    - Reserve, check-in and create each count once per event.
 *    - Early adopters (first EARLY_ADOPTER_WALLETS distinct wallets to reserve) get x2.
 *    - Per-wallet total cap (after the multiplier): MAX_POINTS_PER_WALLET.
 *
 * 4. Campaign allowlist is empty, so every event qualifies. (The hook supports an allowlist.)
 *
 * 5. Suspicious behaviour is flagged for review only; it never disqualifies automatically.
 *
 * The airdrop these points are meant to feed is PLANNED: nothing is distributed yet.
 */

import { useEffect, useState, useCallback } from 'react'
import { createPublicClient, http, parseAbiItem } from 'viem'
import { arc } from 'viem/chains'
import { SEATBACK_ADDRESS, DEPLOY_BLOCK } from '@/contract'
import { getLogsChunked } from '@/utils/logScan'

/** Minimal shape of a decoded log used by the points rules. */
interface LogLike {
  args: { eventId?: bigint; reservationId?: bigint; attendee?: string; organizer?: string }
}

// ─── Campaign & Rule Constants (exported for Docs) ───────────────────────────

/** Approved eventIds for the campaign. [] = all events qualify. */
export const CAMPAIGN_ALLOWLIST: bigint[] = []

/** Minimum real check-ins an event must have for the organiser to earn points. */
export const MIN_CHECKED_IN_FOR_ORGANISER = 5

/** The first N distinct wallets to ever reserve on SeatBack are early adopters. */
export const EARLY_ADOPTER_WALLETS = 500

/** All of an early adopter's points are multiplied by this (before the per-wallet cap). */
export const EARLY_ADOPTER_MULTIPLIER = 2

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
  /** True when this wallet is among the first EARLY_ADOPTER_WALLETS to reserve. */
  earlyAdopter: boolean
  /** Extra confirmed points from the early-adopter multiplier (already included in total). */
  bonus: number
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
  'event EventFinalized(uint256 indexed eventId, uint256 noShowProceeds, uint256 refundLiability)'
)
const EVENT_CANCELLED = parseAbiItem(
  'event EventCancelled(uint256 indexed eventId)'
)

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePoints(address: `0x${string}` | undefined, enabled = true) {
  const [breakdown, setBreakdown] = useState<PointsBreakdown>({
    total: 0, pending: 0,
    createEvent: 0, reserve: 0, checkIn: 0,
    eventCount: 0, reserveCount: 0, checkInCount: 0,
    pendingEvents: 0, suspiciousFlag: false, earlyAdopter: false, bonus: 0,
  })
  const [loading, setLoading] = useState(false)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const fetchPoints = useCallback(async () => {
    if (!address) return
    setLoading(true)
    try {
      // One chunked scan for every event type (the public RPC caps the block range and rate-limits),
      // then split client-side. Logs are returned in chain order.
      const logs = await getLogsChunked(
        client,
        SEATBACK_ADDRESS,
        [EVENT_CREATED, RESERVED, CHECKED_IN, RESERVATION_CANCELLED, EVENT_FINALIZED, EVENT_CANCELLED],
        DEPLOY_BLOCK,
      )
      const me0 = address.toLowerCase()
      const named = (name: string): LogLike[] =>
        logs.filter((l) => l.eventName === name).map((l) => ({ args: l.args as LogLike['args'] }))
      const lower = (v: unknown) => (typeof v === 'string' ? v.toLowerCase() : undefined)

      const created = named('EventCreated').filter((l) => lower(l.args.organizer) === me0)
      const allReserved = named('Reserved')
      const reserved = allReserved.filter((l) => lower(l.args.attendee) === me0)
      const allCheckedIn = named('CheckedIn')
      const checkedIn = allCheckedIn.filter((l) => lower(l.args.attendee) === me0)
      const cancelled = named('ReservationCancelled').filter((l) => lower(l.args.attendee) === me0)
      const finalized = named('EventFinalized')
      const eventCancelled = named('EventCancelled')

      // Early adopter: among the first N distinct wallets to ever reserve (logs are in chain order)
      const earliestWallets = new Set<string>()
      for (const log of allReserved) {
        const w = log.args.attendee?.toLowerCase()
        if (w && earliestWallets.size < EARLY_ADOPTER_WALLETS) earliestWallets.add(w)
      }
      const earlyAdopter = earliestWallets.has(address.toLowerCase())

      // "Real" check-ins for the organiser rule: distinct attendee wallets other than the organiser
      const me = address.toLowerCase()
      const eventCheckInWallets = new Map<string, Set<string>>()
      for (const log of allCheckedIn) {
        const eid = String(log.args.eventId)
        const w = log.args.attendee?.toLowerCase()
        if (!w || w === me) continue
        const set = eventCheckInWallets.get(eid) ?? new Set<string>()
        set.add(w)
        eventCheckInWallets.set(eid, set)
      }

      /** Confirmed only once an event is finalised. Cancelled events earn nothing. */
      const finalizedIds = new Set<string>(
        finalized.map(l => String(l.args.eventId))
      )
      const cancelledIds = new Set<string>(
        eventCancelled.map(l => String(l.args.eventId))
      )

      /** Returns true if eventId passes the campaign allowlist (empty = all events qualify). */
      const inAllowlist = (eid: bigint) =>
        CAMPAIGN_ALLOWLIST.length === 0 ||
        CAMPAIGN_ALLOWLIST.some(a => a === eid)

      /** reservationId keys for cancelled reservations (eventId-reservationId). */
      const cancelledReservations = new Set<string>(
        cancelled.map(l => `${l.args.eventId}-${l.args.reservationId}`)
      )

      /** eventId-reservationId keys for confirmed check-ins (this attendee only).
       *  RESERVE points are only earned if the attendee was actually checked in. */
      const checkedInKeys = new Set<string>(
        checkedIn.map(l => `${l.args.eventId}-${l.args.reservationId}`)
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
        if (cancelledIds.has(eid)) continue // cancelled event = 0 pts
        if (!inAllowlist(log.args.eventId!)) continue
        seenReserveEvents.add(eid)
        reserveCount++
        if (finalizedIds.has(eid)) {
          // Closed event: only award points if the attendee was actually checked in
          if (!checkedInKeys.has(rid)) continue
          confirmedReserve += POINTS_RULES.RESERVE
        } else {
          // Still open: award pending points regardless (check-in hasn't happened yet)
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
        if (cancelledIds.has(eid)) continue // cancelled event = 0 pts
        if (!inAllowlist(log.args.eventId!)) continue
        seenCheckInEvents.add(eid)
        checkInCount++
        if (finalizedIds.has(eid)) {
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
        if (cancelledIds.has(eid)) continue // cancelled event = 0 pts
        if (!inAllowlist(log.args.eventId!)) continue
        const checkInTotal = eventCheckInWallets.get(eid)?.size ?? 0
        const meetsThreshold = checkInTotal >= MIN_CHECKED_IN_FOR_ORGANISER
        eventCount++
        if (finalizedIds.has(eid) && meetsThreshold) {
          // closed + meets threshold = confirmed
          confirmedCreate += POINTS_RULES.CREATE_EVENT
        } else if (!finalizedIds.has(eid)) {
          // still open = pending
          pendingCreate += POINTS_RULES.CREATE_EVENT
          pendingEvents++
        }
        // closed but below threshold = 0 pts
      }

      // ── Totals ────────────────────────────────────────────────────────────
      const baseConfirmed = confirmedCreate + confirmedReserve + confirmedCheckIn
      const multiplier = earlyAdopter ? EARLY_ADOPTER_MULTIPLIER : 1
      const total = Math.min(baseConfirmed * multiplier, MAX_POINTS_PER_WALLET)
      const bonus = total - Math.min(baseConfirmed, MAX_POINTS_PER_WALLET)
      const pending = Math.min(
        (pendingCreate + pendingReserve + pendingCheckIn) * multiplier,
        Math.max(0, MAX_POINTS_PER_WALLET - total),
      )

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
        earlyAdopter,
        bonus,
      })
      setLastFetched(new Date())
      setFetchError(null)
    } catch {
      setFetchError('Points temporarily unavailable')
    } finally {
      setLoading(false)
    }
  }, [address])

  // Fetch once when the points panel is first opened for a wallet (no background polling:
  // the scan walks the chain in chunks and the public RPC is rate limited). Use refresh to update.
  // oxlint-disable-next-line react/set-state-in-effect -- async fetch pattern
  useEffect(() => {
    if (!address || !enabled) return
    void fetchPoints()
  }, [address, enabled, fetchPoints])

  return { breakdown, loading, lastFetched, refresh: fetchPoints, error: fetchError }
}
