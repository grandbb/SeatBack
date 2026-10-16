import { ConnectKitButton } from 'connectkit'
import { useAccount } from 'wagmi'
import { Logo } from './Logo'
import { ACTIVE_CHAIN_ID, IS_MAINNET } from '@/contract'

interface HeaderProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

const TABS = [
  { id: 'home',         label: 'Home' },
  { id: 'events',       label: 'Events' },
  { id: 'create',       label: 'Create' },
  { id: 'reservations', label: 'My Tickets' },
  { id: 'organizer',    label: 'Organiser' },
]

export function Header({ activeTab, onTabChange }: HeaderProps) {
  const { chainId, isConnected } = useAccount()
  const wrongChain = isConnected && chainId !== ACTIVE_CHAIN_ID

  return (
    <header
      className="sticky top-0 z-40"
      style={{
        background: 'rgba(244,250,248,0.88)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border)',
        boxShadow: '0 1px 0 rgba(29,171,142,0.06)',
      }}
    >
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* Brand */}
        <button
          onClick={() => onTabChange('home')}
          className="flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] rounded-lg"
          aria-label="SeatBack home"
        >
          <Logo size="sm" />
        </button>

        {/* Desktop nav */}
        <nav className="hidden sm:flex items-center gap-0.5 flex-1 justify-center" aria-label="Main navigation">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                activeTab === tab.id
                  ? 'text-[var(--accent)] font-semibold'
                  : 'text-[var(--muted)] hover:text-[var(--ink)] hover:bg-white/60'
              }`}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span
                  className="absolute bottom-0.5 left-3 right-3 h-0.5 rounded-full"
                  style={{ background: 'var(--accent)' }}
                />
              )}
            </button>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Network badge */}
          <span className={`hidden md:inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${
            IS_MAINNET
              ? 'bg-[var(--accent-light)] text-[var(--accent-hover)] border-[var(--accent)]/30'
              : 'bg-slate-100 text-slate-500 border-slate-200'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${IS_MAINNET ? 'bg-[var(--accent)]' : 'bg-slate-400'}`} />
            {IS_MAINNET ? 'Mainnet' : 'Testnet'}
          </span>

          {wrongChain && (
            <span className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Wrong network
            </span>
          )}

          <ConnectKitButton />
        </div>
      </div>

      {/* Mobile tab bar */}
      <nav
        className="sm:hidden flex border-t border-[var(--border)]"
        aria-label="Mobile navigation"
        style={{ background: 'rgba(244,250,248,0.95)' }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors relative ${
              activeTab === tab.id
                ? 'text-[var(--accent)]'
                : 'text-[var(--muted)]'
            }`}
            aria-current={activeTab === tab.id ? 'page' : undefined}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span
                className="absolute bottom-0 left-2 right-2 h-0.5 rounded-t-full"
                style={{ background: 'var(--accent)' }}
              />
            )}
          </button>
        ))}
      </nav>
    </header>
  )
}
