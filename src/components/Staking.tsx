/**
 * Staking — SBK token staking UI.
 * Stake SBK to earn USDC from no-show proceeds (80% of event no-shows).
 *
 * NOTE: SBK and Staking contracts are not yet deployed on mainnet.
 *       This UI reads from .env addresses and shows a "not deployed" state
 *       when they are absent.
 */
import { useState, useCallback } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseUnits, formatUnits } from 'viem'
import { Layers, Lock, Unlock, Coins, TrendingUp, AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react'
import { ACTIVE_CHAIN_ID, NETWORK_LABEL, SBK_ADDRESS, STAKING_ADDRESS, STAKING_ABI, SBK_ABI } from '@/contract'

const EXPLORER = ACTIVE_CHAIN_ID === 5042 ? 'https://explorer.arc.io' : 'https://explorer.testnet.arc.io'

// ─── Minimal subset ABIs used by this component ───────────────────────────────

const ERC20_ABI = SBK_ABI


// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt18(val: bigint | undefined, decimals = 2): string {
  if (val == null) return '—'
  return Number(formatUnits(val, 18)).toLocaleString('en-US', { maximumFractionDigits: decimals })
}

function fmt6(val: bigint | undefined, decimals = 4): string {
  if (val == null) return '—'
  return Number(formatUnits(val, 6)).toLocaleString('en-US', { maximumFractionDigits: decimals })
}

// ─── Main component ───────────────────────────────────────────────────────────

