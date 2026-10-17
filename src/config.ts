/**
 * wagmi configuration — Arc Mainnet (production).
 *
 * Hardcoded to Arc Mainnet (chain 5042).
 * Arc Testnet is kept as a secondary chain so wallets can switch if needed.
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

// Arc Mainnet is first — wagmi and ConnectKit default to it
export const INITIAL_CHAIN_ID = arc.id // 5042

export const config = createConfig({
  chains: [arc, arcTestnet, mainnet],
  connectors: [injected()],
  transports: {
    [arc.id]: http('https://rpc.mainnet.arc.io'),
    [arcTestnet.id]: http('https://rpc.testnet.arc.io'),
    [mainnet.id]: http(), // ENS resolution only
  },
})
