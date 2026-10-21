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

import { Loader2, CalendarX, Ticket, QrCode, Coins } from 'lucide-react'


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
    <div className="flex flex-col gap-14">
      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="relative text-center flex flex-col items-center gap-8 pt-12 pb-6 overflow-hidden">
        {/* background blobs */}
        <div className="hero-blob w-80 h-80 -top-20 -left-20" style={{ background: 'var(--accent)', opacity: 0.12 }} />
        <div className="hero-blob w-64 h-64 top-10 right-0" style={{ background: '#6EE7D8', opacity: 0.15 }} />

        {/* Logo mark — large */}
        <div className="relative z-10">
          <img
            src="/logo.svg"
            alt="SeatBack"
            width={96}
            height={96}
            style={{
              width: 96, height: 96,
              filter: 'drop-shadow(0 8px 24px rgba(29,171,142,0.25))',
            }}
          />
        </div>

        <div className="relative z-10 flex flex-col items-center gap-3 max-w-xl mx-auto px-2">
          <h1
            className="text-4xl sm:text-5xl font-bold text-[var(--ink)] leading-tight text-balance"
            style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.03em' }}
          >
            Attendance backed<br className="hidden sm:block" /> by your deposit.
          </h1>
          <p className="text-lg text-[var(--muted)] text-pretty max-w-md">
            Reserve a seat with USDC. Attend and get it back.
            Cancel in time — same result. Miss it and the organiser earns it.
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap gap-3 justify-center">
          <button onClick={onExplore} className="btn-primary px-7 py-3 text-base">
            Explore Events
          </button>
          <button onClick={onCreateEvent} className="btn-ghost px-7 py-3 text-base">
            Create an Event
          </button>
        </div>

        {/* Stats strip */}
        <div className="relative z-10 flex items-center gap-6 pt-2 text-sm text-[var(--muted)]">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
            On-chain escrow
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
            EIP-712 QR check-in
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
            Instant refunds
          </span>
        </div>
      </section>

      {/* ── Three steps ───────────────────────────────────────── */}
      <section>
        <h2
          className="text-xl font-semibold text-[var(--ink)] mb-6 text-center"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          How it works
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StepCard
            icon={<Ticket size={22} className="text-[var(--accent)]" />}
            step="1"
            title="Reserve with USDC"
            body="Pay a refundable deposit to hold your seat. The contract holds it in escrow — no middlemen."
          />
          <StepCard
            icon={<QrCode size={22} className="text-[var(--accent)]" />}
            step="2"
            title="Sign your QR at the door"
            body="Generate a 10-minute signed QR from your wallet. The organiser scans it to confirm attendance on-chain."
          />
          <StepCard
            icon={<Coins size={22} className="text-[var(--accent)]" />}
            step="3"
            title="Claim your refund"
            body="Attended or cancelled on time? Claim your full deposit back. No-show? The deposit goes to the organiser."
          />
        </div>
      </section>

      {/* ── Deposit notice ────────────────────────────────────── */}
      <section
        className="rounded-2xl p-5 text-sm text-[var(--muted)]"
        style={{
          background: 'linear-gradient(135deg, rgba(29,171,142,0.07) 0%, rgba(110,231,216,0.07) 100%)',
          border: '1px solid rgba(29,171,142,0.18)',
        }}
      >
        <p className="font-semibold text-[var(--ink)] mb-2">Before booking</p>
        <p>
          Your deposit is refundable after organiser-confirmed check-in or cancellation before the stated deadline.
          If you do not check in, the organiser may receive your deposit.
          Network fees are separate and non-refundable.
        </p>
        <ul className="mt-2 ml-4 list-disc space-y-1">
          <li>Organiser cancels: all remaining deposits become fully refundable.</li>
          <li>Organiser never opens check-in: all deposits refundable after window closes.</li>
          <li>Attendance is confirmed by the organiser — not by the contract independently.</li>
        </ul>
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
          <div className="rounded-2xl p-6 text-center" style={{ background: 'var(--warning-bg)', color: 'var(--warning)', border: '1px solid var(--accent-muted)' }}>
            <p className="font-medium">Contract not yet deployed.</p>
            <p className="text-sm mt-1 opacity-80">Deploy SeatBack to Arc Mainnet to see events here.</p>
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
              const event = result.result
              const seats = seatsData?.[i]?.result
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
    <div
      className="card-strong rounded-2xl p-6 flex flex-col gap-4 hover:shadow-[var(--shadow-md)] transition-shadow"
    >
      <div className="flex items-center gap-3">
        {/* Step badge */}
        <span
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
          style={{ background: 'var(--accent)' }}
        >
          {step}
        </span>
        {/* Icon in soft teal circle */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'var(--accent-light)' }}
        >
          {icon}
        </div>
      </div>
      <h3
        className="font-semibold text-[var(--ink)] text-base"
        style={{ fontFamily: "'Space Grotesk', sans-serif" }}
      >
        {title}
      </h3>
      <p className="text-sm text-[var(--muted)] leading-relaxed">{body}</p>
    </div>
  )
}
