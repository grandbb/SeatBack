/**
 * SeatBack logo — uses the brand SVG mark from /public/logo.svg
 * alongside the wordmark.
 */

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  /** Show wordmark beside the icon (default true) */
  wordmark?: boolean
  className?: string
}

export function Logo({ size = 'md', wordmark = true, className = '' }: LogoProps) {
  const px = size === 'sm' ? 28 : size === 'lg' ? 64 : 40
  const textClass =
    size === 'sm'
      ? 'text-lg'
      : size === 'lg'
        ? 'text-4xl'
        : 'text-2xl'

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      <img
        src="/logo.svg"
        alt="SeatBack logo"
        width={px}
        height={px}
        style={{ width: px, height: px, objectFit: 'contain' }}
        draggable={false}
      />
      {wordmark && (
        <span
          className={`font-bold tracking-tight text-[var(--ink)] ${textClass}`}
          style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.03em' }}
        >
          SeatBack
        </span>
      )}
    </div>
  )
}
