import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import type { PaymentIntent } from '../src/lib/intent.ts'
import type { PaymentVerificationService } from '../src/lib/observation-service.ts'
import type { NimIncludedObservation, NimObservationResult } from '../src/lib/observe.ts'
import {
  DEFAULT_MAX_OBSERVATION_ATTEMPTS,
  DEFAULT_OBSERVATION_DELAY_MS,
  expectedPaymentFromIntent,
  observePaymentEvidence,
  stateAfterWalletHash,
  type VerificationFlowState,
} from '../src/lib/verification-flow.ts'
import { toVerificationView } from '../src/lib/verification-view.ts'
import { MIN_CONFIRMATIONS, TESTALBATROSS_NETWORK_ID, verifyPayment } from '../src/lib/verify.ts'

const RECIPIENT = 'NQ61 XMNV XULY D874 G08H YDXK LK29 E7YR KFP6'
const OTHER_RECIPIENT = 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000'
const SENDER = 'NQ37 7C3V VMN8 FRPN FXS9 PLAG JMRE 8SC6 KUSQ'
const HASH = '0e70ceec09dc5abd954196c004713d241e08a0cb25370b7e711455cd4853c6fc'
const AMOUNT_LUNA = 250_000

function submittedIntent(overrides: Partial<PaymentIntent> = {}): PaymentIntent {
  return {
    id: 'intent-1',
    recipient: RECIPIENT,
    amountNim: '2.5',
    amountLuna: AMOUNT_LUNA,
    asset: 'NIM',
    network: 'NIMIQ_TESTNET',
    purpose: 'Test invoice',
    createdAt: '2026-09-11T00:00:00.000Z',
    status: 'submitted',
    transactionHash: HASH,
    ...overrides,
  }
}

function included(overrides: Partial<NimIncludedObservation> = {}): NimIncludedObservation {
  return {
    status: 'included',
    hash: HASH,
    from: SENDER,
    to: RECIPIENT,
    valueLuna: AMOUNT_LUNA,
    feeLuna: 5,
    blockNumber: 11063444,
    confirmations: MIN_CONFIRMATIONS,
    timestampMs: 1789035147227,
    executionResult: true,
    fromType: 0,
    toType: 0,
    flags: 0,
    senderData: '',
    recipientData: '',
    networkId: TESTALBATROSS_NETWORK_ID,
    kind: 'basic_transfer',
    ...overrides,
  }
}

/**
 * Test double for the PROVIA server: observe independently, then run the
 * shared verifier. Production Mini App code does not do this in the browser.
 */
function scriptedVerification(
  results: NimObservationResult[],
): PaymentVerificationService & { calls: Array<{ hash: string, network: string }> } {
  const calls: Array<{ hash: string, network: string }> = []

  return {
    calls,
    async verify(intent, hash) {
      const index = calls.length
      calls.push({ hash, network: intent.network })
      const observation = results[Math.min(index, results.length - 1)]
      return verifyPayment(expectedPaymentFromIntent(intent), observation)
    },
  }
}

async function runFlow(
  verification: PaymentVerificationService & { calls?: unknown },
  options: { intent?: PaymentIntent, maxAttempts?: number } = {},
): Promise<{ result: Awaited<ReturnType<typeof observePaymentEvidence>>, states: VerificationFlowState[], delays: number[] }> {
  const intent = options.intent ?? submittedIntent()
  const states: VerificationFlowState[] = [stateAfterWalletHash(intent)]
  const delays: number[] = []

  const result = await observePaymentEvidence({
    intent,
    verification,
    maxAttempts: options.maxAttempts ?? DEFAULT_MAX_OBSERVATION_ATTEMPTS,
    delayMs: DEFAULT_OBSERVATION_DELAY_MS,
    delay: async (ms) => {
      delays.push(ms)
    },
    onState(state) {
      states.push(state)
    },
  })

  return { result, states, delays }
}

