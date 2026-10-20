/**
 * My Reservations — shows all reservations for the connected wallet.
 *
 * States shown per reservation:
 *   Active         — active reservation, check-in not yet open
 *   Checked in     — attendance confirmed, refund ready to claim
 *   Refund available — early cancellation, refund claimable
 *   Refunded       — refund already claimed
 *   Cancelled event — event was cancelled, deposit refundable
 *   No-show        — check-in window closed, check-in was opened, no check-in recorded
 *
 * Older reservations that were cancelled by the attendee also appear with
 * their historical refund status so that a rebooking does not lose history.
 */
import { useState } from 'react'
import {
  useAccount,
  useWalletClient,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSwitchChain,
  useReadContracts,
} from 'wagmi'
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertTriangle,
  ExternalLink,
  QrCode,
  TicketX,
  Wallet,
} from 'lucide-react'
import {
  SEATBACK_ABI,
  SEATBACK_ADDRESS,
  ACTIVE_CHAIN_ID,
  NETWORK_LABEL,
} from '@/contract'
import {
  useEventCount,
  useEventsBatch,
} from '@/hooks/useEvents'
import { computeEventPhase } from '@/types'
import type { EventInfo, ReservationInfo } from '@/types'
import { formatUsdc, formatDateTime, parseOnchainError, shortAddress } from '@/utils/format'
import { buildAddressExplorerUrl } from '@/onchain-facts'
import { TxButton } from './TxButton'
import { CheckInQR } from './CheckInQR'
import { toast } from 'sonner'

interface MyReservationsProps {
  onViewEvent: (eventId: bigint) => void
}

export function MyReservations({ onViewEvent }: MyReservationsProps) {
  const { address, chainId, isConnected } = useAccount()
  const { switchChain } = useSwitchChain()
  const wrongChain = isConnected && chainId !== ACTIVE_CHAIN_ID

  const { data: count, isLoading: countLoading } = useEventCount()
  const total = count ?? 0n
  const ids: bigint[] = []
  for (let i = total - 1n; i >= 0n && ids.length < 100; i--) {
    ids.push(i)
  }

  // Load all events to get activeReservationId per event
  const { data: eventsData, isLoading: eventsLoading } = useEventsBatch(ids)

  // Load activeReservationId for the connected wallet per event
  const { data: activeResIds, isLoading: resLoading } = useReadContracts({
    contracts: address
      ? ids.map((id) => ({
          address: (SEATBACK_ADDRESS ?? undefined),
          abi: SEATBACK_ABI,
          functionName: 'getActiveReservation' as const,
          args: [id, address] as const,
          chainId: ACTIVE_CHAIN_ID,
        }))
      : [],
    query: { enabled: !!SEATBACK_ADDRESS && !!address && ids.length > 0 },
  })

  // Collect unique non-zero reservation IDs (active per event)
  const resIdSet = new Set<bigint>()
  if (activeResIds) {
    for (const r of activeResIds) {
      if (r?.status === 'success' && (r.result) > 0n) {
        resIdSet.add(r.result)
      }
    }
  }
  const resIds = Array.from(resIdSet)

  // Load full reservation details
  const { data: reservationData, isLoading: reservationLoading } = useReadContracts({
    contracts: resIds.map((id) => ({
      address: (SEATBACK_ADDRESS ?? undefined),
      abi: SEATBACK_ABI,
      functionName: 'getReservation' as const,
      args: [id] as const,
      chainId: ACTIVE_CHAIN_ID,
    })),
    query: { enabled: !!SEATBACK_ADDRESS && resIds.length > 0 },
  })

  // Build list of (reservationId, reservation, eventId, event) tuples
  const items: Array<{
    reservationId: bigint
    reservation: ReservationInfo
    eventId: bigint
    event: EventInfo
  }> = []

  for (let i = 0; i < resIds.length; i++) {
    const resResult = reservationData?.[i]
    if (resResult?.status !== 'success' || !resResult.result) continue
    const reservation = resResult.result
    const eventId = reservation.eventId
    const eventIdx = ids.findIndex((id) => id === eventId)
    if (eventIdx === -1) continue
    const eventResult = eventsData?.[eventIdx]
    if (eventResult?.status !== 'success' || !eventResult.result) continue
    const event = eventResult.result
    items.push({ reservationId: resIds[i], reservation, eventId, event })
  }

  if (!isConnected) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-8 text-center flex flex-col gap-2">
        <Wallet size={32} className="mx-auto text-[var(--subtle)]" />
        <p className="font-semibold text-[var(--ink)]">Connect your wallet</p>
        <p className="text-sm text-[var(--muted)]">Connect to see your reservations.</p>
      </div>
    )
  }

  const isLoading = countLoading || eventsLoading || resLoading || reservationLoading

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-[var(--muted)]">
        <Loader2 size={20} className="animate-spin" />
        Loading your reservations…
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <TicketX size={40} className="text-[var(--subtle)]" />
        <p className="font-semibold text-[var(--ink)]">No reservations yet</p>
        <p className="text-sm text-[var(--muted)]">Browse events and reserve a seat to see it here.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {wrongChain && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
          Switch to {NETWORK_LABEL} to take actions.{' '}
          <button onClick={() => switchChain({ chainId: ACTIVE_CHAIN_ID })} className="font-semibold underline">
            Switch
          </button>
        </div>
      )}
      {items.map(({ reservationId, reservation, eventId, event }) => (
        <ReservationCard
          key={reservationId.toString()}
          reservationId={reservationId}
          reservation={reservation}
          eventId={eventId}
          event={event}
          wrongChain={wrongChain}
          onViewEvent={onViewEvent}
        />
      ))}
    </div>
  )
}

