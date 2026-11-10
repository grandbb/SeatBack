/**
 * Organizer Dashboard — shows events where msg.sender is organizer.
 * Allows: openCheckIn, checkIn via QR scanner, checkIn via address, cancelEvent,
 *         withdrawNoShowProceeds, finalizeEvent.
 */
import { useState, useCallback, useEffect } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi'
import { XCircle, AlertTriangle, ChevronDown, ChevronUp, Loader2, QrCode } from 'lucide-react'
import { SEATBACK_ABI, SEATBACK_ADDRESS, ACTIVE_CHAIN_ID, NETWORK_LABEL } from '@/contract'
import { useEventsBatch } from '@/hooks/useEvents'
import { useMyOrganizedEventIds } from '@/hooks/useMyLogs'
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

  // Events this wallet created, found from indexed logs so older events never fall
  // out of a "newest N" window.
  const {
    data: organizedIds,
    isLoading: idsLoading,
    error: idsError,
    refetch: refetchIds,
  } = useMyOrganizedEventIds(address)
  const ids = organizedIds ?? []

  const { data: eventsData, isLoading: eventsLoading, refetch: refetchEventsRaw } = useEventsBatch(ids)
  const refetchEvents = async () => { await refetchIds(); await refetchEventsRaw() }

  const myEvents = ids.flatMap((id, i) => {
    const r = eventsData?.[i]
    if (r?.status !== 'success' || !r.result) return []
    return [{ id, event: r.result }]
  })

  if (!isConnected) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-8 text-center">
        <p className="text-[var(--muted)]">Connect your wallet to see your events.</p>
      </div>
    )
  }

  if (idsLoading || (ids.length > 0 && eventsLoading)) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-[var(--muted)]">
        <Loader2 size={20} className="animate-spin" />
        Loading your events…
      </div>
    )
  }

  if (idsError) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-8 text-center flex flex-col gap-2">
        <p className="font-semibold text-[var(--ink)]">Could not load your events</p>
        <p className="text-sm text-[var(--muted)]">The network did not return your event history. Nothing was lost onchain.</p>
        <button type="button" onClick={() => { void refetchIds() }} className="mx-auto text-sm font-semibold text-[var(--accent)] underline">Try again</button>
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
          onRefetchEvents={() => { void refetchEvents() }}
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
  onRefetchEvents: () => void
}

