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
  // Default is always light — user can toggle dark manually
  return 'light'
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



  const setTheme = useCallback((next: Theme) => {
    localStorage.setItem(KEY, next)
    setThemeState(next)
  }, [])

  const toggle = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [theme, setTheme])

  return { theme, setTheme, toggle, isDark: theme === 'dark' }
}
