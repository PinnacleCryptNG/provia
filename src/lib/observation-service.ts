import type { PaymentIntent } from './intent.ts'
import { verifyPayment, type VerificationResult } from './verify.ts'

export const VERIFY_API_PATH = '/api/verify'

export type PaymentVerificationService = {
  verify(intent: PaymentIntent, transactionHash: string): Promise<VerificationResult>
}

export type VerificationServiceOptions = {
  fetch?: typeof globalThis.fetch
  verifyUrl?: string
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

function verificationRequestBody(intent: PaymentIntent, transactionHash: string): {
  intent: {
    recipient: string
    amountLuna: number
    asset: string
    network: PaymentIntent['network']
  }
  transactionHash: string
} {
  return {
    intent: {
      recipient: intent.recipient,
      amountLuna: intent.amountLuna,
      asset: intent.asset,
      network: intent.network,
    },
    transactionHash,
  }
}

/**
 * Authoritative verification client. POSTs intent + hash to the PROVIA server.
 * Does not call Nimiq RPC and does not declare VERIFIED locally.
 */
export function createProviaApiVerificationService(
  options: VerificationServiceOptions = {},
): PaymentVerificationService {
  const fetchFn = options.fetch ?? globalThis.fetch
  const verifyUrl = options.verifyUrl ?? VERIFY_API_PATH

  return {
    async verify(intent, transactionHash) {
      let response: Response
      try {
        response = await fetchFn(verifyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(verificationRequestBody(intent, transactionHash)),
        })
      }
      catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return unavailableResult(intent, message)
      }

      let payload: unknown
      try {
        payload = await response.json()
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