function OrganizerEventPanel({ eventId, event, wrongChain, onSwitchChain, onRefetchEvents }: OrganizerEventPanelProps) {
  const [expanded, setExpanded] = useState(false)
  const [checkInMode, setCheckInMode] = useState<'qr' | 'manual'>('qr')
  const [checkInAddress, setCheckInAddress] = useState('')
  const [txError, setTxError] = useState<string | null>(null)
  // Confirmation state for irreversible actions
  const [confirmPending, setConfirmPending] = useState<'cancel' | 'finalize' | null>(null)

  const phase = computeEventPhase(event)

  // Load accounting
  const { data: accountingRaw, refetch: refetchAccounting } = useReadContracts({
    contracts: [
      {
        address: (SEATBACK_ADDRESS ?? undefined),
        abi: SEATBACK_ABI,
        functionName: 'getAccounting' as const,
        args: [eventId] as const,
        chainId: ACTIVE_CHAIN_ID,
      },
      {
        address: (SEATBACK_ADDRESS ?? undefined),
        abi: SEATBACK_ABI,
        functionName: 'unclaimedStakerCredit' as const,
        args: [eventId] as const,
        chainId: ACTIVE_CHAIN_ID,
      },
    ],
    query: { enabled: !!SEATBACK_ADDRESS },
  })
  const accounting = accountingRaw?.[0]?.result
  const failedStakerCredit = (accountingRaw?.[1]?.result) ?? 0n

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

  // Step 1: settle no-show proceeds (split between stakers and organiser credit)
  const { writeContract: settle, data: settleHash, isPending: settlePending } = useWriteContract()
  const { isLoading: settleConfirming, isSuccess: settleSuccess } = useWaitForTransactionReceipt({ hash: settleHash })

  // Step 2: withdraw the organiser credit to the payout wallet
  const { writeContract: withdraw, data: withdrawHash, isPending: withdrawPending } = useWriteContract()
  const { isLoading: withdrawConfirming, isSuccess: withdrawSuccess } = useWaitForTransactionReceipt({ hash: withdrawHash })

  // Step 3 (only if delivery to the staking pool failed): anyone can retry
  const { writeContract: retryStaker, data: retryHash, isPending: retryPending } = useWriteContract()
  const { isLoading: retryConfirming, isSuccess: retrySuccess } = useWaitForTransactionReceipt({ hash: retryHash })

  // Refresh once a transaction is actually mined (a wallet returning a hash is not a confirmation)
  useEffect(() => {
    if (openCISuccess || checkInSuccess || cancelSuccess || finalizeSuccess || settleSuccess || withdrawSuccess || retrySuccess) {
      void refetchAccounting()
      onRefetchEvents()
    }
  }, [openCISuccess, checkInSuccess, cancelSuccess, finalizeSuccess, settleSuccess, withdrawSuccess, retrySuccess, refetchAccounting, onRefetchEvents])

  const call = (fn: () => void) => {
    setTxError(null)
    fn()
  }

  const handleOpenCheckIn = () => {
    if (!SEATBACK_ADDRESS) return
    call(() => openCI({
      address: SEATBACK_ADDRESS,
      abi: SEATBACK_ABI,
      functionName: 'openCheckIn',
      args: [eventId],
      chainId: ACTIVE_CHAIN_ID,
    }, { onError: (e) => setTxError(parseOnchainError(e)), onSuccess: () => { toast.success('Check-in transaction sent.') } }))
  }

  const handleCheckIn = () => {
    if (!/^0x[0-9a-fA-F]{40}$/.test(checkInAddress)) {
      setTxError('Enter a valid Ethereum address.')
      return
    }
    call(() => checkIn({
      address: SEATBACK_ADDRESS,
      abi: SEATBACK_ABI,
      functionName: 'checkIn',
      args: [eventId, checkInAddress as `0x${string}`],
      chainId: ACTIVE_CHAIN_ID,
    }, { onError: (e) => setTxError(parseOnchainError(e)), onSuccess: () => { toast.success('Attendee checked in!'); setCheckInAddress(''); void refetchAccounting() } }))
  }

  const handleCancelEvent = useCallback(() => {
    if (confirmPending !== 'cancel') { setConfirmPending('cancel'); return }
    setConfirmPending(null)
    if (!SEATBACK_ADDRESS) return
    call(() => cancelEvt({
      address: SEATBACK_ADDRESS,
      abi: SEATBACK_ABI,
      functionName: 'cancelEvent',
      args: [eventId],
      chainId: ACTIVE_CHAIN_ID,
    }, { onError: (e) => setTxError(parseOnchainError(e)), onSuccess: () => { toast.success('Cancel transaction sent.') } }))
  }, [confirmPending, cancelEvt, eventId, refetchAccounting, onRefetchEvents])

  const handleFinalize = useCallback(() => {
    if (confirmPending !== 'finalize') { setConfirmPending('finalize'); return }
    setConfirmPending(null)
    if (!SEATBACK_ADDRESS) return
    call(() => finalize({
      address: SEATBACK_ADDRESS,
      abi: SEATBACK_ABI,
      functionName: 'finalizeEvent',
      args: [eventId],
      chainId: ACTIVE_CHAIN_ID,
    }, { onError: (e) => setTxError(parseOnchainError(e)), onSuccess: () => { toast.success('Finalize transaction sent.') } }))
  }, [confirmPending, finalize, eventId, refetchAccounting, onRefetchEvents])

  const handleSettle = () => {
    if (!SEATBACK_ADDRESS) return
    call(() => settle({
      address: SEATBACK_ADDRESS,
      abi: SEATBACK_ABI,
      functionName: 'withdrawNoShowProceeds',
      args: [eventId],
      chainId: ACTIVE_CHAIN_ID,
    }, { onError: (e) => setTxError(parseOnchainError(e)), onSuccess: () => { toast.success('Settlement transaction sent.') } }))
  }

  const handleRetryStaker = () => {
    if (!SEATBACK_ADDRESS) return
    call(() => retryStaker({
      address: SEATBACK_ADDRESS,
      abi: SEATBACK_ABI,
      functionName: 'retryStakerCredit',
      args: [eventId],
      chainId: ACTIVE_CHAIN_ID,
    }, { onError: (e) => setTxError(parseOnchainError(e)) }))
  }

  const handleWithdraw = () => {
    if (!SEATBACK_ADDRESS) return
    call(() => withdraw({
      address: SEATBACK_ADDRESS,
      abi: SEATBACK_ABI,
      functionName: 'withdrawOrganizerCredit',
      args: [eventId],
      chainId: ACTIVE_CHAIN_ID,
    }, { onError: (e) => setTxError(parseOnchainError(e)), onSuccess: () => { toast.success('Withdrawal transaction sent.') } }))
  }

  // phase === 'check_in_open' means now is in checkIn window (may or may not be opened by organizer)
  const inCheckInWindow = phase === 'check_in_open'
  const canOpenCheckIn = !event.checkInOpened && !event.cancelled && inCheckInWindow
  const canCheckIn = event.checkInOpened && !event.cancelled && inCheckInWindow
  const canCancel = !event.cancelled && !event.finalized && phase !== 'check_in_closed'
  const canFinalize = !event.cancelled && !event.finalized && (phase === 'check_in_closed')
  const noShowSettled = accounting?.noShowSettled ?? false
  const hasCredit = (accounting?.organizerCredit ?? 0n) > 0n
  const canSettle = !event.cancelled && event.finalized && !noShowSettled && hasCredit
  const canWithdraw = !event.cancelled && event.finalized && noShowSettled && hasCredit

  return (
    <div className="rounded-2xl border border-[var(--border)] overflow-hidden" style={{ background: 'var(--surface-strong)' }}>
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
            <div className="rounded-xl p-3 text-sm" style={{ background: "var(--warning-bg)", color: "var(--warning)", border: "1px solid var(--accent-muted)" }}>
              Switch to {NETWORK_LABEL}.{' '}
              <button onClick={onSwitchChain} className="font-semibold underline">Switch</button>
            </div>
          )}

          {/* Accounting summary */}
          {accounting && (
            <div className="rounded-xl bg-[var(--surface-muted)] p-4 grid grid-cols-2 gap-3 text-sm">
              <AccountingRow label="Active deposits" value={accounting.activeDeposits} />
              <AccountingRow label="Refund liabilities" value={accounting.outstandingRefunds} />
              <AccountingRow label={accounting.noShowSettled ? 'Organiser credit (withdrawable)' : 'Unsettled no-show proceeds (split 50/50 on settle)'} value={accounting.organizerCredit} />
              <AccountingRow label="Refunds paid" value={accounting.refundsPaid} />
              <AccountingRow label="Paid to organiser" value={accounting.organizerPaid} />
              <AccountingRow label="Paid to stakers" value={accounting.stakerPaid} />
              <div className="flex flex-col">
                <span className="text-[var(--subtle)] text-xs">Payout wallet</span>
                <span className="mono text-xs text-[var(--ink)]">{shortAddress(event.payoutWallet)}</span>
              </div>
              <PayoutWalletEditor eventId={eventId} wrongChain={wrongChain} onDone={onRefetchEvents} />
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
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${checkInMode === 'qr' ? 'shadow-sm text-[var(--ink)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}
                    style={checkInMode === 'qr' ? { background: 'var(--surface-strong)' } : {}}
                  >
                    <QrCode size={13} />
                    QR Scanner
                  </button>
                  <button
                    onClick={() => setCheckInMode('manual')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${checkInMode === 'manual' ? 'shadow-sm text-[var(--ink)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}
                    style={checkInMode === 'manual' ? { background: 'var(--surface-strong)' } : {}}
                  >
                    Manual
                  </button>
                </div>

                {/* QR scanner (primary path) */}
                {checkInMode === 'qr' && (
                  <QRScanner
                    event={event}
                    eventId={eventId}
                    onCheckedIn={() => { void refetchAccounting(); void onRefetchEvents() }}
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
              confirmPending === 'finalize' ? (
                <div className="flex gap-2">
                  <button type="button" onClick={handleFinalize}
                    className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold bg-[var(--accent)] text-white">
                    Confirm Finalize
                  </button>
                  <button type="button" onClick={() => setConfirmPending(null)}
                    className="flex-1 rounded-xl px-4 py-2.5 text-sm border border-[var(--border-strong)] text-[var(--ink)]">
                    Cancel
                  </button>
                </div>
              ) : (
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
              )
            )}

            {canSettle && (
              <TxButton
                onClick={handleSettle}
                isPending={settlePending}
                isConfirming={settleConfirming}
                isSuccess={settleSuccess}
                disabled={wrongChain}
                label="Settle No-Show Proceeds (50% stakers / 50% you)"
                className="w-full"
              />
            )}

            {failedStakerCredit > 0n && (
              <div className="rounded-xl p-3 text-sm flex flex-col gap-2" style={{ background: 'var(--warning-bg)', color: 'var(--warning)', border: '1px solid var(--accent-muted)' }}>
                <span>{formatUsdc(failedStakerCredit)} USDC of the stakers' share could not be delivered to the staking pool. Anyone can retry delivery.</span>
                <TxButton
                  onClick={handleRetryStaker}
                  isPending={retryPending}
                  isConfirming={retryConfirming}
                  isSuccess={retrySuccess}
                  disabled={wrongChain}
                  label="Retry delivery to stakers"
                  className="w-full"
                />
              </div>
            )}

            {canWithdraw && (
              <TxButton
                onClick={handleWithdraw}
                isPending={withdrawPending}
                isConfirming={withdrawConfirming}
                isSuccess={withdrawSuccess}
                disabled={wrongChain}
                label={`Withdraw ${formatUsdc(accounting?.organizerCredit ?? 0n)} USDC to ${shortAddress(event.payoutWallet)}`}
                className="w-full"
              />
            )}

            {canCancel && (
              confirmPending === 'cancel' ? (
                <div className="flex gap-2">
                  <button type="button" onClick={handleCancelEvent}
                    className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold bg-[var(--danger)] text-white">
                    Confirm Cancel
                  </button>
                  <button type="button" onClick={() => setConfirmPending(null)}
                    className="flex-1 rounded-xl px-4 py-2.5 text-sm border border-[var(--border-strong)] text-[var(--ink)]">
                    Keep Event
                  </button>
                </div>
              ) : (
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
              )
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
    booking_closed: 'badge-navy',
    check_in_open: 'bg-blue-50 text-blue-700 border-blue-200',
    check_in_closed: 'bg-orange-50 text-orange-700 border-orange-200',
    finalized: 'badge-navy',
    cancelled: 'bg-red-50 text-red-600 border-red-200',
  }
  const labels: Record<string, string> = {
    booking_open: 'Open', booking_closed: 'Closed', check_in_open: 'Check-In',
    check_in_closed: 'Awaiting Finalize', finalized: 'Done', cancelled: 'Cancelled',
  }
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${map[phase] ?? 'badge-navy'}`}>
      {labels[phase] ?? phase}
    </span>
  )
}

/** Organiser-only: change where this event's proceeds are paid (for example if the old wallet cannot receive USDC). */
function PayoutWalletEditor({ eventId, wrongChain, onDone }: { eventId: bigint; wrongChain: boolean; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: confirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({ hash })
  const valid = /^0x[0-9a-fA-F]{40}$/.test(value.trim())
  const mined = isSuccess && receipt?.status === 'success'

  useEffect(() => {
    if (mined) onDone()
  }, [mined, onDone])

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="col-span-2 text-left text-xs font-semibold text-[var(--accent)] underline">
        Change payout wallet
      </button>
    )
  }
  return (
    <div className="col-span-2 flex flex-col gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="New payout wallet 0x…"
        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-xs mono text-[var(--ink)]"
      />
      {value && !valid && <p className="text-xs" style={{ color: 'var(--danger)' }}>Enter a valid 0x address.</p>}
      {error && <p className="text-xs" style={{ color: 'var(--danger)' }}>{parseOnchainError(error)}</p>}
      <TxButton
        onClick={() => {
          if (!SEATBACK_ADDRESS || !valid) return
          writeContract({ address: SEATBACK_ADDRESS, abi: SEATBACK_ABI, functionName: 'updatePayoutWallet', args: [eventId, value.trim() as `0x${string}`], chainId: ACTIVE_CHAIN_ID })
        }}
        isPending={isPending}
        isConfirming={confirming}
        isSuccess={mined}
        disabled={!valid || wrongChain}
        label="Save new payout wallet"
        successLabel="Updated"
        className="w-full"
      />
    </div>
  )
}
