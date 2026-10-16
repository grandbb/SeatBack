/**
 * SeatBack wordmark.
 * A navy seat-icon SVG beside the text wordmark.
 * The brand icon is an inline SVG — no external image asset required.
 */

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function Logo({ size = 'md', className = '' }: LogoProps) {
  const iconSize = size === 'sm' ? 24 : size === 'lg' ? 48 : 32
  const textClass =
    size === 'sm'
      ? 'text-lg font-700'
      : size === 'lg'
        ? 'text-4xl'
        : 'text-2xl'

  return (
    <div className={`flex items-center gap-2 select-none ${className}`}>
      <SeatIcon size={iconSize} />
      <span
        className={`display font-semibold tracking-tight text-[var(--ink)] ${textClass}`}
        style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.03em' }}
      >
        SeatBack
      </span>
    </div>
  )
}

function SeatIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Teal return-arrow ring */}
      <path
        d="M24 4C13.0 4 4 13.0 4 24C4 35.0 13.0 44 24 44C35.0 44 44 35.0 44 24"
        stroke="#0D9488"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        d="M44 24L40 18M44 24L38 20"
        stroke="#0D9488"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Navy seat */}
      <rect x="16" y="20" width="16" height="10" rx="3" fill="#12243A" />
      <rect x="13" y="30" width="22" height="3" rx="1.5" fill="#12243A" />
      <rect x="13" y="18" width="4" height="12" rx="2" fill="#12243A" />
      <rect x="31" y="18" width="4" height="12" rx="2" fill="#12243A" />
    </svg>
  )
}
