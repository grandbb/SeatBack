/**
 * One-time admin setup: link the staking pool to the SeatBack contract.
 *
 * Shown only to the connected admin wallet and only while the pool is not linked.
 * The pool address comes from the app config (not typed by hand) and is checked onchain
 * before the button is enabled: it must point back at this SeatBack and use the same USDC.
 * The contract accepts this call exactly once and it cannot be undone.
 */
import { useEffect } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import {
  SEATBACK_ABI, SEATBACK_ADDRESS, STAKING_ABI, STAKING_ADDRESS, ACTIVE_CHAIN_ID, NETWORK_LABEL, USDC_ADDRESS,
} from '@/contract'
import { parseOnchainError } from '@/utils/format'
import { TxButton } from './TxButton'

const ZERO = '0x0000000000000000000000000000000000000000'

export function AdminSetup() {
  const { address, chainId, isConnected } = useAccount()
  const { switchChain } = useSwitchChain()

  const { data: admin } = useReadContract({
    address: SEATBACK_ADDRESS, abi: SEATBACK_ABI, functionName: 'admin', chainId: ACTIVE_CHAIN_ID,
  })
  const { data: pool, refetch: refetchPool } = useReadContract({
    address: SEATBACK_ADDRESS, abi: SEATBACK_ABI, functionName: 'stakingPool', chainId: ACTIVE_CHAIN_ID,
  })
  const { data: poolSeatBack } = useReadContract({
    address: STAKING_ADDRESS, abi: STAKING_ABI, functionName: 'seatBack', chainId: ACTIVE_CHAIN_ID,
  })
  const { data: poolUsdc } = useReadContract({
    address: STAKING_ADDRESS, abi: STAKING_ABI, functionName: 'usdc', chainId: ACTIVE_CHAIN_ID,
  })

  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: confirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({ hash })

  const mined = isSuccess && receipt?.status === 'success'
  useEffect(() => {
    if (mined) void refetchPool()
  }, [mined, refetchPool])

  const isAdmin = !!address && !!admin && address.toLowerCase() === admin.toLowerCase()
  const alreadyLinked = !!pool && pool !== ZERO
  if (!isConnected || !isAdmin || alreadyLinked) {
    // After a successful link, refresh and hide
    return null
  }

  const wrongChain = chainId !== ACTIVE_CHAIN_ID
  const poolMatches =
    poolSeatBack?.toLowerCase() === SEATBACK_ADDRESS.toLowerCase() &&
    poolUsdc?.toLowerCase() === USDC_ADDRESS.toLowerCase()
  const reverted = isSuccess && receipt?.status !== 'success'

  const submit = () => {
    if (wrongChain) { switchChain({ chainId: ACTIVE_CHAIN_ID }); return }
    if (!poolMatches) return
    writeContract(
      { address: SEATBACK_ADDRESS, abi: SEATBACK_ABI, functionName: 'setStakingPool', args: [STAKING_ADDRESS], chainId: ACTIVE_CHAIN_ID },
      { onError: () => undefined, onSuccess: () => { toast.success('Transaction sent. Waiting for confirmation…') } },
    )
  }

  return (
    <div className="rounded-2xl border p-5 flex flex-col gap-3" style={{ borderColor: 'var(--accent)', background: 'var(--surface-strong)' }}>
      <div className="flex items-center gap-2 font-semibold text-[var(--ink)]">
        <AlertTriangle size={16} className="text-[var(--warning)]" />
        Admin setup required (one time)
      </div>
      <p className="text-sm text-[var(--muted)]">
        Events cannot be created until the staking pool is linked to the SeatBack contract. You are connected as the admin.
        This can be done <strong>only once</strong> and cannot be changed afterwards.
      </p>
      <div className="text-xs font-mono break-all rounded-xl p-3" style={{ background: 'var(--surface-muted)' }}>
        Staking pool: {STAKING_ADDRESS}
      </div>
      {poolSeatBack !== undefined && !poolMatches && (
        <p className="text-sm" style={{ color: 'var(--danger)' }}>
          Safety check failed: this staking contract is not bound to this SeatBack or uses a different USDC. Do not continue.
        </p>
      )}
      {poolMatches && (
        <p className="text-xs text-[var(--muted)]">Safety check passed: the staking contract points to this SeatBack and uses the same USDC.</p>
      )}
      {reverted && <p className="text-sm" style={{ color: 'var(--danger)' }}>The transaction was rejected onchain.</p>}
      {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{parseOnchainError(error)}</p>}
      <TxButton
        onClick={submit}
        isPending={isPending}
        isConfirming={confirming}
        isSuccess={mined}
        disabled={poolSeatBack === undefined || (!wrongChain && !poolMatches)}
        label={wrongChain ? `Switch to ${NETWORK_LABEL}` : 'Link staking pool (one time)'}
        confirmingLabel="Confirming…"
        successLabel="Linked!"
        className="w-full"
      />
    </div>
  )
}
