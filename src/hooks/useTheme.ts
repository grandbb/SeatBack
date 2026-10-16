/**
 * useTheme — light / dark mode toggle.
 *
 * Priority:
 *  1. User's explicit choice stored in localStorage ('seatback-theme')
 *  2. OS/browser prefers-color-scheme
 *
 * Applies the theme by toggling the `dark` class on <html>.
 * All CSS variables are scoped to :root (light) and html.dark (dark)
 * so no React context is needed — class on <html> is the single source.
 */
import { useState, useEffect, useCallback } from 'react'

type Theme = 'light' | 'dark'
const KEY = 'seatback-theme'

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  const stored = localStorage.getItem(KEY) as Theme | null
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  const html = document.documentElement
  if (theme === 'dark') {
    html.classList.add('dark')
  } else {
    html.classList.remove('dark')
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme)

  // Apply on mount and whenever theme changes
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // Listen to OS preference changes (only when user hasn't explicitly chosen)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem(KEY)) {
        const next: Theme = e.matches ? 'dark' : 'light'
        setThemeState(next)
      }
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const setTheme = useCallback((next: Theme) => {
    localStorage.setItem(KEY, next)
    setThemeState(next)
  }, [])

  const toggle = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [theme, setTheme])

  return { theme, setTheme, toggle, isDark: theme === 'dark' }
}
