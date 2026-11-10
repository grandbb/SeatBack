import { useState, useMemo } from 'react'
import { useEventCount, useEventsBatch } from '@/hooks/useEvents'
import { useReadContracts } from 'wagmi'
import { SEATBACK_ABI, SEATBACK_ADDRESS, ACTIVE_CHAIN_ID, NETWORK_LABEL } from '@/contract'
import { EventCard } from './EventCard'
import { computeEventPhase, type EventPhase } from '@/types'
import { Loader2, CalendarX } from 'lucide-react'

// ─── Filter tab definitions ────────────────────────────────────────────────

type FilterKey = 'all' | EventPhase

interface FilterTab {
  key: FilterKey
  label: string
}

const FILTER_TABS: FilterTab[] = [
  { key: 'all',            label: 'All' },
  { key: 'booking_open',   label: 'Booking Open' },
  { key: 'booking_closed', label: 'Booking Closed' },
  { key: 'check_in_open',  label: 'Check-In Open' },
  { key: 'check_in_closed',label: 'Ended' },
  { key: 'finalized',      label: 'Finalized' },
  { key: 'cancelled',      label: 'Cancelled' },
]

// ─── Component ────────────────────────────────────────────────────────────

interface EventListProps {
  onSelectEvent: (eventId: bigint) => void
}

export function EventList({ onSelectEvent }: EventListProps) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all')

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

  // Build enriched list and per-phase counts for badge display
  const items = useMemo(() => {
    return ids.flatMap((id, i) => {
      const result = eventsData?.[i]
      if (result?.status !== 'success' || !result.result) return []
      const event = result.result
      const seats = seatsData?.[i]?.result
      const phase = computeEventPhase(event)
      return [{ id, event, seats, phase }]
    })
  }, [ids, eventsData, seatsData])

  const phaseCounts = useMemo(() => {
    const counts: Partial<Record<FilterKey, number>> = { all: items.length }
    for (const { phase } of items) {
      counts[phase] = (counts[phase] ?? 0) + 1
    }
    return counts
  }, [items])

  const filtered = useMemo(
    () => activeFilter === 'all' ? items : items.filter(it => it.phase === activeFilter),
    [items, activeFilter]
  )

  if (!SEATBACK_ADDRESS) {
    return (
      <div className="rounded-2xl p-6 text-center" style={{ background: 'var(--warning-bg)', color: 'var(--warning)', border: '1px solid var(--accent-muted)' }}>
        <p className="font-medium">Contract not yet deployed.</p>
        <p className="text-sm mt-1 opacity-80">Deploy SeatBack to {NETWORK_LABEL} to see events here.</p>
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
        <p className="text-sm text-[var(--muted)]">Create the first event using the Create tab.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filter tabs — scrollable on mobile */}
      <div
        className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1"
        style={{ scrollbarWidth: 'none' }}
        role="tablist"
        aria-label="Filter events by status"
      >
        {FILTER_TABS.map(({ key, label }) => {
          const count = phaseCounts[key] ?? 0
          if (key !== 'all' && count === 0) return null // hide tabs with no events
          const isActive = activeFilter === key
          return (
            <button
              key={key}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveFilter(key)}
              className={[
                'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium',
                'border transition-all whitespace-nowrap',
                isActive
                  ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-sm'
                  : 'bg-[var(--surface-strong)] text-[var(--muted)] border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)]',
              ].join(' ')}
            >
              {label}
              <span
                className={[
                  'inline-flex items-center justify-center rounded-full text-[10px] font-semibold',
                  'min-w-[16px] h-4 px-1 leading-none',
                  isActive
                    ? 'bg-white/25 text-white'
                    : 'bg-[var(--border)] text-[var(--muted)]',
                ].join(' ')}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>
      {total > BigInt(ids.length) && (
        <p className="text-xs text-[var(--subtle)]">Showing the newest {ids.length} of {String(total)} events.</p>
      )}

      {/* Event cards */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
          <CalendarX size={32} className="text-[var(--subtle)]" />
          <p className="text-sm text-[var(--muted)]">No events match this filter.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(({ id, event, seats }) => (
            <EventCard
              key={id.toString()}
              eventId={id}
              event={event}
              reservedSeats={seats}
              onClick={() => onSelectEvent(id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
