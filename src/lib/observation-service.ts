import { formatLunaAsNim } from './amount.ts'
import { isIntentId } from './ids.ts'
import type { PaymentIntent } from './intent.ts'
import { DEFAULT_NIMIQ_NETWORK } from './network.ts'
import { verifyPayment, type VerificationResult } from './verify.ts'

export const INTENTS_API_PATH = '/api/intents'
export const VERIFY_API_PATH = '/api/verify'
export const PROOFS_API_PATH = '/api/proofs'

export type PaymentVerificationService = {
  verify(intent: PaymentIntent, transactionHash: string): Promise<VerificationResult>
}

export type VerificationServiceOptions = {
  fetch?: typeof globalThis.fetch
  verifyUrl?: string
  intentsUrl?: string
  proofsUrl?: string
}

export type CreatedServerIntent = {
  intentId: string
  recipient: string
  amountLuna: number
  asset: 'NIM'
  network: PaymentIntent['network']
}

export type ProofRecord = {
  proofId: string
  intentId: string
  status: 'VERIFIED'
  asset: 'NIM'
  network: PaymentIntent['network']
  expectedAmountLuna: number
  observedAmountLuna: number
  recipient: string
  transactionHash: string
  blockNumber: number | null
  confirmationsAtVerification: number
  verifiedAt: string
}

const OUTCOMES: ReadonlySet<string> = new Set([
  'VERIFIED',
  'MISMATCH',
  'UNDERPAID',
  'FAILED',
  'UNRESOLVED',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isVerificationResult(value: unknown): value is VerificationResult {
  return isRecord(value) && typeof value.outcome === 'string' && OUTCOMES.has(value.outcome)
}

function unavailableResult(intent: PaymentIntent, message: string): VerificationResult {
  return verifyPayment(
    {
      intentId: intent.id,
      recipient: intent.recipient,
      amountLuna: intent.amountLuna,
      asset: intent.asset,
      network: intent.network,
    },
    {
      status: 'rpc_error',
      message,
    },
  )
}

async function readJson(response: Response): Promise<unknown> {
  return response.json()
}

export async function createServerIntent(
  draft: { recipient: string, amountLuna: number, asset?: 'NIM', network?: PaymentIntent['network'] },
  options: VerificationServiceOptions = {},
): Promise<CreatedServerIntent> {
  const fetchFn = options.fetch ?? globalThis.fetch
  const intentsUrl = options.intentsUrl ?? INTENTS_API_PATH

  let response: Response
  try {
    response = await fetchFn(intentsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: draft.recipient,
        amountLuna: draft.amountLuna,
        asset: draft.asset ?? 'NIM',
        network: draft.network ?? DEFAULT_NIMIQ_NETWORK,
      }),
    })
  }
  catch {
    throw new Error('PROVIA could not create the payment intent. The verification server is unavailable.')
  }

  let payload: unknown
  try {
    payload = await readJson(response)
  }
  catch {
    throw new Error('PROVIA could not create the payment intent.')
  }

  if (!response.ok || !isRecord(payload) || typeof payload.intentId !== 'string' || !isRecord(payload.intent)) {
    const message = isRecord(payload) && typeof payload.error === 'string'
      ? payload.error
      : 'PROVIA could not create the payment intent.'
    throw new Error(message)
  }

  if (!isIntentId(payload.intentId)) {
    throw new Error('PROVIA returned an invalid payment intent ID.')
  }

  const intent = payload.intent
  if (
    typeof intent.recipient !== 'string'
    || typeof intent.amountLuna !== 'number'
    || intent.asset !== 'NIM'
    || (intent.network !== 'NIMIQ_TESTNET' && intent.network !== 'NIMIQ_MAINNET')
  ) {
    throw new Error('PROVIA returned an invalid payment intent.')
  }

  return {
    intentId: payload.intentId,
    recipient: intent.recipient,
    amountLuna: intent.amountLuna,
    asset: 'NIM',
    network: intent.network,
  }
}

export function paymentIntentFromServer(
  created: CreatedServerIntent,
  extras: { amountNim?: string, purpose?: string | null } = {},
): PaymentIntent {
  return {
    id: created.intentId,
    recipient: created.recipient,
    amountNim: extras.amountNim ?? formatLunaAsNim(created.amountLuna),
    amountLuna: created.amountLuna,
    asset: created.asset,
    network: created.network,
    purpose: extras.purpose ?? null,
    createdAt: new Date().toISOString(),
    status: 'created',
    transactionHash: null,
  }
}

/**
 * Authoritative verification client. POSTs intentId + hash to the PROVIA server.
 * Does not call Nimiq RPC and does not declare VERIFIED locally.
 */
export function createProviaApiVerificationService(
  options: VerificationServiceOptions = {},
): PaymentVerificationService {
  const fetchFn = options.fetch ?? globalThis.fetch
  const verifyUrl = options.verifyUrl ?? VERIFY_API_PATH

  return {
    async verify(intent, transactionHash) {
      if (!isIntentId(intent.id)) {
        return unavailableResult(intent, 'This payment has no server-owned intent ID.')
      }

      let response: Response
      try {
        response = await fetchFn(verifyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            intentId: intent.id,
            transactionHash,
          }),
        })
      }
      catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return unavailableResult(intent, message)
      }

      let payload: unknown
      try {
        payload = await readJson(response)
      }
      catch {
        return unavailableResult(intent, 'PROVIA verification server returned non-JSON.')
      }

      if (!isVerificationResult(payload)) {
        return unavailableResult(intent, 'PROVIA verification server returned an unexpected result.')
      }

      return payload
    },
  }
}

export async function createServerProof(
  intentId: string,
  transactionHash: string,
  options: VerificationServiceOptions = {},
): Promise<ProofRecord> {
  const fetchFn = options.fetch ?? globalThis.fetch
  const proofsUrl = options.proofsUrl ?? PROOFS_API_PATH

  const response = await fetchFn(proofsUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ intentId, transactionHash }),
  })

  const payload: unknown = await readJson(response)
  if (!response.ok || !isRecord(payload) || typeof payload.proofId !== 'string') {
    const message = isRecord(payload) && typeof payload.error === 'string'
      ? payload.error
      : 'PROVIA could not create a verification proof.'
    throw new Error(message)
  }

  return payload as ProofRecord
}

export async function fetchServerProof(
  proofId: string,
  options: VerificationServiceOptions = {},
): Promise<ProofRecord | null> {
  const fetchFn = options.fetch ?? globalThis.fetch
  const response = await fetchFn(`${PROOFS_API_PATH}/${encodeURIComponent(proofId)}`)
  if (response.status === 404) {
    return null
  }

  const payload: unknown = await readJson(response)
  if (!response.ok || !isRecord(payload) || typeof payload.proofId !== 'string') {
    return null
  }

  return payload as ProofRecord
}

export function proofSharePath(proofId: string): string {
  return `?proof=${encodeURIComponent(proofId)}`
}