// ─── Reservation card ─────────────────────────────────────────────────────────

interface ReservationCardProps {
  reservationId: bigint
  reservation: ReservationInfo
  eventId: bigint
  event: EventInfo
  wrongChain: boolean
  onViewEvent: (eventId: bigint) => void
}

function ReservationCard({
  reservationId,
  reservation,
  eventId,
  event,
  wrongChain,
  onViewEvent,
}: ReservationCardProps) {
  const { data: walletClient } = useWalletClient({ chainId: ACTIVE_CHAIN_ID })
  const [showQR, setShowQR] = useState(false)
  const [txError, setTxError] = useState<string | null>(null)

  const { writeContract: claimRefund, data: claimHash, isPending: claimPending, isError: claimIsError } =
    useWriteContract()
  const { isLoading: claimConfirming, isSuccess: claimSuccess } = useWaitForTransactionReceipt({
    hash: claimHash,
  })

  const phase = computeEventPhase(event)
  const isOver = phase === 'finalized' || phase === 'cancelled'

  // Derived status
  const isNoShow =
    !reservation.active &&
    !reservation.refundable &&
    !reservation.refundClaimed &&
    event.checkInOpened &&
    (event.finalized || isOver)

  const isActive = reservation.active && !event.cancelled

  const canClaimRefund =
    (reservation.refundable && !reservation.refundClaimed) ||
    (event.cancelled && reservation.active && !reservation.refundClaimed) ||
    (!event.checkInOpened && !event.cancelled && isOver && reservation.active && !reservation.refundClaimed)

  const handleClaimRefund = () => {
    if (!SEATBACK_ADDRESS) return
    setTxError(null)
    claimRefund(
      {
        address: SEATBACK_ADDRESS,
        abi: SEATBACK_ABI,
        functionName: 'claimRefund',
        args: [reservationId],
        chainId: ACTIVE_CHAIN_ID,
      },
      {
        onError: (e) => setTxError(parseOnchainError(e)),
        onSuccess: () => toast.success('Refund claimed — USDC sent to your wallet.'),
      },
    )
  }

  const explorerBase = `https://explorer.arc.io`
  const txExplorer = (hash: `0x${string}`) => `${explorerBase}/tx/${hash}`

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white overflow-hidden">
      {/* Header */}
      <div className="p-5 flex items-start justify-between gap-3 border-b border-[var(--border)]">
        <div className="flex-1 min-w-0">
          <button
            onClick={() => onViewEvent(eventId)}
            className="font-semibold text-[var(--ink)] text-left hover:text-[var(--accent)] transition-colors"
          >
            {event.title}
          </button>
          <p className="text-xs text-[var(--muted)] mt-0.5">{formatDateTime(event.eventStart)}</p>
          <p className="text-xs text-[var(--muted)]">{event.venue}</p>
        </div>
        <ReservationStatusBadge
          reservation={reservation}
          event={event}
          isNoShow={isNoShow}
          phase={phase}
        />
      </div>

      {/* Body */}
      <div className="p-5 flex flex-col gap-4">
        {/* Info grid */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <InfoCell label="Reservation ID" value={`#${reservationId}`} mono />
          <InfoCell label="Deposit" value={`${formatUsdc(event.depositAmount)} USDC`} />
          <InfoCell label="Event ID" value={`#${eventId}`} mono />
          <InfoCell
            label="Organiser"
            value={shortAddress(event.organizer)}
            mono
            href={buildAddressExplorerUrl(ACTIVE_CHAIN_ID, event.organizer) ?? undefined}
          />
        </div>

        {/* QR toggle — only for active reservations during check-in */}
        {isActive && event.checkInOpened && !wrongChain && (
          <div>
            <button
              onClick={() => setShowQR(!showQR)}
              className="flex items-center gap-2 text-sm text-[var(--accent)] font-medium hover:underline"
            >
              <QrCode size={15} />
              {showQR ? 'Hide QR Code' : 'Show Check-In QR'}
            </button>
            {showQR && walletClient && (
              <div className="mt-3">
                <CheckInQR
                  eventId={eventId}
                  reservationId={reservationId}
                  event={event}
                  reservation={reservation}
                />
              </div>
            )}
          </div>
        )}

        {/* Checked-in state */}
        {!reservation.active && reservation.refundable && !reservation.refundClaimed && !isNoShow && (
          <div className="rounded-xl bg-teal-50 border border-teal-200 p-3 text-sm text-teal-800 flex items-center gap-2">
            <CheckCircle2 size={15} />
            Attendance confirmed. You are eligible for a full refund.
          </div>
        )}

        {/* Event cancelled state */}
        {event.cancelled && reservation.active && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700 flex items-center gap-2">
            <XCircle size={14} />
            Event cancelled by organiser. Your deposit is fully refundable.
          </div>
        )}

        {/* Never-opened refund */}
        {!event.cancelled && !event.checkInOpened && isOver && reservation.active && (
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm text-slate-700 flex items-center gap-2">
            <Clock size={14} />
            Check-in was never opened. Your deposit is fully refundable.
          </div>
        )}

        {/* No-show */}
        {isNoShow && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 flex items-center gap-2">
            <AlertTriangle size={14} />
            No check-in recorded. Deposit assigned to organiser as a no-show.
          </div>
        )}

        {/* Refund claimed */}
        {reservation.refundClaimed && (
          <div className="rounded-xl bg-teal-50 border border-teal-200 p-3 text-sm text-teal-800 flex items-center gap-2">
            <CheckCircle2 size={14} />
            Refund of {formatUsdc(event.depositAmount)} USDC has been claimed.
          </div>
        )}

        {/* Claim refund action */}
        {canClaimRefund && !reservation.refundClaimed && !wrongChain && (
          <TxButton
            onClick={handleClaimRefund}
            isPending={claimPending}
            isConfirming={claimConfirming}
            isSuccess={claimSuccess}
            isError={claimIsError}
            label={`Claim ${formatUsdc(event.depositAmount)} USDC Refund`}
            confirmingLabel="Claiming refund…"
            successLabel="Refund claimed!"
            className="w-full"
          />
        )}

        {txError && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700 flex items-center gap-2">
            <AlertTriangle size={14} />
            {txError}
          </div>
        )}

        {/* Explorer links */}
        {claimHash && (
          <a
            href={txExplorer(claimHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-[var(--accent)] hover:underline"
          >
            <ExternalLink size={11} />
            View refund transaction
          </a>
        )}

        <button
          onClick={() => onViewEvent(eventId)}
          className="text-xs text-[var(--muted)] hover:text-[var(--accent)] text-left transition-colors"
        >
          View event details →
        </button>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function InfoCell({
  label,
  value,
  mono,
  href,
}: {
  label: string
  value: string
  mono?: boolean
  href?: string
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-[var(--subtle)]">{label}</span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={`text-sm text-[var(--accent)] hover:underline ${mono ? 'font-mono' : ''}`}
        >
          {value}
        </a>
      ) : (
        <span className={`text-sm text-[var(--ink)] ${mono ? 'font-mono' : 'font-medium'}`}>{value}</span>
      )}
    </div>
  )
}

