/**
 * Discovery of a wallet's own records from contract state (no log scanning).
 *
 * Why not logs: the public Arc RPC rejects eth_getLogs ranges above ~10,000 blocks and
 * rate-limits bursts, and Arc produces a block every ~0.5 s, so a scan from the deploy
 * block gets slower every day. Reading contract state through multicall scales with the
 * number of events and reservations instead, and never depends on chain age.
 */
import { useQuery } from '@tanstack/react-query'
import { usePublicClient } from 'wagmi'
import { SEATBACK_ABI, SEATBACK_ADDRESS, ACTIVE_CHAIN_ID } from '@/contract'

const RESERVATION_PAGE = 150
const EVENT_PAGE = 50
const POLL_MS = 60_000

const descending = (a: bigint, b: bigint) => (a < b ? 1 : a > b ? -1 : 0)

/** All reservation ids made by `attendee` (optionally for a single event), newest first. */
export function useMyReservationIds(attendee: `0x${string}` | undefined, eventId?: bigint) {
  const client = usePublicClient({ chainId: ACTIVE_CHAIN_ID })
  return useQuery({
    queryKey: ['myReservationIds', SEATBACK_ADDRESS, attendee, eventId?.toString() ?? 'all'],
    enabled: !!client && !!attendee && !!SEATBACK_ADDRESS,
    refetchInterval: POLL_MS,
    queryFn: async (): Promise<bigint[]> => {
      if (!client || !attendee || !SEATBACK_ADDRESS) return []
      const me = attendee.toLowerCase()

      // 1. Candidate reservation ids
      const candidates: bigint[] = []
      if (eventId !== undefined) {
        for (let offset = 0n; ; offset += BigInt(RESERVATION_PAGE)) {
          const page = (await client.readContract({
            address: SEATBACK_ADDRESS,
            abi: SEATBACK_ABI,
            functionName: 'getEventReservations',
            args: [eventId, offset, BigInt(RESERVATION_PAGE)],
          }))
          candidates.push(...page)
          if (page.length < RESERVATION_PAGE) break
        }
      } else {
        const total = (await client.readContract({
          address: SEATBACK_ADDRESS,
          abi: SEATBACK_ABI,
          functionName: 'reservationCount',
        }))
        for (let id = 1n; id <= total; id++) candidates.push(id)
      }

      // 2. Keep the ones that belong to this wallet
      const mine: bigint[] = []
      for (let i = 0; i < candidates.length; i += RESERVATION_PAGE) {
        const slice = candidates.slice(i, i + RESERVATION_PAGE)
        const res = await client.multicall({
          allowFailure: true,
          contracts: slice.map((id) => ({
            address: SEATBACK_ADDRESS,
            abi: SEATBACK_ABI,
            functionName: 'getReservation' as const,
            args: [id] as const,
          })),
        })
        res.forEach((r, idx) => {
          if (r.status !== 'success') return
          const info = r.result as { attendee: string }
          if (info.attendee.toLowerCase() === me) mine.push(slice[idx])
        })
      }
      return mine.sort(descending)
    },
  })
}

/** All event ids created by `organizer`, newest first. */
export function useMyOrganizedEventIds(organizer: `0x${string}` | undefined) {
  const client = usePublicClient({ chainId: ACTIVE_CHAIN_ID })
  return useQuery({
    queryKey: ['myOrganizedEventIds', SEATBACK_ADDRESS, organizer],
    enabled: !!client && !!organizer && !!SEATBACK_ADDRESS,
    refetchInterval: POLL_MS,
    queryFn: async (): Promise<bigint[]> => {
      if (!client || !organizer || !SEATBACK_ADDRESS) return []
      const me = organizer.toLowerCase()
      const total = (await client.readContract({
        address: SEATBACK_ADDRESS,
        abi: SEATBACK_ABI,
        functionName: 'eventCount',
      }))

      const mine: bigint[] = []
      for (let start = 0n; start < total; start += BigInt(EVENT_PAGE)) {
        const end = start + BigInt(EVENT_PAGE) > total ? total : start + BigInt(EVENT_PAGE)
        const ids: bigint[] = []
        for (let id = start; id < end; id++) ids.push(id)
        const res = await client.multicall({
          allowFailure: true,
          contracts: ids.map((id) => ({
            address: SEATBACK_ADDRESS,
            abi: SEATBACK_ABI,
            functionName: 'getEvent' as const,
            args: [id] as const,
          })),
        })
        res.forEach((r, idx) => {
          if (r.status !== 'success') return
          const info = r.result as { organizer: string }
          if (info.organizer.toLowerCase() === me) mine.push(ids[idx])
        })
      }
      return mine.sort(descending)
    },
  })
}
