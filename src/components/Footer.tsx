/**
 * Footer — developer credits for SeatBack.
 */

export function Footer() {
  return (
    <footer className="mt-auto border-t border-[var(--border)] bg-[var(--surface)]">
      <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="SeatBack" className="w-6 h-6" />
          <span className="font-semibold text-[var(--fg)] text-sm tracking-tight">SeatBack</span>
        </div>

        {/* Credits */}
        <div className="text-center text-xs text-[var(--muted)] leading-relaxed">
          <p className="font-medium text-[var(--fg-2)]">Developer credits</p>
          <p>
            Built by{' '}
            <a
              href="https://community.arc.io/home/users/max-play-4698q43lc1"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent)] hover:underline font-medium"
            >
              Max Play
            </a>
            {' '}+{' '}
            <a
              href="https://studio.arc.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent)] hover:underline font-medium"
            >
              studio.arc.io
            </a>
          </p>
          <p className="mt-0.5">
            <a
              href="mailto:grandmaxplay@gmail.com"
              className="hover:text-[var(--accent)] transition-colors"
            >
              grandmaxplay@gmail.com
            </a>
          </p>
        </div>

        {/* Contract chain badge */}
        <div className="flex flex-col items-center sm:items-end gap-0.5 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
            <span className="text-[var(--muted)]">Arc Mainnet</span>
          </div>
          <a
            href="https://explorer.arc.io/address/0x6Fdb06A9Ce387937C2261F489E502e53cA1F0Bbc"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
          >
            0x6Fdb…Bbc
          </a>
        </div>
      </div>
    </footer>
  )
}
