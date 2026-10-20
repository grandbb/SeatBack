/**
 * Docs — project documentation page (English).
 * Covers: what SeatBack is, how it works for attendees and organisers,
 * the refund policy, the QR check-in flow, trust model, and contract facts.
 */
import { BookOpen, Ticket, QrCode, Coins, Shield, AlertTriangle, Code2, Users, Calendar, ChevronRight } from 'lucide-react'
import { SEATBACK_ADDRESS, ACTIVE_CHAIN_ID, NETWORK_LABEL } from '@/contract'

const EXPLORER_URL = ACTIVE_CHAIN_ID === 5042
  ? 'https://explorer.arc.io'
  : 'https://explorer.testnet.arc.io'

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ id, title, icon, children }: {
  id: string
  title: string
  icon: React.ReactNode
  children: React.ReactNode
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

function Callout({ type, children }: { type: 'info' | 'warn', children: React.ReactNode }) {
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

// ─── TOC ──────────────────────────────────────────────────────────────────────

const TOC_ITEMS = [
  { id: 'overview',    label: 'Overview' },
  { id: 'attendee',   label: 'Attendee guide' },
  { id: 'organiser',  label: 'Organiser guide' },
  { id: 'checkin',    label: 'QR check-in' },
  { id: 'refunds',    label: 'Refund policy' },
  { id: 'trust',      label: 'Trust model' },
  { id: 'contract',   label: 'Contract & security' },
  { id: 'faq',        label: 'FAQ' },
]

// ─── Main component ───────────────────────────────────────────────────────────

export function Docs() {
  return (
    <div className="flex flex-col lg:flex-row gap-8 max-w-5xl mx-auto">

      {/* ── Sidebar TOC (desktop) ── */}
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

      {/* ── Content ── */}
      <div className="flex-1 flex flex-col gap-12 min-w-0">

        {/* Page title */}
        <div className="flex items-center gap-3">
          <BookOpen size={28} className="text-[var(--accent)] flex-shrink-0" />
          <div>
            <h1 className="text-3xl font-bold text-[var(--ink)]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Documentation
            </h1>
            <p className="text-sm text-[var(--muted)] mt-0.5">SeatBack — onchain event attendance escrow</p>
          </div>
        </div>

        {/* ── 1. Overview ── */}
        <Section id="overview" title="Overview" icon={<BookOpen size={18} className="text-[var(--accent)]" />}>
          <P>
            <strong className="text-[var(--fg)]">SeatBack</strong> is an onchain event attendance escrow application built on{' '}
            <a href="https://arc.io" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">{NETWORK_LABEL}</a>.
            It solves a common problem: people book event seats and don't show up, wasting the organiser's resources.
          </P>
          <P>
            SeatBack puts a refundable USDC deposit behind every reservation. The deposit is held in a smart contract —
            not by the organiser, not by a middleman — and is automatically unlocked based on what happens:
          </P>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-1">
            {[
              { emoji: '✅', label: 'Attended', result: 'Full deposit refunded to attendee' },
              { emoji: '⏩', label: 'Cancelled on time', result: 'Full deposit refunded to attendee' },
              { emoji: '❌', label: 'No-show', result: 'Deposit goes to organiser as proceeds' },
            ].map(c => (
              <div key={c.label} className="rounded-xl border border-[var(--border)] p-4 text-sm flex flex-col gap-1" style={{ background: 'var(--surface)' }}>
                <span className="text-lg">{c.emoji}</span>
                <span className="font-semibold text-[var(--fg)]">{c.label}</span>
                <span className="text-[var(--muted)]">{c.result}</span>
              </div>
            ))}
          </div>
          <P>
            Gas fees on Arc are paid in USDC — no separate ETH or native token is required.
            Every action (reserve, cancel, check-in, refund, withdraw) is a real on-chain transaction with a public explorer link.
          </P>
        </Section>

        {/* ── 2. Attendee guide ── */}
        <Section id="attendee" title="Attendee guide" icon={<Ticket size={18} className="text-[var(--accent)]" />}>
          <H3>What you need</H3>
          <P>
            An EVM-compatible wallet (MetaMask, Coinbase Wallet, etc.) connected to <strong>{NETWORK_LABEL}</strong>,
            with enough USDC to cover the event deposit plus a small amount for gas (also USDC on Arc).
          </P>

          <H3>Step-by-step</H3>
          <div className="flex flex-col gap-4 mt-1">
            <Step n={1} title="Browse events">
              Go to the <strong>Events</strong> tab to see all upcoming events. Click an event to view its details:
              deposit amount, event schedule, check-in window, refund deadline, and capacity.
            </Step>
            <Step n={2} title="Reserve a seat">
              Click <strong>Reserve</strong> on the event detail page. Your wallet will prompt you to:
              (a) approve the USDC deposit amount, then (b) confirm the reservation transaction.
              Once confirmed, your seat is held and the deposit is in escrow.
            </Step>
            <Step n={3} title="Cancel (optional)">
              If your plans change, go to <strong>My Tickets</strong> and cancel before the refund cutoff deadline shown on the event.
              Cancelling after the cutoff is not possible — your deposit stays in escrow until the event is finalised.
            </Step>
            <Step n={4} title="Generate your check-in QR on the day">
              During the event's check-in window, open <strong>My Tickets</strong>, find your reservation, and tap
              <strong> Generate QR</strong>. Your wallet will ask for a single EIP-712 signature (no gas, no transaction).
              The QR is valid for <strong>5 minutes</strong> — generate it just before the organiser scans it.
            </Step>
            <Step n={5} title="Show the QR to the organiser">
              The organiser scans your QR and submits an on-chain check-in transaction. Once confirmed,
              your reservation moves to <em>Checked in</em> status.
            </Step>
            <Step n={6} title="Claim your refund">
              After the event ends, return to <strong>My Tickets</strong> and click <strong>Claim Refund</strong>.
              Your USDC deposit is sent back to your wallet in one transaction.
            </Step>
          </div>

          <Callout type="info">
            Your deposit is refundable after organiser-confirmed check-in, or after cancellation before the stated deadline.
            Network fees are separate and non-refundable.
          </Callout>
        </Section>

        {/* ── 3. Organiser guide ── */}
        <Section id="organiser" title="Organiser guide" icon={<Calendar size={18} className="text-[var(--accent)]" />}>
          <H3>Creating an event</H3>
          <P>
            Go to the <strong>Create</strong> tab and fill in the event form. All fields are required:
          </P>
          <ul className="text-sm text-[var(--muted)] leading-relaxed ml-4 list-disc space-y-1 mt-1">
            <li><strong>Title, description, venue</strong> — shown publicly on the event page.</li>
            <li><strong>Event start / end</strong> — when the event takes place.</li>
            <li><strong>Booking close</strong> — deadline for new reservations.</li>
            <li><strong>Refund cutoff</strong> — last moment attendees can cancel for a refund. Must be ≤ check-in start.</li>
            <li><strong>Check-in window</strong> — start and end time when QR check-ins are accepted.</li>
            <li><strong>Capacity</strong> — maximum number of seats.</li>
            <li><strong>Deposit amount</strong> — USDC per seat, in whole units (e.g. 1 = 1 USDC).</li>
            <li><strong>Payout wallet</strong> — address that receives no-show proceeds.</li>
          </ul>
          <Callout type="warn">
            All event rules are written permanently to the blockchain at creation time and <strong>cannot be changed</strong>.
            Review every field carefully before submitting.
          </Callout>

          <H3>Running the event</H3>
          <div className="flex flex-col gap-4 mt-1">
            <Step n={1} title="Open check-in">
              Go to <strong>Organiser</strong> → your event → click <strong>Open Check-In</strong> when
              the check-in window starts. This is required before any QR scans are accepted.
            </Step>
            <Step n={2} title="Scan attendee QRs">
              Use the <strong>Scan QR</strong> tab in the Organiser dashboard. Allow camera access when prompted,
              or use <strong>Paste Payload</strong> if a camera is unavailable.
              Review the attendee details shown, then click <strong>Confirm Check-In</strong> to submit on-chain.
            </Step>
            <Step n={3} title="Finalise and withdraw">
              After the check-in window closes, click <strong>Finalise Event</strong>.
              No-show deposits are moved to your organiser credit.
              Click <strong>Withdraw Proceeds</strong> to send them to your payout wallet.
            </Step>
          </div>

          <H3>Cancelling an event</H3>
          <P>
            You can cancel an event before the check-in window closes. All active deposits immediately become
            refundable for attendees. You receive no proceeds from a cancelled event.
          </P>
        </Section>

        {/* ── 4. QR check-in ── */}
        <Section id="checkin" title="QR check-in" icon={<QrCode size={18} className="text-[var(--accent)]" />}>
          <P>
            SeatBack uses <strong>EIP-712 typed-data signatures</strong> for QR check-in.
            The attendee's wallet signs a structured message — not a transaction, so no gas is spent at signing time.
          </P>

          <H3>What the QR encodes</H3>
          <P>Each QR payload is bound to:</P>
          <ul className="text-sm text-[var(--muted)] leading-relaxed ml-4 list-disc space-y-1 mt-1">
            <li><strong>Chain ID</strong> — cannot be replayed on a different chain.</li>
            <li><strong>Contract address</strong> — cannot be replayed against a different deployment.</li>
            <li><strong>Event ID</strong> — cannot be used for a different event.</li>
            <li><strong>Reservation ID</strong> — unique per booking; stale QRs from cancelled/rebooked reservations are rejected.</li>
            <li><strong>Attendee wallet address</strong> — wallet substitution is rejected.</li>
            <li><strong>Nonce</strong> — cryptographically random 128-bit value; consumed on first use, preventing replays.</li>
            <li><strong>validAfter / validUntil</strong> — maximum 5-minute window, capped to the event's check-in end time.</li>
          </ul>

          <H3>Smart-contract wallet support</H3>
          <P>
            ERC-1271 wallets (Safe, Argent, etc.) are supported. The contract first attempts ECDSA recovery;
            if that fails, it calls <code className="text-xs bg-[var(--surface)] px-1.5 py-0.5 rounded font-mono">isValidSignature</code> on
            the attendee's contract. Wallets that implement neither are not supported for QR check-in;
            the organiser may fall back to the manual direct check-in path.
          </P>

          <Callout type="warn">
            A QR code proves <strong>wallet control</strong>, not physical presence. The organiser is the
            sole on-chain attester of attendance. If the organiser refuses to submit a check-in, the deposit
            may be classified as a no-show after the window closes.
          </Callout>

          <H3>Paste payload fallback</H3>
          <P>
            If camera access is unavailable, the attendee can copy the QR payload text (shown below the QR) and
            the organiser can paste it into the <strong>Paste Payload</strong> input in the scanner.
            The same validation rules apply.
          </P>
        </Section>

        {/* ── 5. Refund policy ── */}
        <Section id="refunds" title="Refund policy" icon={<Coins size={18} className="text-[var(--accent)]" />}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left py-2 pr-4 font-semibold text-[var(--fg)]">Scenario</th>
                  <th className="text-left py-2 pr-4 font-semibold text-[var(--fg)]">Attendee</th>
                  <th className="text-left py-2 font-semibold text-[var(--fg)]">Organiser</th>
                </tr>
              </thead>
              <tbody className="text-[var(--muted)]">
                {[
                  ['Checked in by organiser', 'Full refund claimable', 'No proceeds from this seat'],
                  ['Cancelled before cutoff', 'Full refund claimable', 'No proceeds from this seat'],
                  ['No-show (check-in opened)', 'No refund', 'Deposit as proceeds after finalise'],
                  ['No-show (check-in never opened)', 'Full refund claimable', 'No proceeds'],
                  ['Organiser cancels event', 'Full refund claimable', 'No proceeds'],
                  ['Event never opened, window passed', 'Full refund claimable', 'No proceeds'],
                ].map(([scenario, attendee, organiser]) => (
                  <tr key={scenario} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-2.5 pr-4 font-medium text-[var(--fg-2)]">{scenario}</td>
                    <td className="py-2.5 pr-4">{attendee}</td>
                    <td className="py-2.5">{organiser}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <P>
            Network (gas) fees are always separate and non-refundable. Each refund or withdrawal requires
            one on-chain transaction costing a small USDC gas fee on Arc.
          </P>
        </Section>

        {/* ── 6. Trust model ── */}
        <Section id="trust" title="Trust model" icon={<Users size={18} className="text-[var(--accent)]" />}>
          <H3>What the contract guarantees</H3>
          <ul className="text-sm text-[var(--muted)] leading-relaxed ml-4 list-disc space-y-1 mt-1">
            <li>Deposits are held in the contract — the organiser cannot withdraw them before finalisation.</li>
            <li>An attendee can always claim a refund if their reservation is marked refundable.</li>
            <li>No-show proceeds cannot exceed the sum of deposits from reservations that were not checked in or cancelled.</li>
            <li>A cancelled or rebooked reservation cannot redeem an old QR (stale reservation ID).</li>
            <li>The same QR nonce cannot be consumed twice (replay protection).</li>
          </ul>

          <H3>What requires trust in the organiser</H3>
          <Callout type="warn">
            The organiser is the <strong>sole on-chain attester of attendance</strong>.
            Only the organiser can submit a check-in transaction — there is no self-service attendee check-in path.
            If the organiser opens the check-in window but refuses to scan a present attendee's QR, that attendee's
            deposit may be classified as a no-show after the window closes.
            Attend events only with organisers you trust.
          </Callout>

          <H3>What nobody can do</H3>
          <ul className="text-sm text-[var(--muted)] leading-relaxed ml-4 list-disc space-y-1 mt-1">
            <li>Nobody can cancel an event after the check-in window has closed.</li>
            <li>Nobody can change event rules (deposit, capacity, deadlines) after creation.</li>
            <li>Nobody can use an expired, replayed, or cross-event QR to fake attendance.</li>
            <li>Nobody can drain the contract — all USDC in the contract is accounted for per event.</li>
          </ul>
        </Section>

        {/* ── 7. Contract & security ── */}
        <Section id="contract" title="Contract & security" icon={<Shield size={18} className="text-[var(--accent)]" />}>
          <div className="rounded-xl border border-[var(--border)] p-4 flex flex-col gap-3 text-sm" style={{ background: 'var(--surface)' }}>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <div>
                <span className="text-[var(--muted)]">Network</span>
                <p className="font-semibold text-[var(--fg)]">{NETWORK_LABEL}</p>
              </div>
              <div>
                <span className="text-[var(--muted)]">Chain ID</span>
                <p className="font-semibold text-[var(--fg)] font-mono">{ACTIVE_CHAIN_ID}</p>
              </div>
              <div>
                <span className="text-[var(--muted)]">Contract address</span>
                <a
                  href={`${EXPLORER_URL}/address/${SEATBACK_ADDRESS}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block font-semibold text-[var(--accent)] hover:underline font-mono text-xs mt-0.5 break-all"
                >
                  {SEATBACK_ADDRESS ?? 'Not deployed'}
                </a>
              </div>
            </div>
          </div>

          <H3>Security properties</H3>
          <ul className="text-sm text-[var(--muted)] leading-relaxed ml-4 list-disc space-y-1 mt-1">
            <li><strong>ReentrancyGuard</strong> on all token-transfer functions.</li>
            <li><strong>SafeERC20</strong> for all USDC transfers — handles non-standard token return values.</li>
            <li><strong>EIP-712 domain separator</strong> bound to chain ID and contract address — fork-safe.</li>
            <li><strong>Nonce replay protection</strong> — per-reservation nonce mapping, consumed on first use.</li>
            <li><strong>ERC-1271 support</strong> with safe try/catch — non-conformant contracts return false, not revert.</li>
            <li><strong>No admin keys</strong> — no owner, no upgrade proxy, no pause mechanism. Rules are immutable.</li>
            <li><strong>No native value</strong> — the contract never accepts ETH/native; deposits are ERC-20 only.</li>
          </ul>

          <H3>Frontend security</H3>
          <ul className="text-sm text-[var(--muted)] leading-relaxed ml-4 list-disc space-y-1 mt-1">
            <li>QR content is never navigated to as a URL and never executed.</li>
            <li>Scanned payload is validated against schema, size limits, address format, and chain ID before any action.</li>
            <li>QR image is rendered as a PNG data URL — no innerHTML / XSS surface.</li>
            <li>Content-Security-Policy, HSTS, X-Frame-Options: DENY, and Permissions-Policy headers are set on every response.</li>
          </ul>
        </Section>

        {/* ── 8. FAQ ── */}
        <Section id="faq" title="FAQ" icon={<AlertTriangle size={18} className="text-[var(--accent)]" />}>
          {[
            {
              q: 'What wallet do I need?',
              a: 'Any EVM wallet that supports Arc Mainnet (chain ID 5042), such as MetaMask or Coinbase Wallet. Smart-contract wallets (Safe, Argent) that implement ERC-1271 are also supported.',
            },
            {
              q: 'What token is used for deposits?',
              a: 'USDC on Arc Mainnet. Gas fees on Arc are also paid in USDC — you do not need any other token.',
            },
            {
              q: 'Can I have two reservations for the same event?',
              a: 'No. Each wallet address can hold at most one active reservation per event. You must cancel your existing reservation before booking again.',
            },
            {
              q: 'What happens if I cancel after the refund cutoff?',
              a: 'Cancellation is not allowed after the refund cutoff. Your deposit remains in escrow until the event is finalised. If you are not checked in and check-in was opened, the deposit becomes organiser proceeds.',
            },
            {
              q: 'My QR expired before the organiser scanned it. What do I do?',
              a: 'Generate a new QR — click "Generate QR" again to request a fresh 5-minute signature. There is no limit on how many QRs you can generate.',
            },
            {
              q: 'How long after the event can I claim my refund?',
              a: 'There is no deadline for claiming a refund once it is available. You can claim it any time after the check-in window closes and the event is finalised.',
            },
            {
              q: 'Can the organiser change the deposit amount after I book?',
              a: 'No. All event rules — including deposit amount, capacity, and deadlines — are written to the blockchain at creation and cannot be changed.',
            },
            {
              q: 'What if the organiser never finalises the event?',
              a: 'Anyone can call finaliseEvent once the check-in window has ended. You can also claim your refund directly from My Tickets — the app finalises automatically when needed.',
            },
          ].map(({ q, a }) => (
            <details key={q} className="group rounded-xl border border-[var(--border)] overflow-hidden">
              <summary className="flex items-center justify-between px-5 py-4 cursor-pointer font-medium text-[var(--fg)] text-sm select-none list-none" style={{ background: 'var(--surface)' }}>
                <span>{q}</span>
                <ChevronRight size={15} className="text-[var(--muted)] group-open:rotate-90 transition-transform flex-shrink-0 ml-3" />
              </summary>
              <div className="px-5 py-4 text-sm text-[var(--muted)] leading-relaxed border-t border-[var(--border)]">
                {a}
              </div>
            </details>
          ))}
        </Section>

        {/* ── Source ── */}
        <Section id="source" title="Source code" icon={<Code2 size={18} className="text-[var(--accent)]" />}>
          <P>SeatBack is fully open-source. The smart contract and frontend are available on GitHub.</P>
          <div className="flex flex-wrap gap-3 mt-1">
            <a
              href="https://github.com/grandbb/SeatBack"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary px-5 py-2.5 text-sm inline-flex items-center gap-2"
            >
              <Code2 size={15} />
              View on GitHub
            </a>
            {SEATBACK_ADDRESS && (
              <a
                href={`${EXPLORER_URL}/address/${SEATBACK_ADDRESS}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost px-5 py-2.5 text-sm inline-flex items-center gap-2"
              >
                <Shield size={15} />
                Contract on Explorer
              </a>
            )}
          </div>
        </Section>

      </div>
    </div>
  )
}