describe('verification UI orchestration', () => {
  it('shows submitted after the wallet returns a hash, without calling it verified', () => {
    const intent = submittedIntent()
    const state = stateAfterWalletHash(intent)
    const view = toVerificationView(state)

    assert.equal(state.screen, 'submitted')
    assert.equal(view.title, 'Payment submitted')
    assert.equal(
      view.message,
      'Nimiq Pay accepted the transaction. PROVIA is now checking the Nimiq blockchain.',
    )
    assert.equal(view.note, null)
    assert.equal(view.showVerifiedLabel, false)
    assert.equal(view.kind, 'submitted')
    assert.equal(view.tone, 'neutral')
    assert.equal(view.summaryRows.length, 0)
    assert.ok(view.detailRows.some((row) => row.label === 'Transaction hash'))
    assert.ok(view.detailRows.some((row) => row.label === 'Network'))
    assert.deepEqual(
      view.statusSteps.map((step) => step.label),
      ['Payment submitted', 'Payment found', 'Confirming …'],
    )
  })

  it('shows observing copy while looking up independent evidence', () => {
    const view = toVerificationView({
      screen: 'checking',
      intent: submittedIntent(),
      attempt: 1,
      maxAttempts: DEFAULT_MAX_OBSERVATION_ATTEMPTS,
    })

    assert.equal(view.kind, 'checking')
    assert.equal(view.title, 'Verifying payment')
    assert.equal(view.eyebrow, 'Verifying')
    assert.match(view.message, /Checking the Nimiq blockchain/)
    assert.equal(view.showVerifiedLabel, false)
    assert.ok(view.rows.some((row) => row.label === 'Network'))
    assert.equal(view.summaryRows.length, 0)
  })

  it('keeps a not-found observation unresolved', async () => {
    const verification = scriptedVerification([{ status: 'not_found', hash: HASH }])
    const { result, delays } = await runFlow(verification)
    const view = toVerificationView({
      screen: 'complete',
      intent: submittedIntent(),
      result,
    })

    assert.equal(result.outcome, 'UNRESOLVED')
    assert.equal(result.reason, 'NOT_FOUND')
    assert.equal(view.title, 'Looking for the payment')
    assert.equal(view.kind, 'unresolved')
    assert.equal(view.showVerifiedLabel, false)
    assert.equal(view.canRetry, true)
    assert.notEqual(view.title, 'Payment failed')
    assert.match(view.message, /will not mark this payment as failed/)
    assert.equal(verification.calls.length, DEFAULT_MAX_OBSERVATION_ATTEMPTS)
    assert.deepEqual(delays, [DEFAULT_OBSERVATION_DELAY_MS, DEFAULT_OBSERVATION_DELAY_MS])
  })

  it('does not verify a found transaction with insufficient confirmations', async () => {
    const verification = scriptedVerification([included({ confirmations: MIN_CONFIRMATIONS - 1 })])
    const { result } = await runFlow(verification)
    const view = toVerificationView({
      screen: 'complete',
      intent: submittedIntent(),
      result,
    })

    assert.equal(result.outcome, 'UNRESOLVED')
    assert.equal(result.reason, 'INSUFFICIENT_CONFIRMATIONS')
    assert.equal(view.kind, 'waiting')
    assert.equal(view.title, 'Verifying payment')
    assert.equal(view.tone, 'waiting')
    assert.equal(view.showVerifiedLabel, false)
    assert.match(view.message, /Checking the Nimiq blockchain/)
    assert.equal(view.progress?.current, MIN_CONFIRMATIONS - 1)
    assert.equal(view.progress?.required, MIN_CONFIRMATIONS)
    assert.equal(view.progress?.label, `${MIN_CONFIRMATIONS - 1} / ${MIN_CONFIRMATIONS} confirmations`)
    assert.equal(verification.calls.length, DEFAULT_MAX_OBSERVATION_ATTEMPTS)
  })

  it('renders VERIFIED only when verifyPayment returns VERIFIED', async () => {
    const verification = scriptedVerification([included()])
    const { result, delays } = await runFlow(verification)
    const view = toVerificationView({
      screen: 'complete',
      intent: submittedIntent(),
      result,
    })

    assert.equal(result.outcome, 'VERIFIED')
    assert.equal(view.kind, 'verified')
    assert.equal(view.title, 'Payment verified')
    assert.equal(view.showVerifiedLabel, true)
    assert.match(view.message, /reached the intended recipient/)
    assert.match(view.note ?? '', /not a cryptographic certificate/)
    assert.ok(view.rows.some((row) => row.label === 'Amount'))
    assert.ok(view.rows.some((row) => row.label === 'Recipient'))
    assert.ok(view.rows.some((row) => row.label === 'Network'))
    assert.ok(view.rows.some((row) => row.label === 'Transaction hash'))
    assert.ok(view.rows.some((row) => row.label === 'Confirmations'))
    assert.ok(view.rows.some((row) => row.label === 'Block'))
    assert.equal(view.detailsLabel, 'View verification details')
    assert.equal(verification.calls.length, 1)
    assert.deepEqual(delays, [])
  })

  it('renders a wrong-recipient mismatch', async () => {
    const verification = scriptedVerification([included({ to: OTHER_RECIPIENT })])
    const { result } = await runFlow(verification)
    const view = toVerificationView({
      screen: 'complete',
      intent: submittedIntent(),
      result,
    })

    assert.equal(result.outcome, 'MISMATCH')
    assert.equal(result.reason, 'WRONG_RECIPIENT')
    assert.equal(view.kind, 'wrong_recipient')
    assert.equal(view.title, 'Payment not verified')
    assert.equal(view.message, 'The observed transaction does not satisfy this payment request.')
    assert.equal(view.showVerifiedLabel, false)
    assert.equal(verification.calls.length, 1)
  })

  it('renders underpayment with expected and observed amounts', async () => {
    const verification = scriptedVerification([included({ valueLuna: AMOUNT_LUNA - 1 })])
    const { result } = await runFlow(verification)
    const view = toVerificationView({
      screen: 'complete',
      intent: submittedIntent(),
      result,
    })

    assert.equal(result.outcome, 'UNDERPAID')
    assert.equal(view.kind, 'underpaid')
    assert.equal(view.title, 'Payment not verified')
    assert.equal(view.message, 'The observed transaction does not satisfy this payment request.')
    assert.equal(view.summaryRows.length, 0)
    assert.equal(view.showVerifiedLabel, false)
  })

  it('renders overpayment as a mismatch, not verified', async () => {
    const verification = scriptedVerification([included({ valueLuna: AMOUNT_LUNA + 1 })])
    const { result } = await runFlow(verification)
    const view = toVerificationView({
      screen: 'complete',
      intent: submittedIntent(),
      result,
    })

    assert.equal(result.outcome, 'MISMATCH')
    assert.equal(result.reason, 'OVERPAID')
    assert.equal(view.kind, 'overpaid')
    assert.equal(view.title, 'Payment not verified')
    assert.equal(view.message, 'The observed transaction does not satisfy this payment request.')
    assert.equal(view.tone, 'mismatch')
    assert.equal(view.showVerifiedLabel, false)
  })

  it('renders failed execution as a failed payment', async () => {
    const verification = scriptedVerification([included({ executionResult: false })])
    const { result } = await runFlow(verification)
    const view = toVerificationView({
      screen: 'complete',
      intent: submittedIntent(),
      result,
    })

    assert.equal(result.outcome, 'FAILED')
    assert.equal(result.reason, 'EXECUTION_FAILED')
    assert.equal(view.kind, 'failed')
    assert.equal(view.title, 'Payment not verified')
    assert.equal(view.tone, 'negative')
    assert.equal(view.message, 'The observed transaction does not satisfy this payment request.')
    assert.equal(view.showVerifiedLabel, false)
    assert.equal(verification.calls.length, 1)
  })

  it('does not style insufficient evidence or RPC errors as a failed payment', async () => {
    const verification = scriptedVerification([{ status: 'rpc_error', message: 'timeout' }])
    const { result } = await runFlow(verification)
    const view = toVerificationView({
      screen: 'complete',
      intent: submittedIntent(),
      result,
    })

    assert.equal(result.outcome, 'UNRESOLVED')
    assert.equal(result.reason, 'RPC_ERROR')
    assert.equal(view.kind, 'unresolved')
    assert.equal(view.title, 'Could not check yet')
    assert.notEqual(view.title, 'Payment failed')
    assert.match(view.message, /does not mean the payment failed/)
  })

  it('keeps confirmation progress visible while still observing', () => {
    const result = verifyPayment(
      expectedPaymentFromIntent(submittedIntent()),
      included({ confirmations: 34 }),
    )
    const view = toVerificationView({
      screen: 'checking',
      intent: submittedIntent(),
      attempt: 2,
      maxAttempts: DEFAULT_MAX_OBSERVATION_ATTEMPTS,
      lastResult: result,
    })

    assert.equal(view.kind, 'waiting')
    assert.equal(view.isChecking, true)
    assert.equal(view.canRetry, false)
    assert.equal(view.progress?.label, `34 / ${MIN_CONFIRMATIONS} confirmations`)
  })

  it('retries observation after an unresolved state', async () => {
    const verification = scriptedVerification([
      { status: 'not_found', hash: HASH },
      { status: 'not_found', hash: HASH },
      { status: 'not_found', hash: HASH },
      included(),
    ])

    const first = await runFlow(verification)
    assert.equal(first.result.outcome, 'UNRESOLVED')
    assert.equal(toVerificationView({
      screen: 'complete',
      intent: submittedIntent(),
      result: first.result,
    }).canRetry, true)

    const retry = await runFlow(verification)
    assert.equal(retry.result.outcome, 'VERIFIED')
    assert.equal(verification.calls.length, DEFAULT_MAX_OBSERVATION_ATTEMPTS + 1)
  })

  it('does not trigger wallet confirmation while observing', async () => {
    let walletCalls = 0
    const sendBasicTransaction = async () => {
      walletCalls += 1
      return HASH
    }

    const verification = scriptedVerification([{ status: 'not_found', hash: HASH }])
    await runFlow(verification)

    assert.equal(walletCalls, 0)
    assert.equal(typeof sendBasicTransaction, 'function')

    const flowSource = readFileSync(new URL('../src/lib/verification-flow.ts', import.meta.url), 'utf8')
    const viewSource = readFileSync(new URL('../src/lib/verification-view.ts', import.meta.url), 'utf8')
    const appSource = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
    assert.doesNotMatch(flowSource, /sendBasicTransaction|sendBasicNimPayment|getNimTransactionByHash/)
    assert.doesNotMatch(viewSource, /sendBasicTransaction|sendBasicNimPayment/)
    assert.match(appSource, /createProviaApiVerificationService/)
    assert.doesNotMatch(appSource, /createRpcObservationService|getNimTransactionByHash/)
  })

  it('passes the intent network into verification and never infers it from "Nimiq"', async () => {
    const verification = scriptedVerification([included()])
    await runFlow(verification)

    assert.equal(verification.calls[0]?.network, 'NIMIQ_TESTNET')
    assert.notEqual(verification.calls[0]?.network, 'Nimiq')
  })
})
