/**
 * Full event view: details, refund policy, booking/cancellation actions for attendees.
 */
import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain, useReadContract, useReadContracts } from 'wagmi'
import { erc20Abi } from 'viem'
import { ArrowLeft, Share2, Check, MapPin, Clock, Users, Ticket, AlertTriangle, Info, CheckCircle2, XCircle } from 'lucide-react'
import { SEATBACK_ABI, SEATBACK_ADDRESS, ACTIVE_CHAIN_ID, USDC_ADDRESS, NETWORK_LABEL } from '@/contract'
import { formatUsdc, formatDateTime, parseOnchainError, shortAddress, nowSeconds } from '@/utils/format'
import { buildEventUrl } from '@/utils/url'
import { useEvent, useActiveReservationId, useReservation, useReservedSeats } from '@/hooks/useEvents'
import { useMyReservationIds } from '@/hooks/useMyLogs'
import type { EventInfo } from '@/types'
import { computeEventPhase } from '@/types'
import { TxButton } from './TxButton'
import { toast } from 'sonner'

interface EventDetailProps {
  eventId: bigint
  onBack: () => void
}

export function EventDetail({ eventId, onBack }: EventDetailProps) {
  const { address, chainId, isConnected } = useAccount()
  const { switchChain } = useSwitchChain()
  const wrongChain = isConnected && chainId !== ACTIVE_CHAIN_ID

  const { data: event, refetch: refetchEvent, isLoading } = useEvent(eventId)
  const { data: reservedSeats, refetch: refetchSeats } = useReservedSeats(eventId)
  const { data: activeResId, refetch: refetchResId } = useActiveReservationId(
    eventId,
    address,
  )
  // Older reservations of this wallet for this event (cancelled or checked in). The contract
  // clears the "active" pointer for those, but their deposit may still be waiting to be claimed.
  const { data: myResIds, refetch: refetchMyResIds } = useMyReservationIds(address, eventId)
  const { data: myResData, refetch: refetchMyRes } = useReadContracts({
    contracts: (myResIds ?? []).map((id) => ({
      address: SEATBACK_ADDRESS ?? undefined,
      abi: SEATBACK_ABI,
      functionName: 'getReservation' as const,
      args: [id] as const,
      chainId: ACTIVE_CHAIN_ID,
    })),
    query: { enabled: !!SEATBACK_ADDRESS && (myResIds?.length ?? 0) > 0 },
  })
  let claimableResId: bigint | null = null
  const myIdList = myResIds ?? []
  for (let i = 0; i < myIdList.length; i++) {
    const r = myResData?.[i]
    if (r?.status === 'success' && r.result && r.result.refundable && !r.result.refundClaimed) {
      claimableResId = myIdList[i]
      break
    }
  }
  // The reservation we show/act on: the active one, otherwise one with an unclaimed refund.
  const shownResId: bigint | null = activeResId && activeResId > 0n ? activeResId : claimableResId
  const { data: reservation, refetch: refetchRes } = useReservation(shownResId)

  // USDC balance and allowance
  const { data: usdcBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: ACTIVE_CHAIN_ID,
    query: { enabled: !!address },
  })
  const { data: usdcAllowance, refetch: refetchAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address && SEATBACK_ADDRESS ? [address, SEATBACK_ADDRESS] : undefined,
    chainId: ACTIVE_CHAIN_ID,
    query: { enabled: !!address && !!SEATBACK_ADDRESS },
  })

  // Approve tx
  const { writeContract: approve, data: approveHash, isPending: approvePending } = useWriteContract()
  const { isLoading: approveConfirming, isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveHash })

  // Reserve tx
  const { writeContract: reserve, data: reserveHash, isPending: reservePending, isError: reserveError, error: reserveErr } = useWriteContract()
  const { isLoading: reserveConfirming, isSuccess: reserveSuccess } = useWaitForTransactionReceipt({
    hash: reserveHash,
  })

  // Cancel reservation tx
  const { writeContract: cancelRes, data: cancelResHash, isPending: cancelResPending, isError: cancelResError, error: cancelResErr } = useWriteContract()
  const { isLoading: cancelResConfirming, isSuccess: cancelResSuccess } = useWaitForTransactionReceipt({
    hash: cancelResHash,
  })

  // Claim refund tx
  const { writeContract: claimRefund, data: claimHash, isPending: claimPending, isError: claimError, error: claimErr } = useWriteContract()
  const { isLoading: claimConfirming, isSuccess: claimSuccess } = useWaitForTransactionReceipt({ hash: claimHash })

  const [txError, setTxError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleShare = () => {
    const url = buildEventUrl(eventId)
    const markCopied = () => { setCopied(true); setTimeout(() => setCopied(false), 2000) }
    const fallback = () => {
      const ta = document.createElement('textarea')
      ta.value = url; ta.style.cssText = 'position:fixed;opacity:0'
      document.body.appendChild(ta); ta.select()
      try { document.execCommand('copy'); markCopied() } finally { document.body.removeChild(ta) }
    }
    if (!navigator.clipboard) { fallback(); return }
    navigator.clipboard.writeText(url).then(markCopied).catch(fallback)
  }

  // After approve tx is confirmed on-chain, re-read allowance so the button
  // switches from "Allow USDC" → "Reserve Seat" without a manual page refresh.
  useEffect(() => {
    if (approveSuccess) {
      void refetchAllowance()
    }
  }, [approveSuccess, refetchAllowance])

  const refetchAll = () => {
    void refetchEvent()
    void refetchSeats()
    void refetchResId()
    void refetchRes()
    void refetchMyResIds()
    void refetchMyRes()
    void refetchAllowance()
  }

  // Refresh once reserve / cancel / claim is actually mined, not when the wallet returns a hash
  useEffect(() => {
    if (reserveSuccess || cancelResSuccess || claimSuccess) refetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reserveSuccess, cancelResSuccess, claimSuccess])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-[var(--muted)]">Loading…</div>
    )
  }

  if (!event || event.organizer === '0x0000000000000000000000000000000000000000') {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <XCircle size={36} className="text-[var(--muted)]" />
        <p className="font-semibold text-[var(--ink)]">Event not found</p>
        <p className="text-sm text-[var(--muted)]">Event #{eventId.toString()} does not exist.</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-2 text-sm text-[var(--accent)] underline underline-offset-2"
        >
          Back to events
        </button>
      </div>
    )
  }

  const evt = event
  const seatsLeft = Math.max(0, evt.capacity - Number(reservedSeats ?? 0))
  const hasActiveReservation = activeResId !== undefined && activeResId > 0n
  const depositAmount = evt.depositAmount

  // Check if allowance is sufficient
  const needsApproval = (usdcAllowance ?? 0n) < depositAmount
  const hasFunds = (usdcBalance ?? 0n) >= depositAmount

  const handleApprove = () => {
    if (!SEATBACK_ADDRESS) return
    setTxError(null)
    approve({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'approve',
      args: [SEATBACK_ADDRESS, depositAmount],
      chainId: ACTIVE_CHAIN_ID,
    }, {
      onError: (e) => setTxError(parseOnchainError(e)),
      onSuccess: () => toast.success('USDC spending approved'),
    })
  }

  const handleReserve = () => {
    if (!SEATBACK_ADDRESS) return
    setTxError(null)
    reserve({
      address: SEATBACK_ADDRESS,
      abi: SEATBACK_ABI,
      functionName: 'reserve',
      args: [eventId],
      chainId: ACTIVE_CHAIN_ID,
    }, {
      onError: (e) => setTxError(parseOnchainError(e)),
      onSuccess: () => { toast.success('Reservation sent. Waiting for confirmation…') },
    })
  }

  const handleCancelReservation = () => {
    if (!SEATBACK_ADDRESS || !activeResId) return
    setTxError(null)
    cancelRes({
      address: SEATBACK_ADDRESS,
      abi: SEATBACK_ABI,
      functionName: 'cancelReservation',
      args: [activeResId],
      chainId: ACTIVE_CHAIN_ID,
    }, {
      onError: (e) => setTxError(parseOnchainError(e)),
      onSuccess: () => { toast.success('Cancellation sent. Waiting for confirmation…') },
    })
  }

  const handleClaimRefund = () => {
    if (!SEATBACK_ADDRESS) return
    const resId = shownResId
    if (!resId) return
    setTxError(null)
    claimRefund({
      address: SEATBACK_ADDRESS,
      abi: SEATBACK_ABI,
      functionName: 'claimRefund',
      args: [resId],
      chainId: ACTIVE_CHAIN_ID,
    }, {
      onError: (e) => setTxError(parseOnchainError(e)),
      onSuccess: () => { toast.success('Refund transaction sent. Waiting for confirmation…') },
    })
  }

  const phase = computeEventPhase(evt)

  const canCancel =
    hasActiveReservation &&
    !reservation?.refundable &&
    !reservation?.refundClaimed &&
    !evt.cancelled &&
    nowSeconds() < evt.refundCutoff

  // No-show: active reservation, check-in was opened, event is over, but no check-in recorded
  const isNoShow =
    hasActiveReservation &&
    !reservation?.refundable &&
    !reservation?.refundClaimed &&
    evt.checkInOpened &&
    (evt.finalized || phase === 'check_in_closed')

  const canClaimRefund =
    shownResId !== null &&
    !isNoShow &&
    (reservation?.refundable ||
      (hasActiveReservation && (evt.cancelled || phase === 'finalized' || phase === 'check_in_closed'))) &&
    !reservation?.refundClaimed

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      {/* Top bar: back + share */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--ink)] transition-colors -ml-1"
          aria-label="Back to event list"
        >
          <ArrowLeft size={16} />
          Back to events
        </button>

        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
          aria-label="Copy share link"
        >
          {copied ? <Check size={14} className="text-teal-600" /> : <Share2 size={14} />}
          {copied ? 'Link copied!' : 'Share'}
        </button>
      </div>

      {/* Hero card */}
      <div className="rounded-2xl border border-[var(--border)] p-6 flex flex-col gap-4" style={{ background: 'var(--surface-strong)' }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1
              className="display text-2xl font-semibold text-[var(--ink)] leading-tight"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {evt.title}
            </h1>
            <p className="text-[var(--muted)] mt-2 text-pretty">{evt.description}</p>
          </div>
          <PhaseBadge phase={phase} />
        </div>

        <div className="flex flex-col gap-2 text-sm text-[var(--muted)] border-t border-[var(--border)] pt-4">
          <span className="flex items-center gap-2"><Clock size={15} />{formatDateTime(evt.eventStart)} — {formatDateTime(evt.eventEnd)}</span>
          <span className="flex items-center gap-2"><MapPin size={15} />{evt.venue}</span>
          <span className="flex items-center gap-2"><Users size={15} />{seatsLeft} of {evt.capacity} seats available</span>
          <span className="flex items-center gap-2">
            <Ticket size={15} className="text-[var(--accent)]" />
            <strong className="text-[var(--ink)] tabular-nums">{formatUsdc(depositAmount)} USDC</strong> refundable deposit
          </span>
        </div>

        {/* Organizer */}
        <p className="text-xs text-[var(--subtle)]">
          Organiser: <span className="mono">{shortAddress(evt.organizer)}</span>
        </p>
      </div>

      {/* Refund Policy */}
      <RefundPolicy event={evt} />

      {/* Attendee Action Card */}
      {isConnected ? (
        <AttendeeActions
          phase={phase}
          event={evt}
          hasActiveReservation={hasActiveReservation}
          hasReservationRecord={hasActiveReservation || shownResId !== null}
          reservation={reservation}
          canCancel={canCancel}
          canClaimRefund={canClaimRefund}
          needsApproval={needsApproval}
          hasFunds={hasFunds}
          usdcBalance={usdcBalance}
          wrongChain={wrongChain}
          onSwitchChain={() => switchChain({ chainId: ACTIVE_CHAIN_ID })}
          onApprove={handleApprove}
          onReserve={handleReserve}
          onCancel={handleCancelReservation}
          onClaimRefund={handleClaimRefund}
          approvePending={approvePending}
          approveConfirming={approveConfirming}
          approveSuccess={approveSuccess}
          reservePending={reservePending}
          reserveConfirming={reserveConfirming}
          reserveSuccess={reserveSuccess}
          cancelResPending={cancelResPending}
          cancelResConfirming={cancelResConfirming}
          cancelResSuccess={cancelResSuccess}
          claimPending={claimPending}
          claimConfirming={claimConfirming}
          claimSuccess={claimSuccess}
          txError={txError}
          reserveError={reserveError}
          cancelResError={cancelResError}
          claimError={claimError}
          reserveErrMsg={reserveErr ? parseOnchainError(reserveErr) : null}
          cancelResErrMsg={cancelResErr ? parseOnchainError(cancelResErr) : null}
          claimErrMsg={claimErr ? parseOnchainError(claimErr) : null}
        />
      ) : (
        <div className="rounded-2xl border border-[var(--border)] p-6 text-center" style={{ background: 'var(--surface-strong)' }}>
          <p className="text-[var(--muted)]">Connect your wallet to reserve a seat or manage your reservation.</p>
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function PhaseBadge({ phase }: { phase: string }) {
  const map: Record<string, { label: string; className: string }> = {
    booking_open: { label: 'Booking Open', className: 'bg-teal-50 text-teal-700 border-teal-200' },
    booking_closed: { label: 'Booking Closed', className: 'badge-navy' },
    check_in_open: { label: 'Check-In Live', className: 'bg-blue-50 text-blue-700 border-blue-200' },
    check_in_closed: { label: 'Ended', className: 'bg-orange-50 text-orange-700 border-orange-200' },
    finalized: { label: 'Finalized', className: 'badge-navy' },
    cancelled: { label: 'Cancelled', className: 'bg-red-50 text-red-600 border-red-200' },
  }
  const b = map[phase] ?? map.finalized
  return (
    <span className={`flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${b.className}`}>
      {b.label}
    </span>
  )
}

function RefundPolicy({ event }: { event: EventInfo }) {
  return (
    <section
      className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-5"
      aria-label="Refund policy"
    >
      <h2 className="font-semibold text-[var(--ink)] flex items-center gap-2 mb-3">
        <Info size={16} className="text-[var(--accent)]" />
        Refund Policy
      </h2>
      <ul className="flex flex-col gap-2 text-sm text-[var(--muted)]">
        <li className="flex items-start gap-2">
          <CheckCircle2 size={15} className="text-[var(--success)] mt-0.5 flex-shrink-0" />
          Cancel before <strong className="text-[var(--ink)]">{formatDateTime(event.refundCutoff)}</strong> for a full refund.
        </li>
        <li className="flex items-start gap-2">
          <CheckCircle2 size={15} className="text-[var(--success)] mt-0.5 flex-shrink-0" />
          Attend and get checked in by the organiser to receive your full deposit back.
        </li>
        <li className="flex items-start gap-2">
          <CheckCircle2 size={15} className="text-[var(--success)] mt-0.5 flex-shrink-0" />
          If the organiser cancels the event, all active deposits become refundable.
        </li>
        <li className="flex items-start gap-2">
          <CheckCircle2 size={15} className="text-[var(--success)] mt-0.5 flex-shrink-0" />
          If the organiser never opens check-in, all remaining deposits become refundable at <strong className="text-[var(--ink)]">{formatDateTime(event.checkInEnd)}</strong>.
        </li>
        <li className="flex items-start gap-2">
          <XCircle size={15} className="text-[var(--danger)] mt-0.5 flex-shrink-0" />
          No-shows (check-in was opened but you were not checked in) forfeit their deposit: 50% goes to SBK stakers and 50% to the organiser. If nobody is staking when the event settles, the staker half is held in an owner reserve.
        </li>
      </ul>
      <div className="mt-3 pt-3 border-t border-[var(--border)] text-xs text-[var(--subtle)]">
        <AlertTriangle size={12} className="inline mr-1" />
        Attendance is confirmed by the organiser. One wallet is not cryptographic proof of one person. The contract does not independently verify physical presence.
      </div>
    </section>
  )
}

interface AttendeeActionsProps {
  phase: string
  event: EventInfo
  hasActiveReservation: boolean
  hasReservationRecord: boolean
  reservation: { active: boolean; refundable: boolean; refundClaimed: boolean } | undefined
  canCancel: boolean
  canClaimRefund: boolean
  needsApproval: boolean
  hasFunds: boolean
  usdcBalance: bigint | undefined
  wrongChain: boolean
  onSwitchChain: () => void
  onApprove: () => void
  onReserve: () => void
  onCancel: () => void
  onClaimRefund: () => void
  approvePending: boolean
  approveConfirming: boolean
  approveSuccess: boolean
  reservePending: boolean
  reserveConfirming: boolean
  reserveSuccess: boolean
  cancelResPending: boolean
  cancelResConfirming: boolean
  cancelResSuccess: boolean
  claimPending: boolean
  claimConfirming: boolean
  claimSuccess: boolean
  txError: string | null
  reserveError: boolean
  cancelResError: boolean
  claimError: boolean
  reserveErrMsg: string | null
  cancelResErrMsg: string | null
  claimErrMsg: string | null
}

function AttendeeActions({
  phase,
  event,
  hasActiveReservation,
  hasReservationRecord,
  reservation,
  canCancel,
  canClaimRefund,
  needsApproval,
  hasFunds,
  usdcBalance,
  wrongChain,
  onSwitchChain,
  onApprove,
  onReserve,
  onCancel,
  onClaimRefund,
  approvePending,
  approveConfirming,
  approveSuccess,
  reservePending,
  reserveConfirming,
  reserveSuccess,
  cancelResPending,
  cancelResConfirming,
  cancelResSuccess,
  claimPending,
  claimConfirming,
  claimSuccess,
  txError,
  reserveError,
  cancelResError,
  claimError,
  reserveErrMsg,
  cancelResErrMsg,
  claimErrMsg,
}: AttendeeActionsProps) {
  const errorMsg = txError || reserveErrMsg || cancelResErrMsg || claimErrMsg

  return (
    <div className="rounded-2xl border border-[var(--border)] p-6 flex flex-col gap-4" style={{ background: 'var(--surface-strong)' }}>
      <h2 className="font-semibold text-[var(--ink)]">Your Reservation</h2>

      {wrongChain && (
        <div className="rounded-xl p-3 text-sm" style={{ background: "var(--warning-bg)", color: "var(--warning)", border: "1px solid var(--accent-muted)" }}>
          Switch to {NETWORK_LABEL} to interact.
          <button
            onClick={onSwitchChain}
            className="ml-2 font-semibold underline underline-offset-2"
          >
            Switch now
          </button>
        </div>
      )}

      {/* Current status */}
      {hasReservationRecord && (
        <div className="rounded-xl bg-teal-50 border border-teal-200 p-3 text-sm text-teal-800 flex items-center gap-2">
          <CheckCircle2 size={15} />
          {reservation?.refundClaimed
            ? 'Refund claimed — deposit returned to your wallet.'
            : reservation?.refundable
              ? 'You are eligible for a refund. Claim it below.'
              : 'You have an active reservation for this event.'}
        </div>
      )}

      {/* Not booked + booking open */}
      {!hasActiveReservation && phase === 'booking_open' && !wrongChain && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--muted)]">Deposit required</span>
            <span className="font-semibold tabular-nums text-[var(--ink)]">
              {formatUsdc(event.depositAmount)} USDC
            </span>
          </div>
          {usdcBalance !== undefined && (
            <div className="flex items-center justify-between text-xs text-[var(--subtle)]">
              <span>Your USDC balance</span>
              <span className="tabular-nums">{formatUsdc(usdcBalance)} USDC</span>
            </div>
          )}
          {!hasFunds && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700 flex items-center gap-2">
              <AlertTriangle size={14} />
              Insufficient USDC balance. Add USDC to your wallet on Arc Mainnet to continue.
            </div>
          )}
          {/* Step 1: Approve, Step 2: Reserve */}
          {needsApproval ? (
            <TxButton
              onClick={onApprove}
              isPending={approvePending}
              isConfirming={approveConfirming}
              isSuccess={approveSuccess}
              disabled={!hasFunds || wrongChain}
              label={`Allow ${formatUsdc(event.depositAmount)} USDC`}
              successLabel="Approved!"
              className="w-full"
            />
          ) : (
            <TxButton
              onClick={onReserve}
              isPending={reservePending}
              isConfirming={reserveConfirming}
              isSuccess={reserveSuccess}
              isError={reserveError}
              disabled={!hasFunds || wrongChain}
              label={`Reserve Seat — ${formatUsdc(event.depositAmount)} USDC`}
              confirmingLabel="Confirming reservation…"
              successLabel="Seat reserved!"
              className="w-full"
            />
          )}
        </div>
      )}

      {/* Cancel before cutoff */}
      {canCancel && !wrongChain && (
        <div className="flex flex-col gap-2">
          <TxButton
            onClick={onCancel}
            isPending={cancelResPending}
            isConfirming={cancelResConfirming}
            isSuccess={cancelResSuccess}
            isError={cancelResError}
            label="Cancel Reservation"
            variant="ghost"
            className="w-full"
          />
          <p className="text-xs text-center text-[var(--subtle)]">
            Cancellation before deadline entitles you to a full refund (claimed separately).
          </p>
        </div>
      )}

      {/* Claim refund */}
      {canClaimRefund && !reservation?.refundClaimed && !wrongChain && (
        <TxButton
          onClick={onClaimRefund}
          isPending={claimPending}
          isConfirming={claimConfirming}
          isSuccess={claimSuccess}
          isError={claimError}
          label={`Claim ${formatUsdc(event.depositAmount)} USDC Refund`}
          confirmingLabel="Sending refund…"
          successLabel="Refund received!"
          className="w-full"
        />
      )}

      {/* Generic closed state */}
      {!hasReservationRecord && phase !== 'booking_open' && (
        <p className="text-sm text-center text-[var(--muted)]">
          {event.cancelled ? 'This event was cancelled.' : 'Booking is closed for this event.'}
        </p>
      )}

      {/* Error */}
      {errorMsg && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle size={14} />
          {errorMsg}
        </div>
      )}
    </div>
  )
}
