/**
 * SeatBack — root routing component.
 *
 * Tabs: Home | Events | Create | My Reservations | Organiser
 * A selected event ID drives a detail overlay (no URL routing needed for testnet demo).
 */
import { useState } from 'react'
import { Header } from './components/Header'
import { Home } from './components/Home'
import { EventList } from './components/EventList'
import { EventDetail } from './components/EventDetail'
import { CreateEvent } from './components/CreateEvent'
import { MyReservations } from './components/MyReservations'
import { OrganizerDashboard } from './components/OrganizerDashboard'

export type AppTab = 'home' | 'events' | 'create' | 'reservations' | 'organizer'

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('home')
  const [selectedEventId, setSelectedEventId] = useState<bigint | null>(null)

  const handleSelectEvent = (id: bigint) => {
    setSelectedEventId(id)
    // Switch to events tab so the detail back-button works
    setActiveTab('events')
  }

  const handleEventCreated = () => {
    setSelectedEventId(null)
    setActiveTab('events')
  }

  const handleTabChange = (tab: string) => {
    setSelectedEventId(null)
    setActiveTab(tab as AppTab)
  }

  return (
    <div className="min-h-dvh bg-[var(--bg)] flex flex-col">
      <Header activeTab={activeTab} onTabChange={handleTabChange} />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        {/* Event detail overlay (renders on top of events tab) */}
        {activeTab === 'events' && selectedEventId !== null ? (
          <EventDetail
            eventId={selectedEventId}
            onBack={() => setSelectedEventId(null)}
          />
        ) : (
          <>
            {activeTab === 'home' && (
              <Home
                onExplore={() => handleTabChange('events')}
                onCreateEvent={() => handleTabChange('create')}
                onSelectEvent={handleSelectEvent}
              />
            )}
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
          </>
        )}
      </main>
    </div>
  )
}
