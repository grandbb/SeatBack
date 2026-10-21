/**
 * usePoints — คำนวณ Points จาก onchain events แบบ read-only
 *
 * ─── กติกา (v2) ───────────────────────────────────────────────────────────────
 *
 * 1. PENDING vs CONFIRMED
 *    - Points จะ "confirmed" เฉพาะจากงานที่จบแล้ว (finalized หรือ cancelled)
 *    - งานที่ยังไม่จบ = pending (แสดงแยก ไม่นับใน total)
 *    - ผู้จองที่ยกเลิก (ReservationCancelled) = 0 pts
 *    - ผู้จองที่ไม่มา (Reserved แต่ไม่มี CheckedIn) = 0 pts ถ้างานจบแล้ว
 *
 * 2. เงื่อนไขผู้จัดได้แต้ม
 *    - งานต้องผ่านเกณฑ์แคมเปญ (CAMPAIGN_ALLOWLIST) — ระยะแรกกำหนดโดย admin
 *    - ต้องมีผู้เข้าร่วมที่ check-in จริง >= MIN_CHECKED_IN_FOR_ORGANISER (5 คน)
 *
 * 3. Per-event cap + per-wallet cap
 *    - Reserve: สูงสุด 1 ครั้งต่องานต่อ wallet (นับแค่ครั้งสุดท้าย)
 *    - Check-in: สูงสุด 1 ครั้งต่องานต่อ wallet
 *    - Create: 1 ครั้งต่องาน (ผู้จัด)
 *    - Per-wallet total cap: MAX_POINTS_PER_WALLET
 *
 * 4. Campaign allowlist
 *    - ระยะแรก: กำหนดรายการ eventId ที่อนุมัติไว้ใน CAMPAIGN_ALLOWLIST
 *    - [] = เปิดกว้าง (disable allowlist ตอน production)
 *
 * 5. การตรวจพฤติกรรม (informational — snapshot processor ทำต่อ)
 *    - ระบบนี้แสดง flag "pattern detected" แต่ไม่ตัดสิทธิ์โดยอัตโนมัติ
 *    - flag ถ้า: งานเดียวกัน wallet เดิมจองซ้ำ > REPEAT_BOOKING_THRESHOLD ครั้ง
 *
 * 6. กติกาประกาศก่อน snapshot
 *    - ค่า rules ทุกตัวที่นี่ถูก export เพื่อให้ Docs อ่านได้โดยตรง
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { createPublicClient, http, parseAbiItem } from 'viem'
import { arc } from 'viem/chains'
import { SEATBACK_ADDRESS } from '@/contract'

// ─── Campaign & Rule Constants (exported for Docs) ───────────────────────────

/** eventId ที่อนุมัติให้เข้าร่วมแคมเปญ — [] = เปิดกว้างทุกงาน */
export const CAMPAIGN_ALLOWLIST: bigint[] = []

/** จำนวน check-in ขั้นต่ำที่งานต้องมีเพื่อให้ผู้จัดได้แต้ม */
export const MIN_CHECKED_IN_FOR_ORGANISER = 5

/** เพดาน Points สูงสุดต่อ wallet (ป้องกัน sybil อย่างง่าย) */
export const MAX_POINTS_PER_WALLET = 50_000

/** เพดาน Reserve points ต่องาน (1 ครั้ง = 100 pts) */
export const MAX_RESERVE_PER_EVENT = 1

/** เพดาน Check-in points ต่องาน (1 ครั้ง = 300 pts) */
export const MAX_CHECKIN_PER_EVENT = 1

/** จำนวนการจองซ้ำที่ถือว่า suspicious (flag แต่ไม่ตัด) */
export const REPEAT_BOOKING_THRESHOLD = 3

export const POINTS_RULES = {
  CREATE_EVENT: 500,  // ผู้จัดงาน — งานต้องผ่าน allowlist + ≥5 check-in
  RESERVE: 100,       // ผู้จอง — นับหลังงานจบ ถ้า check-in ด้วยรับเพิ่ม
  CHECK_IN: 300,      // ผู้จองที่ check-in — งานต้องจบ
} as const

