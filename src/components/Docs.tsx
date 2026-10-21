/**
 * Docs — SeatBack documentation. Plain English, no duplicates.
 */
import { BookOpen, Ticket, QrCode, Coins, Shield, AlertTriangle, Code2, Calendar, ChevronRight, Layers, Gift, Star } from 'lucide-react'
import { SEATBACK_ADDRESS, STAKING_ADDRESS, SBK_ADDRESS, ACTIVE_CHAIN_ID, NETWORK_LABEL } from '@/contract'

const EXPLORER_URL = ACTIVE_CHAIN_ID === 5042
  ? 'https://explorer.arc.io'
  : 'https://explorer.testnet.arc.io'

// ─── Primitives ───────────────────────────────────────────────────────────────

function Section({ id, title, icon, children }: {
  id: string; title: string; icon: React.ReactNode; children: React.ReactNode
}) {
  return (
    <section id={id} className="flex flex-col gap-4 scroll-mt-20">
      <div className="flex items-center gap-3 border-b border-[var(--border)] pb-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent-light)' }}>
          {icon}
        </div>
        <h2 className="text-xl font-bold text-[var(--ink)]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          {title}
        </h2>
      </div>
      {children}
    </section>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-[var(--muted)] leading-relaxed">{children}</p>
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-semibold text-[var(--fg)] text-base mt-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      {children}
    </h3>
  )
}

function Callout({ type, children }: { type: 'info' | 'warn'; children: React.ReactNode }) {
  const colors = type === 'warn'
    ? 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300'
    : 'bg-teal-50 border-teal-200 text-teal-800 dark:bg-teal-950/30 dark:border-teal-800 dark:text-teal-300'
  return (
    <div className={`rounded-xl border p-4 text-sm leading-relaxed ${colors}`}>
      {children}
    </div>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white mt-0.5" style={{ background: 'var(--accent)' }}>
        {n}
      </div>
      <div className="flex flex-col gap-1">
        <p className="font-semibold text-[var(--fg)] text-sm">{title}</p>
        <p className="text-sm text-[var(--muted)] leading-relaxed">{children}</p>
      </div>
    </div>
  )
}

function ContractCard({ name, badge, desc, bullets, addr }: {
  name: string; badge: string; desc: string; bullets: string[]; addr: string
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] p-4 flex flex-col gap-2 text-sm" style={{ background: 'var(--surface)' }}>
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <p className="font-bold text-[var(--fg)] text-base">{name}</p>
          <p className="text-xs text-[var(--muted)] mt-0.5">{desc}</p>
        </div>
        <span className="badge badge-teal flex-shrink-0">{badge}</span>
      </div>
      <ul className="text-xs text-[var(--muted)] leading-relaxed ml-1 list-disc list-inside space-y-0.5 mt-1">
        {bullets.map(b => <li key={b}>{b}</li>)}
      </ul>
      <a
        href={`${EXPLORER_URL}/address/${addr}`}
        target="_blank" rel="noopener noreferrer"
        className="font-mono text-xs text-[var(--accent)] hover:underline break-all mt-1"
      >
        {addr}
      </a>
    </div>
  )
}

// ─── TOC ──────────────────────────────────────────────────────────────────────

const TOC_ITEMS = [
  { id: 'overview',    label: 'Overview' },
  { id: 'how',         label: 'How it works' },
  { id: 'attendee',   label: 'Attendee guide' },
  { id: 'organiser',  label: 'Organiser guide' },
  { id: 'refunds',    label: 'Refund policy' },
  { id: 'contracts',  label: 'Contracts' },
  { id: 'faq',        label: 'FAQ' },
  { id: 'points',     label: 'Points' },
  { id: 'tokenomics', label: 'SBK token' },
  { id: 'airdrop',    label: 'Airdrop' },
  { id: 'source',     label: 'Source code' },
]

// ─── Main ─────────────────────────────────────────────────────────────────────

