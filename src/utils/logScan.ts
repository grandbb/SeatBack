import type { AbiEvent, PublicClient } from 'viem'

/**
 * Chunked eth_getLogs for the public Arc RPC.
 *
 * The RPC rejects ranges above ~10,000 blocks ("requested range too large") and rate-limits
 * bursts ("rate limit exceeded"), so a single call from the deploy block does not work.
 * This walks the range in safe chunks, one request at a time, retrying on rate limits.
 */
const CHUNK = 8_000n
const MAX_ATTEMPTS = 6

export interface ScannedLog {
  eventName: string
  args: Record<string, unknown>
  blockNumber: bigint
}

function isRateLimit(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message ?? err).toLowerCase()
  return msg.includes('rate limit') || msg.includes('429') || msg.includes('-32005') || msg.includes('too many')
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (!isRateLimit(err)) throw err
      await sleep(400 * 2 ** attempt)
    }
  }
  throw lastErr
}

export async function getLogsChunked(
  client: PublicClient,
  address: `0x${string}`,
  events: readonly AbiEvent[],
  fromBlock: bigint,
): Promise<ScannedLog[]> {
  const latest = await withRetry(() => client.getBlockNumber())
  const out: ScannedLog[] = []
  for (let start = fromBlock; start <= latest; start += CHUNK) {
    const end = start + CHUNK - 1n > latest ? latest : start + CHUNK - 1n
    const logs = await withRetry(() =>
      client.getLogs({ address, events: events as AbiEvent[], fromBlock: start, toBlock: end }),
    )
    for (const l of logs as unknown as Array<{ eventName: string; args: Record<string, unknown>; blockNumber: bigint }>) {
      out.push({ eventName: l.eventName, args: l.args, blockNumber: l.blockNumber })
    }
  }
  return out
}
