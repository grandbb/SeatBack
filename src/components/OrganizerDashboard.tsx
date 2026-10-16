/**
 * Organizer Dashboard — shows events where msg.sender is organizer.
 * Allows: openCheckIn, checkIn via QR scanner, checkIn via address, cancelEvent,
 *         withdrawNoShowProceeds, finalizeEvent.
 */
import { useState } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi'
import { XCircle, AlertTriangle, ChevronDown, ChevronUp, Loader2, QrCode } from 'lucide-react'
import { SEATBACK_ABI, SEATBACK_ADDRESS, ACTIVE_CHAIN_ID, NETWORK_LABEL } from '@/contract'
import { useEventCount, useEventsBatch } from '@/hooks/useEvents'
import { useReadContracts } from 'wagmi'
import { formatUsdc, formatDateTime, parseOnchainError, shortAddress } from '@/utils/format'
import { computeEventPhase } from '@/types'
import type { EventInfo } from '@/types'
import { TxButton } from './TxButton'
import { QRScanner } from './QRScanner'
import { toast } from 'sonner'

export function OrganizerDashboard() {
  const { address, chainId, isConnected } = useAccount()
  const { switchChain } = useSwitchChain()
  const wrongChain = isConnected && chainId !== ACTIVE_CHAIN_ID

  const { data: count, isLoading: countLoading } = useEventCount()
  const total = count ?? 0n
  const limit = 50n
  const start = total > limit ? total - limit : 0n
  const ids: bigint[] = []
  for (let i = total - 1n; i >= start; i--) {
    ids.push(i)
    if (ids.length >= 50) break
  }

  const { data: eventsData, isLoading: eventsLoading } = useEventsBatch(ids)

  // Filter to only events where organizer === address
  const myEventIds = ids.filter((id, i) => {
    const r = eventsData?.[i]
    if (r?.status !== 'success' || !r.result) return false
    return (r.result as EventInfo).organizer.toLowerCase() === address?.toLowerCase()
  })

  const myEvents = myEventIds.map((id) => {
    const idx = ids.indexOf(id)
    const r = eventsData?.[idx]
    return { id, event: r?.result as EventInfo }
  })

  if (!isConnected) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-8 text-center">
        <p className="text-[var(--muted)]">Connect your wallet to see your events.</p>
      </div>
    )
  }

  if (countLoading || eventsLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-[var(--muted)]">
        <Loader2 size={20} className="animate-spin" />
        Loading your events…
      </div>
    )
  }

  if (myEvents.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-8 text-center flex flex-col gap-2">
        <p className="font-semibold text-[var(--ink)]">No events found</p>
        <p className="text-sm text-[var(--muted)]">Events you create will appear here.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {myEvents.map(({ id, event }) => (
        <OrganizerEventPanel
          key={id.toString()}
          eventId={id}
          event={event}
          wrongChain={wrongChain}
          onSwitchChain={() => switchChain({ chainId: ACTIVE_CHAIN_ID })}
        />
      ))}
    </div>
  )
}

interface OrganizerEventPanelProps {
  eventId: bigint
  event: EventInfo
  wrongChain: boolean
  onSwitchChain: () => void
}

