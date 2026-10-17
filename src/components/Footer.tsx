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
              href="https://community.arc.io/home"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[var(--accent)] transition-colors"
            >
              Arc House
            </a>
            {' · '}
            <a
              href="https://explorer.arc.io/address/0x5edD40f2817D5ADd1E991dAfa6852521ef19fDA7"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[var(--accent)] transition-colors font-mono"
            >
              0x5edD…fDA7
            </a>
          </p>
        </div>

        {/* Contract chain badge */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
          <span className="text-[var(--muted)]">Arc Mainnet</span>
        </div>
      </div>
    </footer>
  )
}
