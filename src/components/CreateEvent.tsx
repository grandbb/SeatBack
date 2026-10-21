/**
 * Create Event form — for organizers.
 */
import { useState } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi'
import { Info, AlertTriangle } from 'lucide-react'
import { SEATBACK_ABI, SEATBACK_ADDRESS, ACTIVE_CHAIN_ID, NETWORK_LABEL } from '@/contract'
import { parseUsdc, parseOnchainError } from '@/utils/format'
import { TxButton } from './TxButton'
import { toast } from 'sonner'

interface CreateEventProps {
  onCreated: (eventId: bigint) => void
}

export function CreateEvent({ onCreated }: CreateEventProps) {
  const { address, chainId, isConnected } = useAccount()
  const { switchChain } = useSwitchChain()
  const wrongChain = isConnected && chainId !== ACTIVE_CHAIN_ID

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [venue, setVenue] = useState('')
  const [eventStartInput, setEventStartInput] = useState('')
  const [eventEndInput, setEventEndInput] = useState('')
  const [depositInput, setDepositInput] = useState('')
  const [capacityInput, setCapacityInput] = useState('')
  const [bookingCloseInput, setBookingCloseInput] = useState('')
  const [refundCutoffInput, setRefundCutoffInput] = useState('')
  const [checkInStartInput, setCheckInStartInput] = useState('')
  const [checkInEndInput, setCheckInEndInput] = useState('')
  const [payoutWallet, setPayoutWallet] = useState(address ?? '')
  const [formError, setFormError] = useState<string | null>(null)
  const [txError, setTxError] = useState<string | null>(null)

  const { writeContract, data: hash, isPending, isError, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  // Keep payout wallet in sync with connected wallet
  const effectivePayoutWallet = payoutWallet || address || ''

  const validate = (): string | null => {
    if (!title.trim() || title.length > 120) return 'Title is required (max 120 chars).'
    if (!description.trim() || description.length > 500) return 'Description is required (max 500 chars).'
    if (!venue.trim() || venue.length > 200) return 'Venue is required (max 200 chars).'
    if (!depositInput || parseUsdc(depositInput) === 0n) return 'Enter a deposit amount greater than 0.'
    const cap = parseInt(capacityInput, 10)
    if (isNaN(cap) || cap <= 0) return 'Capacity must be at least 1.'
    if (!eventStartInput || !eventEndInput || !bookingCloseInput || !refundCutoffInput || !checkInStartInput || !checkInEndInput)
      return 'All date/time fields are required.'
    const tEventStart = Math.floor(new Date(eventStartInput).getTime() / 1000)
    const tEventEnd = Math.floor(new Date(eventEndInput).getTime() / 1000)
    const tBookingClose = Math.floor(new Date(bookingCloseInput).getTime() / 1000)
    const tRefundCutoff = Math.floor(new Date(refundCutoffInput).getTime() / 1000)
    const tCheckInStart = Math.floor(new Date(checkInStartInput).getTime() / 1000)
    const tCheckInEnd = Math.floor(new Date(checkInEndInput).getTime() / 1000)
    const now = Math.floor(Date.now() / 1000)
    if (tBookingClose <= now) return 'Booking close must be in the future.'
    if (tBookingClose > tRefundCutoff) return 'Booking close must be ≤ refund cutoff.'
    if (tRefundCutoff > tCheckInStart) return 'Refund cutoff must be ≤ check-in start.'
    if (tCheckInStart >= tCheckInEnd) return 'Check-in start must be before check-in end.'
    if (tEventEnd <= tEventStart) return 'Event end must be after event start.'
    if (!/^0x[0-9a-fA-F]{40}$/.test(effectivePayoutWallet)) return 'Enter a valid payout wallet address.'
    return null
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setTxError(null)

    const err = validate()
    if (err) { setFormError(err); return }
    if (!SEATBACK_ADDRESS) { setFormError('Contract not deployed yet.'); return }
    if (wrongChain) { switchChain({ chainId: ACTIVE_CHAIN_ID }); return }

    const tEventStart = BigInt(Math.floor(new Date(eventStartInput).getTime() / 1000))
    const tEventEnd = BigInt(Math.floor(new Date(eventEndInput).getTime() / 1000))
    const tBookingClose = BigInt(Math.floor(new Date(bookingCloseInput).getTime() / 1000))
    const tRefundCutoff = BigInt(Math.floor(new Date(refundCutoffInput).getTime() / 1000))
    const tCheckInStart = BigInt(Math.floor(new Date(checkInStartInput).getTime() / 1000))
    const tCheckInEnd = BigInt(Math.floor(new Date(checkInEndInput).getTime() / 1000))

    writeContract({
      address: SEATBACK_ADDRESS,
      abi: SEATBACK_ABI,
      functionName: 'createEvent',
      args: [{
        payoutWallet: effectivePayoutWallet as `0x${string}`,
        title,
        description,
        venue,
        eventStart: tEventStart,
        eventEnd: tEventEnd,
        capacity: parseInt(capacityInput, 10),
        depositAmount: parseUsdc(depositInput),
        bookingClose: tBookingClose,
        refundCutoff: tRefundCutoff,
        checkInStart: tCheckInStart,
        checkInEnd: tCheckInEnd,
      }],
      chainId: ACTIVE_CHAIN_ID,
    }, {
      onError: (e) => setTxError(parseOnchainError(e)),
      onSuccess: () => {
        toast.success('Event created on-chain!')
        // We navigate the user — caller handles this via onCreated
      },
    })
  }

  // After success, get event count to derive new event ID (eventCount - 1)
  // We can redirect the user to the events list
  if (isSuccess) {
    return (
      <div className="max-w-lg mx-auto rounded-2xl border border-teal-200 bg-teal-50 p-8 text-center flex flex-col gap-4">
        <div className="text-teal-600 text-5xl flex justify-center">
          <Info size={48} />
        </div>
        <h2 className="display text-xl font-semibold text-teal-800" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Event created!
        </h2>
        <p className="text-sm text-teal-700">
          Your event has been published on {NETWORK_LABEL}. Switch to the Events tab to see it and manage check-in from My Events.
        </p>
        <button
          onClick={() => onCreated(0n)}
          className="rounded-xl bg-[var(--accent)] text-white px-5 py-3 font-semibold text-sm"
        >
          View Events
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto flex flex-col gap-6">
      <div>
        <h1
          className="display text-2xl font-semibold text-[var(--ink)]"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          Create an Event
        </h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          All fields are stored on-chain and are permanent after creation. A material change requires cancelling and creating a new event.
        </p>
      </div>

      {!isConnected && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-5 text-center text-sm text-[var(--muted)]">
          Connect your wallet to create an event.
        </div>
      )}

      {wrongChain && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
          Switch to {NETWORK_LABEL} first.{' '}
          <button onClick={() => switchChain({ chainId: ACTIVE_CHAIN_ID })} className="font-semibold underline">
            Switch
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {/* Basic info */}
        <fieldset className="rounded-2xl border border-[var(--border)] p-5 flex flex-col gap-4" style={{ background: 'var(--surface-strong)' }}>
          <legend className="font-semibold text-[var(--ink)] px-1">Event Details</legend>

          <Field label="Title" required hint="Max 120 characters · shown publicly">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              className={inputCls}
              placeholder="Web3 Workshop: Intro to Smart Contracts"
              aria-required="true"
            />
          </Field>

          <Field label="Description" required hint="Max 500 characters · shown publicly">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
              className={inputCls}
              placeholder="A hands-on session covering Solidity basics…"
              aria-required="true"
            />
          </Field>

          <Field label="Venue" required hint="Public venue name · max 200 chars">
            <input
              type="text"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              maxLength={200}
              className={inputCls}
              placeholder="Example: The Hub, 42 Main St, Auckland"
              aria-required="true"
            />
          </Field>
        </fieldset>

        {/* Times */}
        <fieldset className="rounded-2xl border border-[var(--border)] p-5 flex flex-col gap-4" style={{ background: 'var(--surface-strong)' }}>
          <legend className="font-semibold text-[var(--ink)] px-1">Schedule</legend>
          <p className="text-xs text-[var(--subtle)]">
            Times are in your local timezone. The contract stores UTC Unix timestamps.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Event Start" required>
              <input type="datetime-local" value={eventStartInput} onChange={(e) => setEventStartInput(e.target.value)} className={inputCls} aria-required="true" />
            </Field>
            <Field label="Event End" required>
              <input type="datetime-local" value={eventEndInput} onChange={(e) => setEventEndInput(e.target.value)} className={inputCls} aria-required="true" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Booking Closes" required hint="After this, no new reservations">
              <input type="datetime-local" value={bookingCloseInput} onChange={(e) => setBookingCloseInput(e.target.value)} className={inputCls} aria-required="true" />
            </Field>
            <Field label="Refund Cutoff" required hint="After this, cancellations forfeit deposit">
              <input type="datetime-local" value={refundCutoffInput} onChange={(e) => setRefundCutoffInput(e.target.value)} className={inputCls} aria-required="true" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Check-In Opens" required hint="Organiser can open check-in from this time">
              <input type="datetime-local" value={checkInStartInput} onChange={(e) => setCheckInStartInput(e.target.value)} className={inputCls} aria-required="true" />
            </Field>
            <Field label="Check-In Closes" required hint="Finalization & refund claims available after this">
              <input type="datetime-local" value={checkInEndInput} onChange={(e) => setCheckInEndInput(e.target.value)} className={inputCls} aria-required="true" />
            </Field>
          </div>
        </fieldset>

        {/* Seats & deposit */}
        <fieldset className="rounded-2xl border border-[var(--border)] p-5 flex flex-col gap-4" style={{ background: 'var(--surface-strong)' }}>
          <legend className="font-semibold text-[var(--ink)] px-1">Seats & Deposit</legend>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Capacity" required hint="Max attendees">
              <input
                type="number"
                min={1}
                max={9999}
                value={capacityInput}
                onChange={(e) => setCapacityInput(e.target.value)}
                className={inputCls}
                placeholder="50"
                aria-required="true"
              />
            </Field>
            <Field label="Deposit (USDC)" required hint="Per attendee, fully refundable">
              <input
                type="number"
                min={0.01}
                step={0.01}
                value={depositInput}
                onChange={(e) => setDepositInput(e.target.value)}
                className={inputCls}
                placeholder="5.00"
                aria-required="true"
              />
            </Field>
          </div>
        </fieldset>

        {/* Payout wallet */}
        <fieldset className="rounded-2xl border border-[var(--border)] p-5 flex flex-col gap-4" style={{ background: 'var(--surface-strong)' }}>
          <legend className="font-semibold text-[var(--ink)] px-1">Payout Wallet</legend>
          <Field label="No-show proceeds sent to" required hint="Immutable after creation — double-check this address">
            <input
              type="text"
              value={effectivePayoutWallet}
              onChange={(e) => setPayoutWallet(e.target.value)}
              className={inputCls}
              placeholder="0x…"
              aria-required="true"
            />
          </Field>
          <p className="text-xs text-[var(--subtle)] flex items-center gap-1.5">
            <AlertTriangle size={12} />
            Only no-show deposits are paid out to this address. Attendee refunds always return to the original reserving wallet.
          </p>
        </fieldset>

        {/* Errors */}
        {(formError || txError || (isError && error)) && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700 flex items-center gap-2">
            <AlertTriangle size={14} />
            {formError || txError || (error ? parseOnchainError(error) : 'Unknown error')}
          </div>
        )}

        <TxButton
          onClick={() => {}}
          isPending={isPending}
          isConfirming={isConfirming}
          isSuccess={isSuccess}
          isError={isError}
          disabled={!isConnected || wrongChain}
          label="Publish Event"
          confirmingLabel="Publishing on-chain…"
          successLabel="Event published!"
          className="w-full"
        />
        <p className="text-xs text-center text-[var(--subtle)]">
          This calls <span className="mono">createEvent</span> on the SeatBack contract — gas is paid in USDC on {NETWORK_LABEL}.
        </p>
      </form>
    </div>
  )
}

// Helpers
const inputCls =
  'w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--ink)] placeholder-[var(--subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--focus)] focus:border-[var(--accent)] transition-colors'

function Field({ label, required, hint, children }: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-[var(--ink-2)]">
        {label}
        {required && <span className="text-[var(--danger)] ml-0.5" aria-hidden="true">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-[var(--subtle)]">{hint}</p>}
    </div>
  )
}
