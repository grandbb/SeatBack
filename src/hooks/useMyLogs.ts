/**
 * Log-based discovery of a wallet's own records.
 *
 * The contract clears `activeReservationId` after a cancel or a check-in, and the
 * event list only shows the newest events, so neither can be used to find every
 * reservation or every event a wallet owns. Indexed event logs can.
 */
import { useQuery } from '@tanstack/react-query'
import { usePublicClient } from 'wagmi'
import { parseAbiItem } from 'viem'
import { SEATBACK_ADDRESS, ACTIVE_CHAIN_ID, DEPLOY_BLOCK } from '@/contract'

const RESERVED = parseAbiItem(
  'event Reserved(uint256 indexed eventId, uint256 indexed reservationId, address indexed attendee, uint256 depositAmount)',
)
const EVENT_CREATED = parseAbiItem(
  'event EventCreated(uint256 indexed eventId, address indexed organizer, address payoutWallet, uint256 depositAmount, uint256 capacity, uint256 bookingClose, uint256 refundCutoff, uint256 checkInStart, uint256 checkInEnd)',
)

const CHECKED_IN = parseAbiItem(
  'event CheckedIn(uint256 indexed eventId, uint256 indexed reservationId, address indexed attendee)',
)

const descending = (a: bigint, b: bigint) => (a < b ? 1 : a > b ? -1 : 0)

/** All reservation ids ever made by `attendee` (optionally for a single event), newest first. */
export function useMyReservationIds(attendee: `0x${string}` | undefined, eventId?: bigint) {
  const client = usePublicClient({ chainId: ACTIVE_CHAIN_ID })
  return useQuery({
    queryKey: ['myReservationIds', SEATBACK_ADDRESS, attendee, eventId?.toString() ?? 'all'],
    enabled: !!client && !!attendee && !!SEATBACK_ADDRESS,
    refetchInterval: 30_000,
    queryFn: async (): Promise<bigint[]> => {
      if (!client || !attendee || !SEATBACK_ADDRESS) return []
      const logs = await client.getLogs({
        address: SEATBACK_ADDRESS,
        event: RESERVED,
        args: eventId === undefined ? { attendee } : { attendee, eventId },
        fromBlock: DEPLOY_BLOCK,
        toBlock: 'latest',
      })
      const ids = new Set<bigint>()
      for (const l of logs) {
        if (l.args.reservationId !== undefined) ids.add(l.args.reservationId)
      }
      return Array.from(ids).sort(descending)
    },
  })
}

/** All event ids created by `organizer`, newest first. */
export function useMyOrganizedEventIds(organizer: `0x${string}` | undefined) {
  const client = usePublicClient({ chainId: ACTIVE_CHAIN_ID })
  return useQuery({
    queryKey: ['myOrganizedEventIds', SEATBACK_ADDRESS, organizer],
    enabled: !!client && !!organizer && !!SEATBACK_ADDRESS,
    refetchInterval: 30_000,
    queryFn: async (): Promise<bigint[]> => {
      if (!client || !organizer || !SEATBACK_ADDRESS) return []
      const logs = await client.getLogs({
        address: SEATBACK_ADDRESS,
        event: EVENT_CREATED,
        args: { organizer },
        fromBlock: DEPLOY_BLOCK,
        toBlock: 'latest',
      })
      const ids = new Set<bigint>()
      for (const l of logs) {
        if (l.args.eventId !== undefined) ids.add(l.args.eventId)
      }
      return Array.from(ids).sort(descending)
    },
  })
}

/** Reservation ids of `attendee` that were actually checked in by an organiser. */
export function useMyCheckedInReservationIds(attendee: `0x${string}` | undefined) {
  const client = usePublicClient({ chainId: ACTIVE_CHAIN_ID })
  return useQuery({
    queryKey: ['myCheckedInReservationIds', SEATBACK_ADDRESS, attendee],
    enabled: !!client && !!attendee && !!SEATBACK_ADDRESS,
    refetchInterval: 30_000,
    queryFn: async (): Promise<bigint[]> => {
      if (!client || !attendee || !SEATBACK_ADDRESS) return []
      const logs = await client.getLogs({
        address: SEATBACK_ADDRESS,
        event: CHECKED_IN,
        args: { attendee },
        fromBlock: DEPLOY_BLOCK,
        toBlock: 'latest',
      })
      const ids = new Set<bigint>()
      for (const l of logs) {
        if (l.args.reservationId !== undefined) ids.add(l.args.reservationId)
      }
      return Array.from(ids)
    },
  })
}
