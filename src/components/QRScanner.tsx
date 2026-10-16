/**
 * QRScanner — organizer-side QR scanner with paste-payload fallback.
 *
 * Security rules enforced here:
 *  - Camera access is only requested when the organiser clicks "Scan QR".
 *  - Scanned content is never navigated to as a URL.
 *  - Scanned content is never eval()'d.
 *  - A raw wallet address QR is rejected (not treated as secure attendance proof).
 *  - Content is parsed by decodePayload() before any action is taken.
 *
 * After scanning/pasting, the organiser reviews event/reservation/wallet
 * details and explicitly clicks "Confirm Check-In" to submit the transaction.
 *
 * Falls back to paste mode gracefully when the browser reports no camera.
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { Camera, CameraOff, ClipboardPaste, CheckCircle2, AlertTriangle, Loader2, X } from 'lucide-react'
import { decodePayload, payloadToAuthArgs, qrSecondsLeft, PayloadDecodeError, type CheckInPayload } from '@/utils/checkin'
import { SEATBACK_ABI, SEATBACK_ADDRESS, ACTIVE_CHAIN_ID } from '@/contract'
import { formatDateTime, parseOnchainError, shortAddress } from '@/utils/format'
import type { EventInfo } from '@/types'
import { toast } from 'sonner'
import { TxButton } from './TxButton'

// Lazily import jsQR only when camera scanning is actually requested
type JsQR = typeof import('jsqr')['default']

interface QRScannerProps {
  event: EventInfo
  eventId: bigint
  onCheckedIn: () => void
}

type ScanMode = 'idle' | 'camera' | 'paste'
type ReviewState = 'reviewing' | 'submitting' | 'done' | 'error'

export function QRScanner({ event, eventId: _eventId, onCheckedIn }: QRScannerProps) {
  const [scanMode, setScanMode] = useState<ScanMode>('idle')
  const [pasteValue, setPasteValue] = useState('')
  const [payload, setPayload] = useState<CheckInPayload | null>(null)
  const [reviewState, setReviewState] = useState<ReviewState>('reviewing')
  const [decodeError, setDecodeError] = useState<string | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [txError, setTxError] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const jsQrRef = useRef<JsQR | null>(null)

  const stopCamera = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => stopCamera()
  }, [stopCamera])

  const { writeContract, data: txHash, isPending, isError: isTxError, error: txErr } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  const handleDecoded = useCallback((raw: string) => {
    setDecodeError(null)
    stopCamera()
    setScanMode('idle')
    try {
      const p = decodePayload(raw)
      setPayload(p)
      setReviewState('reviewing')
    } catch (e) {
      if (e instanceof PayloadDecodeError) {
        setDecodeError(e.message)
      } else {
        setDecodeError('Failed to parse QR payload.')
      }
    }
  }, [stopCamera])

  const startCamera = useCallback(async () => {
    setCameraError(null)
    setDecodeError(null)
    setScanMode('camera')

    // Load jsQR lazily
    if (!jsQrRef.current) {
      try {
        const mod = await import('jsqr')
        jsQrRef.current = mod.default
      } catch {
        setCameraError('QR scanning library failed to load.')
        setScanMode('idle')
        return
      }
    }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      })
    } catch {
      setCameraError('Camera access denied or unavailable. Use "Paste Payload" instead.')
      setScanMode('idle')
      return
    }

    streamRef.current = stream
    if (videoRef.current) {
      videoRef.current.srcObject = stream
      videoRef.current.play().catch(() => null)
    }

    const scan = () => {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || !jsQrRef.current) return

      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.drawImage(video, 0, 0)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQrRef.current(imageData.data, imageData.width, imageData.height)
        if (code) {
          handleDecoded(code.data)
          return
        }
      }
      rafRef.current = requestAnimationFrame(scan)
    }
    rafRef.current = requestAnimationFrame(scan)
  }, [handleDecoded])

  const handlePaste = useCallback(() => {
    if (!pasteValue.trim()) return
    handleDecoded(pasteValue.trim())
    setPasteValue('')
  }, [pasteValue, handleDecoded])

  const handleConfirmCheckIn = useCallback(() => {
    if (!payload || !SEATBACK_ADDRESS) return
    setTxError(null)
    setReviewState('submitting')
    const auth = payloadToAuthArgs(payload)
    writeContract({
      address: SEATBACK_ADDRESS,
      abi: SEATBACK_ABI,
      functionName: 'checkInWithSig',
      args: [auth, payload.sig],
      chainId: ACTIVE_CHAIN_ID,
    }, {
      onError: (e) => {
        setTxError(parseOnchainError(e))
        setReviewState('error')
      },
      onSuccess: () => {
        setReviewState('done')
        toast.success('Attendee checked in on-chain!')
        onCheckedIn()
      },
    })
  }, [payload, writeContract, onCheckedIn])

  const reset = () => {
    stopCamera()
    setPayload(null)
    setScanMode('idle')
    setDecodeError(null)
    setCameraError(null)
    setTxError(null)
    setReviewState('reviewing')
    setPasteValue('')
  }

  // ── Review panel ──────────────────────────────────────────────────────────────
  if (payload) {
    const secsLeft = qrSecondsLeft(payload)
    const expired = secsLeft <= 0
    const auth = payloadToAuthArgs(payload)

    return (
      <div className="rounded-2xl border border-[var(--border)] bg-white p-5 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-[var(--ink)] text-sm flex items-center gap-2">
            <CheckCircle2 size={16} className="text-[var(--accent)]" />
            Review QR Payload
          </h3>
          <button onClick={reset} aria-label="Dismiss" className="text-[var(--muted)] hover:text-[var(--ink)]">
            <X size={16} />
          </button>
        </div>

        {/* Details */}
        <div className="rounded-xl bg-[var(--surface-muted)] p-4 flex flex-col gap-2 text-sm">
          <Row label="Event" value={event.title} />
          <Row label="Event ID" value={String(auth.eventId)} mono />
          <Row label="Reservation ID" value={String(auth.reservationId)} mono />
          <Row label="Attendee wallet" value={shortAddress(auth.attendee)} mono />
          <Row label="Valid after" value={formatDateTime(Number(auth.validAfter))} />
          <Row label="Expires" value={formatDateTime(Number(auth.validUntil))} />
          <Row
            label="Status"
            value={expired ? 'EXPIRED' : `${secsLeft}s remaining`}
            className={expired ? 'text-red-600 font-semibold' : 'text-teal-700 font-semibold'}
          />
        </div>

        <div className="text-xs text-[var(--subtle)] bg-amber-50 rounded-xl border border-amber-200 p-3">
          <strong>Note:</strong> The QR signature proves wallet control, not physical presence.
          You as organiser are attesting attendance. Submitting this transaction is your confirmation.
        </div>

        {expired && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700 flex items-center gap-2">
            <AlertTriangle size={14} />
            This QR has expired. Ask the attendee to generate a new one.
          </div>
        )}

        {reviewState === 'done' && isSuccess && (
          <div className="rounded-xl bg-teal-50 border border-teal-200 p-3 text-sm text-teal-700 flex items-center gap-2">
            <CheckCircle2 size={14} />
            Attendance attested on-chain.
          </div>
        )}

        {(txError || (isTxError && txErr)) && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700 flex items-center gap-2">
            <AlertTriangle size={14} />
            {txError || parseOnchainError(txErr)}
          </div>
        )}

        <div className="flex gap-2">
          {reviewState !== 'done' && (
            <TxButton
              onClick={handleConfirmCheckIn}
              isPending={isPending}
              isConfirming={isConfirming}
              isSuccess={isSuccess}
              isError={isTxError}
              disabled={expired || reviewState === 'submitting'}
              label="Confirm Check-In"
              confirmingLabel="Confirming on-chain…"
              successLabel="Checked in!"
              className="flex-1"
            />
          )}
          <button
            onClick={reset}
            className="px-4 py-2.5 rounded-xl border border-[var(--border)] text-sm text-[var(--muted)] hover:bg-[var(--surface-muted)] transition-colors"
          >
            {reviewState === 'done' ? 'Close' : 'Cancel'}
          </button>
        </div>
      </div>
    )
  }

  // ── Scanner panel ─────────────────────────────────────────────────────────────
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white p-5 flex flex-col gap-4">
      <h3 className="font-semibold text-[var(--ink)] text-sm">Scan Attendee QR</h3>

      {/* Camera / paste toggle */}
      {scanMode === 'idle' && (
        <div className="flex flex-col gap-2">
          <button
            onClick={() => void startCamera()}
            className="flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-4 py-3 text-sm font-semibold transition-colors"
          >
            <Camera size={16} />
            Scan with Camera
          </button>
          <button
            onClick={() => { setScanMode('paste'); setCameraError(null) }}
            className="flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] text-sm text-[var(--muted)] hover:bg-[var(--surface-muted)] px-4 py-2.5 transition-colors"
          >
            <ClipboardPaste size={15} />
            Paste QR Payload
          </button>
        </div>
      )}

      {/* Camera stream */}
      {scanMode === 'camera' && (
        <div className="flex flex-col gap-3">
          <div className="relative rounded-xl overflow-hidden bg-black aspect-square max-w-xs mx-auto w-full">
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-cover"
              aria-label="Camera viewfinder"
            />
            {/* Scanning overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-48 border-4 border-white/70 rounded-xl" />
            </div>
          </div>
          <canvas ref={canvasRef} className="hidden" />
          <div className="flex items-center justify-center gap-2 text-sm text-[var(--muted)]">
            <Loader2 size={15} className="animate-spin" />
            Scanning…
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { stopCamera(); setScanMode('paste') }}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] text-sm text-[var(--muted)] hover:bg-[var(--surface-muted)] px-4 py-2.5 transition-colors"
            >
              <ClipboardPaste size={14} />
              Paste instead
            </button>
            <button
              onClick={() => { stopCamera(); setScanMode('idle') }}
              className="px-4 py-2.5 rounded-xl border border-[var(--border)] text-sm text-[var(--muted)] hover:bg-[var(--surface-muted)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Paste mode */}
      {scanMode === 'paste' && (
        <div className="flex flex-col gap-3">
          <label className="text-xs text-[var(--muted)]" htmlFor="qr-paste-input">
            Paste the attendee's QR payload JSON here.
          </label>
          <textarea
            id="qr-paste-input"
            value={pasteValue}
            onChange={(e) => setPasteValue(e.target.value)}
            rows={4}
            placeholder='{"v":"1","contract":"0x…","eventId":"…"}'
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[var(--focus)] resize-none"
            aria-label="QR payload JSON"
          />
          <div className="flex gap-2">
            <button
              onClick={handlePaste}
              disabled={!pasteValue.trim()}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle2 size={15} />
              Verify Payload
            </button>
            <button
              onClick={() => { setScanMode('idle'); setPasteValue(''); setDecodeError(null) }}
              className="px-4 py-2.5 rounded-xl border border-[var(--border)] text-sm text-[var(--muted)] hover:bg-[var(--surface-muted)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Errors */}
      {cameraError && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 flex items-start gap-2">
          <CameraOff size={14} className="mt-0.5 flex-shrink-0" />
          {cameraError}
        </div>
      )}
      {decodeError && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700 flex items-start gap-2">
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
          {decodeError}
        </div>
      )}

      <p className="text-xs text-[var(--subtle)]">
        Scanned content is parsed as JSON only. URLs are never opened.
        A raw wallet address QR is not accepted as secure proof.
      </p>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function Row({
  label,
  value,
  mono,
  className,
}: {
  label: string
  value: string
  mono?: boolean
  className?: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[var(--subtle)] text-xs flex-shrink-0">{label}</span>
      <span className={`text-[var(--ink)] text-right break-all ${mono ? 'font-mono text-xs' : 'text-sm'} ${className ?? ''}`}>
        {value}
      </span>
    </div>
  )
}
