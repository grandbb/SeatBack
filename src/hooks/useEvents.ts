import { useReadContract, useReadContracts } from 'wagmi'
import { SEATBACK_ABI, SEATBACK_ADDRESS, ACTIVE_CHAIN_ID } from '@/contract'
import type { EventInfo, EventAccounting } from '@/types'

/** Read the total number of events created */
export function useEventCount() {
  return useReadContract({
    address: SEATBACK_ADDRESS ?? undefined,
    abi: SEATBACK_ABI,
    functionName: 'eventCount',
    chainId: ACTIVE_CHAIN_ID,
    query: { enabled: !!SEATBACK_ADDRESS },
  })
}

/** Read a single event by ID */
export function useEvent(eventId: bigint | null) {
  return useReadContract({
    address: SEATBACK_ADDRESS ?? undefined,
    abi: SEATBACK_ABI,
    functionName: 'getEvent',
    args: eventId !== null ? [eventId] : undefined,
    chainId: ACTIVE_CHAIN_ID,
    query: { enabled: !!SEATBACK_ADDRESS && eventId !== null },
  })
}

/** Read accounting for an event */
export function useEventAccounting(eventId: bigint | null) {
  return useReadContract({
    address: SEATBACK_ADDRESS ?? undefined,
    abi: SEATBACK_ABI,
    functionName: 'getAccounting',
    args: eventId !== null ? [eventId] : undefined,
    chainId: ACTIVE_CHAIN_ID,
    query: { enabled: !!SEATBACK_ADDRESS && eventId !== null },
  })
}

/** Read reserved seat count for an event */
export function useReservedSeats(eventId: bigint | null) {
  return useReadContract({
    address: SEATBACK_ADDRESS ?? undefined,
    abi: SEATBACK_ABI,
    functionName: 'reservedSeats',
    args: eventId !== null ? [eventId] : undefined,
    chainId: ACTIVE_CHAIN_ID,
    query: { enabled: !!SEATBACK_ADDRESS && eventId !== null },
  })
}

/** Load multiple events at once */
export function useEventsBatch(ids: bigint[]) {
  return useReadContracts({
    contracts: ids.map((id) => ({
      address: (SEATBACK_ADDRESS ?? undefined),
      abi: SEATBACK_ABI,
      functionName: 'getEvent' as const,
      args: [id] as const,
      chainId: ACTIVE_CHAIN_ID,
    })),
    query: { enabled: !!SEATBACK_ADDRESS && ids.length > 0 },
  })
}

/** Get the active reservation ID for a wallet on an event (0n = none) */
export function useActiveReservationId(eventId: bigint | null, attendee: `0x${string}` | undefined) {
  return useReadContract({
    address: SEATBACK_ADDRESS ?? undefined,
    abi: SEATBACK_ABI,
    functionName: 'getActiveReservation',
    args: eventId !== null && attendee ? [eventId, attendee] : undefined,
    chainId: ACTIVE_CHAIN_ID,
    query: { enabled: !!SEATBACK_ADDRESS && eventId !== null && !!attendee },
  })
}

/** Get a reservation by ID */
export function useReservation(reservationId: bigint | null) {
  return useReadContract({
    address: SEATBACK_ADDRESS ?? undefined,
    abi: SEATBACK_ABI,
    functionName: 'getReservation',
    args: reservationId !== null ? [reservationId] : undefined,
    chainId: ACTIVE_CHAIN_ID,
    query: { enabled: !!SEATBACK_ADDRESS && reservationId !== null && reservationId > 0n },
  })
}

// Re-export types for consumers
export type { EventInfo, EventAccounting }
