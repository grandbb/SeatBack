import { useState } from 'react'
import { useAccount } from 'wagmi'
import { usePoints, POINTS_RULES, MIN_CHECKED_IN_FOR_ORGANISER, MAX_POINTS_PER_WALLET } from '@/hooks/usePoints'

interface PointsBadgeProps {
  expanded?: boolean
  onToggle?: () => void
}

export function PointsBadge({ expanded, onToggle }: PointsBadgeProps = {}) {
  const { address } = useAccount()
  const { breakdown, loading, lastFetched, refresh } = usePoints(address)
  const [internalOpen, setInternalOpen] = useState(false)

  const open = expanded !== undefined ? expanded : internalOpen
  const toggle = () => {
    if (onToggle) onToggle()
    else setInternalOpen(v => !v)
  }

  if (!address) return null

  const hasPending = breakdown.pending > 0

  return (
    <div className="relative">
      <button
        onClick={toggle}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-all"
        style={{
          background: 'var(--accent-muted)',
          color: 'var(--accent)',
          border: '1px solid var(--accent)',
        }}
        title="SeatBack Points"
      >
        <span>⭐</span>
        <span>{loading && breakdown.total === 0 ? '…' : breakdown.total.toLocaleString()}</span>
        {hasPending && (
          <span className="text-xs opacity-60 font-normal">
            +{breakdown.pending.toLocaleString()} pending
          </span>
        )}
        <span className="opacity-60 font-normal">pts</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={toggle} />
          <div
            className="absolute right-0 top-10 z-50 w-80 rounded-2xl shadow-xl p-5 flex flex-col gap-4"
            style={{ background: 'var(--surface-strong)', border: '1px solid var(--border-strong)' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium opacity-50 uppercase tracking-wide">SeatBack Points</div>
                <div className="text-2xl font-bold mt-0.5" style={{ color: 'var(--accent)' }}>
                  {breakdown.total.toLocaleString()}
                  <span className="text-sm font-normal opacity-50 ml-1">pts confirmed</span>
                </div>
                {hasPending && (
                  <div className="text-sm opacity-60 mt-0.5">
                    +{breakdown.pending.toLocaleString()} pts pending (events not yet finalised)
                  </div>
                )}
              </div>
              <button
                onClick={e => { e.stopPropagation(); void refresh() }}
                className="text-xs px-2 py-1 rounded-lg opacity-50 hover:opacity-100 transition-opacity"
                style={{ background: 'var(--surface-muted)', color: 'var(--ink)' }}
                title="Refresh"
              >
                {loading ? '⟳' : '↻'} Refresh
              </button>
            </div>

            {breakdown.suspiciousFlag && (
              <div
                className="text-xs rounded-xl p-3 leading-relaxed"
                style={{ background: 'var(--warning-bg)', color: 'var(--warning)', border: '1px solid var(--warning-bg)' }}
              >
                ⚠️ Repeated reservation pattern detected. Points may be reviewed before snapshot.
              </div>
            )}

            <div>
              <div className="text-xs font-semibold opacity-50 uppercase tracking-wide mb-2">Confirmed</div>
              <div className="flex flex-col gap-2">
                <Row
                  icon="🎟️"
                  label={`Events created (≥${MIN_CHECKED_IN_FOR_ORGANISER} check-ins)`}
                  count={breakdown.eventCount}
                  pts={breakdown.createEvent}
                  each={POINTS_RULES.CREATE_EVENT}
                />
                <Row
                  icon="📋"
                  label="Reservations (finalised + attended)"
                  count={breakdown.reserveCount}
                  pts={breakdown.reserve}
                  each={POINTS_RULES.RESERVE}
                />
                <Row
                  icon="✅"
                  label="Check-ins (finalised event)"
                  count={breakdown.checkInCount}
                  pts={breakdown.checkIn}
                  each={POINTS_RULES.CHECK_IN}
                />
              </div>
            </div>

            {hasPending && (
              <div>
                <div className="text-xs font-semibold opacity-50 uppercase tracking-wide mb-2">Pending (events not yet closed)</div>
                <div className="text-sm opacity-60 rounded-xl p-3" style={{ background: 'var(--surface-muted)' }}>
                  {breakdown.pendingEvents > 0 && (
                    <div>🕐 Waiting on {breakdown.pendingEvents} event{breakdown.pendingEvents > 1 ? 's' : ''} ({breakdown.pending.toLocaleString()} pts)</div>
                  )}
                  <div className="text-xs mt-1 opacity-70">Points confirmed once the event finalises and passes criteria.</div>
                </div>
              </div>
            )}

            {breakdown.total >= MAX_POINTS_PER_WALLET * 0.9 && (
              <div
                className="text-xs rounded-xl p-3"
                style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}
              >
                Approaching the {MAX_POINTS_PER_WALLET.toLocaleString()} pts per-wallet cap.
              </div>
            )}

            <div className="text-xs opacity-40 flex items-center justify-between pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
              <span>Read from Arc Mainnet · no gas</span>
              {lastFetched && <span>{lastFetched.toLocaleTimeString()}</span>}
            </div>

            <div
              className="text-xs rounded-xl p-3 leading-relaxed"
              style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}
            >
              Points count toward the SBK airdrop snapshot. See Docs → Points for full rules.
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Row({ icon, label, count, pts, each }: {
  icon: string; label: string; count: number; pts: number; each: number
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2">
        <span>{icon}</span>
        <div>
          <div className="font-medium leading-tight" style={{ color: 'var(--ink)' }}>{label}</div>
          <div className="text-xs opacity-50">{count} × {each} pts</div>
        </div>
      </div>
      <div className="font-semibold tabular-nums" style={{ color: 'var(--accent)' }}>
        {pts.toLocaleString()}
      </div>
    </div>
  )
}
