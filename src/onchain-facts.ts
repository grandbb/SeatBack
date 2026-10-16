/**
 * onchain-facts — lightweight shim that replaces the Arc Studio injected
 * @/onchain-facts helper for this imported repository.
 *
 * Data is sourced from official Arc documentation:
 *   https://docs.arc.io/arc/references/contract-addresses
 *   https://docs.arc.io/arc/references/connect-to-arc
 *
 * Arc Mainnet  chainId 5042    RPC https://rpc.mainnet.arc.io
 * Arc Testnet  chainId 5042002 RPC https://rpc.testnet.arc.io
 *
 * USDC address is identical on both networks:
 *   0x3600000000000000000000000000000000000000  (6 decimals, ERC-20 view)
 *
 * Native USDC gas token uses 18 decimals — a separate underlying value;
 * never add them together or show them as two separate balances.
 */

// ─── Chain metadata ───────────────────────────────────────────────────────────

interface ChainInfo {
  id: number
  name: string
  rpcUrl: string
  explorerUrl: string
  nativeCurrency: { name: string; symbol: string; decimals: number }
}

const CHAINS: Record<number, ChainInfo> = {
  5042: {
    id: 5042,
    name: 'Arc',
    rpcUrl: 'https://rpc.mainnet.arc.io',
    explorerUrl: 'https://explorer.arc.io',
    nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  },
  5042002: {
    id: 5042002,
    name: 'Arc Testnet',
    rpcUrl: 'https://rpc.testnet.arc.io',
    explorerUrl: 'https://explorer.testnet.arc.io',
    nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  },
}

/** USDC ERC-20 address — same on both Arc networks (6 decimals). */
const USDC_ADDRESS = '0x3600000000000000000000000000000000000000' as const

interface UsdcInfo {
  address: `0x${string}`
  decimals: number
}

/** Returns USDC info for the given Arc chain ID, or undefined if unknown. */
export function getUsdc(chainId: number): UsdcInfo | undefined {
  if (chainId === 5042 || chainId === 5042002) {
    return { address: USDC_ADDRESS, decimals: 6 }
  }
  return undefined
}

/** Returns chain metadata for the given Arc chain ID, throws if unknown. */
export function requireChain(chainId: number): ChainInfo {
  const c = CHAINS[chainId]
  if (!c) throw new Error(`Unknown Arc chain ID: ${chainId}`)
  return c
}

/** Returns a block-explorer URL for a transaction hash, or null if chain unknown. */
export function buildTxExplorerUrl(chainId: number, txHash: string): string | null {
  const c = CHAINS[chainId]
  if (!c) return null
  return `${c.explorerUrl}/tx/${txHash}`
}

/** Returns a block-explorer URL for a wallet/contract address, or null if chain unknown. */
export function buildAddressExplorerUrl(chainId: number, address: string): string | null {
  const c = CHAINS[chainId]
  if (!c) return null
  return `${c.explorerUrl}/address/${address}`
}
