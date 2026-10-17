/**
 * CheckInQR — attendee-side QR generator.
 *
 * The attendee explicitly clicks "Generate QR" to request a single EIP-712
 * signature.  The QR is valid for up to 5 minutes.  A countdown timer
 * shows remaining validity and the QR auto-clears on expiry.
 * No background signature requests are made.
 *
 * The QR encodes a compact JSON CheckInPayload (see utils/checkin.ts).
 * It is displayed as an SVG QR code using the `qrcode` library.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useAccount, useWalletClient } from 'wagmi'
import { QrCode, RefreshCw, AlertTriangle, CheckCircle2, Clock, Loader2 } from 'lucide-react'
import {
  signCheckInAuth,
  encodePayload,
  qrSecondsLeft,
  MAX_QR_VALIDITY_S,
  type CheckInPayload,
} from '@/utils/checkin'
import { ACTIVE_CHAIN_ID } from '@/contract'
import type { EventInfo, ReservationInfo } from '@/types'
import { computeEventPhase } from '@/types'
import QRCode from 'qrcode'
import { toast } from 'sonner'

interface CheckInQRProps {
  eventId: bigint
  reservationId: bigint
  event: EventInfo
  reservation: ReservationInfo
}

type QrState = 'idle' | 'signing' | 'active' | 'expired' | 'error'

export function CheckInQR({ eventId, reservationId, event, reservation }: CheckInQRProps) {
  const { address, chainId } = useAccount()
  const { data: walletClient } = useWalletClient({ chainId: ACTIVE_CHAIN_ID })

  const [state, setState] = useState<QrState>('idle')
  const [payload, setPayload] = useState<CheckInPayload | null>(null)
  const [qrSvg, setQrSvg] = useState<string>('')
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Clear the timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const startCountdown = useCallback((p: CheckInPayload) => {
    clearTimer()
    const tick = () => {
      const left = qrSecondsLeft(p)
      setSecondsLeft(Math.max(0, left))
      if (left <= 0) {
        clearTimer()
        setState('expired')
        setQrSvg('')
      }
    }
    tick()
    timerRef.current = setInterval(tick, 1000)
  }, [])

  const generateQR = useCallback(async () => {
    if (!walletClient || !address) {
      setErrorMsg('Wallet not connected.')
      return
    }
    if (chainId !== ACTIVE_CHAIN_ID) {
      setErrorMsg('Switch to Arc Mainnet first.')
      return
    }

    setState('signing')
    setErrorMsg(null)

    try {
      const p = await signCheckInAuth({
        walletClient,
        eventId,
        reservationId,
        attendee: address,
        checkInEnd: event.checkInEnd,
      })

      const encoded = encodePayload(p)

      // Generate SVG QR code
      const svgStr = await QRCode.toString(encoded, {
        type: 'svg',
        margin: 2,
        color: { dark: '#12243A', light: '#FFFFFF' },
        errorCorrectionLevel: 'M',
      })

      setPayload(p)
      setQrSvg(svgStr)
      setState('active')
      startCountdown(p)
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message ?? 'Unknown error'
      if (msg.toLowerCase().includes('user rejected') || msg.includes('4001')) {
        setState('idle')
        toast.info('Signature cancelled.')
      } else {
        setState('error')
        setErrorMsg(msg)
      }
    }
  }, [walletClient, address, chainId, eventId, reservationId, event.checkInEnd, startCountdown])

  // Use computeEventPhase to avoid Date.now() in render (React Compiler purity)
  const evtPhase = computeEventPhase(event)
  const checkInLive = event.checkInOpened && evtPhase === 'check_in_open'
  const alreadyCheckedIn = !reservation.active && reservation.refundable && !reservation.refundClaimed

  if (alreadyCheckedIn) {
    return (
      <div className="rounded-2xl border border-teal-200 bg-teal-50 p-5 flex items-center gap-3">
        <CheckCircle2 size={20} className="text-teal-600 flex-shrink-0" />
        <div>
          <p className="font-semibold text-teal-800 text-sm">Checked in</p>
          <p className="text-xs text-teal-700 mt-0.5">
            Your attendance has been confirmed by the organiser.
            Claim your refund from the main reservation panel.
          </p>
        </div>
      </div>
    )
  }

  if (!reservation.active) {
    return null
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <QrCode size={18} className="text-[var(--accent)]" />
        <h3 className="font-semibold text-[var(--ink)] text-sm">Check-In QR Code</h3>
      </div>

      {/* Instructions */}
      <p className="text-xs text-[var(--muted)]">
        Generate a time-limited QR code signed by your wallet. Show it to the
        organiser at the event. Valid for {MAX_QR_VALIDITY_S / 60} minutes after signing.
        Your wallet signature proves control of this reservation — not physical presence.
      </p>

      {!checkInLive && (
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600 flex items-center gap-2">
          <Clock size={14} />
          QR check-in is only available during the check-in window once the organiser opens it.
        </div>
      )}

      {/* Active QR */}
      {state === 'active' && qrSvg && (
        <div className="flex flex-col items-center gap-3">
          <div
            className="rounded-xl border-2 border-[var(--accent)] overflow-hidden bg-white p-2"
            aria-label="Check-in QR code"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: QR SVG generated locally from trusted data
            dangerouslySetInnerHTML={{ __html: qrSvg }}
            style={{ width: 220, height: 220 }}
          />

          {/* Countdown */}
          <div className={`flex items-center gap-1.5 text-sm font-medium ${secondsLeft <= 30 ? 'text-red-600' : 'text-[var(--accent)]'}`}>
            <Clock size={14} />
            {secondsLeft > 0 ? `Expires in ${secondsLeft}s` : 'Expired'}
          </div>

          {/* Show attendee wallet for organiser verification */}
          {payload && (
            <p className="text-xs text-[var(--subtle)] font-mono text-center break-all">
              {payload.attendee}
            </p>
          )}

          <button
            onClick={() => void generateQR()}
            className="flex items-center gap-1.5 text-xs text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
          >
            <RefreshCw size={13} />
            Refresh (request new signature)
          </button>
        </div>
      )}

      {/* Expired */}
      {state === 'expired' && (
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 flex items-center gap-2 w-full">
            <AlertTriangle size={14} />
            QR expired — generate a new one.
          </div>
          {checkInLive && (
            <button
              onClick={() => void generateQR()}
              className="flex items-center gap-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-4 py-2.5 text-sm font-semibold transition-colors"
            >
              <RefreshCw size={15} />
              Generate New QR
            </button>
          )}
        </div>
      )}

      {/* Signing */}
      {state === 'signing' && (
        <div className="flex flex-col items-center gap-2 py-4">
          <Loader2 size={28} className="animate-spin text-[var(--accent)]" />
          <p className="text-sm text-[var(--muted)]">Waiting for wallet signature…</p>
          <p className="text-xs text-[var(--subtle)]">Check your wallet for an EIP-712 sign request.</p>
        </div>
      )}

      {/* Error */}
      {state === 'error' && errorMsg && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle size={14} />
          {errorMsg}
        </div>
      )}

      {/* Idle — show generate button */}
      {(state === 'idle' || state === 'error') && checkInLive && (
        <button
          onClick={() => void generateQR()}
          disabled={!walletClient || chainId !== ACTIVE_CHAIN_ID}
          className="flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <QrCode size={16} />
          Generate Check-In QR
        </button>
      )}
    </div>
  )
}