const POLL_INTERVAL = 60_000

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PointsBreakdown {
  /** แต้มที่ confirmed (งานจบแล้ว + ผ่านเกณฑ์) */
  total: number
  /** แต้มที่รอตรวจสอบ (งานยังไม่จบ) */
  pending: number
  createEvent: number
  reserve: number
  checkIn: number
  eventCount: number
  reserveCount: number
  checkInCount: number
  /** งานที่ยังไม่จบ (pending) */
  pendingEvents: number
  /** flag: พบพฤติกรรม suspicious */
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

      /** eventId → จำนวน check-in ทั้งหมด (ทุก attendee) */
      const allCheckedIn = await client.getLogs({
        address: SEATBACK_ADDRESS, event: CHECKED_IN,
        fromBlock: 0n, toBlock: 'latest',
      })
      const eventCheckInCount = new Map<string, number>()
      for (const log of allCheckedIn) {
        const eid = String(log.args.eventId)
        eventCheckInCount.set(eid, (eventCheckInCount.get(eid) ?? 0) + 1)
      }

      /** eventId ที่ finalized หรือ cancelled = "จบแล้ว" */
      const finalizedIds = new Set<string>(
        finalized.map(l => String(l.args.eventId))
      )
      const cancelledIds = new Set<string>(
        eventCancelled.map(l => String(l.args.eventId))
      )
      const closedIds = new Set<string>([...finalizedIds, ...cancelledIds])

      /** eventId ที่ผ่าน allowlist ([] = ทุกงาน) */
      const inAllowlist = (eid: bigint) =>
        CAMPAIGN_ALLOWLIST.length === 0 ||
        CAMPAIGN_ALLOWLIST.some(a => a === eid)

      /** eventId ที่ผู้จองยกเลิก */
      const cancelledReservations = new Set<string>(
        cancelled.map(l => `${l.args.eventId}-${l.args.reservationId}`)
      )

      // ── ตรวจ suspicious pattern ───────────────────────────────────────────
      const reservePerEvent = new Map<string, number>()
      for (const log of reserved) {
        const eid = String(log.args.eventId)
        reservePerEvent.set(eid, (reservePerEvent.get(eid) ?? 0) + 1)
      }
      const suspiciousFlag = [...reservePerEvent.values()].some(
        n => n > REPEAT_BOOKING_THRESHOLD
      )

      // ── คำนวณ Reserve points ──────────────────────────────────────────────
      // - 1 ครั้งต่องาน (MAX_RESERVE_PER_EVENT)
      // - ถ้างานจบแล้วและไม่ได้ยกเลิก = confirmed
      // - ถ้างานยังไม่จบ = pending
      let confirmedReserve = 0
      let pendingReserve = 0
      let reserveCount = 0
      const seenReserveEvents = new Set<string>()

      for (const log of reserved) {
        const eid = String(log.args.eventId)
        const rid = `${eid}-${log.args.reservationId}`
        if (seenReserveEvents.has(eid)) continue // per-event cap
        if (cancelledReservations.has(rid)) continue // ยกเลิกแล้ว = 0 pts
        if (!inAllowlist(log.args.eventId!)) continue
        seenReserveEvents.add(eid)
        reserveCount++
        if (closedIds.has(eid)) {
          confirmedReserve += POINTS_RULES.RESERVE
        } else {
          pendingReserve += POINTS_RULES.RESERVE
        }
      }

      // ── คำนวณ Check-in points ─────────────────────────────────────────────
      // - 1 ครั้งต่องาน
      // - งานต้องจบแล้ว (finalized or cancelled-with-checkin)
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

      // ── คำนวณ Create points ───────────────────────────────────────────────
      // - งานต้องผ่าน allowlist
      // - ต้องมี check-in จริง >= MIN_CHECKED_IN_FOR_ORGANISER
      // - งานต้องจบแล้ว (finalized)
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
          // งานจบ + ผ่านเกณฑ์ = confirmed
          confirmedCreate += POINTS_RULES.CREATE_EVENT
        } else if (!closedIds.has(eid)) {
          // งานยังไม่จบ = pending
          pendingCreate += POINTS_RULES.CREATE_EVENT
          pendingEvents++
        }
        // งานจบแต่ไม่ผ่านเกณฑ์ = 0 pts
      }

      // ── รวม ───────────────────────────────────────────────────────────────
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
