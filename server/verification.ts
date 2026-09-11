import { isIntentId } from '../src/lib/ids.ts'
import { normalizeTransactionHash } from '../src/lib/observe.ts'
import {
  verifyPayment,
  type ExpectedNimPayment,
  type VerificationResult,
} from '../src/lib/verify.ts'
import type { NimiqNetwork } from '../src/lib/network.ts'
import type { ObserveTransaction } from './observation.ts'

export type HashReservationStore = {
  ownerOf(hash: string): string | null
  reserve(hash: string, intentId: string): void
}

export function createHashReservationStore(): HashReservationStore {
  const owners = new Map<string, string>()

  return {
    ownerOf(hash) {
      return owners.get(hash) ?? null
    },
    reserve(hash, intentId) {
      owners.set(hash, intentId)
    },
  }
}

/**
 * A hash that already verified one intent cannot verify a different intent.
 * Re-checking the same intent with the same hash remains VERIFIED.
 */
export function rejectReplayedVerification(
  result: VerificationResult,
  intentId: string,
  transactionHash: string,
  reservations: HashReservationStore,
): VerificationResult {
  if (result.outcome !== 'VERIFIED') {
    return result
  }

  const hash = normalizeTransactionHash(transactionHash) ?? result.transactionHash
  if (!hash) {
    return result
  }

  const owner = reservations.ownerOf(hash)
  if (owner && owner !== intentId) {
    return {
      ...result,
      outcome: 'MISMATCH',
      reason: 'REPLAYED_TRANSACTION',
    }
  }

  reservations.reserve(hash, intentId)
  return result
}

export type VerifyApiResponse = VerificationResult & {
  intentId: string
  network: NimiqNetwork
  explanation: string
}

export type ParsedVerifyRequest =
  | { ok: true, intentId: string, transactionHash: string }
  | { ok: false, error: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

/**
 * Accept only a server-owned intent ID and a transaction hash.
 * Client-supplied amount, recipient, network, outcome, and observation
 * fields are ignored.
 */
export function parseVerifyRequest(body: unknown): ParsedVerifyRequest {
  if (!isRecord(body)) {
    return { ok: false, error: 'Request body must be a JSON object.' }
  }

  const intentId = readString(body.intentId)
  const transactionHash = readString(body.transactionHash)

  if (!intentId || !isIntentId(intentId)) {
    return { ok: false, error: 'intentId is required.' }
  }

  if (!transactionHash) {
    return { ok: false, error: 'transactionHash is required.' }
  }

  return { ok: true, intentId, transactionHash }
}

export function parseProofRequest(body: unknown): ParsedVerifyRequest {
  return parseVerifyRequest(body)
}

export function explanationFor(result: VerificationResult): string {
  if (result.outcome === 'VERIFIED') {
    return 'The transaction was found on the Nimiq blockchain. The recipient matches, the amount matches, execution succeeded, and the confirmation requirement was satisfied.'
  }

  if (result.outcome === 'UNDERPAID') {
    return 'PROVIA found the transaction, but the amount received is less than requested.'
  }

  if (result.outcome === 'FAILED') {
    return 'The transaction was included on the Nimiq blockchain, but execution failed.'
  }

  if (result.outcome === 'MISMATCH') {
    if (result.reason === 'WRONG_RECIPIENT') {
      return 'The transaction was sent to a different address than the payment intent.'
    }
    if (result.reason === 'OVERPAID') {
      return 'The transaction amount is greater than the requested amount.'
    }
    if (result.reason === 'WRONG_NETWORK') {
      return 'The transaction was found on a different Nimiq network than the payment intent.'
    }
    return 'PROVIA found the transaction, but it does not match the payment intent.'
  }

  if (result.reason === 'INSUFFICIENT_CONFIRMATIONS') {
    return 'The transaction was found, but it does not yet have enough confirmations to verify.'
  }

  if (result.reason === 'INVALID_HASH') {
    return 'The transaction hash is not a valid 32-byte hex hash.'
  }

  if (result.reason === 'NOT_FOUND') {
    return 'The transaction was not found on the Nimiq network.'
  }

  return 'PROVIA could not establish sufficient blockchain evidence yet.'
}

export function toVerifyApiResponse(
  intentId: string,
  network: NimiqNetwork,
  result: VerificationResult,
): VerifyApiResponse {
  return {
    ...result,
    intentId,
    network,
    explanation: explanationFor(result),
  }
}

/**
 * One authoritative observation plus the shared pure verifier.
 * Does not accept blockchain evidence from the caller.
 */
export async function verifyIntentAgainstChain(
  intent: ExpectedNimPayment,
  transactionHash: string,
  observe: ObserveTransaction,
  reservations: HashReservationStore,
): Promise<VerificationResult> {
  if (!normalizeTransactionHash(transactionHash)) {
    return verifyPayment(intent, {
      status: 'invalid_hash',
      message: 'Enter a 32-byte hex transaction hash.',
    })
  }

  const observation = await observe(transactionHash)
  return rejectReplayedVerification(
    verifyPayment(intent, observation),
    intent.intentId,
    transactionHash,
    reservations,
  )
}
