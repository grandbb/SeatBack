import { ConnectKitButton } from 'connectkit'
import { useAccount } from 'wagmi'
import { Logo } from './Logo'
import { ACTIVE_CHAIN_ID, IS_MAINNET } from '@/contract'

interface HeaderProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

const TABS = [
  { id: 'home', label: 'Home' },
  { id: 'events', label: 'Events' },
  { id: 'create', label: 'Create' },
  { id: 'reservations', label: 'My Tickets' },
  { id: 'organizer', label: 'Organiser' },
]

export function Header({ activeTab, onTabChange }: HeaderProps) {
  const { chainId, isConnected } = useAccount()
  const wrongChain = isConnected && chainId !== ACTIVE_CHAIN_ID

  return (
    <header
      style={{
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }}
    >
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <Logo size="sm" />

        <nav className="hidden sm:flex items-center gap-1 flex-1 justify-center" aria-label="Main navigation">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-muted)]'
              }`}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {/* Network badge — always visible to remind users which network is active */}
          <span className={`hidden sm:inline-flex text-xs font-medium px-2 py-1 rounded-md border ${
            IS_MAINNET
              ? 'bg-teal-50 text-teal-700 border-teal-200'
              : 'bg-slate-100 text-slate-600 border-slate-200'
          }`}>
            {IS_MAINNET ? 'Arc Mainnet' : 'Arc Testnet'}
          </span>
          {wrongChain && (
            <span className="hidden sm:inline-flex text-xs font-medium px-2 py-1 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
              Switch to {IS_MAINNET ? 'Arc Mainnet' : 'Arc Testnet'}
            </span>
          )}
          <ConnectKitButton />
        </div>
      </div>

      {/* Mobile nav */}
      <nav
        className="sm:hidden flex items-center border-t border-[var(--border)]"
        aria-label="Mobile navigation"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-[var(--accent)] border-b-2 border-[var(--accent)]'
                : 'text-[var(--muted)]'
            }`}
            aria-current={activeTab === tab.id ? 'page' : undefined}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </header>
  )
}
