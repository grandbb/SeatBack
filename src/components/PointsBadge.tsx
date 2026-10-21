/**
 * PointsBadge — แสดง Points ของ wallet ที่ connect อยู่
 * แยก confirmed vs pending + suspicious flag
 */

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
        {hasPending && (
          <span className="text-xs opacity-60 font-normal">
            +{breakdown.pending.toLocaleString()} pending
          </span>
        )}
        <span className="opacity-60 font-normal">pts</span>
      </button>

      {/* Popover */}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={toggle} />

          <div
            className="absolute right-0 top-10 z-50 w-80 rounded-2xl shadow-xl p-5 flex flex-col gap-4"
            style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium opacity-50 uppercase tracking-wide">SeatBack Points</div>
                <div className="text-2xl font-bold mt-0.5" style={{ color: 'var(--accent)' }}>
                  {breakdown.total.toLocaleString()}
                  <span className="text-sm font-normal opacity-50 ml-1">pts confirmed</span>
                </div>
                {hasPending && (
                  <div className="text-sm opacity-60 mt-0.5">
                    +{breakdown.pending.toLocaleString()} pts รอตรวจสอบ
                  </div>
                )}
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

            {/* Suspicious flag */}
            {breakdown.suspiciousFlag && (
              <div
                className="text-xs rounded-xl p-3 leading-relaxed"
                style={{ background: 'rgba(234,179,8,0.1)', color: '#ca8a04', border: '1px solid rgba(234,179,8,0.3)' }}
              >
                ⚠️ พบรูปแบบการจองซ้ำผิดปกติ Points อาจถูกตรวจสอบเพิ่มเติมก่อน snapshot
              </div>
            )}

            {/* Confirmed breakdown */}
            <div>
              <div className="text-xs font-semibold opacity-50 uppercase tracking-wide mb-2">Confirmed</div>
              <div className="flex flex-col gap-2">
                <Row
                  icon="🎟️"
                  label={`Events (≥${MIN_CHECKED_IN_FOR_ORGANISER} check-in)`}
                  count={breakdown.eventCount}
                  pts={breakdown.createEvent}
                  each={POINTS_RULES.CREATE_EVENT}
                />
                <Row
                  icon="📋"
                  label="Reservations (งานจบ + มา)"
                  count={breakdown.reserveCount}
                  pts={breakdown.reserve}
                  each={POINTS_RULES.RESERVE}
                />
                <Row
                  icon="✅"
                  label="Check-ins (งานจบ)"
                  count={breakdown.checkInCount}
                  pts={breakdown.checkIn}
                  each={POINTS_RULES.CHECK_IN}
                />
              </div>
            </div>

            {/* Pending breakdown */}
            {hasPending && (
              <div>
                <div className="text-xs font-semibold opacity-50 uppercase tracking-wide mb-2">รอตรวจสอบ (งานยังไม่จบ)</div>
                <div className="text-sm opacity-60 rounded-xl p-3" style={{ background: 'var(--surface)' }}>
                  {breakdown.pendingEvents > 0 && (
                    <div>🕐 งานที่รอจบ: {breakdown.pendingEvents} งาน ({breakdown.pending.toLocaleString()} pts)</div>
                  )}
                  <div className="text-xs mt-1 opacity-70">Points จะ confirmed เมื่องานสิ้นสุดและผ่านเกณฑ์</div>
                </div>
              </div>
            )}

            {/* Cap notice */}
            {breakdown.total >= MAX_POINTS_PER_WALLET * 0.9 && (
              <div
                className="text-xs rounded-xl p-3"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#dc2626' }}
              >
                ใกล้ถึงเพดาน {MAX_POINTS_PER_WALLET.toLocaleString()} pts ต่อ wallet
              </div>
            )}

            {/* Footer */}
            <div className="text-xs opacity-40 flex items-center justify-between pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
              <span>Read from Arc Mainnet · ไม่ใช้ gas</span>
              {lastFetched && <span>{lastFetched.toLocaleTimeString()}</span>}
            </div>

            {/* Airdrop notice */}
            <div
              className="text-xs rounded-xl p-3 leading-relaxed"
              style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}
            >
              Points นับรวมใน SBK airdrop snapshot — ดูกติกาทั้งหมดที่ Docs → Points
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Row component ────────────────────────────────────────────────────────────

function Row({ icon, label, count, pts, each }: {
  icon: string
  label: string
  count: number
  pts: number
  each: number
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2">
        <span>{icon}</span>
        <div>
          <div className="font-medium leading-tight">{label}</div>
          <div className="text-xs opacity-50">{count} × {each} pts</div>
        </div>
      </div>
      <div className="font-semibold tabular-nums" style={{ color: 'var(--accent)' }}>
        {pts.toLocaleString()}
      </div>
    </div>
  )
}
