import { createOpaqueId } from '../src/lib/ids.ts'
import type { NimiqNetwork } from '../src/lib/network.ts'
import type { VerificationResult } from '../src/lib/verify.ts'
import type { ObserveTransaction } from './observation.ts'
import {
  expectedPaymentFromStoredIntent,
  type IntentStore,
  type StoredPaymentIntent,
} from './intents.ts'
import { verifyIntentAgainstChain, type HashReservationStore } from './verification.ts'

export type ProofRecord = {
  proofId: string
  intentId: string
  status: 'VERIFIED'
  asset: 'NIM'
  network: NimiqNetwork
  expectedAmountLuna: number
  observedAmountLuna: number
  recipient: string
  transactionHash: string
  blockNumber: number | null
  confirmationsAtVerification: number
  verifiedAt: string
}

export type ProofStore = {
  put(proof: ProofRecord): void
  get(proofId: string): ProofRecord | null
}

export function createProofStore(): ProofStore {
  const byId = new Map<string, ProofRecord>()

  return {
    put(proof) {
      byId.set(proof.proofId, proof)
    },
    get(proofId) {
      return byId.get(proofId) ?? null
    },
  }
}

function proofFromVerifiedResult(
  stored: StoredPaymentIntent,
  result: VerificationResult,
): ProofRecord | null {
  if (result.outcome !== 'VERIFIED') {
    return null
  }

  if (
    result.observedAmountLuna === null
    || result.observedRecipient === null
    || result.transactionHash === null
    || result.confirmations === null
  ) {
    return null
  }

  return {
    proofId: createOpaqueId('prf'),
    intentId: stored.intentId,
    status: 'VERIFIED',
    asset: stored.asset,
    network: stored.network,
    expectedAmountLuna: result.expectedAmountLuna,
    observedAmountLuna: result.observedAmountLuna,
    recipient: result.observedRecipient,
    transactionHash: result.transactionHash,
    blockNumber: result.observedBlockNumber,
    confirmationsAtVerification: result.confirmations,
    verifiedAt: new Date().toISOString(),
  }
}

export type IssueProofResult =
  | { ok: true, proof: ProofRecord }
  | { ok: false, status: number, error: string, result?: VerificationResult }

/**
 * Independently observes the chain and runs verifyPayment().
 * A proof is issued only when that engine returns VERIFIED.
 */
export async function issueProof(options: {
  intentId: string
  transactionHash: string
  intents: IntentStore
  proofs: ProofStore
  observe: ObserveTransaction
  reservations: HashReservationStore
}): Promise<IssueProofResult> {
  const stored = options.intents.get(options.intentId)
  if (!stored) {
    return { ok: false, status: 404, error: 'Unknown payment intent.' }
  }

  const result = await verifyIntentAgainstChain(
    expectedPaymentFromStoredIntent(stored),
    options.transactionHash,
    options.observe,
    options.reservations,
  )

  const proof = proofFromVerifiedResult(stored, result)
  if (!proof) {
    return {
      ok: false,
      status: 409,
      error: 'A PROVIA verification proof can only be created for a VERIFIED payment.',
      result,
    }
  }

  options.proofs.put(proof)
  return { ok: true, proof }
}
