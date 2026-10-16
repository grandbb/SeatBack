import { useEventCount, useEventsBatch } from '@/hooks/useEvents'
import { useReadContracts } from 'wagmi'
import { SEATBACK_ABI, SEATBACK_ADDRESS, ACTIVE_CHAIN_ID, NETWORK_LABEL } from '@/contract'
import { EventCard } from './EventCard'
import { Loader2, CalendarX } from 'lucide-react'
import type { EventInfo } from '@/types'

interface EventListProps {
  onSelectEvent: (eventId: bigint) => void
}

export function EventList({ onSelectEvent }: EventListProps) {
  const { data: count, isLoading: countLoading } = useEventCount()

  // Build array of IDs to load (reverse order: newest first, max 50)
  const total = count ?? 0n
  const limit = 50n
  const start = total > limit ? total - limit : 0n
  const ids: bigint[] = []
  for (let i = total - 1n; i >= start; i--) {
    ids.push(i)
    if (ids.length >= 50) break
  }

  const { data: eventsData, isLoading: eventsLoading } = useEventsBatch(ids)

  // Load reserved seat counts
  const { data: seatsData } = useReadContracts({
    contracts: ids.map((id) => ({
      address: (SEATBACK_ADDRESS ?? undefined),
      abi: SEATBACK_ABI,
      functionName: 'reservedSeats' as const,
      args: [id] as const,
      chainId: ACTIVE_CHAIN_ID,
    })),
    query: { enabled: !!SEATBACK_ADDRESS && ids.length > 0 },
  })

  const isLoading = countLoading || eventsLoading

  if (!SEATBACK_ADDRESS) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
        <p className="text-amber-800 font-medium">Contract not yet deployed.</p>
        <p className="text-sm text-amber-600 mt-1">Deploy SeatBack to {NETWORK_LABEL} to see events here.</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-[var(--muted)]">
        <Loader2 size={20} className="animate-spin" />
        <span>Loading events…</span>
      </div>
    )
  }

  if (!count || count === 0n) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <CalendarX size={40} className="text-[var(--subtle)]" />
        <p className="font-semibold text-[var(--ink)]">No events yet</p>
        <p className="text-sm text-[var(--muted)]">Create the first event using the Create Event tab.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {ids.map((id, i) => {
        const result = eventsData?.[i]
        if (result?.status !== 'success' || !result.result) return null
        const event = result.result as EventInfo
        const seats = seatsData?.[i]?.result as number | undefined
        return (
          <EventCard
            key={id.toString()}
            eventId={id}
            event={event}
            reservedSeats={seats}
            onClick={() => onSelectEvent(id)}
          />
        )
      })}
    </div>
  )
}
