import { useAccount } from 'wagmi'
import { Logo } from './Logo'
import { WalletMenu } from './WalletMenu'
import { ACTIVE_CHAIN_ID, IS_MAINNET } from '@/contract'
import { useTheme } from '@/hooks/useTheme'
import { Sun, Moon } from 'lucide-react'

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
  { id: 'docs',         label: 'Docs' },
]

export function Header({ activeTab, onTabChange }: HeaderProps) {
  const { chainId, isConnected } = useAccount()
  const wrongChain = isConnected && chainId !== ACTIVE_CHAIN_ID
  const { isDark, toggle } = useTheme()

  return (
    <header
      style={{
        background: isDark
          ? 'rgba(11, 22, 34, 0.88)'
          : 'rgba(255, 255, 255, 0.88)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }}
    >
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        {/* Logo */}
        <button
          onClick={() => onTabChange('home')}
          className="flex-shrink-0 focus-visible:outline-none"
          aria-label="Go to home"
        >
          <Logo size="sm" />
        </button>

        {/* Desktop nav */}
        <nav
          className="hidden sm:flex items-center gap-0.5 flex-1 justify-center"
          aria-label="Main navigation"
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
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

        {/* Right controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Network badge */}
          <span className={`hidden md:inline-flex text-xs font-semibold px-2.5 py-1 rounded-full border ${
            IS_MAINNET
              ? 'bg-teal-500/10 text-teal-600 border-teal-300/50 dark:text-teal-300 dark:border-teal-500/30'
              : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-white/5 dark:text-slate-300 dark:border-white/10'
          }`}>
            {IS_MAINNET ? 'Arc Mainnet' : 'Arc Testnet'}
          </span>

          {/* Wrong chain warning */}
          {wrongChain && (
            <span className="hidden sm:inline-flex text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 border border-amber-300/50">
              Wrong network
            </span>
          )}

          {/* Dark / Light toggle */}
          <button
            onClick={toggle}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:bg-[var(--surface-muted)] text-[var(--muted)] hover:text-[var(--ink)]"
          >
            {isDark
              ? <Sun size={17} strokeWidth={2.2} />
              : <Moon size={17} strokeWidth={2.2} />
            }
          </button>

          {/* Wallet button — Points + Sign Out inside */}
          <WalletMenu />
        </div>
      </div>

      {/* Mobile tab bar */}
      <nav
        className="sm:hidden flex items-center border-t border-[var(--border)]"
        aria-label="Mobile navigation"
        style={{ background: 'var(--surface-strong)' }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
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
