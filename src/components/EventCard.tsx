import { useState } from 'react'
import { MapPin, Clock, Users, Ticket, Share2, Check } from 'lucide-react'
import { formatUsdc, formatDateTime, countdown } from '@/utils/format'
import type { EventInfo } from '@/types'
import { computeEventPhase } from '@/types'
import { buildEventUrl } from '@/App'

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

export function EventCard({ eventId, event, reservedSeats, onClick }: EventCardProps) {
  const phase = computeEventPhase(event)
  const badge = PHASE_BADGE[phase]
  const seatsLeft = event.capacity - (reservedSeats ?? 0)
  const bookingOpen = phase === 'booking_open'
  const [copied, setCopied] = useState(false)

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation() // don't open event detail
    const url = buildEventUrl(eventId)
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

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
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-xs font-medium px-2 py-1 rounded-full border ${badge.className}`}>
            {badge.label}
          </span>
          <button
            onClick={handleShare}
            title={copied ? 'Link copied!' : 'Copy share link'}
            aria-label="Copy share link"
            className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--surface-muted)] transition-colors"
          >
            {copied ? <Check size={14} className="text-teal-600" /> : <Share2 size={14} />}
          </button>
        </div>
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
