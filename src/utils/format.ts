import { USDC_DECIMALS } from '@/contract'

/** Format a raw USDC bigint (6 decimals) to a display string like "5.00".
 *  Uses pure BigInt arithmetic to avoid Number precision loss on large values. */
export function formatUsdc(raw: bigint): string {
  if (raw < 0n) raw = 0n
  const scale = BigInt(10 ** USDC_DECIMALS)
  const whole = raw / scale
  const frac  = raw % scale
  const fracStr = frac.toString().padStart(USDC_DECIMALS, '0').slice(0, 2)
  return `${whole.toLocaleString('en-US')}.${fracStr}`
}

/** Parse a user input string like "5" or "5.50" into raw USDC bigint.
 *  Strict: only an unsigned plain decimal with at most 6 fractional digits is accepted.
 *  Anything else (signs, exponents like "1e3", extra dots, letters) returns 0n, so the
 *  amount a user sees is always the amount that is sent. Pure BigInt, no floating point. */
export function parseUsdc(input: string): bigint {
  const v = input.trim()
  if (!/^(\d+\.?\d{0,6}|\.\d{1,6})$/.test(v)) return 0n
  const [wholePart, fracPart = ''] = v.split('.')
  const whole = wholePart ? BigInt(wholePart) : 0n
  const frac = fracPart.padEnd(USDC_DECIMALS, '0')
  return whole * BigInt(10 ** USDC_DECIMALS) + BigInt(frac)
}

/** Largest instant a JavaScript Date can represent, in ms. */
const MAX_DATE_MS = 8.64e15

/** Seconds to ms, or null when the value cannot be shown as a date (untrusted onchain data). */
function safeMs(ts: bigint | number): number | null {
  const ms = (typeof ts === 'bigint' ? Number(ts) : ts) * 1000
  if (!Number.isFinite(ms) || Math.abs(ms) > MAX_DATE_MS) return null
  return ms
}

/**
 * Format a Unix timestamp in the user's LOCAL timezone (OS setting).
 * Used on all display pages: Events, My Tickets, Organiser, etc.
 * The timezone abbreviation (e.g. "GMT+7", "EST") is shown automatically.
 */
export function formatDateTime(ts: bigint | number): string {
  const ms = safeMs(ts)
  if (ms === null) return 'Invalid date'
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'shortOffset', // shows GMT+7, GMT-5, etc.
  }).format(new Date(ms))
}

/**
 * Format a Unix timestamp in UTC (GMT+0).
 * Used ONLY in the Create Event form so all organisers enter times
 * in a single unambiguous timezone.
 */
export function formatDateTimeUTC(ts: bigint | number): string {
  const ms = safeMs(ts)
  if (ms === null) return 'Invalid date'
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'shortOffset', // always shows GMT+0
  }).format(new Date(ms))
}

/**
 * Convert a "datetime-local" input value (treated as UTC by the form)
 * to a Unix timestamp in seconds.
 * The input value format is "YYYY-MM-DDTHH:mm" and is interpreted as UTC.
 */
export function utcInputToUnix(value: string): number {
  if (!value) return 0
  const ms = new Date(value + 'Z').getTime()
  return isNaN(ms) ? 0 : Math.floor(ms / 1000)
}

/**
 * Convert a Unix timestamp (seconds) to a "datetime-local" input value in UTC.
 * Returns "YYYY-MM-DDTHH:mm" suitable for <input type="datetime-local">.
 */
export function unixToUtcInput(ts: number): string {
  const d = new Date(ts * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

/** Short date only, local timezone */
export function formatDate(ts: bigint | number): string {
  const ms = safeMs(ts)
  if (ms === null) return 'Invalid date'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(ms))
}

/** Format an address 0x1234…abcd */
export function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

/** Return a human-friendly countdown string. Returns "" if in the future is false. */
export function countdown(targetTs: bigint): string {
  const now = Math.floor(Date.now() / 1000)
  const diff = Number(targetTs) - now
  if (diff <= 0) return 'Closed'
  const d = Math.floor(diff / 86400)
  const h = Math.floor((diff % 86400) / 3600)
  const m = Math.floor((diff % 3600) / 60)
  if (d > 0) return `${d}d ${h}h left`
  if (h > 0) return `${h}h ${m}m left`
  return `${m}m left`
}

export function parseOnchainError(error: unknown): string {
  const msg = (error as { message?: string })?.message?.toLowerCase() ?? ''
  if (msg.includes('user rejected') || msg.includes('4001')) return 'Transaction cancelled.'
  if (msg.includes('insufficient')) return 'Insufficient USDC balance.'
  if (msg.includes('bookingclosed') || msg.includes('booking closed')) return 'Booking is closed for this event.'
  if (msg.includes('capacityfull')) return 'This event is now fully booked.'
  if (msg.includes('alreadyreserved')) return 'You already have a reservation for this event.'
  if (msg.includes('notrefundable')) return 'This reservation is not eligible for a refund.'
  if (msg.includes('alreadyclaimed')) return 'Refund has already been claimed.'
  if (msg.includes('notattendee')) return 'You are not the attendee for this reservation.'
  if (msg.includes('reverted')) {
    const m = msg.match(/reason="([^"]+)"/)
    if (m) {
      // Sanitize: truncate, strip URLs, strip HTML to prevent phishing via revert reasons
      const reason = m[1]
        .slice(0, 200)
        .replace(/https?:\/\/\S+/gi, '[link removed]')
        .replace(/<[^>]+>/g, '')
      return `Failed: ${reason}`
    }
    return 'Transaction failed. Check your wallet and try again.'
  }
  if (msg.includes('network') || msg.includes('timeout')) return 'Network issue. Please retry.'
  return 'Something went wrong. Please try again.'
}

/** Current wall-clock time in whole seconds (kept out of component bodies for render purity). */
export function nowSeconds(): bigint {
  return BigInt(Math.floor(Date.now() / 1000))
}
