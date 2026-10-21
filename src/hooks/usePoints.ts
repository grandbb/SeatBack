/**
 * usePoints — คำนวณ Points จาก onchain events แบบ read-only
 *
 * Points rules:
 *   Create event  = 500 pts  (EventCreated organizer)
 *   Reserve       = 100 pts  (Reserved attendee)
 *   Check-in      = 300 pts  (CheckedIn attendee)
 *
 * ดึง logs แบบ paginated ทุก POLL_INTERVAL ms
 * ไม่ใช้ gas ทั้งสิ้น
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { createPublicClient, http, parseAbiItem } from 'viem'
import { arc } from 'viem/chains'
import { SEATBACK_ADDRESS } from '@/contract'

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL = 60_000 // 1 minute

export const POINTS_RULES = {
  CREATE_EVENT: 500,
  RESERVE: 100,
  CHECK_IN: 300,
} as const

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PointsBreakdown {
  total: number
  createEvent: number   // events created
  reserve: number       // reservations made
  checkIn: number       // check-ins completed
  eventCount: number
  reserveCount: number
  checkInCount: number
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

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePoints(address: `0x${string}` | undefined) {
  const [breakdown, setBreakdown] = useState<PointsBreakdown>({
    total: 0,
    createEvent: 0,
    reserve: 0,
    checkIn: 0,
    eventCount: 0,
    reserveCount: 0,
    checkInCount: 0,
  })
  const [loading, setLoading] = useState(false)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetch = useCallback(async () => {
    if (!address) return
    setLoading(true)
    try {
      // Fetch all 3 event types in parallel
      const [created, reserved, checkedIn] = await Promise.all([
        client.getLogs({
          address: SEATBACK_ADDRESS,
          event: EVENT_CREATED,
          args: { organizer: address },
          fromBlock: 0n,
          toBlock: 'latest',
        }),
        client.getLogs({
          address: SEATBACK_ADDRESS,
          event: RESERVED,
          args: { attendee: address },
          fromBlock: 0n,
          toBlock: 'latest',
        }),
        client.getLogs({
          address: SEATBACK_ADDRESS,
          event: CHECKED_IN,
          args: { attendee: address },
          fromBlock: 0n,
          toBlock: 'latest',
        }),
      ])

      const eventCount = created.length
      const reserveCount = reserved.length
      const checkInCount = checkedIn.length

      const createEvent = eventCount * POINTS_RULES.CREATE_EVENT
      const reserve = reserveCount * POINTS_RULES.RESERVE
      const checkIn = checkInCount * POINTS_RULES.CHECK_IN
      const total = createEvent + reserve + checkIn

      setBreakdown({ total, createEvent, reserve, checkIn, eventCount, reserveCount, checkInCount })
      setLastFetched(new Date())
    } catch {
      // Silently fail — Points are non-critical
    } finally {
      setLoading(false)
    }
  }, [address])

  // oxlint-disable-next-line react/set-state-in-effect -- async fetch pattern: setState inside async callback is intentional
  useEffect(() => {
    if (!address) return
    void fetch()
    timerRef.current = setInterval(() => { void fetch() }, POLL_INTERVAL)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [address, fetch])

  return { breakdown, loading, lastFetched, refresh: fetch }
}
