import type { NimiqNetwork } from './network.ts'
import { rpcUrlForNetwork } from './network.ts'
import { getNimTransactionByHash, type NimObservationResult } from './observe.ts'

/**
 * Independent blockchain observation. The UI and verification engine depend on
 * this interface, not on raw RPC envelopes, so observation can later move behind
 * a server API without changing `verifyPayment()` or UI result types.
 */
export type PaymentObservationService = {
  getByHash(hash: string, network: NimiqNetwork): Promise<NimObservationResult>
}

export function createRpcObservationService(): PaymentObservationService {
  return {
    getByHash(hash, network) {
      return getNimTransactionByHash(hash, { rpcUrl: rpcUrlForNetwork(network) })
    },
  }
}
