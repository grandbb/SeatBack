/**
 * Docs — SeatBack documentation. Each fact appears exactly once.
 */
import { BookOpen, Ticket, QrCode, Coins, Shield, AlertTriangle, Code2, Calendar, ChevronRight, Layers, Star } from 'lucide-react'
import { SEATBACK_ADDRESS, STAKING_ADDRESS, SBK_ADDRESS, ACTIVE_CHAIN_ID, NETWORK_LABEL } from '@/contract'

const EXPLORER_URL = ACTIVE_CHAIN_ID === 5042
  ? 'https://explorer.arc.io'
  : 'https://explorer.arc.io'

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
  // Both types use teal/accent tokens — warn uses slightly stronger border
  const style = type === 'warn'
    ? { background: 'var(--warning-bg)', color: 'var(--warning)', border: '1px solid var(--accent)' }
    : { background: 'var(--accent-muted)', color: 'var(--accent)', border: '1px solid var(--accent-muted)' }
  return (
    <div className="rounded-xl p-4 text-sm leading-relaxed" style={style}>
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
  { id: 'attendee',    label: 'Attendee guide' },
  { id: 'organiser',   label: 'Organiser guide' },
  { id: 'refunds',     label: 'Refund policy' },
  { id: 'contracts',   label: 'Contracts' },
  { id: 'points',      label: 'Points & airdrop' },
  { id: 'tokenomics',  label: 'SBK token' },
  { id: 'faq',         label: 'FAQ' },
  { id: 'source',      label: 'Source code' },
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
            Attendees lock a deposit when booking. Show up and get checked in — full refund.
            No-show — deposit is split 50% to the organiser and 50% to SBK stakers.
            Deposits are held by a smart contract on Arc, not by the organiser or the developer. The organiser alone decides who attended.
          </P>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
            {[
              { emoji: '✅', label: 'Attended', result: 'Full deposit back' },
              { emoji: '⏩', label: 'Cancelled on time', result: 'Full deposit back' },
              { emoji: '❌', label: 'No-show', result: '50% organiser · 50% stakers' },
            ].map(c => (
              <div key={c.label} className="rounded-xl border border-[var(--border)] p-4 text-sm flex flex-col gap-1" style={{ background: 'var(--surface)' }}>
                <span className="text-lg">{c.emoji}</span>
                <span className="font-semibold text-[var(--fg)]">{c.label}</span>
                <span className="text-[var(--muted)]">{c.result}</span>
              </div>
            ))}
          </div>
          <P>
            Gas on Arc is paid in USDC — you only ever need USDC in your wallet. No ETH required.
          </P>
        </Section>

        {/* ── 2. How it works ── */}
        <Section id="how" title="How it works" icon={<QrCode size={18} className="text-[var(--accent)]" />}>
          <P>The full lifecycle of a seat, from booking to payout:</P>
          <div className="flex flex-col gap-3 mt-1">
            <Step n={1} title="Organiser creates an event">Sets deposit amount, capacity, booking deadline, refund cutoff, check-in window, and a payout wallet. The deposit, capacity and all deadlines are locked onchain at creation.</Step>
            <Step n={2} title="Attendee reserves a seat">Sends USDC deposit to the escrow contract. Funds stay in the contract — the organiser cannot touch them.</Step>
            <Step n={3} title="Attendee generates a QR at the door">Signs a message with their wallet (no gas). The QR is valid for 10 minutes. If it expires, generate a new one.</Step>
            <Step n={4} title="Organiser scans the QR">Verifies the signature and submits a check-in transaction onchain. This marks the attendee as present.</Step>
            <Step n={5} title="Event is finalised and settled">After the check-in window closes, anyone can finalise the event and settle its no-show deposits (one transaction, once per event). The contract splits them 50% to the staking pool and 50% to the organiser.</Step>
            <Step n={6} title="Everyone collects what they are owed">Checked-in attendees claim their refund (available as soon as they are checked in). The organiser withdraws their 50% to the event payout wallet. SBK stakers claim their USDC share once their 24 h lock has passed.</Step>
          </div>
          <Callout type="warn">
            <strong>Trust model:</strong> Only the organiser can submit a check-in transaction — there is no self-service check-in.
            The organiser alone decides who attended: if they open check-in and do not check you in, your deposit is treated as a no-show and there is no dispute process.
            Only attend events from organisers you trust.
          </Callout>
        </Section>

        {/* ── 3. Attendee guide ── */}
        <Section id="attendee" title="Attendee guide" icon={<Ticket size={18} className="text-[var(--accent)]" />}>
          <P>
            You need an EVM wallet (MetaMask, Coinbase Wallet, Rainbow, etc.) connected to <strong>{NETWORK_LABEL}</strong> with enough USDC for the deposit and gas.
          </P>
          <div className="flex flex-col gap-3 mt-1">
            <Step n={1} title="Browse and reserve">Go to Events → pick an event → click Reserve. Approve the USDC deposit and confirm. Your seat is held; deposit goes into escrow.</Step>
            <Step n={2} title="Cancel if plans change">Open the event page and cancel before the refund cutoff. After the cutoff you can no longer cancel: you only get your deposit back if you are checked in.</Step>
            <Step n={3} title="Show up and get scanned">During the check-in window, open My Tickets → your event → Show Check-In QR → Generate Check-In QR. Sign with your wallet (free). Show the QR to the organiser within 10 minutes.</Step>
            <Step n={4} title="Claim your refund">Once you are checked in or have cancelled, go to My Tickets (or the event page) and click Claim Refund. USDC is sent to your wallet. If the organiser never opened check-in, everyone can claim a full refund after the check-in window ends.</Step>
          </div>
        </Section>

        {/* ── 4. Organiser guide ── */}
        <Section id="organiser" title="Organiser guide" icon={<Calendar size={18} className="text-[var(--accent)]" />}>
          <H3>Creating an event</H3>
          <P>Go to Create and fill in all fields. The contract enforces this timeline order:</P>
          <div className="rounded-xl border border-[var(--border)] overflow-hidden mt-1">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--surface-muted)' }}>
                  <th className="px-4 py-2.5 text-left font-semibold text-[var(--fg)]">Step</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-[var(--fg)]">Field</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-[var(--fg)]">Meaning</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {[
                  ['①', 'Booking Closes',   'Last moment attendees can reserve'],
                  ['②', 'Refund Cutoff',    'Last moment attendees can cancel for a refund (≥ ①)'],
                  ['③', 'Check-In Opens',   'Earliest time the organiser can open check-in (≥ ②) — set to event start'],
                  ['④', 'Check-In Closes',  'QR scans stop; no-shows are locked; finalisation available (at least 5 minutes after ③)'],
                ].map(([s, f, m]) => (
                  <tr key={f} style={{ background: 'var(--surface)' }}>
                    <td className="px-4 py-2.5 font-bold text-[var(--accent)] text-sm">{s}</td>
                    <td className="px-4 py-2.5 font-medium text-[var(--fg)] text-sm">{f}</td>
                    <td className="px-4 py-2.5 text-[var(--muted)] text-sm">{m}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Callout type="warn">Deposit, capacity and deadlines are permanently locked onchain at creation, and Booking Closes must be on or before the event start. Only the payout wallet can be changed later, by you as organiser. Double-check everything before confirming.</Callout>

          <H3>Running the event</H3>
          <div className="flex flex-col gap-3 mt-1">
            <Step n={1} title="Open check-in">Organiser → your event → Open Check-In. QR scans are not accepted before this.</Step>
            <Step n={2} title="Scan attendee QRs">Use the QR Scanner mode. Allow camera access (Scan with Camera), or use Paste QR Payload. Review the attendee details, then confirm to submit onchain.</Step>
            <Step n={3} title="Finalise, settle and withdraw">After Check-In Closes: click Finalize Event, then Settle No-Show Proceeds (this splits the forfeited deposits 50/50 with stakers; anyone can do it, once). Finally click Withdraw to send your 50% to the event payout wallet. If delivery to the staking pool ever fails, a Retry button appears and anyone can press it.</Step>
          </div>

          <H3>Cancelling an event</H3>
          <P>
            You can cancel before the check-in window closes. All deposits become claimable by attendees, including those already checked in.
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
                  <th className="px-4 py-3 text-left font-semibold text-[var(--fg)]">Attendee gets</th>
                  <th className="px-4 py-3 text-left font-semibold text-[var(--fg)]">Organiser gets</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {[
                  ['Checked in',                        'Full refund',  'Nothing from this seat'],
                  ['Cancelled before cutoff',            'Full refund',  'Nothing from this seat'],
                  ['No-show (check-in was opened)',      'No refund',    '50% of deposit (the other 50% goes to SBK stakers)'],
                  ['No-show (check-in never opened)',    'Full refund',  'Nothing'],
                  ['Organiser cancels event',            'Full refund',  'Nothing'],
                ].map(([s, a, o]) => (
                  <tr key={s} style={{ background: 'var(--surface)' }}>
                    <td className="px-4 py-3 font-medium text-[var(--fg)] text-sm">{s}</td>
                    <td className="px-4 py-3 text-[var(--muted)] text-sm">{a}</td>
                    <td className="px-4 py-3 text-[var(--muted)] text-sm">{o}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <P>Gas fees are non-refundable. There is no deadline to claim a refund once it is available.</P>
        </Section>

        {/* ── 6. Contracts ── */}
        <Section id="contracts" title="Contracts" icon={<Shield size={18} className="text-[var(--accent)]" />}>
          <div className="flex flex-wrap gap-3 items-center text-sm mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-medium text-[var(--accent)]" style={{ background: 'var(--accent-light)' }}>
              <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse inline-block" />
              {NETWORK_LABEL}
            </span>
            <span className="text-[var(--muted)]">Chain ID <span className="font-mono font-semibold text-[var(--fg)]">{ACTIVE_CHAIN_ID}</span></span>
          </div>

          <P>
            Network: Arc Mainnet (chain ID 5042), RPC <span className="font-mono">https://rpc.mainnet.arc.io</span>, explorer <span className="font-mono">https://explorer.arc.io</span>.
            USDC is the ERC-20 at <span className="font-mono">0x3600…0000</span> with 6 decimals; network fees are paid in USDC.
            The Create Event form takes UTC times; everywhere else times are shown in your local timezone with the offset.
          </P>

          <div className="flex flex-col gap-3">
            <ContractCard
              name="SeatBack v4"
              badge="Escrow"
              desc="Core contract — events, deposits, check-ins, refunds, and no-show proceeds."
              bullets={[
                'Holds all USDC in escrow; funds cannot leave outside the rules',
                'No-show split: 50% organiser · 50% staking pool',
                'EIP-712 QR signatures — chain-bound, event-bound, single-use',
                'Admin can set the staking pool exactly once — it can never be changed, and the admin cannot move anyone\'s funds',
                'Organiser proceeds always go to the event payout wallet, which only the organiser can change',
                'No upgrade proxy — deployed code is permanent',
              ]}
              addr={SEATBACK_ADDRESS ?? ''}
            />
            <ContractCard
              name="SeatBackStaking v3"
              badge="Staking"
              desc="SBK holders stake here to earn USDC from every event's no-show proceeds."
              bullets={[
                'Minimum stake: 1 SBK · Claim and unstake unlock 24 h after your last stake',
                'Receives 50% of no-show USDC from SeatBack when an event is settled',
                'If nobody is staking at that moment, that share is held as an owner reserve that only the staking owner can withdraw. It is not given to later stakers',
                'The owner cannot touch staked SBK or rewards already earned by stakers',
                'Reward = your staked SBK ÷ total staked × pool amount for that event',
                'Rounding remainders carry forward exactly once, so rewards are always fully backed by deposited USDC',
              ]}
              addr={STAKING_ADDRESS ?? ''}
            />
            <ContractCard
              name="SeatBack Token (SBK)"
              badge="ERC-20"
              desc="Utility token for staking. Fixed supply — no new SBK can ever be minted."
              bullets={[
                '100,000,000 SBK fixed supply, minted to deployer at launch',
                'ERC-20Permit (EIP-2612) — gasless approvals via wallet signature',
                'Stake to earn USDC; holding without staking earns nothing',
                'Planned: 30M SBK for a community airdrop (not distributed; no claim contract exists yet)',
              ]}
              addr={SBK_ADDRESS ?? ''}
            />
          </div>

          <H3>Security</H3>
          <ul className="text-sm text-[var(--muted)] leading-relaxed ml-4 list-disc space-y-1 mt-1">
            <li><strong className="text-[var(--fg)]">ReentrancyGuard</strong> on every function that moves tokens.</li>
            <li><strong className="text-[var(--fg)]">SafeERC20</strong> for all USDC transfers.</li>
            <li><strong className="text-[var(--fg)]">ERC-1271</strong> — smart-contract wallets (Safe, Argent) supported for check-in.</li>
            <li><strong className="text-[var(--fg)]">CSP + HSTS headers</strong> on the frontend; QR rendered as PNG, never HTML.</li>
            <li><strong className="text-[var(--fg)]">Not independently audited.</strong> The contracts are open source, tested and internally reviewed, but have not had a third-party audit. Only use amounts you can afford to lose.</li>
          </ul>
        </Section>

        {/* ── 7. Points & Airdrop ── */}
        <Section id="points" title="Points & Airdrop" icon={<Star size={18} className="text-[var(--accent)]" />}>
          <P>
            Points track your onchain activity on SeatBack and are the planned basis for a future community airdrop of <strong className="text-[var(--fg)]">30,000,000 SBK</strong>.
            They are calculated in your browser from onchain events — no account required.
            Connect your wallet and open the wallet menu to see your score and breakdown.
          </P>

          <Callout type="info">
            The airdrop is planned and not guaranteed. Nothing has been distributed, and no snapshot date, claim contract or final formula has been set.
          </Callout>

          <H3>How points are earned</H3>
          <div className="rounded-xl border border-[var(--border)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--surface-muted)' }}>
                  <th className="px-4 py-3 text-left font-semibold text-[var(--fg)]">Action</th>
                  <th className="px-4 py-3 text-left font-semibold text-[var(--fg)]">Points</th>
                  <th className="px-4 py-3 text-left font-semibold text-[var(--fg)]">Condition</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {[
                  ['Reserve a seat',  '+100', 'Event finalised + you were checked in (not cancelled, not no-show)'],
                  ['Check in',        '+300', 'Event finalised — stacks with Reserve points above'],
                  ['Create an event', '+500', 'Event finalised + at least 5 check-ins from other wallets'],
                  ['Early adopter',   '×2',   'First 500 wallets ever to reserve on SeatBack — all your points doubled'],
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

          <H3>Pending vs Confirmed</H3>
          <P>
            Points are <strong className="text-[var(--fg)]">pending</strong> until the event is finalised. Only confirmed points count toward your airdrop allocation.
            Your wallet badge shows both values separately.
          </P>

          <H3>What earns zero points</H3>
          <div className="flex flex-col gap-1.5 mt-1">
            {[
              'Cancelled reservation — deposit refunded, no points',
              'No-show — 0 pts even if you reserved',
              'Event cancelled before it starts — 0 pts for everyone',
              'Organiser with fewer than 5 real check-ins — 0 pts for create',
            ].map(t => (
              <div key={t} className="flex items-start gap-2 text-sm">
                <span className="opacity-40 mt-0.5">✗</span>
                <span className="opacity-70">{t}</span>
              </div>
            ))}
          </div>

          <H3>Limits and anti-gaming</H3>
          <div className="rounded-xl border border-[var(--border)] overflow-hidden">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-[var(--border)]">
                {[
                  ['Max per wallet',     '50,000 pts',  'Hard cap — extra activity above this earns nothing'],
                  ['Per event',          '1× each',     'Reserve, check-in, and create each count once per event'],
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
          <P>
            Wallets that repeatedly reserve the same event are flagged for review (not automatically disqualified) and see a warning badge.
            No appeals process has been set up yet.
          </P>

          <H3>Airdrop allocation formula</H3>
          <div className="rounded-xl border border-[var(--border)] p-4 text-sm" style={{ background: 'var(--surface)' }}>
            <p className="text-xs text-[var(--muted)] mb-1">Planned, not final:</p>
            <p className="font-mono text-[var(--accent)] font-semibold mb-1">your SBK = (your confirmed points ÷ total all-wallets points) × 30,000,000</p>
            <p className="text-[var(--muted)]">Splitting across wallets is not endorsed and may be flagged. Final airdrop rules are not set.</p>
          </div>

          <H3>Claim process</H3>
          <Callout type="warn">
            To be announced. No claim contract exists yet. Never trust a claim link that is not published on this site and the official GitHub repository.
          </Callout>
        </Section>

        {/* ── 8. SBK Token ── */}
        <Section id="tokenomics" title="SBK Token" icon={<Layers size={18} className="text-[var(--accent)]" />}>
          <P>
            <strong className="text-[var(--fg)]">SEATBACK (SBK)</strong> is the staking token.
            Stake it in SeatBackStaking to earn a share of every event's no-show USDC proceeds.
            Holding without staking earns nothing.
          </P>

          <H3>Token facts</H3>
          <div className="rounded-xl border border-[var(--border)] overflow-hidden">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-[var(--border)]">
                {[
                  ['Total supply',  '100,000,000 SBK', 'Fixed forever — no minting ever'],
                  ['Decimals',      '18',               'Standard ERC-20'],
                  ['Standard',      'ERC-20 + Permit',  'Gasless approvals via EIP-2612'],
                  ['Minimum stake', '1 SBK',            'Your total stake must be at least 1 SBK'],
                  ['Lock period',   '24 hours',         'Claim and unstake unlock 24 h after your last stake; staking again restarts the timer'],
                  ['Current holder','Deployer wallet',  'All 100,000,000 SBK is currently held by the deployer wallet'],
                  ['Yield asset',   'USDC',             "50% of each event's no-show proceeds"],
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

          <H3>Planned token allocation</H3>
          <Callout type="warn">
            This is the planned split. It is not enforced onchain yet: no airdrop, vesting or treasury contract exists today, and all SBK is still in the deployer wallet.
          </Callout>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: 'Community airdrop',  pct: '30%', amount: '30,000,000 SBK', desc: 'Early users — see Points & Airdrop section', color: 'var(--accent)' },
              { label: 'Ecosystem & growth', pct: '25%', amount: '25,000,000 SBK', desc: 'Grants, partnerships, liquidity, integrations', color: '#8b5cf6' },
              { label: 'Team',               pct: '20%', amount: '20,000,000 SBK', desc: 'Planned: 4-year linear vest with 1-year cliff (no vesting contract yet)', color: '#f59e0b' },
              { label: 'Treasury reserve',   pct: '15%', amount: '15,000,000 SBK', desc: 'Planned: future contract versions, audits, emergencies', color: '#10b981' },
              { label: 'Staking bootstrap',  pct: '10%', amount: '10,000,000 SBK', desc: 'Extra rewards for early stakers while USDC volume grows', color: '#ef4444' },
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

          <Callout type="warn">
            SBK does not represent equity or voting rights. Yield depends on no-show volume — no guaranteed return. This is not investment advice.
          </Callout>
        </Section>

        {/* ── 9. FAQ ── */}
        <Section id="faq" title="FAQ" icon={<AlertTriangle size={18} className="text-[var(--accent)]" />}>
          {[
            { q: 'What wallet do I need?', a: 'Any EVM wallet on Arc Mainnet (chain ID 5042): MetaMask, Coinbase Wallet, Rainbow, etc. Smart-contract wallets (Safe, Argent) that implement ERC-1271 also work for check-in.' },
            { q: 'Can I book two seats at the same event?', a: 'No. One active reservation per wallet per event. Cancel your existing one first if you need to rebook.' },
            { q: 'What happens if I miss the refund cutoff?', a: 'Cancellation is not allowed after the cutoff. Your deposit stays in escrow. If you are checked in you get it back; if check-in was opened and you are not checked in, it becomes no-show proceeds after finalisation.' },
            { q: 'What if the organiser never finalises?', a: 'You do not need them to. Anyone can finalise once the check-in window ends, and claiming a refund after that point finalises the event automatically. If check-in was never opened, every attendee can claim a full refund.' },
            { q: 'Who decides whether I attended?', a: 'The organiser. Only they can check attendees in, and there is no dispute process. This is the main trust assumption: only book events from organisers you trust.' },
            { q: 'Can the organiser change the rules after I book?', a: 'No. Deposit amount, capacity, and all deadlines are permanently locked onchain at creation. The organiser can only change the wallet their own proceeds are paid to.' },
            { q: 'Can the developer or admin take the deposits?', a: 'No. Deposits can only go back to attendees, to the event payout wallet, or to the staking pool. The admin can set the staking pool once and nothing else. One caveat: if an event settles while nobody is staking, the staker half is held as an owner reserve that the staking owner can withdraw.' },
            { q: 'Has this been audited?', a: 'The contracts are open source, covered by automated tests and have been through repeated internal security reviews. They have not had an independent third-party audit yet. Use amounts you are comfortable with.' },
            { q: 'What is SBK and do I need it to attend events?', a: 'SBK is optional — you do not need it to attend events or claim refunds. It is only useful if you want to earn USDC by staking and receiving a share of no-show proceeds.' },
            { q: 'Is the airdrop guaranteed?', a: 'No. It is planned. Nothing has been distributed, no claim contract exists, and the rules are not final. Splitting activity across wallets is not endorsed and may be flagged.' },
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