export function Docs() {
  return (
    <div className="flex flex-col lg:flex-row gap-8 max-w-5xl mx-auto">

      {/* Sidebar TOC */}
      <aside className="hidden lg:flex flex-col gap-1 w-48 flex-shrink-0 sticky top-24 self-start">
        <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">On this page</p>
        {TOC_ITEMS.map(item => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className="text-sm text-[var(--muted)] hover:text-[var(--accent)] transition-colors py-0.5 flex items-center gap-1.5 group"
          >
            <ChevronRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--accent)]" />
            {item.label}
          </a>
        ))}
      </aside>

      {/* Content */}
      <div className="flex-1 flex flex-col gap-12 min-w-0">

        {/* Title */}
        <div className="flex items-center gap-3">
          <BookOpen size={28} className="text-[var(--accent)] flex-shrink-0" />
          <div>
            <h1 className="text-3xl font-bold text-[var(--ink)]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Documentation
            </h1>
            <p className="text-sm text-[var(--muted)] mt-0.5">SeatBack — onchain event attendance escrow on {NETWORK_LABEL}</p>
          </div>
        </div>

        {/* ── 1. Overview ── */}
        <Section id="overview" title="Overview" icon={<BookOpen size={18} className="text-[var(--accent)]" />}>
          <P>
            <strong className="text-[var(--fg)]">SeatBack</strong> solves event no-shows with a USDC deposit.
            Every attendee locks a small deposit when booking. If they show up and get checked in, they get it back.
            If they don't show up, the deposit is split between the organiser and SBK token stakers.
            The entire flow runs on a smart contract — no middleman holds the funds.
          </P>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
            {[
              { emoji: '✅', label: 'Attended', result: 'Full deposit refunded' },
              { emoji: '⏩', label: 'Cancelled on time', result: 'Full deposit refunded' },
              { emoji: '❌', label: 'No-show', result: '50% organiser · 50% SBK stakers' },
            ].map(c => (
              <div key={c.label} className="rounded-xl border border-[var(--border)] p-4 text-sm flex flex-col gap-1" style={{ background: 'var(--surface)' }}>
                <span className="text-lg">{c.emoji}</span>
                <span className="font-semibold text-[var(--fg)]">{c.label}</span>
                <span className="text-[var(--muted)]">{c.result}</span>
              </div>
            ))}
          </div>
          <P>
            Gas fees on Arc are paid in USDC. You do not need ETH or any other token — just USDC in your wallet.
          </P>
        </Section>

        {/* ── 2. How it works ── */}
        <Section id="how" title="How it works" icon={<QrCode size={18} className="text-[var(--accent)]" />}>
          <P>The full lifecycle of a seat, step by step:</P>
          <div className="flex flex-col gap-3 mt-1">
            {[
              { n: 1, t: 'Organiser creates an event', d: 'Sets deposit amount, capacity, booking deadline, refund cutoff, and check-in window. All rules are locked onchain at creation — nothing can be changed afterwards.' },
              { n: 2, t: 'Attendee reserves a seat', d: 'Approves and sends USDC deposit to the escrow contract. The deposit is not held by the organiser — it stays in the contract.' },
              { n: 3, t: 'Event day: attendee generates a QR', d: 'During the check-in window, the attendee signs a message with their wallet (no gas, no transaction). This creates a QR code valid for 10 minutes.' },
              { n: 4, t: 'Organiser scans QR', d: 'The organiser\'s app verifies the signature and submits a check-in transaction onchain. This marks the attendee as present.' },
              { n: 5, t: 'Organiser finalises the event', d: 'After the check-in window closes, finalization calculates who showed up and who didn\'t. Anyone can trigger finalization.' },
              { n: 6, t: 'Everyone collects what they\'re owed', d: 'Checked-in attendees claim their deposit refund. Organiser withdraws no-show proceeds. SBK stakers claim their USDC share.' },
            ].map(({ n, t, d }) => (
              <Step key={n} n={n} title={t}>{d}</Step>
            ))}
          </div>

          <H3>Check-in trust model</H3>
          <Callout type="warn">
            Only the organiser can submit a check-in transaction. There is no self-service check-in.
            If the organiser refuses to scan a present attendee's QR, that attendee may be classified as a no-show.
            Only attend events with organisers you trust.
          </Callout>
        </Section>

        {/* ── 3. Attendee guide ── */}
        <Section id="attendee" title="Attendee guide" icon={<Ticket size={18} className="text-[var(--accent)]" />}>
          <P>
            You need an EVM wallet (MetaMask, Coinbase Wallet, etc.) connected to <strong>{NETWORK_LABEL}</strong>,
            with USDC to cover the deposit and gas (also USDC on Arc).
          </P>
          <div className="flex flex-col gap-3 mt-1">
            <Step n={1} title="Browse and reserve">Go to Events, pick an event, click Reserve. Approve the USDC deposit then confirm the transaction. Your seat is held and the deposit is in escrow.</Step>
            <Step n={2} title="Cancel (if needed)">Go to My Tickets and cancel before the event's refund cutoff. Cancelling after the cutoff is not allowed — your deposit stays locked until finalization.</Step>
            <Step n={3} title="Generate your QR on event day">During the check-in window, open My Tickets → your event → tap Generate QR. Sign the message in your wallet (free, no gas). Show the QR to the organiser within 10 minutes.</Step>
            <Step n={4} title="Claim your refund after">Once the event is finalised, go to My Tickets and click Claim Refund. Your USDC is sent back to your wallet.</Step>
          </div>
          <Callout type="info">
            If your QR expires before the organiser scans it, tap Generate QR again — you can generate as many as needed. Each is valid for 10 minutes.
          </Callout>
        </Section>

        {/* ── 4. Organiser guide ── */}
        <Section id="organiser" title="Organiser guide" icon={<Calendar size={18} className="text-[var(--accent)]" />}>
          <H3>Creating an event</H3>
          <P>Go to Create and fill in all fields. Once submitted, nothing can be changed.</P>
          <div className="rounded-xl border border-[var(--border)] overflow-hidden mt-1">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-[var(--border)]">
                {[
                  ['Title / description / venue', 'Shown publicly'],
                  ['Event start & end', 'When the event takes place'],
                  ['Booking close', 'Last moment attendees can reserve'],
                  ['Refund cutoff', 'Last moment attendees can cancel for a refund'],
                  ['Check-in window', 'Start & end time when QR scans are accepted'],
                  ['Capacity', 'Maximum number of seats'],
                  ['Deposit amount', 'USDC per seat (e.g. 1 = 1 USDC)'],
                  ['Payout wallet', 'Receives no-show proceeds'],
                ].map(([field, note]) => (
                  <tr key={field} style={{ background: 'var(--surface)' }}>
                    <td className="px-4 py-2.5 font-medium text-[var(--fg)] text-sm">{field}</td>
                    <td className="px-4 py-2.5 text-[var(--muted)] text-sm">{note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Callout type="warn">All event rules are permanently locked onchain at creation. Review everything before confirming.</Callout>

          <H3>Running the event</H3>
          <div className="flex flex-col gap-3 mt-1">
            <Step n={1} title="Open check-in">Go to Organiser → your event → Open Check-In when the window starts. QR scans are not accepted before this.</Step>
            <Step n={2} title="Scan attendee QRs">Use the Scan QR tab. Allow camera access, or use Paste Payload if no camera. Review the attendee info shown, then confirm to submit onchain.</Step>
            <Step n={3} title="Finalise and withdraw">After the check-in window closes, click Finalise Event. Then click Withdraw Proceeds to send no-show funds to your payout wallet.</Step>
          </div>

          <H3>Cancelling an event</H3>
          <P>
            You can cancel before the check-in window closes. All deposits immediately become refundable to attendees.
            You receive no proceeds from a cancelled event.
          </P>
        </Section>

        {/* ── 5. Refund policy ── */}
        <Section id="refunds" title="Refund policy" icon={<Coins size={18} className="text-[var(--accent)]" />}>
          <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--surface-muted)' }}>
                  <th className="px-4 py-3 text-left font-semibold text-[var(--fg)]">Situation</th>
                  <th className="px-4 py-3 text-left font-semibold text-[var(--fg)]">Attendee</th>
                  <th className="px-4 py-3 text-left font-semibold text-[var(--fg)]">Organiser</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {[
                  ['Checked in by organiser',         'Full refund',      'No proceeds from this seat'],
                  ['Cancelled before cutoff',          'Full refund',      'No proceeds from this seat'],
                  ['No-show (check-in was opened)',    'No refund',        '50% of deposit as proceeds'],
                  ['No-show (check-in never opened)', 'Full refund',       'No proceeds'],
                  ['Organiser cancels event',          'Full refund',      'No proceeds'],
                ].map(([s, a, o]) => (
                  <tr key={s} style={{ background: 'var(--surface)' }}>
                    <td className="px-4 py-3 font-medium text-[var(--fg-2)] text-sm">{s}</td>
                    <td className="px-4 py-3 text-[var(--muted)] text-sm">{a}</td>
                    <td className="px-4 py-3 text-[var(--muted)] text-sm">{o}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <P>Gas fees are always separate and non-refundable. There is no deadline to claim a refund once it is available.</P>
        </Section>

        {/* ── 6. Contracts ── */}
        <Section id="contracts" title="Contracts" icon={<Shield size={18} className="text-[var(--accent)]" />}>
          <div className="flex flex-wrap gap-3 items-center text-sm mb-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-medium text-[var(--accent)]" style={{ background: 'var(--accent-light)' }}>
              <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse inline-block" />
              {NETWORK_LABEL}
            </span>
            <span className="text-[var(--muted)]">Chain ID <span className="font-mono font-semibold text-[var(--fg)]">{ACTIVE_CHAIN_ID}</span></span>
          </div>

          <div className="flex flex-col gap-3">
            <ContractCard
              name="SeatBack v3"
              badge="Escrow"
              desc="Core contract — handles all events, deposits, check-ins, refunds, and no-show proceeds."
              bullets={[
                'Holds USDC in escrow; no one can access funds outside the rules',
                'Splits no-show proceeds: 50% to organiser, 50% to staking pool',
                'EIP-712 QR check-in with nonce replay protection',
                'Admin can only update the staking pool address — all other rules are immutable',
              ]}
              addr={SEATBACK_ADDRESS ?? ''}
            />
            <ContractCard
              name="SeatBackStaking v2"
              badge="Staking"
              desc="USDC yield pool — SBK holders stake here to earn a share of every event's no-show proceeds."
              bullets={[
                'Minimum stake: 1 SBK · Unstake cooldown: 7,200 blocks (~24 hours)',
                'Receives 50% of no-show USDC from SeatBack at each finalization',
                'Distributes pro-rata to all stakers (your SBK ÷ total staked × pool)',
                'Undistributed proceeds carry forward — no USDC is ever stuck',
              ]}
              addr={STAKING_ADDRESS ?? ''}
            />
            <ContractCard
              name="SeatBack Token (SBK)"
              badge="ERC-20"
              desc="Utility and staking token. Fixed supply of 100,000,000 SBK — no minting ever."
              bullets={[
                '100M fixed supply, minted to deployer at launch',
                'ERC-20Permit: gasless approvals via EIP-2612 signature',
                'Stake SBK to earn USDC from no-show proceeds',
                '30M SBK reserved for community airdrop (not yet distributed)',
              ]}
              addr={SBK_ADDRESS ?? ''}
            />
          </div>

          <H3>Security highlights</H3>
          <ul className="text-sm text-[var(--muted)] leading-relaxed ml-4 list-disc space-y-1 mt-1">
            <li><strong className="text-[var(--fg)]">ReentrancyGuard</strong> on all functions that move tokens.</li>
            <li><strong className="text-[var(--fg)]">SafeERC20</strong> for all USDC transfers.</li>
            <li><strong className="text-[var(--fg)]">EIP-712 + nonce</strong> — QR signatures are chain-bound, contract-bound, event-bound, and single-use.</li>
            <li><strong className="text-[var(--fg)]">ERC-1271</strong> — smart-contract wallets (Safe, Argent) are supported for check-in.</li>
            <li><strong className="text-[var(--fg)]">No upgrade proxy</strong> — deployed code cannot be changed by anyone.</li>
            <li><strong className="text-[var(--fg)]">CSP + HSTS headers</strong> on the frontend; QR rendered as PNG, never as HTML.</li>
          </ul>
        </Section>

        {/* ── 7. FAQ ── */}
        <Section id="faq" title="FAQ" icon={<AlertTriangle size={18} className="text-[var(--accent)]" />}>
          {[
            { q: 'What wallet do I need?', a: 'Any EVM wallet on Arc Mainnet (chain ID 5042): MetaMask, Coinbase Wallet, Rainbow, etc. Smart-contract wallets (Safe, Argent) that implement ERC-1271 also work.' },
            { q: 'What token is used for deposits and gas?', a: 'USDC only. On Arc, gas is also paid in USDC — you do not need ETH or any other token.' },
            { q: 'Can I book two seats at the same event?', a: 'No. One active reservation per wallet per event. Cancel your existing one first if you need to rebook.' },
            { q: 'What if I miss the refund cutoff?', a: 'You cannot cancel after the cutoff. Your deposit stays in escrow. If you\'re not checked in and check-in was opened, it becomes no-show proceeds after finalization.' },
            { q: 'My QR expired — what do I do?', a: 'Tap Generate QR again. Each new QR is valid for 10 minutes. You can generate as many as you need.' },
            { q: 'What if the organiser never finalises?', a: 'Anyone can call finalizeEvent once the check-in window ends. The app does this automatically when you try to claim your refund.' },
            { q: 'Can the organiser change the rules after I book?', a: 'No. Deposit amount, capacity, and all deadlines are locked onchain at creation and cannot be changed.' },
            { q: 'What is SBK and do I need it?', a: 'SBK is the staking token. You do not need it to attend events or get refunds. It is only needed if you want to earn a share of no-show proceeds by staking.' },
          ].map(({ q, a }) => (
            <details key={q} className="group rounded-xl border border-[var(--border)] overflow-hidden" style={{ background: 'var(--surface)' }}>
              <summary className="flex items-center justify-between px-5 py-4 cursor-pointer font-medium text-[var(--fg)] text-sm select-none list-none" style={{ background: 'var(--surface)' }}>
                <span>{q}</span>
                <ChevronRight size={15} className="text-[var(--muted)] group-open:rotate-90 transition-transform flex-shrink-0 ml-3" />
              </summary>
              <div className="px-5 py-4 text-sm text-[var(--muted)] leading-relaxed border-t border-[var(--border)]" style={{ background: 'var(--surface-muted)' }}>
                {a}
              </div>
            </details>
          ))}
        </Section>

        {/* ── 8. SBK token ── */}
        <Section id="tokenomics" title="SBK Token" icon={<Layers size={18} className="text-[var(--accent)]" />}>
          <P>
            <strong className="text-[var(--fg)]">SEATBACK (SBK)</strong> is the staking token for SeatBack.
            Its only purpose is to earn USDC yield from no-show proceeds. Holding SBK without staking earns nothing.
          </P>

          <H3>Token facts</H3>
          <div className="rounded-xl border border-[var(--border)] overflow-hidden">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-[var(--border)]">
                {[
                  ['Total supply',   '100,000,000 SBK', 'Fixed forever — no minting'],
                  ['Decimals',       '18',               'Standard ERC-20'],
                  ['Standard',       'ERC-20 + Permit',  'Gasless approvals (EIP-2612)'],
                  ['Staking min',    '1 SBK',            'Minimum to earn rewards'],
                  ['Unstake delay',  '7,200 blocks',     '~24 hours on Arc'],
                  ['Yield source',   'USDC',             '50% of no-show proceeds per event'],
                ].map(([k, v, n]) => (
                  <tr key={k} style={{ background: 'var(--surface)' }}>
                    <td className="px-4 py-2.5 font-medium text-[var(--fg)] text-sm">{k}</td>
                    <td className="px-4 py-2.5 text-[var(--accent)] font-semibold text-sm">{v}</td>
                    <td className="px-4 py-2.5 text-[var(--muted)] text-sm">{n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <H3>Token allocation</H3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: 'Community airdrop',  pct: '30%', amount: '30,000,000 SBK', desc: 'Early users who reserved, checked in, or created events before the snapshot', color: 'var(--accent)' },
              { label: 'Ecosystem & growth', pct: '25%', amount: '25,000,000 SBK', desc: 'Grants, partnerships, liquidity, and integrations', color: '#8b5cf6' },
              { label: 'Team',               pct: '20%', amount: '20,000,000 SBK', desc: '4-year linear vest with 1-year cliff', color: '#f59e0b' },
              { label: 'Treasury reserve',   pct: '15%', amount: '15,000,000 SBK', desc: 'Future upgrades, audits, and emergencies', color: '#10b981' },
              { label: 'Staking bootstrap',  pct: '10%', amount: '10,000,000 SBK', desc: 'Extra SBK rewards for early stakers while USDC volume grows', color: '#ef4444' },
            ].map(({ label, pct, amount, desc, color }) => (
              <div key={label} className="rounded-xl p-4 border border-[var(--border)]" style={{ background: 'var(--surface)' }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-[var(--fg)] text-sm">{label}</span>
                  <span className="text-lg font-bold" style={{ color }}>{pct}</span>
                </div>
                <div className="text-xs font-mono text-[var(--accent)] mb-1">{amount}</div>
                <p className="text-xs text-[var(--muted)] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          <H3>How no-show proceeds flow to stakers</H3>
          <div className="rounded-xl border border-[var(--border)] p-4 text-sm" style={{ background: 'var(--surface)' }}>
            <p className="font-semibold text-[var(--fg)] mb-3">Example: 10 attendees × 1 USDC deposit = 10 USDC escrowed</p>
            <div className="flex flex-col gap-2 text-[var(--muted)]">
              <div className="flex items-center gap-2"><ChevronRight size={13} className="text-[var(--accent)] flex-shrink-0" /><span>8 show up and check in → 8 USDC becomes refundable to them</span></div>
              <div className="flex items-center gap-2"><ChevronRight size={13} className="text-[var(--accent)] flex-shrink-0" /><span>2 no-shows → 2 USDC are proceeds</span></div>
              <div className="flex items-center gap-2"><ChevronRight size={13} className="text-[var(--accent)] flex-shrink-0" /><span className="font-semibold text-[var(--fg)]">1.00 USDC (50%) → SBK staking pool, split pro-rata to all stakers</span></div>
              <div className="flex items-center gap-2"><ChevronRight size={13} className="text-[var(--accent)] flex-shrink-0" /><span className="font-semibold text-[var(--fg)]">1.00 USDC (50%) → organiser payout wallet</span></div>
            </div>
          </div>
          <P>
            Your USDC reward = (your staked SBK ÷ total staked SBK at finalization) × staking pool amount for that event. Rewards accumulate onchain and can be claimed at any time without unstaking.
          </P>

          <Callout type="warn">
            SBK does not represent equity or voting rights. Staking rewards depend on no-show volume — there is no guaranteed return. This is not investment advice.
          </Callout>
        </Section>

        {/* ── 9. Points ── */}
        <Section id="points" title="Points" icon={<Star size={18} className="text-[var(--accent)]" />}>
          <P>
            Points วัดกิจกรรมบน SeatBack และกำหนดสัดส่วน SBK airdrop ของคุณ
            คำนวณแบบ real-time จาก onchain events โดยตรง — ไม่มี server ไม่ต้องสมัครบัญชี
            เชื่อมต่อ wallet เพื่อดูคะแนนและรายละเอียดใน header
          </P>

          {/* ─ กติกาหลัก ─ */}
          <H3>กติกาการให้คะแนน</H3>

          <div className="rounded-xl border border-[var(--border)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--surface-muted)' }}>
                  <th className="px-4 py-3 text-left font-semibold text-[var(--fg)]">กิจกรรม</th>
                  <th className="px-4 py-3 text-left font-semibold text-[var(--fg)]">คะแนน</th>
                  <th className="px-4 py-3 text-left font-semibold text-[var(--fg)]">เงื่อนไข</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {[
                  ['จองที่นั่ง',     '+100', 'หลังงานจบ + ไม่ยกเลิก + มา check-in จริง'],
                  ['Check in',      '+300', 'หลังงานจบ (finalized) เท่านั้น'],
                  ['สร้างงาน',      '+500', 'งานต้องจบ + มีผู้ check-in จริง ≥ 5 คน + ผ่าน allowlist'],
                  ['Early adopter', '×2',   'First 500 wallets ที่เคย reserve — คะแนนทั้งหมดคูณสอง'],
                ].map(([a, p, n]) => (
                  <tr key={a} style={{ background: 'var(--surface)' }}>
                    <td className="px-4 py-3 font-medium text-[var(--fg)] text-sm">{a}</td>
                    <td className="px-4 py-3 text-[var(--accent)] font-bold text-sm">{p}</td>
                    <td className="px-4 py-3 text-[var(--muted)] text-sm">{n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ─ Pending vs Confirmed ─ */}
          <H3>Pending vs Confirmed</H3>
          <P>
            คะแนนแบ่งเป็น 2 สถานะ:
          </P>
          <div className="flex flex-col gap-2 mt-1">
            <div className="rounded-xl p-4 flex gap-3" style={{ background: 'var(--surface-strong)' }}>
              <span className="text-xl">⏳</span>
              <div>
                <div className="font-semibold text-sm">Pending (รอตรวจสอบ)</div>
                <div className="text-sm opacity-70 mt-0.5">งานที่คุณจอง สร้าง หรือ check-in แต่ยังไม่จบ — แสดงแยก ไม่นับใน total จนกว่างานจะ finalized</div>
              </div>
            </div>
            <div className="rounded-xl p-4 flex gap-3" style={{ background: 'var(--surface-strong)' }}>
              <span className="text-xl">✅</span>
              <div>
                <div className="font-semibold text-sm">Confirmed (นับแล้ว)</div>
                <div className="text-sm opacity-70 mt-0.5">งานจบแล้ว + ผ่านเกณฑ์ทั้งหมด — นับใน total และ airdrop</div>
              </div>
            </div>
          </div>

          {/* ─ สิ่งที่ไม่ได้คะแนน ─ */}
          <H3>สิ่งที่ไม่ได้คะแนน</H3>
          <div className="flex flex-col gap-1.5 mt-1">
            {[
              'ยกเลิกการจอง — คืนเงิน แต่ 0 pts',
              'จองแล้วไม่มา (no-show) — 0 pts หลังงานจบ',
              'งานถูก cancel ก่อนเริ่ม — 0 pts ทุกฝ่าย',
              'สร้างงานที่มีผู้ check-in น้อยกว่า 5 คน — 0 pts ผู้จัด',
              'งานที่ไม่ผ่าน campaign allowlist — 0 pts (ระยะแรก)',
            ].map(t => (
              <div key={t} className="flex items-start gap-2 text-sm">
                <span className="opacity-40 mt-0.5">✗</span>
                <span className="opacity-70">{t}</span>
              </div>
            ))}
          </div>

          {/* ─ เพดาน ─ */}
          <H3>เพดานคะแนน</H3>
          <div className="rounded-xl border border-[var(--border)] overflow-hidden">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-[var(--border)]">
                {[
                  ['สูงสุดต่อ wallet',              '50,000 pts',  'ป้องกัน Sybil ด้วยกระเป๋าเดิมหลายใบ'],
                  ['Reserve ต่องาน',                '1 ครั้ง',     'ถ้าจองซ้ำงานเดิม นับครั้งแรกครั้งเดียว'],
                  ['Check-in ต่องาน',               '1 ครั้ง',     '1 คน 1 check-in ต่องาน'],
                  ['Create ต่องาน',                  '1 ครั้ง',     'ผู้จัดคนเดียวกันกับใน EventCreated log'],
                ].map(([a, b, c]) => (
                  <tr key={a} style={{ background: 'var(--surface)' }}>
                    <td className="px-4 py-3 font-medium text-[var(--fg)] text-sm">{a}</td>
                    <td className="px-4 py-3 text-[var(--accent)] font-semibold text-sm">{b}</td>
                    <td className="px-4 py-3 text-[var(--muted)] text-sm">{c}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ─ Campaign allowlist ─ */}
          <H3>Campaign allowlist</H3>
          <P>
            ในระยะแรก เฉพาะงานที่ผ่านการอนุมัติเข้าแคมเปญเท่านั้นที่สร้างคะแนนได้
            ทุกคนยังสร้างงานได้ตามปกติ แต่คะแนนจะเริ่มนับเมื่องานผ่านเกณฑ์แล้ว
            วิธีนี้ป้องกันงานปลอมในช่วงเริ่มต้น และจะเปิดกว้างเมื่อมีข้อมูลเพียงพอ
          </P>

          {/* ─ การตรวจพฤติกรรม ─ */}
          <H3>การตรวจพฤติกรรมผิดปกติ</H3>
          <P>
            ระบบตรวจ pattern ดังนี้เป็น flag (ไม่ตัดสิทธิ์อัตโนมัติ):
          </P>
          <div className="flex flex-col gap-1.5 mt-1">
            {[
              'กลุ่มกระเป๋าเดิมจองงานเดียวกันซ้ำๆ เกิน 3 ครั้ง',
              'รูปแบบเวลาจองและ check-in เหมือนกันมาก (bot-like)',
              'wallet จากแหล่งเดียวกันร่วมงานกันตลอด',
            ].map(t => (
              <div key={t} className="flex items-start gap-2 text-sm">
                <span className="text-yellow-500 mt-0.5">⚠️</span>
                <span className="opacity-70">{t}</span>
              </div>
            ))}
          </div>
          <P>
            wallet ที่ถูก flag จะเห็นคำเตือนใน Points badge และอาจถูกตรวจเพิ่มก่อน snapshot
            มีช่องทางอุทธรณ์ผ่าน GitHub Issues
          </P>

          {/* ─ ก่อน snapshot ─ */}
          <H3>ก่อน snapshot</H3>
          <P>
            กติกาทั้งหมดนี้จะถูกประกาศและล็อกก่อน snapshot อย่างน้อย 14 วัน
            ผลคะแนนเบื้องต้นจะเผยแพร่ให้ตรวจสอบและอุทธรณ์ก่อนที่ Merkle root จะถูกล็อก
          </P>

          <Callout type="info">
            ⭐ เชื่อมต่อ wallet — คะแนน confirmed และ pending จะแสดงใน header อัตโนมัติ อ่านจาก Arc Mainnet ไม่ใช้ gas
          </Callout>
        </Section>

        {/* ── 10. Airdrop ── */}
        <Section id="airdrop" title="Airdrop — 30M SBK for early users" icon={<Gift size={18} className="text-[var(--accent)]" />}>
          <Callout type="info">
            Not yet distributed. Any onchain activity on SeatBack before the snapshot counts. The snapshot date and claim contract address will be announced publicly.
          </Callout>

          <H3>Who qualifies</H3>
          <P>
            Any wallet that appears in SeatBack's onchain event logs before the snapshot block. No application needed.
            Your allocation = (your points ÷ total points across all wallets) × 30,000,000 SBK.
          </P>

          <div className="rounded-xl border border-[var(--border)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--surface-muted)' }}>
                  <th className="px-4 py-3 text-left font-semibold text-[var(--fg)]">Action</th>
                  <th className="px-4 py-3 text-left font-semibold text-[var(--fg)]">Points</th>
                  <th className="px-4 py-3 text-left font-semibold text-[var(--fg)]">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {[
                  ['จองที่นั่ง',     '100',  'งานจบ + ไม่ยกเลิก + มา check-in จริง'],
                  ['Check in',      '300',  'งานจบ (finalized) เท่านั้น'],
                  ['สร้างงาน',      '500',  'งานจบ + ≥5 check-in + ผ่าน allowlist'],
                  ['Early adopter', '×2',   'First 500 wallets ที่เคย reserve — คูณทั้งหมด'],
                ].map(([a, p, n]) => (
                  <tr key={a} style={{ background: 'var(--surface)' }}>
                    <td className="px-4 py-3 font-medium text-[var(--fg)] text-sm">{a}</td>
                    <td className="px-4 py-3 text-[var(--accent)] font-semibold text-sm">{p}</td>
                    <td className="px-4 py-3 text-[var(--muted)] text-sm">{n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <H3>Claim process</H3>
          <div className="flex flex-col gap-3 mt-1">
            <Step n={1} title="Snapshot">All activity up to the snapshot block is recorded. Nothing after counts.</Step>
            <Step n={2} title="Merkle tree published">Allocations per wallet are computed from onchain data and published publicly for anyone to verify. At least 7 days before claiming opens.</Step>
            <Step n={3} title="Claim contract live">Connect your wallet, see your allocation, submit one transaction to receive SBK.</Step>
            <Step n={4} title="Stake immediately">Once you have SBK, stake to start earning USDC from future no-show proceeds right away.</Step>
          </div>

          <Callout type="warn">
            Splitting across multiple wallets gives no advantage — allocation is proportional. Unclaimed SBK after 180 days returns to Treasury. Always verify the claim contract address on the official GitHub repo before interacting.
          </Callout>
        </Section>

        {/* ── 10. Source code ── */}
        <Section id="source" title="Source code" icon={<Code2 size={18} className="text-[var(--accent)]" />}>
          <P>SeatBack is fully open-source. Smart contracts and frontend are on GitHub.</P>
          <div className="flex flex-wrap gap-3 mt-2">
            <a href="https://github.com/grandbb/SeatBack" target="_blank" rel="noopener noreferrer"
              className="btn-primary px-5 py-2.5 text-sm inline-flex items-center gap-2">
              <Code2 size={15} />View on GitHub
            </a>
            {SEATBACK_ADDRESS && (
              <a href={`${EXPLORER_URL}/address/${SEATBACK_ADDRESS}`} target="_blank" rel="noopener noreferrer"
                className="btn-ghost px-5 py-2.5 text-sm inline-flex items-center gap-2">
                <Shield size={15} />SeatBack on Explorer
              </a>
            )}
          </div>
        </Section>

      </div>
    </div>
  )
}
