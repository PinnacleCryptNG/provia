import { fetchWithTimeout } from '../src/lib/http.ts'
import { getNimTransactionByHash, type NimObservationResult } from '../src/lib/observe.ts'

/**
 * Isolated Nimiq RPC endpoint for the PROVIA verification server.
 * Replace this with a production node/provider later.
 * Clients cannot supply an RPC URL.
 */
export const NIMIQ_RPC_URL = process.env.NIMIQ_RPC_URL ?? 'https://rpc.testnet.nimiqwatch.com'

export type ObserveTransaction = (hash: string) => Promise<NimObservationResult>

export function createNimiqRpcObserver(options: {
  rpcUrl?: string
  fetch?: typeof globalThis.fetch
} = {}): ObserveTransaction {
  const rpcUrl = options.rpcUrl ?? NIMIQ_RPC_URL
  const fetchImpl = options.fetch ?? fetchWithTimeout

  return (hash) => getNimTransactionByHash(hash, { rpcUrl, fetch: fetchImpl })
}
