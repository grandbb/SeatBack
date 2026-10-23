/**
 * Demo — SeatBack walkthrough page.
 * Scroll-through story: Problem → Solution → How it works (step-by-step) → Token → Built on Arc
 */

import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle, ShieldCheck, QrCode, Coins, Users,
  CalendarCheck, Ticket, ScanLine, BadgeCheck, Wallet,
  ArrowRight, ExternalLink, Layers
} from 'lucide-react'

/* ── tiny hook: reveal on scroll ───────────────────── */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold: 0.15 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return { ref, visible }
}

/* ── animated section wrapper ──────────────────────── */
function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const { ref, visible } = useReveal()
  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(28px)',
        transition: `opacity 0.55s ease ${delay}ms, transform 0.55s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  )
}

/* ── section heading ────────────────────────────────── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: 'var(--accent)' }}>
      {children}
    </p>
  )
}

/* ── problem card ───────────────────────────────────── */
function ProblemCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="card p-5 flex gap-4">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
        {icon}
      </div>
      <div>
        <p className="font-semibold text-sm mb-1" style={{ color: 'var(--ink)' }}>{title}</p>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>{body}</p>
      </div>
    </div>
  )
}

/* ── step card ──────────────────────────────────────── */
function StepCard({
  number, icon, title, body, note, role,
}: {
  number: number; icon: React.ReactNode; title: string; body: string; note?: string; role: 'attendee' | 'organiser' | 'both'
}) {
  const roleColor = role === 'attendee'
    ? { bg: 'var(--accent-muted)', color: 'var(--accent)' }
    : role === 'organiser'
      ? { bg: 'rgba(99,102,241,0.1)', color: '#6366f1' }
      : { bg: 'var(--surface-muted)', color: 'var(--ink-2)' }

  return (
    <div className="card p-5 flex gap-4">
      {/* step number */}
      <div className="flex flex-col items-center gap-2 flex-shrink-0">
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white"
          style={{ background: 'var(--accent)' }}>
          {number}
        </div>
        <div className="w-px flex-1 min-h-[24px]" style={{ background: 'var(--border)' }} />
      </div>
      {/* content */}
      <div className="pb-4 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span style={{ color: 'var(--accent)' }}>{icon}</span>
          <span className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{title}</span>
          <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: roleColor.bg, color: roleColor.color }}>
            {role === 'both' ? 'anyone' : role}
          </span>
        </div>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>{body}</p>
        {note && (
          <p className="text-xs mt-2 px-3 py-1.5 rounded-lg"
            style={{ background: 'var(--surface-muted)', color: 'var(--ink-2)' }}>
            {note}
          </p>
        )}
      </div>
    </div>
  )
}

/* ── flow diagram box ───────────────────────────────── */
function FlowBox({ icon, label, sub }: { icon: React.ReactNode; label: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
        style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
        {icon}
      </div>
      <p className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>{label}</p>
      {sub && <p className="text-[10px]" style={{ color: 'var(--muted)' }}>{sub}</p>}
    </div>
  )
}

/* ── main ───────────────────────────────────────────── */
export function Demo() {
  return (
    <div className="space-y-20 pb-16">

      {/* ── HERO ── */}
      <Reveal>
        <div className="text-center py-10 space-y-4">
          <div className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full border"
            style={{ background: 'var(--accent-muted)', color: 'var(--accent)', borderColor: 'var(--border)' }}>
            <Layers size={12} /> How SeatBack works
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold" style={{ color: 'var(--ink)' }}>
            From problem to solution —<br />
            <span style={{ color: 'var(--accent)' }}>step by step</span>
          </h1>
          <p className="text-base max-w-xl mx-auto" style={{ color: 'var(--muted)' }}>
            A full walkthrough of why SeatBack exists, what it solves, and how every participant
            interacts with the protocol.
          </p>
        </div>
      </Reveal>

      {/* ── PROBLEM ── */}
      <section className="space-y-6">
        <Reveal>
          <SectionLabel>The problem</SectionLabel>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--ink)' }}>
            Ghost bookings cost everyone
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            Free or low-cost reservations are easy to abandon. Organisers over-book to compensate,
            attendees miss out on genuine seats, and no one is held accountable.
          </p>
        </Reveal>

        <div className="grid sm:grid-cols-2 gap-4">
          {[
            {
              icon: <AlertTriangle size={18} />, delay: 0,
              title: 'No-show epidemic',
              body: 'Events routinely see 30–60% no-show rates when booking is free. Capacity planning becomes impossible.',
            },
            {
              icon: <Users size={18} />, delay: 80,
              title: 'Real attendees locked out',
              body: 'Seats held by ghost bookings mean genuine participants cannot reserve — trust in the event erodes.',
            },
            {
              icon: <Wallet size={18} />, delay: 160,
              title: 'No financial consequence',
              body: 'Without skin in the game, cancelling at the last minute or simply not showing up carries zero cost.',
            },
            {
              icon: <ShieldCheck size={18} />, delay: 240,
              title: 'No transparent audit trail',
              body: 'Organisers control attendance records. Disputes over refunds have no neutral third party to appeal to.',
            },
          ].map((p) => (
            <Reveal key={p.title} delay={p.delay}>
              <ProblemCard icon={p.icon} title={p.title} body={p.body} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── SOLUTION ── */}
      <section className="space-y-6">
        <Reveal>
          <SectionLabel>The solution</SectionLabel>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--ink)' }}>
            Escrow-backed commitments on Arc
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            SeatBack replaces trust with code. Every reservation locks a USDC deposit in an
            audited smart contract. Show up and get it back. Ghost the event and it funds
            the organiser and SBK stakers.
          </p>
        </Reveal>

        <Reveal delay={80}>
          <div className="card p-6">
            <div className="flex flex-wrap justify-center gap-3 items-center">
              <FlowBox icon={<Ticket size={20} />} label="Reserve" sub="Lock USDC" />
              <ArrowRight size={16} style={{ color: 'var(--muted)' }} />
              <FlowBox icon={<QrCode size={20} />} label="Show up" sub="Sign QR" />
              <ArrowRight size={16} style={{ color: 'var(--muted)' }} />
              <FlowBox icon={<ScanLine size={20} />} label="Check-in" sub="Organiser scans" />
              <ArrowRight size={16} style={{ color: 'var(--muted)' }} />
              <FlowBox icon={<BadgeCheck size={20} />} label="Finalise" sub="Funds released" />
            </div>

            <div className="mt-5 grid sm:grid-cols-3 gap-3">
              {[
                { label: 'Attended', outcome: 'Full deposit refunded to you', color: 'var(--accent)' },
                { label: 'Cancelled on time', outcome: 'Full deposit refunded to you', color: 'var(--accent)' },
                { label: 'No-show', outcome: '50% organiser · 50% SBK stakers', color: 'var(--warning)' },
              ].map((r) => (
                <div key={r.label} className="rounded-xl p-3 text-center"
                  style={{ background: 'var(--surface-muted)' }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: r.color }}>{r.label}</p>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>{r.outcome}</p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── STEP-BY-STEP ── */}
      <section className="space-y-4">
        <Reveal>
          <SectionLabel>Full walkthrough</SectionLabel>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--ink)' }}>
            Every step, every actor
          </h2>
        </Reveal>

        {[
          {
            number: 1, role: 'organiser' as const, icon: <CalendarCheck size={16} />,
            title: 'Organiser creates an event',
            body: 'Sets event name, capacity, deposit amount, booking deadline, refund cutoff, and check-in window. All parameters are written to the contract at creation — nothing can change afterwards.',
            note: 'Timeline enforced onchain: ① Booking Closes ≤ ② Refund Cutoff ≤ ③ Check-In Opens < ④ Check-In Closes',
          },
          {
            number: 2, role: 'attendee' as const, icon: <Ticket size={16} />,
            title: 'Attendee reserves a seat',
            body: 'Approves the USDC deposit and calls reserve(). The deposit is locked in the contract immediately. The organiser cannot access it at this point.',
            note: 'Gas on Arc is paid in USDC — no ETH needed.',
          },
          {
            number: 3, role: 'attendee' as const, icon: <QrCode size={16} />,
            title: 'Attendee generates a QR at the door',
            body: 'Opens My Tickets → Check In. The wallet signs an EIP-712 message (no gas). A QR code is generated valid for 10 minutes. If it expires, generate a new one.',
            note: 'Signing proves wallet control. No transaction is sent at this step.',
          },
          {
            number: 4, role: 'organiser' as const, icon: <ScanLine size={16} />,
            title: 'Organiser scans the QR',
            body: 'Opens Organiser → QR Scanner. Camera reads the code, verifies the signature off-chain, then submits a checkIn() transaction to the contract.',
            note: 'Only the organiser can attest attendance. There is no self-service check-in.',
          },
          {
            number: 5, role: 'both' as const, icon: <BadgeCheck size={16} />,
            title: 'Event is finalised',
            body: 'After the check-in window closes, anyone can call finalise(). The contract calculates no-shows and routes unclaimed deposits: 50% to the organiser wallet set at creation, 50% to the SBK staking pool.',
            note: 'Checked-in attendees can now claim their refund.',
          },
          {
            number: 6, role: 'attendee' as const, icon: <Coins size={16} />,
            title: 'Attendee claims refund',
            body: 'Checked-in attendees call claimRefund() to receive their full deposit back. Cancelled reservations (before refund cutoff) are also refundable.',
          },
          {
            number: 7, role: 'organiser' as const, icon: <Wallet size={16} />,
            title: 'Organiser withdraws no-show proceeds',
            body: 'After finalisation the organiser calls withdrawNoShowProceeds() to receive 50% of forfeited deposits. The remaining 50% is sent to the staking contract automatically.',
          },
        ].map((step, i) => (
          <Reveal key={step.number} delay={i * 60}>
            <StepCard {...step} />
          </Reveal>
        ))}
      </section>

      {/* ── TOKEN ── */}
      <section className="space-y-5">
        <Reveal>
          <SectionLabel>SBK token</SectionLabel>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--ink)' }}>
            Stake to earn from no-shows
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            SEATBACK (SBK) is the protocol token. Staking SBK entitles holders to a share of
            no-show proceeds from every event that routes through the staking pool.
          </p>
        </Reveal>

        <Reveal delay={80}>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              {
                title: 'Fixed supply', value: '100,000,000 SBK',
                body: 'Minted once at deployment. No inflation, no admin mint function.',
              },
              {
                title: 'Staking yield', value: '50% of no-show fees',
                body: 'Pro-rata to staked amount. Distributed every time a SeatBack event is finalised.',
              },
              {
                title: 'Airdrop allocation', value: '30,000,000 SBK',
                body: 'Reserved for early users. Points are earned by creating events, reserving, and checking in.',
              },
            ].map((c, i) => (
              <Reveal key={c.title} delay={i * 80}>
                <div className="card p-5 h-full">
                  <p className="text-xs font-semibold mb-1" style={{ color: 'var(--accent)' }}>{c.title}</p>
                  <p className="text-lg font-bold mb-1" style={{ color: 'var(--ink)' }}>{c.value}</p>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>{c.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </Reveal>

        <Reveal delay={160}>
          <div className="card p-5">
            <p className="text-sm font-semibold mb-3" style={{ color: 'var(--ink)' }}>
              Points — earn your airdrop allocation
            </p>
            <div className="grid grid-cols-3 gap-3 text-center text-sm">
              {[
                { action: 'Create an event', pts: '500 pts' },
                { action: 'Reserve a seat', pts: '100 pts' },
                { action: 'Check in', pts: '300 pts' },
              ].map((r) => (
                <div key={r.action} className="rounded-xl py-3 px-2"
                  style={{ background: 'var(--surface-muted)' }}>
                  <p className="font-bold" style={{ color: 'var(--accent)' }}>{r.pts}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{r.action}</p>
                </div>
              ))}
            </div>
            <p className="text-xs mt-3" style={{ color: 'var(--muted)' }}>
              Points become claimable after the snapshot. Campaign rules and Merkle root will be
              published at least 14 days before the snapshot date.
            </p>
          </div>
        </Reveal>
      </section>

      {/* ── CONTRACTS ── */}
      <section className="space-y-4">
        <Reveal>
          <SectionLabel>Live on Arc Mainnet</SectionLabel>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--ink)' }}>
            Fully audited, fully transparent
          </h2>
        </Reveal>

        <Reveal delay={80}>
          <div className="space-y-3">
            {[
              {
                name: 'SeatBack v3',
                role: 'Event escrow — holds deposits, manages check-in, splits no-show proceeds',
                address: '0x6Fdb06A9Ce387937C2261F489E502e53cA1F0Bbc',
              },
              {
                name: 'SeatBackStaking v2',
                role: 'Staking pool — receives 50% of no-show fees, distributes USDC to SBK stakers',
                address: '0x4ae8f1dA7699f3a78a12f8fD28C83F159c84F177',
              },
              {
                name: 'SBK Token',
                role: 'ERC-20 + ERC-20Permit — fixed 100M supply, minted to deployer at genesis',
                address: '0x6AB94508cB97756873316f6819F258BCE444363f',
              },
            ].map((c, i) => (
              <Reveal key={c.name} delay={i * 60}>
                <a
                  href={`https://explorer.arc.io/address/${c.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="card p-4 flex items-center gap-4 hover:bg-[var(--surface-muted)] transition-colors group"
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
                    <ShieldCheck size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{c.name}</p>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>{c.role}</p>
                    <p className="text-xs font-mono mt-0.5 truncate" style={{ color: 'var(--accent)' }}>
                      {c.address}
                    </p>
                  </div>
                  <ExternalLink size={14} className="flex-shrink-0 opacity-40 group-hover:opacity-80 transition-opacity"
                    style={{ color: 'var(--accent)' }} />
                </a>
              </Reveal>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ── BUILT ON ARC ── */}
      <Reveal>
        <div className="card p-8 text-center space-y-4"
          style={{ background: 'var(--accent-muted)', border: '1.5px solid var(--border)' }}>
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mx-auto"
            style={{ background: 'var(--accent)', color: '#fff' }}>
            <Layers size={26} />
          </div>
          <h3 className="text-xl font-bold" style={{ color: 'var(--ink)' }}>
            Built entirely with Arc Studio
          </h3>
          <p className="text-sm max-w-md mx-auto" style={{ color: 'var(--muted)' }}>
            Smart contracts, frontend, security audits, tokenomics, and deployment — all created
            through natural conversation on{' '}
            <a href="https://studio.arc.io" target="_blank" rel="noopener noreferrer"
              className="font-semibold underline underline-offset-2" style={{ color: 'var(--accent)' }}>
              studio.arc.io
            </a>.
            No backend servers. No admin keys. 100% onchain.
          </p>
          <a
            href="https://studio.arc.io"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--accent)' }}
          >
            Build your own app <ArrowRight size={14} />
          </a>
        </div>
      </Reveal>

    </div>
  )
}
