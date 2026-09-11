import { isValidNimiqAddress, normalizeNimiqAddress } from '../src/lib/address.ts'
import { isNimiqNetwork, type NimiqNetwork } from '../src/lib/network.ts'
import { normalizeTransactionHash } from '../src/lib/observe.ts'
import {
  verifyPayment,
  type ExpectedNimPayment,
  type VerificationResult,
} from '../src/lib/verify.ts'
import type { ObserveTransaction } from './observation.ts'

export type VerifyApiResponse = VerificationResult & {
  network: NimiqNetwork
  explanation: string
}

export type ParsedVerifyRequest =
  | { ok: true, intent: ExpectedNimPayment, transactionHash: string }
  | { ok: false, error: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function readInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null
}

function parseIntent(value: unknown): ExpectedNimPayment | null {
  if (!isRecord(value)) {
    return null
  }

  const recipient = readString(value.recipient)
  const amountLuna = readInteger(value.amountLuna)
  const asset = readString(value.asset)
  const network = readString(value.network)

  if (!recipient || amountLuna === null || amountLuna < 0 || !asset || !network || !isNimiqNetwork(network)) {
    return null
  }

  if (!isValidNimiqAddress(recipient)) {
    return null
  }

  return {
    recipient: normalizeNimiqAddress(recipient),
    amountLuna,
    asset,
    network,
  }
}

/**
 * Accept only the payment intent and transaction hash.
 * Observed amounts, recipients, confirmations, execution, and "verified"
 * claims from the browser are ignored.
 */
export function parseVerifyRequest(body: unknown): ParsedVerifyRequest {
  if (!isRecord(body)) {
    return { ok: false, error: 'Request body must be a JSON object.' }
  }

  const transactionHash = readString(body.transactionHash)
  const intent = parseIntent(body.intent)

  if (!transactionHash) {
    return { ok: false, error: 'transactionHash is required.' }
  }

  if (!intent) {
    return { ok: false, error: 'intent must include a valid recipient, amountLuna, asset, and network.' }
  }

  return { ok: true, intent, transactionHash }
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
  intent: ExpectedNimPayment,
  result: VerificationResult,
): VerifyApiResponse {
  return {
    ...result,
    network: intent.network,
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
): Promise<VerificationResult> {
  if (!normalizeTransactionHash(transactionHash)) {
    return verifyPayment(intent, {
      status: 'invalid_hash',
      message: 'Enter a 32-byte hex transaction hash.',
    })
  }

  const observation = await observe(transactionHash)
  return verifyPayment(intent, observation)
}
