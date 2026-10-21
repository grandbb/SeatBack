import { useAccount, useDisconnect } from 'wagmi'
import { useModal } from 'connectkit'
import { useState, useRef, useEffect } from 'react'
import { LogOut, Star, RefreshCw } from 'lucide-react'
import { usePoints, POINTS_RULES, MIN_CHECKED_IN_FOR_ORGANISER, MAX_POINTS_PER_WALLET } from '@/hooks/usePoints'

export function WalletMenu() {
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const { setOpen } = useModal()
  const [open, setMenuOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { breakdown, loading, lastFetched, refresh } = usePoints(address)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (!isConnected || !address) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="btn-primary px-4 py-2 text-sm font-semibold rounded-xl"
      >
        Connect Wallet
      </button>
    )
  }

  const short = `${address.slice(0, 6)}…${address.slice(-4)}`
  const hasPending = breakdown.pending > 0
  const nearCap = breakdown.total >= MAX_POINTS_PER_WALLET * 0.9

  return (
    <div ref={ref} className="relative">
      {/* Wallet button */}
      <button
        onClick={() => setMenuOpen(v => !v)}
        className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all"
        style={{
          background: 'var(--surface-strong)',
          border: '1px solid var(--border)',
          color: 'var(--ink)',
        }}
      >
        <span
          className="w-5 h-5 rounded-full flex-shrink-0"
          style={{ background: `hsl(${parseInt(address.slice(2, 8), 16) % 360},60%,55%)` }}
        />
        <span className="hidden sm:inline">{short}</span>
        <span
          className="flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full"
          style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}
        >
          <Star size={10} strokeWidth={2.5} />
          {loading && breakdown.total === 0 ? '…' : breakdown.total.toLocaleString()}
        </span>
        <svg
          className={`w-3.5 h-3.5 opacity-40 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"
        >
          <path d="M2 4l4 4 4-4" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute right-0 top-12 z-50 w-80 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{
            background: 'var(--surface-strong)',
            border: '1px solid var(--border-strong)',
          }}
        >
          {/* Wallet info */}
          <div className="px-5 pt-5 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3">
              <span
                className="w-9 h-9 rounded-full flex-shrink-0"
                style={{ background: `hsl(${parseInt(address.slice(2, 8), 16) % 360},60%,55%)` }}
              />
              <div>
                <div className="text-xs opacity-40 font-medium uppercase tracking-wide">Connected wallet</div>
                <div className="font-mono text-sm font-semibold" style={{ color: 'var(--ink)' }}>{short}</div>
              </div>
            </div>
          </div>

          {/* Points section */}
          <div className="px-5 py-4 flex flex-col gap-3">
            {/* Total + refresh */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs opacity-40 font-semibold uppercase tracking-wide mb-0.5">SeatBack Points</div>
                <div className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>
                  {breakdown.total.toLocaleString()}
                  <span className="text-sm font-normal opacity-40 ml-1">pts confirmed</span>
                </div>
                {hasPending && (
                  <div className="text-xs opacity-50 mt-0.5">
                    +{breakdown.pending.toLocaleString()} pts pending (events not yet finalised)
                  </div>
                )}
              </div>
              <button
                onClick={e => { e.stopPropagation(); void refresh() }}
                disabled={loading}
                className="w-8 h-8 rounded-xl flex items-center justify-center transition-opacity"
                style={{ background: 'var(--surface-muted)', opacity: loading ? 0.4 : 1 }}
                title="Refresh points"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} style={{ color: 'var(--muted)' }} />
              </button>
            </div>

            {/* Suspicious flag */}
            {breakdown.suspiciousFlag && (
              <div
                className="text-xs rounded-xl p-3 leading-relaxed"
                style={{
                  background: 'var(--warning-bg)',
                  color: 'var(--warning)',
                  border: '1px solid var(--warning-bg)',
                }}
              >
                ⚠️ Repeated reservations detected — points may be reviewed before snapshot.
              </div>
            )}

            {/* Cap warning */}
            {nearCap && (
              <div
                className="text-xs rounded-xl p-3"
                style={{
                  background: 'var(--danger-bg)',
                  color: 'var(--danger)',
                  border: '1px solid var(--danger-bg)',
                }}
              >
                Approaching the {MAX_POINTS_PER_WALLET.toLocaleString()} pts per-wallet cap.
              </div>
            )}

            {/* Breakdown */}
            <div
              className="flex flex-col gap-2 rounded-xl p-3"
              style={{ background: 'var(--surface-muted)' }}
            >
              <BreakdownRow
                icon="🎟️"
                label={`Create event (≥${MIN_CHECKED_IN_FOR_ORGANISER} check-ins)`}
                count={breakdown.eventCount}
                pts={breakdown.createEvent}
                each={POINTS_RULES.CREATE_EVENT}
              />
              <div className="border-t" style={{ borderColor: 'var(--border)' }} />
              <BreakdownRow
                icon="📋"
                label="Reserve seat (finalised + attended)"
                count={breakdown.reserveCount}
                pts={breakdown.reserve}
                each={POINTS_RULES.RESERVE}
              />
              <div className="border-t" style={{ borderColor: 'var(--border)' }} />
              <BreakdownRow
                icon="✅"
                label="Check-in (finalised event)"
                count={breakdown.checkInCount}
                pts={breakdown.checkIn}
                each={POINTS_RULES.CHECK_IN}
              />
            </div>

            {/* Footer */}
            <div
              className="text-xs opacity-30 flex justify-between pt-1 border-t"
              style={{ borderColor: 'var(--border)' }}
            >
              <span>Read from Arc Mainnet · no gas</span>
              {lastFetched && <span>Updated {lastFetched.toLocaleTimeString()}</span>}
            </div>
          </div>

          {/* Sign out */}
          <div className="px-4 pb-4">
            <button
              onClick={() => { disconnect(); setMenuOpen(false) }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              style={{
                background: 'var(--danger-bg)',
                color: 'var(--danger)',
                border: '1px solid var(--danger-bg)',
              }}
            >
              <LogOut size={15} />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function BreakdownRow({ icon, label, count, pts, each }: {
  icon: string; label: string; count: number; pts: number; each: number
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2">
        <span className="text-base">{icon}</span>
        <div>
          <div className="font-medium text-xs leading-tight" style={{ color: 'var(--ink)' }}>{label}</div>
          <div className="text-xs opacity-40">{count} × {each} pts each</div>
        </div>
      </div>
      <div className="font-bold tabular-nums text-sm" style={{ color: 'var(--accent)' }}>
        {pts > 0 ? pts.toLocaleString() : <span className="opacity-30">0</span>}
      </div>
    </div>
  )
}
