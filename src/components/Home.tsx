/**
 * Home / Explore page.
 *
 * Explains the three steps, shows real events with status,
 * and offers Create event / Explore events CTAs.
 * Shows truthful empty states when nothing exists.
 */
import { SEATBACK_ADDRESS, ACTIVE_CHAIN_ID } from '@/contract'
import { useEventCount, useEventsBatch } from '@/hooks/useEvents'
import { useReadContracts } from 'wagmi'
import { SEATBACK_ABI } from '@/contract'
import { EventCard } from './EventCard'
import { Logo } from './Logo'
import { Loader2, CalendarX, Ticket, QrCode, Coins } from 'lucide-react'
import type { EventInfo } from '@/types'

interface HomeProps {
  onExplore: () => void
  onCreateEvent: () => void
  onSelectEvent: (id: bigint) => void
}

export function Home({ onExplore, onCreateEvent, onSelectEvent }: HomeProps) {
  const { data: count, isLoading: countLoading } = useEventCount()
  const total = count ?? 0n
  const maxDisplay = 6
  const ids: bigint[] = []
  for (let i = total - 1n; i >= 0n && ids.length < maxDisplay; i--) {
    ids.push(i)
  }

  const { data: eventsData, isLoading: eventsLoading } = useEventsBatch(ids)

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

  return (
    <div className="flex flex-col gap-12">
      {/* Hero */}
      <section className="text-center flex flex-col items-center gap-6 py-8">
        <Logo size="lg" />
        <div>
          <h1
            className="text-4xl font-bold text-[var(--ink)] tracking-tight leading-tight"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Attendance backed<br />by your deposit.
          </h1>
          <p className="mt-3 text-lg text-[var(--muted)] max-w-lg mx-auto">
            Reserve a seat with a USDC deposit. Attend and get it back.
            Cancel in time and get it back. Miss it — the organiser earns it.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 justify-center">
          <button
            onClick={onExplore}
            className="rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-6 py-3 text-sm font-semibold transition-colors"
          >
            Explore Events
          </button>
          <button
            onClick={onCreateEvent}
            className="rounded-xl border border-[var(--border-strong)] text-[var(--ink)] hover:bg-[var(--surface-muted)] px-6 py-3 text-sm font-semibold transition-colors"
          >
            Create an Event
          </button>
        </div>
      </section>

      {/* Three steps */}
      <section>
        <h2
          className="text-xl font-semibold text-[var(--ink)] mb-6 text-center"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          How it works
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StepCard
            icon={<Ticket size={24} className="text-[var(--accent)]" />}
            step="1"
            title="Reserve with USDC"
            body="Pay a refundable deposit to hold your seat. The contract holds it in escrow — no middlemen."
          />
          <StepCard
            icon={<QrCode size={24} className="text-[var(--accent)]" />}
            step="2"
            title="Sign your QR at the event"
            body="On the day, generate a 5-minute QR from your wallet. The organiser scans it to confirm attendance on-chain."
          />
          <StepCard
            icon={<Coins size={24} className="text-[var(--accent)]" />}
            step="3"
            title="Claim your refund"
            body="Attended? Claim your full deposit back. Cancelled on time? Same result. No-show? The deposit goes to the organiser."
          />
        </div>
      </section>

      {/* Deposit notice */}
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-5 text-sm text-[var(--muted)]">
        <p>
          <strong className="text-[var(--ink)]">Before booking:</strong>{' '}
          Your deposit is refundable after organiser-confirmed check-in or cancellation before the stated deadline.
          If you do not check in, the organiser may receive your deposit.
          Network fees are separate and non-refundable.
        </p>
        <p className="mt-2">
          Organiser cancellation: all remaining deposits become fully refundable.
          If the organiser never opens check-in, all deposits become refundable after the window closes.
          These two paths are in addition to the policy above.
        </p>
        <p className="mt-2">
          Attendance is confirmed by the organiser. The contract does not independently prove physical presence or automatically send money without transactions.
        </p>
      </section>

      {/* Recent events */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2
            className="text-xl font-semibold text-[var(--ink)]"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Recent Events
          </h2>
          {total > BigInt(maxDisplay) && (
            <button
              onClick={onExplore}
              className="text-sm text-[var(--accent)] font-medium hover:underline"
            >
              See all →
            </button>
          )}
        </div>

        {!SEATBACK_ADDRESS && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
            <p className="text-amber-800 font-medium">Contract not yet deployed.</p>
            <p className="text-sm text-amber-600 mt-1">Deploy SeatBack to Arc Testnet to see events here.</p>
          </div>
        )}

        {SEATBACK_ADDRESS && isLoading && (
          <div className="flex items-center justify-center py-16 gap-2 text-[var(--muted)]">
            <Loader2 size={20} className="animate-spin" />
            <span>Loading events…</span>
          </div>
        )}

        {SEATBACK_ADDRESS && !isLoading && total === 0n && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
            <CalendarX size={36} className="text-[var(--subtle)]" />
            <p className="font-semibold text-[var(--ink)]">No events yet</p>
            <p className="text-sm text-[var(--muted)]">Create the first event to get started.</p>
            <button
              onClick={onCreateEvent}
              className="mt-1 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-5 py-2.5 text-sm font-semibold transition-colors"
            >
              Create Event
            </button>
          </div>
        )}

        {SEATBACK_ADDRESS && !isLoading && total > 0n && (
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
            {total > BigInt(maxDisplay) && (
              <button
                onClick={onExplore}
                className="rounded-2xl border border-[var(--border)] p-4 text-sm text-[var(--accent)] font-medium text-center hover:bg-[var(--surface-muted)] transition-colors"
              >
                View all {String(total)} events →
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

function StepCard({
  icon,
  step,
  title,
  body,
}: {
  icon: React.ReactNode
  step: string
  title: string
  body: string
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white p-5 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[var(--accent)]/10 flex items-center justify-center text-xs font-bold text-[var(--accent)]">
          {step}
        </div>
        {icon}
      </div>
      <h3 className="font-semibold text-[var(--ink)]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
        {title}
      </h3>
      <p className="text-sm text-[var(--muted)]">{body}</p>
    </div>
  )
}
