/**
 * PointsBadge — แสดง Points ของ wallet ที่ connect อยู่
 * คลิกเพื่อดู breakdown แบบ popover
 */

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { usePoints, POINTS_RULES } from '@/hooks/usePoints'

interface PointsBadgeProps {
  expanded?: boolean
  onToggle?: () => void
}

export function PointsBadge({ expanded, onToggle }: PointsBadgeProps = {}) {
  const { address } = useAccount()
  const { breakdown, loading, lastFetched, refresh } = usePoints(address)
  const [internalOpen, setInternalOpen] = useState(false)

  // Support both controlled (expanded/onToggle) and uncontrolled mode
  const open = expanded !== undefined ? expanded : internalOpen
  const toggle = () => {
    if (onToggle) onToggle()
    else setInternalOpen(v => !v)
  }

  if (!address) return null

  return (
    <div className="relative">
      {/* Badge button */}
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
        <span className="opacity-60 font-normal">pts</span>
      </button>

      {/* Popover */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={toggle}
          />

          {/* Panel */}
          <div
            className="absolute right-0 top-10 z-50 w-72 rounded-2xl shadow-xl p-5 flex flex-col gap-4"
            style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium opacity-50 uppercase tracking-wide">SeatBack Points</div>
                <div className="text-2xl font-bold mt-0.5" style={{ color: 'var(--accent)' }}>
                  {breakdown.total.toLocaleString()}
                  <span className="text-sm font-normal opacity-50 ml-1">pts</span>
                </div>
              </div>
              <button
                onClick={e => { e.stopPropagation(); void refresh() }}
                className="text-xs px-2 py-1 rounded-lg opacity-50 hover:opacity-100 transition-opacity"
                style={{ background: 'var(--surface)' }}
                title="Refresh"
              >
                {loading ? '⟳' : '↻'} Refresh
              </button>
            </div>

            {/* Breakdown */}
            <div className="flex flex-col gap-2">
              <Row
                icon="🎟️"
                label="Events Created"
                count={breakdown.eventCount}
                pts={breakdown.createEvent}
                each={POINTS_RULES.CREATE_EVENT}
              />
              <Row
                icon="📋"
                label="Reservations"
                count={breakdown.reserveCount}
                pts={breakdown.reserve}
                each={POINTS_RULES.RESERVE}
              />
              <Row
                icon="✅"
                label="Check-ins"
                count={breakdown.checkInCount}
                pts={breakdown.checkIn}
                each={POINTS_RULES.CHECK_IN}
              />
            </div>

            {/* Footer */}
            <div className="text-xs opacity-40 flex items-center justify-between pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
              <span>Read from Arc Mainnet</span>
              {lastFetched && (
                <span>{lastFetched.toLocaleTimeString()}</span>
              )}
            </div>

            {/* Airdrop notice */}
            <div
              className="text-xs rounded-xl p-3 leading-relaxed"
              style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}
            >
              Points count toward SBK airdrop snapshot. See Docs → Airdrop for details.
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Row component ────────────────────────────────────────────────────────────

function Row({
  icon, label, count, pts, each,
}: {
  icon: string
  label: string
  count: number
  pts: number
  each: number
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2 opacity-70">
        <span>{icon}</span>
        <span>{label}</span>
        <span className="opacity-50 text-xs">×{count}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="opacity-40 text-xs">+{each}/each</span>
        <span className="font-semibold" style={{ color: pts > 0 ? 'var(--accent)' : undefined }}>
          {pts.toLocaleString()}
        </span>
      </div>
    </div>
  )
}