export function Staking() {
  const { address, chainId, isConnected } = useAccount()
  const wrongChain = isConnected && chainId !== ACTIVE_CHAIN_ID

  // ── Read state ──────────────────────────────────────────────────────────────

  const { data: sbkBalance, refetch: refetchSbk } = useReadContract({
    address: SBK_ADDRESS || undefined,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!SBK_ADDRESS },
  })

  const { data: sbkAllowance, refetch: refetchAllowance } = useReadContract({
    address: SBK_ADDRESS || undefined,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && STAKING_ADDRESS ? [address, STAKING_ADDRESS] : undefined,
    query: { enabled: !!address && !!SBK_ADDRESS && !!STAKING_ADDRESS },
  })

  const { data: stakedBalance, refetch: refetchStaked } = useReadContract({
    address: STAKING_ADDRESS || undefined,
    abi: STAKING_ABI,
    functionName: 'stakedBalance',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!STAKING_ADDRESS },
  })

  const { data: pendingReward, refetch: refetchReward } = useReadContract({
    address: STAKING_ADDRESS || undefined,
    abi: STAKING_ABI,
    functionName: 'pendingReward',
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!STAKING_ADDRESS },
  })

  const { data: totalStaked, refetch: refetchTotal } = useReadContract({
    address: STAKING_ADDRESS || undefined,
    abi: STAKING_ABI,
    functionName: 'totalStaked',
    query: { enabled: !!STAKING_ADDRESS },
  })

  const { data: undistributed } = useReadContract({
    address: STAKING_ADDRESS || undefined,
    abi: STAKING_ABI,
    functionName: 'undistributedProceeds',
    query: { enabled: !!STAKING_ADDRESS },
  })

  // ── Write state ─────────────────────────────────────────────────────────────

  const { writeContract, data: txHash, isPending, reset: resetWrite } = useWriteContract()
  const { isLoading: isTxLoading, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  const [stakeInput, setStakeInput] = useState('')
  const [unstakeInput, setUnstakeInput] = useState('')
  const [activeAction, setActiveAction] = useState<'stake' | 'unstake' | 'claim' | 'exit' | null>(null)

  const refetchAll = useCallback(() => {
    void refetchSbk()
    void refetchAllowance()
    void refetchStaked()
    void refetchReward()
    void refetchTotal()
  }, [refetchSbk, refetchAllowance, refetchStaked, refetchReward, refetchTotal])

  if (isTxSuccess && activeAction) {
    setActiveAction(null)
    resetWrite()
    setStakeInput('')
    setUnstakeInput('')
    refetchAll()
  }

  // Share %
  const sharePercent = totalStaked && stakedBalance && totalStaked > 0n
    ? ((Number(stakedBalance) / Number(totalStaked)) * 100).toFixed(2)
    : '0.00'

  // Approve needed for stake
  const stakeAmountBigint = stakeInput ? parseUnits(stakeInput, 18) : 0n
  const needsApproval = stakeAmountBigint > 0n && (sbkAllowance ?? 0n) < stakeAmountBigint

  const busy = isPending || isTxLoading

  const handleApprove = () => {
    if (!SBK_ADDRESS || !STAKING_ADDRESS) return
    setActiveAction('stake')
    writeContract({
      address: SBK_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [STAKING_ADDRESS, stakeAmountBigint],
    })
  }

  const handleStake = () => {
    if (!STAKING_ADDRESS || stakeAmountBigint === 0n) return
    setActiveAction('stake')
    writeContract({
      address: STAKING_ADDRESS,
      abi: STAKING_ABI,
      functionName: 'stake',
      args: [stakeAmountBigint],
    })
  }

  const handleUnstake = () => {
    if (!STAKING_ADDRESS || !unstakeInput) return
    setActiveAction('unstake')
    writeContract({
      address: STAKING_ADDRESS,
      abi: STAKING_ABI,
      functionName: 'unstake',
      args: [parseUnits(unstakeInput, 18)],
    })
  }

  const handleClaim = () => {
    if (!STAKING_ADDRESS) return
    setActiveAction('claim')
    writeContract({
      address: STAKING_ADDRESS,
      abi: STAKING_ABI,
      functionName: 'claimReward',
    })
  }

  const handleExit = () => {
    if (!STAKING_ADDRESS) return
    setActiveAction('exit')
    writeContract({
      address: STAKING_ADDRESS,
      abi: STAKING_ABI,
      functionName: 'exit',
    })
  }

  // ── Connected UI ─────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-light)' }}>
          <Layers size={20} className="text-[var(--accent)]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--ink)]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            SBK Staking
          </h1>
          <p className="text-xs text-[var(--muted)]">Stake SBK — earn USDC from event no-show proceeds</p>
        </div>
        <button onClick={refetchAll} className="ml-auto p-2 rounded-lg hover:bg-[var(--surface-muted)] text-[var(--muted)]" title="Refresh">
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Chain warning */}
      {wrongChain && (
        <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: 'var(--warning-bg)', color: 'var(--warning)', border: '1px solid var(--accent-muted)' }}>
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--warning)' }} />
          <p className="text-sm">
            Wrong network. Please switch to {NETWORK_LABEL} to use staking.
          </p>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Your SBK', value: fmt18(sbkBalance), icon: <Coins size={14} /> },
          { label: 'Staked', value: fmt18(stakedBalance), icon: <Lock size={14} /> },
          { label: 'Pool share', value: `${sharePercent}%`, icon: <TrendingUp size={14} /> },
          { label: 'Pending USDC', value: fmt6(pendingReward), icon: <Coins size={14} className="text-teal-500" /> },
        ].map(({ label, value, icon }) => (
          <div key={label} className="card p-4 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-[var(--muted)] text-xs">{icon}{label}</div>
            <div className="text-base font-bold text-[var(--ink)]">{value}</div>
          </div>
        ))}
      </div>

      {/* Pool info */}
      <div className="card p-4 flex items-center justify-between flex-wrap gap-3 text-sm">
        <div className="flex flex-col gap-0.5">
          <span className="text-[var(--muted)] text-xs">Total SBK staked</span>
          <span className="font-semibold text-[var(--fg)]">{fmt18(totalStaked)} SBK</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[var(--muted)] text-xs">Undistributed (cold-start)</span>
          <span className="font-semibold text-[var(--fg)]">{fmt6(undistributed)} USDC</span>
        </div>
        <a href={`${EXPLORER}/address/${STAKING_ADDRESS}`} target="_blank" rel="noopener noreferrer"
          className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1">
          Contract <ExternalLink size={11} />
        </a>
      </div>

      {!isConnected ? (
        <div className="card p-8 text-center text-[var(--muted)] text-sm">Connect your wallet to stake SBK.</div>
      ) : (
        <>
          {/* Stake */}
          <div className="card p-5 flex flex-col gap-4">
            <h2 className="font-semibold text-[var(--fg)] flex items-center gap-2"><Lock size={15} /> Stake SBK</h2>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                placeholder="Amount SBK"
                value={stakeInput}
                onChange={e => setStakeInput(e.target.value)}
                className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
              <button
                onClick={() => setStakeInput(fmt18(sbkBalance, 0).replace(/,/g, ''))}
                className="text-xs px-3 py-2 rounded-xl border border-[var(--border)] text-[var(--muted)] hover:text-[var(--fg)]"
              >Max</button>
            </div>
            {needsApproval ? (
              <button onClick={handleApprove} disabled={busy || wrongChain} className="btn-primary py-3 text-sm disabled:opacity-50">
                {busy && activeAction === 'stake' ? 'Approving…' : 'Approve SBK'}
              </button>
            ) : (
              <button onClick={handleStake} disabled={busy || !stakeInput || stakeAmountBigint === 0n || wrongChain} className="btn-primary py-3 text-sm disabled:opacity-50">
                {busy && activeAction === 'stake' ? 'Staking…' : 'Stake SBK'}
              </button>
            )}
          </div>

          {/* Unstake */}
          <div className="card p-5 flex flex-col gap-4">
            <h2 className="font-semibold text-[var(--fg)] flex items-center gap-2"><Unlock size={15} /> Unstake SBK</h2>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                placeholder="Amount SBK"
                value={unstakeInput}
                onChange={e => setUnstakeInput(e.target.value)}
                className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
              <button
                onClick={() => setUnstakeInput(fmt18(stakedBalance, 0).replace(/,/g, ''))}
                className="text-xs px-3 py-2 rounded-xl border border-[var(--border)] text-[var(--muted)] hover:text-[var(--fg)]"
              >Max</button>
            </div>
            <button onClick={handleUnstake} disabled={busy || !unstakeInput || wrongChain} className="btn-ghost py-3 text-sm border border-[var(--border)] disabled:opacity-50">
              {busy && activeAction === 'unstake' ? 'Unstaking…' : 'Unstake SBK'}
            </button>
          </div>

          {/* Claim + Exit */}
          <div className="grid grid-cols-2 gap-3">
            <div className="card p-5 flex flex-col gap-3">
              <h2 className="font-semibold text-[var(--fg)] text-sm flex items-center gap-2"><Coins size={14} /> Claim USDC</h2>
              <p className="text-xs text-[var(--muted)]">Claim {fmt6(pendingReward)} USDC without unstaking.</p>
              <button onClick={handleClaim} disabled={busy || !pendingReward || (pendingReward) === 0n || wrongChain} className="btn-primary py-2.5 text-sm disabled:opacity-50">
                {busy && activeAction === 'claim' ? 'Claiming…' : 'Claim USDC'}
              </button>
            </div>
            <div className="card p-5 flex flex-col gap-3">
              <h2 className="font-semibold text-[var(--fg)] text-sm flex items-center gap-2"><Unlock size={14} /> Exit All</h2>
              <p className="text-xs text-[var(--muted)]">Unstake all SBK and claim all USDC in one transaction.</p>
              <button onClick={handleExit} disabled={busy || (!stakedBalance && !pendingReward) || wrongChain} className="btn-ghost py-2.5 text-sm border border-[var(--border)] disabled:opacity-50">
                {busy && activeAction === 'exit' ? 'Exiting…' : 'Exit All'}
              </button>
            </div>
          </div>

          {/* Tx status */}
          {txHash && (
            <a href={`${EXPLORER}/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
              className="card p-4 flex items-center gap-3 text-sm hover:bg-[var(--surface-muted)]">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isTxSuccess ? 'bg-green-500' : 'animate-pulse'}`} style={isTxSuccess ? {} : { background: 'var(--accent)' }} />
              <span className="text-[var(--muted)] truncate">{isTxSuccess ? 'Transaction confirmed' : 'Waiting for confirmation…'}</span>
              <ExternalLink size={13} className="ml-auto text-[var(--accent)] flex-shrink-0" />
            </a>
          )}
        </>
      )}
    </div>
  )
}
