import { USDC_DECIMALS } from '@/contract'

/** Format a raw USDC bigint (6 decimals) to a display string like "5.00" */
export function formatUsdc(raw: bigint): string {
  const n = Number(raw) / 10 ** USDC_DECIMALS
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Parse a user input string like "5" or "5.50" into raw USDC bigint */
export function parseUsdc(input: string): bigint {
  const cleaned = input.replace(/[^0-9.]/g, '')
  const n = parseFloat(cleaned)
  if (isNaN(n) || n < 0) return 0n
  return BigInt(Math.round(n * 10 ** USDC_DECIMALS))
}

/** Format a Unix timestamp to a human-readable date/time in the user's local timezone */
export function formatDateTime(ts: bigint | number): string {
  const ms = typeof ts === 'bigint' ? Number(ts) * 1000 : ts * 1000
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(ms))
}

/** Short date only */
export function formatDate(ts: bigint | number): string {
  const ms = typeof ts === 'bigint' ? Number(ts) * 1000 : ts * 1000
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
    return m ? `Failed: ${m[1]}` : 'Transaction failed. Check your wallet and try again.'
  }
  if (msg.includes('network') || msg.includes('timeout')) return 'Network issue. Please retry.'
  return 'Something went wrong. Please try again.'
}
