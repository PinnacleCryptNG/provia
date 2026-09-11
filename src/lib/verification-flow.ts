import type { PaymentIntent } from './intent.ts'
import type { PaymentVerificationService } from './observation-service.ts'
import type { ExpectedNimPayment, VerificationResult } from './verify.ts'

/** Small, bounded request budget. Public Nimiq.watch RPC is rate-limited. */
export const DEFAULT_MAX_OBSERVATION_ATTEMPTS = 3

/** Pause between client requests. First lookup is immediate. */
export const DEFAULT_OBSERVATION_DELAY_MS = 4_000

export type VerificationFlowState =
  | { screen: 'submitted', intent: PaymentIntent }
  | {
    screen: 'checking'
    intent: PaymentIntent
    attempt: number
    maxAttempts: number
    lastResult?: VerificationResult
  }
  | { screen: 'complete', intent: PaymentIntent, result: VerificationResult }

export function expectedPaymentFromIntent(intent: PaymentIntent): ExpectedNimPayment {
  return {
    intentId: intent.id,
    recipient: intent.recipient,
    amountLuna: intent.amountLuna,
    asset: intent.asset,
    network: intent.network,
  }
}

export function stateAfterWalletHash(intent: PaymentIntent): VerificationFlowState {
  if (!intent.transactionHash) {
    throw new Error('Cannot start verification without a submitted transaction hash.')
  }

  return { screen: 'submitted', intent }
}

export function isRetryableVerification(result: VerificationResult): boolean {
  if (result.outcome !== 'UNRESOLVED') {
    return false
  }

  return (
    result.reason === 'NOT_FOUND'
    || result.reason === 'INSUFFICIENT_CONFIRMATIONS'
    || result.reason === 'RPC_ERROR'
    || result.reason === 'MISSING_EXECUTION_RESULT'
  )
}

function defaultDelay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export type ObservePaymentOptions = {
  intent: PaymentIntent
  verification: PaymentVerificationService
  delay?: (ms: number) => Promise<void>
  maxAttempts?: number
  delayMs?: number
  onState?: (state: VerificationFlowState) => void
}

/**
 * Ask the PROVIA server to observe a submitted hash. Does not send, confirm,
 * or otherwise call the wallet, and does not run the verifier locally.
 */
export async function observePaymentEvidence(
  options: ObservePaymentOptions,
): Promise<VerificationResult> {
  const hash = options.intent.transactionHash
  if (!hash) {
    throw new Error('Cannot observe a payment without a submitted transaction hash.')
  }

  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_OBSERVATION_ATTEMPTS
  const delayMs = options.delayMs ?? DEFAULT_OBSERVATION_DELAY_MS
  const delay = options.delay ?? defaultDelay

  let lastResult: VerificationResult | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    options.onState?.({
      screen: 'checking',
      intent: options.intent,
      attempt,
      maxAttempts,
      lastResult: lastResult ?? undefined,
    })

    lastResult = await options.verification.verify(options.intent, hash)

    if (!isRetryableVerification(lastResult) || attempt === maxAttempts) {
      options.onState?.({
        screen: 'complete',
        intent: options.intent,
        result: lastResult,
      })
      return lastResult
    }

    options.onState?.({
      screen: 'checking',
      intent: options.intent,
      attempt,
      maxAttempts,
      lastResult,
    })

    await delay(delayMs)
  }

  return lastResult!
}
