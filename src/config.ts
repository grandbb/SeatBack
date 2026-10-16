/**
 * wagmi configuration — dual-network (Arc Testnet / Arc Mainnet).
 *
 * VITE_NETWORK=testnet (default) → Arc Testnet
 * VITE_NETWORK=mainnet           → Arc Mainnet
 *
 * Both chains are registered so the wallet can switch between them.
 * mainnet (Ethereum) is included only for ENS resolution.
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

export const config = createConfig({
  chains: [arcTestnet, arc, mainnet],
  connectors: [injected()],
  transports: {
    [arcTestnet.id]: http('https://rpc.testnet.arc.io'),
    [arc.id]: http('https://rpc.mainnet.arc.io'),
    [mainnet.id]: http(), // ENS resolution
  },
})
