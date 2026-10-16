/**
 * wagmi configuration — dual-network (Arc Testnet / Arc Mainnet).
 *
 * VITE_NETWORK=testnet (default) → Arc Testnet (chain 5042002)
 * VITE_NETWORK=mainnet           → Arc Mainnet (chain 5042)
 *
 * The ACTIVE chain is placed first so wagmi and ConnectKit default to it.
 * Both Arc chains are registered so the wallet can switch between them.
 * Ethereum mainnet is included only for ENS resolution.
 *
 * Built with Arc Studio — https://studio.arc.io
 */

import { http, createConfig } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { arcTestnet, arc } from 'viem/chains'
import { injected } from 'wagmi/connectors'
import { registerChain } from './tracing'

// Pre-register both Arc chains so trace events show correct names immediately
registerChain(arcTestnet.id, arcTestnet.rpcUrls.default.http[0])
registerChain(arc.id, arc.rpcUrls.default.http[0])

const IS_MAINNET = (import.meta.env.VITE_NETWORK as string | undefined) === 'mainnet'

// Active chain first — wagmi and ConnectKit default to the first chain in the list
const arcChains = IS_MAINNET
  ? ([arc, arcTestnet] as const)
  : ([arcTestnet, arc] as const)

export const INITIAL_CHAIN_ID = IS_MAINNET ? arc.id : arcTestnet.id

export const config = createConfig({
  chains: [...arcChains, mainnet],
  connectors: [injected()],
  transports: {
    [arcTestnet.id]: http('https://rpc.testnet.arc.io'),
    [arc.id]: http('https://rpc.mainnet.arc.io'),
    [mainnet.id]: http(), // ENS resolution only
  },
})