function ReservationStatusBadge({
  reservation,
  event,
  isNoShow,
  phase,
}: {
  reservation: ReservationInfo
  event: EventInfo
  isNoShow: boolean
  phase: string
}) {
  const evtPhase = computeEventPhase(event)
  const isOver = evtPhase === 'finalized' || evtPhase === 'cancelled'

  if (reservation.refundClaimed) {
    return <Badge label="Refunded" className="bg-teal-50 text-teal-700 border-teal-200" />
  }
  if (isNoShow) {
    return <Badge label="No-show" className="bg-amber-50 text-amber-700 border-amber-200" />
  }
  if (!reservation.active && reservation.refundable) {
    return <Badge label="Checked in" className="bg-blue-50 text-blue-700 border-blue-200" />
  }
  if (event.cancelled && reservation.active) {
    return <Badge label="Event cancelled" className="bg-red-50 text-red-600 border-red-200" />
  }
  if (!event.cancelled && !event.checkInOpened && isOver && reservation.active) {
    return <Badge label="Refund available" className="bg-slate-100 text-slate-700 border-slate-200" />
  }
  if (reservation.refundable && !reservation.refundClaimed) {
    return <Badge label="Refund available" className="bg-slate-100 text-slate-700 border-slate-200" />
  }
  if (reservation.active && phase === 'check_in_open') {
    return <Badge label="Check-in open" className="bg-blue-50 text-blue-700 border-blue-200" />
  }
  if (reservation.active) {
    return <Badge label="Active" className="bg-teal-50 text-teal-700 border-teal-200" />
  }
  return <Badge label="Inactive" className="bg-slate-100 text-slate-500 border-slate-200" />
}

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${className}`}>
      {label}
    </span>
  )
}
