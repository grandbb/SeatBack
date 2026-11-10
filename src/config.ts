/**
 * wagmi configuration — Arc Mainnet only (production).
 *
 * Built with Arc Studio — https://studio.arc.io
 */

import { http, createConfig } from 'wagmi'
import { arc } from 'viem/chains'
import { injected } from 'wagmi/connectors'
import { registerChain } from './tracing'

// Pre-register the chain so trace events show the correct name immediately
registerChain(arc.id, arc.rpcUrls.default.http[0])

export const INITIAL_CHAIN_ID = arc.id // 5042

export const config = createConfig({
  chains: [arc],
  connectors: [injected()],
  transports: {
    [arc.id]: http('https://rpc.mainnet.arc.io'),
  },
})
