import { MapPin, Clock, Users, Ticket } from 'lucide-react'
import { formatUsdc, formatDateTime, countdown } from '@/utils/format'
import type { EventInfo } from '@/types'
import { computeEventPhase } from '@/types'

interface EventCardProps {
  eventId: bigint
  event: EventInfo
  reservedSeats?: number
  onClick?: () => void
}

const PHASE_BADGE: Record<string, { label: string; className: string }> = {
  booking_open: { label: 'Booking Open', className: 'bg-teal-50 text-teal-700 border-teal-200' },
  booking_closed: { label: 'Booking Closed', className: 'badge-navy' },
  check_in_open: { label: 'Check-In Open', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  check_in_closed: { label: 'Ended', className: 'badge-navy' },
  finalized: { label: 'Finalized', className: 'badge-navy' },
  cancelled: { label: 'Cancelled', className: 'bg-red-50 text-red-600 border-red-200' },
}

export function EventCard({ eventId: _eventId, event, reservedSeats, onClick }: EventCardProps) {
  const phase = computeEventPhase(event)
  const badge = PHASE_BADGE[phase]
  const seatsLeft = event.capacity - (reservedSeats ?? 0)
  const bookingOpen = phase === 'booking_open'

  return (
    <article
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      className={`rounded-2xl border border-[var(--border)] p-5 flex flex-col gap-3 transition-shadow ${
        onClick ? 'cursor-pointer hover:shadow-md hover:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--focus)]' : ''
      }`}
      style={{ background: 'var(--surface-strong)' }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3
            className="display font-semibold text-[var(--ink)] text-lg leading-tight truncate"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {event.title}
          </h3>
          <p className="text-sm text-[var(--muted)] mt-0.5 line-clamp-2">{event.description}</p>
        </div>
        <span
          className={`flex-shrink-0 text-xs font-medium px-2 py-1 rounded-full border ${badge.className}`}
        >
          {badge.label}
        </span>
      </div>

      {/* Details */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-[var(--muted)]">
        <span className="flex items-center gap-1.5">
          <Clock size={14} />
          {formatDateTime(event.eventStart)}
        </span>
        <span className="flex items-center gap-1.5">
          <MapPin size={14} />
          {event.venue}
        </span>
      </div>

      {/* Footer row */}
      <div className="flex items-center justify-between pt-1 border-t border-[var(--border)]">
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5 text-[var(--ink)] font-semibold tabular-nums">
            <Ticket size={14} className="text-[var(--accent)]" />
            {formatUsdc(event.depositAmount)} USDC
          </span>
          <span className="flex items-center gap-1.5 text-[var(--muted)]">
            <Users size={14} />
            {seatsLeft} / {event.capacity} seats left
          </span>
        </div>
        {bookingOpen && (
          <span className="text-xs text-[var(--accent)] font-medium">
            {countdown(event.bookingClose)}
          </span>
        )}
      </div>
    </article>
  )
}
