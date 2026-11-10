/**
 * SeatBack — root routing component.
 *
 * Tabs: Events | Create | My Reservations | Organiser | Stake
 * Deep-link: ?event=<id> opens that event detail directly and is kept in sync
 * with the URL so share links work.
 */
import { useState, useEffect, useCallback } from 'react'
import { useTheme } from './hooks/useTheme'
import { Header } from './components/Header'
import { EventList } from './components/EventList'
import { EventDetail } from './components/EventDetail'
import { CreateEvent } from './components/CreateEvent'
import { MyReservations } from './components/MyReservations'
import { OrganizerDashboard } from './components/OrganizerDashboard'
import { Footer } from './components/Footer'
import { Docs } from './components/Docs'
import { Demo } from './components/Demo'
import { Staking } from './components/Staking'
import { ErrorBoundary } from './components/ErrorBoundary'

export type AppTab = 'events' | 'create' | 'reservations' | 'organizer' | 'staking' | 'docs' | 'demo'

export { buildEventUrl } from '@/utils/url'

/** Read ?event=N from the URL and return as BigInt, or null. */
function readEventParam(): bigint | null {
  const raw = new URLSearchParams(window.location.search).get('event')
  if (!raw || !/^\d+$/.test(raw)) return null
  try { return BigInt(raw) } catch { return null }
}

/** Push or clear the ?event= param in the browser URL without a page reload. */
function syncUrlParam(eventId: bigint | null) {
  const url = new URL(window.location.href)
  if (eventId !== null) {
    url.searchParams.set('event', eventId.toString())
  } else {
    url.searchParams.delete('event')
  }
  window.history.replaceState(null, '', url.toString())
}

export default function App() {
  useTheme()

  // Initialise from URL so a shared ?event= link opens the right detail directly
  const [activeTab, setActiveTab] = useState<AppTab>('events')
  const [selectedEventId, setSelectedEventId] = useState<bigint | null>(readEventParam)

  // Keep URL in sync whenever selectedEventId changes
  useEffect(() => {
    syncUrlParam(selectedEventId)
  }, [selectedEventId])

  const handleSelectEvent = useCallback((id: bigint) => {
    setSelectedEventId(id)
    setActiveTab('events')
  }, [])

  const handleEventCreated = useCallback(() => {
    setSelectedEventId(null)
    setActiveTab('events')
  }, [])

  const handleTabChange = useCallback((tab: string) => {
    setSelectedEventId(null)
    setActiveTab(tab as AppTab)
  }, [])

  return (
    <div className="min-h-dvh bg-[var(--bg)] flex flex-col">
      <Header activeTab={activeTab} onTabChange={handleTabChange} />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        <ErrorBoundary key={`${activeTab}-${selectedEventId ?? "none"}`}>
        {/* Event detail — shown when an event is selected (from any tab or share link) */}
        {activeTab === 'events' && selectedEventId !== null ? (
          <EventDetail
            eventId={selectedEventId}
            onBack={() => setSelectedEventId(null)}
          />
        ) : (
          <>
            {activeTab === 'events' && (
              <EventList onSelectEvent={handleSelectEvent} />
            )}
            {activeTab === 'create' && (
              <CreateEvent onCreated={handleEventCreated} />
            )}
            {activeTab === 'reservations' && (
              <MyReservations onViewEvent={handleSelectEvent} />
            )}
            {activeTab === 'organizer' && (
              <OrganizerDashboard />
            )}
            {activeTab === 'staking' && (
              <Staking />
            )}
            {activeTab === 'docs' && (
              <Docs />
            )}
            {activeTab === 'demo' && (
              <Demo />
            )}
          </>
        )}
        </ErrorBoundary>
      </main>
      <Footer />
    </div>
  )
}
