import { useState, useRef, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { Logo } from './Logo'
import { WalletMenu } from './WalletMenu'
import { ACTIVE_CHAIN_ID, IS_MAINNET } from '@/contract'
import { useTheme } from '@/hooks/useTheme'
import { Sun, Moon, Menu, X, BookOpen, PlayCircle } from 'lucide-react'

interface HeaderProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

// Primary nav tabs — always visible
const PRIMARY_TABS = [
  { id: 'home',         label: 'Home' },
  { id: 'events',       label: 'Events' },
  { id: 'create',       label: 'Create' },
  { id: 'reservations', label: 'My Tickets' },
  { id: 'organizer',    label: 'Organiser' },
]

// Secondary tabs — live in hamburger menu
const MENU_TABS = [
  { id: 'docs', label: 'Docs',        icon: BookOpen,   desc: 'Full documentation & guides' },
  { id: 'demo', label: 'Demo',        icon: PlayCircle, desc: 'Walkthrough & project overview' },
]

export function Header({ activeTab, onTabChange }: HeaderProps) {
  const { chainId, isConnected } = useAccount()
  const wrongChain = isConnected && chainId !== ACTIVE_CHAIN_ID
  const { isDark, toggle } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    function handle(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [menuOpen])

  // Close menu on Escape
  useEffect(() => {
    if (!menuOpen) return
    function handle(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [menuOpen])

  function navigate(id: string) {
    onTabChange(id)
    setMenuOpen(false)
  }

  const isMenuActive = MENU_TABS.some(t => t.id === activeTab)

  return (
    <header
      style={{
        background: isDark
          ? 'rgba(11, 22, 34, 0.92)'
          : 'rgba(255, 255, 255, 0.92)',
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
          onClick={() => navigate('home')}
          className="flex-shrink-0 focus-visible:outline-none"
          aria-label="Go to home"
        >
          <Logo size="sm" />
        </button>

        {/* Desktop primary nav */}
        <nav
          className="hidden sm:flex items-center gap-0.5 flex-1 justify-center"
          aria-label="Main navigation"
        >
          {PRIMARY_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => navigate(tab.id)}
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
            <span
              className="hidden sm:inline-flex text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ background: 'var(--warning-bg)', color: 'var(--warning)', border: '1px solid var(--accent-muted)' }}
            >
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

          {/* Hamburger menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              aria-label="More pages"
              aria-expanded={menuOpen}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                menuOpen || isMenuActive
                  ? 'bg-[var(--accent)] text-white'
                  : 'hover:bg-[var(--surface-muted)] text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              {menuOpen ? <X size={17} strokeWidth={2.2} /> : <Menu size={17} strokeWidth={2.2} />}
            </button>

            {/* Dropdown */}
            {menuOpen && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 8px)',
                  width: 220,
                  background: isDark ? '#0f1f2e' : '#ffffff',
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  boxShadow: isDark
                    ? '0 8px 32px rgba(0,0,0,0.5)'
                    : '0 8px 32px rgba(0,0,0,0.12)',
                  overflow: 'hidden',
                  zIndex: 50,
                }}
              >
                <div style={{ padding: '6px' }}>
                  {MENU_TABS.map(tab => {
                    const Icon = tab.icon
                    const isActive = activeTab === tab.id
                    return (
                      <button
                        key={tab.id}
                        onClick={() => navigate(tab.id)}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 10,
                          padding: '10px 12px',
                          borderRadius: 10,
                          background: isActive ? 'var(--accent)' : 'transparent',
                          color: isActive ? '#fff' : 'var(--ink)',
                          border: 'none',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => {
                          if (!isActive) (e.currentTarget).style.background = 'var(--surface-muted)'
                        }}
                        onMouseLeave={e => {
                          if (!isActive) (e.currentTarget).style.background = 'transparent'
                        }}
                      >
                        <Icon size={16} strokeWidth={2} style={{ marginTop: 2, flexShrink: 0, opacity: isActive ? 1 : 0.6 }} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{tab.label}</div>
                          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 1 }}>{tab.desc}</div>
                        </div>
                      </button>
                    )
                  })}
                </div>

                <div style={{ borderTop: '1px solid var(--border)', padding: '8px 16px 10px', fontSize: 11, opacity: 0.4 }}>
                  SeatBack on Arc Mainnet
                </div>
              </div>
            )}
          </div>

          {/* Wallet button — Points + Sign Out inside */}
          <WalletMenu />
        </div>
      </div>

      {/* Mobile tab bar — primary tabs only */}
      <nav
        className="sm:hidden flex items-center border-t border-[var(--border)]"
        aria-label="Mobile navigation"
        style={{ background: 'var(--surface-strong)' }}
      >
        {PRIMARY_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => navigate(tab.id)}
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
        {/* Hamburger for mobile too */}
        <button
          onClick={() => setMenuOpen(v => !v)}
          className={`flex-1 py-2.5 text-xs font-semibold transition-colors flex flex-col items-center gap-0.5 ${
            isMenuActive
              ? 'text-[var(--accent)] border-b-2 border-[var(--accent)]'
              : 'text-[var(--muted)]'
          }`}
          aria-label="More"
        >
          <Menu size={14} />
          <span>More</span>
        </button>
      </nav>
    </header>
  )
}