function OrganizerEventPanel({ eventId, event, wrongChain, onSwitchChain }: OrganizerEventPanelProps) {
  const [expanded, setExpanded] = useState(false)
  const [checkInMode, setCheckInMode] = useState<'qr' | 'manual'>('qr')
  const [checkInAddress, setCheckInAddress] = useState('')
  const [txError, setTxError] = useState<string | null>(null)

  const phase = computeEventPhase(event)

  // Load accounting
  const { data: accountingRaw, refetch: refetchAccounting } = useReadContracts({
    contracts: [{
      address: (SEATBACK_ADDRESS ?? undefined),
      abi: SEATBACK_ABI,
      functionName: 'getAccounting' as const,
      args: [eventId] as const,
      chainId: ACTIVE_CHAIN_ID,
    }],
    query: { enabled: !!SEATBACK_ADDRESS },
  })
  const accounting = accountingRaw?.[0]?.result

  // Reserved seats
  const { data: seatsRaw } = useReadContracts({
    contracts: [{
      address: (SEATBACK_ADDRESS ?? undefined),
      abi: SEATBACK_ABI,
      functionName: 'reservedSeats' as const,
      args: [eventId] as const,
      chainId: ACTIVE_CHAIN_ID,
    }],
    query: { enabled: !!SEATBACK_ADDRESS },
  })
  const reservedSeats = seatsRaw?.[0]?.result

  // Open check-in
  const { writeContract: openCI, data: openCIHash, isPending: openCIPending } = useWriteContract()
  const { isLoading: openCIConfirming, isSuccess: openCISuccess } = useWaitForTransactionReceipt({ hash: openCIHash })

  // Check in attendee
  const { writeContract: checkIn, data: checkInHash, isPending: checkInPending } = useWriteContract()
  const { isLoading: checkInConfirming, isSuccess: checkInSuccess } = useWaitForTransactionReceipt({ hash: checkInHash })

  // Cancel event
  const { writeContract: cancelEvt, data: cancelHash, isPending: cancelPending } = useWriteContract()
  const { isLoading: cancelConfirming, isSuccess: cancelSuccess } = useWaitForTransactionReceipt({ hash: cancelHash })

  // Finalize
  const { writeContract: finalize, data: finalizeHash, isPending: finalizePending } = useWriteContract()
  const { isLoading: finalizeConfirming, isSuccess: finalizeSuccess } = useWaitForTransactionReceipt({ hash: finalizeHash })

  // Withdraw proceeds
  const { writeContract: withdraw, data: withdrawHash, isPending: withdrawPending } = useWriteContract()
  const { isLoading: withdrawConfirming, isSuccess: withdrawSuccess } = useWaitForTransactionReceipt({ hash: withdrawHash })

  const call = (fn: () => void) => {
    setTxError(null)
    fn()
  }

  const handleOpenCheckIn = () =>
    call(() => openCI({
      address: SEATBACK_ADDRESS!,
      abi: SEATBACK_ABI,
      functionName: 'openCheckIn',
      args: [eventId],
      chainId: ACTIVE_CHAIN_ID,
    }, { onError: (e) => setTxError(parseOnchainError(e)), onSuccess: () => { toast.success('Check-in opened!'); void refetchAccounting() } }))

  const handleCheckIn = () => {
    if (!/^0x[0-9a-fA-F]{40}$/.test(checkInAddress)) {
      setTxError('Enter a valid Ethereum address.')
      return
    }
    call(() => checkIn({
      address: SEATBACK_ADDRESS!,
      abi: SEATBACK_ABI,
      functionName: 'checkIn',
      args: [eventId, checkInAddress as `0x${string}`],
      chainId: ACTIVE_CHAIN_ID,
    }, { onError: (e) => setTxError(parseOnchainError(e)), onSuccess: () => { toast.success('Attendee checked in!'); setCheckInAddress('') } }))
  }

  const handleCancelEvent = () =>
    call(() => cancelEvt({
      address: SEATBACK_ADDRESS!,
      abi: SEATBACK_ABI,
      functionName: 'cancelEvent',
      args: [eventId],
      chainId: ACTIVE_CHAIN_ID,
    }, { onError: (e) => setTxError(parseOnchainError(e)), onSuccess: () => { toast.success('Event cancelled.'); void refetchAccounting() } }))

  const handleFinalize = () =>
    call(() => finalize({
      address: SEATBACK_ADDRESS!,
      abi: SEATBACK_ABI,
      functionName: 'finalizeEvent',
      args: [eventId],
      chainId: ACTIVE_CHAIN_ID,
    }, { onError: (e) => setTxError(parseOnchainError(e)), onSuccess: () => { toast.success('Event finalized.'); void refetchAccounting() } }))

  const handleWithdraw = () =>
    call(() => withdraw({
      address: SEATBACK_ADDRESS!,
      abi: SEATBACK_ABI,
      functionName: 'withdrawNoShowProceeds',
      args: [eventId],
      chainId: ACTIVE_CHAIN_ID,
    }, { onError: (e) => setTxError(parseOnchainError(e)), onSuccess: () => { toast.success('Proceeds withdrawn to payout wallet!'); void refetchAccounting() } }))

  // phase === 'check_in_open' means now is in checkIn window (may or may not be opened by organizer)
  const inCheckInWindow = phase === 'check_in_open'
  const isOver = phase === 'finalized' || phase === 'cancelled'
  const canOpenCheckIn = !event.checkInOpened && !event.cancelled && inCheckInWindow
  const canCheckIn = event.checkInOpened && !event.cancelled && inCheckInWindow
  const canCancel = !event.cancelled && !isOver
  const canFinalize = !event.cancelled && !event.finalized && isOver && phase !== 'cancelled'
  const canWithdraw = !event.cancelled && event.finalized && (accounting?.organizerCredit ?? 0n) > 0n

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white overflow-hidden">
      {/* Collapsed header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-5 flex items-start justify-between gap-4 text-left hover:bg-[var(--surface-muted)] transition-colors"
        aria-expanded={expanded}
      >
        <div className="flex-1 min-w-0">
          <h3 className="display font-semibold text-[var(--ink)] truncate" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {event.title}
          </h3>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            {formatDateTime(event.eventStart)} · {reservedSeats ?? 0}/{event.capacity} seats
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <PhasePill phase={phase} />
          {expanded ? <ChevronUp size={16} className="text-[var(--muted)]" /> : <ChevronDown size={16} className="text-[var(--muted)]" />}
        </div>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-[var(--border)] p-5 flex flex-col gap-4">
          {wrongChain && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
              Switch to {NETWORK_LABEL}.{' '}
              <button onClick={onSwitchChain} className="font-semibold underline">Switch</button>
            </div>
          )}

          {/* Accounting summary */}
          {accounting && (
            <div className="rounded-xl bg-[var(--surface-muted)] p-4 grid grid-cols-2 gap-3 text-sm">
              <AccountingRow label="Active deposits" value={accounting.activeDeposits} />
              <AccountingRow label="Refund liabilities" value={accounting.outstandingRefunds} />
              <AccountingRow label="Organiser credit" value={accounting.organizerCredit} />
              <AccountingRow label="Refunds paid" value={accounting.refundsPaid} />
              <AccountingRow label="Proceeds paid" value={accounting.organizerPaid} />
              <div className="flex flex-col">
                <span className="text-[var(--subtle)] text-xs">Payout wallet</span>
                <span className="mono text-xs text-[var(--ink)]">{shortAddress(event.payoutWallet)}</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3">
            {canOpenCheckIn && (
              <TxButton
                onClick={handleOpenCheckIn}
                isPending={openCIPending}
                isConfirming={openCIConfirming}
                isSuccess={openCISuccess}
                disabled={wrongChain}
                label="Open Check-In"
                confirmingLabel="Opening check-in…"
                className="w-full"
              />
            )}

            {canCheckIn && (
              <div className="flex flex-col gap-3">
                {/* Mode toggle */}
                <div className="flex items-center gap-1 rounded-xl bg-[var(--surface-muted)] p-1 w-fit">
                  <button
                    onClick={() => setCheckInMode('qr')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${checkInMode === 'qr' ? 'bg-white shadow-sm text-[var(--ink)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}
                  >
                    <QrCode size={13} />
                    QR Scanner
                  </button>
                  <button
                    onClick={() => setCheckInMode('manual')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${checkInMode === 'manual' ? 'bg-white shadow-sm text-[var(--ink)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}
                  >
                    Manual
                  </button>
                </div>

                {/* QR scanner (primary path) */}
                {checkInMode === 'qr' && (
                  <QRScanner
                    event={event}
                    eventId={eventId}
                    onCheckedIn={() => { void refetchAccounting() }}
                  />
                )}

                {/* Manual address entry (fallback) */}
                {checkInMode === 'manual' && (
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={checkInAddress}
                        onChange={(e) => setCheckInAddress(e.target.value)}
                        placeholder="Attendee wallet address (0x…)"
                        className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--focus)]"
                        aria-label="Attendee wallet address"
                      />
                      <TxButton
                        onClick={handleCheckIn}
                        isPending={checkInPending}
                        isConfirming={checkInConfirming}
                        isSuccess={checkInSuccess}
                        disabled={wrongChain || !checkInAddress}
                        label="Check In"
                        className="flex-shrink-0"
                      />
                    </div>
                    <p className="text-xs text-[var(--subtle)]">
                      Direct address entry bypasses QR verification. Use only when the attendee cannot display a QR.
                      You bear responsibility for verifying identity by other means.
                    </p>
                  </div>
                )}
              </div>
            )}

            {canFinalize && (
              <TxButton
                onClick={handleFinalize}
                isPending={finalizePending}
                isConfirming={finalizeConfirming}
                isSuccess={finalizeSuccess}
                disabled={wrongChain}
                label="Finalize Event"
                variant="ghost"
                className="w-full"
              />
            )}

            {canWithdraw && (
              <TxButton
                onClick={handleWithdraw}
                isPending={withdrawPending}
                isConfirming={withdrawConfirming}
                isSuccess={withdrawSuccess}
                disabled={wrongChain}
                label={`Withdraw ${formatUsdc(accounting?.organizerCredit ?? 0n)} USDC Proceeds`}
                className="w-full"
              />
            )}

            {canCancel && (
              <TxButton
                onClick={handleCancelEvent}
                isPending={cancelPending}
                isConfirming={cancelConfirming}
                isSuccess={cancelSuccess}
                disabled={wrongChain}
                label="Cancel Event"
                variant="danger"
                className="w-full"
              />
            )}
          </div>

          {txError && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700 flex items-center gap-2">
              <AlertTriangle size={14} />
              {txError}
            </div>
          )}

          {event.cancelled && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700 flex items-center gap-2">
              <XCircle size={14} />
              This event has been cancelled. All active deposits are refundable.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AccountingRow({ label, value }: { label: string; value: bigint }) {
  return (
    <div className="flex flex-col">
      <span className="text-[var(--subtle)] text-xs">{label}</span>
      <span className="font-semibold tabular-nums text-[var(--ink)] text-sm">{formatUsdc(value)} USDC</span>
    </div>
  )
}

function PhasePill({ phase }: { phase: string }) {
  const map: Record<string, string> = {
    booking_open: 'bg-teal-50 text-teal-700 border-teal-200',
    booking_closed: 'bg-slate-100 text-slate-500 border-slate-200',
    check_in_open: 'bg-blue-50 text-blue-700 border-blue-200',
    check_in_closed: 'bg-slate-100 text-slate-500 border-slate-200',
    finalized: 'bg-slate-100 text-slate-500 border-slate-200',
    cancelled: 'bg-red-50 text-red-600 border-red-200',
  }
  const labels: Record<string, string> = {
    booking_open: 'Open', booking_closed: 'Closed', check_in_open: 'Check-In',
    check_in_closed: 'Ended', finalized: 'Done', cancelled: 'Cancelled',
  }
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${map[phase] ?? 'bg-slate-100 text-slate-500 border-slate-200'}`}>
      {labels[phase] ?? phase}
    </span>
  )
}
