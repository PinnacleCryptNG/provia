import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import type { PaymentIntent } from '../src/lib/intent.ts'
import type { NimiqNetwork } from '../src/lib/network.ts'
import type { NimIncludedObservation, NimObservationResult } from '../src/lib/observe.ts'
import type { PaymentObservationService } from '../src/lib/observation-service.ts'
import {
  DEFAULT_MAX_OBSERVATION_ATTEMPTS,
  DEFAULT_OBSERVATION_DELAY_MS,
  observePaymentEvidence,
  stateAfterWalletHash,
  type VerificationFlowState,
} from '../src/lib/verification-flow.ts'
import { toVerificationView } from '../src/lib/verification-view.ts'
import { MIN_CONFIRMATIONS, TESTALBATROSS_NETWORK_ID } from '../src/lib/verify.ts'

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

function scriptedObservation(
  results: NimObservationResult[],
): PaymentObservationService & { calls: Array<{ hash: string, network: NimiqNetwork }> } {
  const calls: Array<{ hash: string, network: NimiqNetwork }> = []

  return {
    calls,
    async getByHash(hash, network) {
      const index = calls.length
      calls.push({ hash, network })
      return results[Math.min(index, results.length - 1)]
    },
  }
}

async function runFlow(
  observation: PaymentObservationService,
  options: { intent?: PaymentIntent, maxAttempts?: number } = {},
): Promise<{ result: Awaited<ReturnType<typeof observePaymentEvidence>>, states: VerificationFlowState[], delays: number[] }> {
  const intent = options.intent ?? submittedIntent()
  const states: VerificationFlowState[] = [stateAfterWalletHash(intent)]
  const delays: number[] = []

  const result = await observePaymentEvidence({
    intent,
    observation,
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
      "Your transaction was submitted to the Nimiq network. We're waiting for blockchain evidence.",
    )
    assert.equal(view.showVerifiedLabel, false)
    assert.equal(view.kind, 'submitted')
    assert.ok(view.rows.some((row) => row.label === 'Transaction'))
    assert.ok(view.rows.some((row) => row.label === 'Amount'))
    assert.ok(view.rows.some((row) => row.label === 'Recipient'))
  })

  it('keeps a not-found observation unresolved', async () => {
    const observation = scriptedObservation([{ status: 'not_found', hash: HASH }])
    const { result, delays } = await runFlow(observation)
    const view = toVerificationView({
      screen: 'complete',
      intent: submittedIntent(),
      result,
    })

    assert.equal(result.outcome, 'UNRESOLVED')
    assert.equal(result.reason, 'NOT_FOUND')
    assert.equal(view.title, 'Payment not verified yet')
    assert.equal(view.kind, 'unresolved')
    assert.equal(view.showVerifiedLabel, false)
    assert.equal(view.canRetry, true)
    assert.notEqual(view.title, 'Payment failed')
    assert.equal(observation.calls.length, DEFAULT_MAX_OBSERVATION_ATTEMPTS)
    assert.deepEqual(delays, [DEFAULT_OBSERVATION_DELAY_MS, DEFAULT_OBSERVATION_DELAY_MS])
  })

  it('does not verify a found transaction with insufficient confirmations', async () => {
    const observation = scriptedObservation([included({ confirmations: MIN_CONFIRMATIONS - 1 })])
    const { result } = await runFlow(observation)
    const view = toVerificationView({
      screen: 'complete',
      intent: submittedIntent(),
      result,
    })

    assert.equal(result.outcome, 'UNRESOLVED')
    assert.equal(result.reason, 'INSUFFICIENT_CONFIRMATIONS')
    assert.equal(view.kind, 'waiting')
    assert.equal(view.title, 'Payment not verified yet')
    assert.equal(view.showVerifiedLabel, false)
    assert.match(view.message, /enough confirmations/)
    assert.equal(observation.calls.length, DEFAULT_MAX_OBSERVATION_ATTEMPTS)
  })

  it('renders VERIFIED only when verifyPayment returns VERIFIED', async () => {
    const observation = scriptedObservation([included()])
    const { result, delays } = await runFlow(observation)
    const view = toVerificationView({
      screen: 'complete',
      intent: submittedIntent(),
      result,
    })

    assert.equal(result.outcome, 'VERIFIED')
    assert.equal(view.kind, 'verified')
    assert.equal(view.title, 'Payment verified')
    assert.equal(view.showVerifiedLabel, true)
    assert.match(view.message, /recipient matches/)
    assert.match(view.message, /amount matches/)
    assert.match(view.message, /executed successfully/)
    assert.match(view.message, /confirmation requirement/)
    assert.ok(view.rows.some((row) => row.label === 'Confirmations'))
    assert.ok(view.rows.some((row) => row.label === 'Block'))
    assert.equal(observation.calls.length, 1)
    assert.deepEqual(delays, [])
  })

  it('renders a wrong-recipient mismatch', async () => {
    const observation = scriptedObservation([included({ to: OTHER_RECIPIENT })])
    const { result } = await runFlow(observation)
    const view = toVerificationView({
      screen: 'complete',
      intent: submittedIntent(),
      result,
    })

    assert.equal(result.outcome, 'MISMATCH')
    assert.equal(result.reason, 'WRONG_RECIPIENT')
    assert.equal(view.kind, 'wrong_recipient')
    assert.equal(view.title, "Payment doesn't match")
    assert.match(view.message, /different address/)
    assert.equal(view.showVerifiedLabel, false)
    assert.equal(observation.calls.length, 1)
  })

  it('renders underpayment with expected and observed amounts', async () => {
    const observation = scriptedObservation([included({ valueLuna: AMOUNT_LUNA - 1 })])
    const { result } = await runFlow(observation)
    const view = toVerificationView({
      screen: 'complete',
      intent: submittedIntent(),
      result,
    })

    assert.equal(result.outcome, 'UNDERPAID')
    assert.equal(view.kind, 'underpaid')
    assert.equal(view.title, "Payment doesn't match")
    assert.equal(
      view.message,
      'PROVIA found the transaction, but the amount received is less than requested.',
    )
    assert.ok(view.rows.some((row) => row.label === 'Expected'))
    assert.ok(view.rows.some((row) => row.label === 'Observed'))
    assert.equal(view.showVerifiedLabel, false)
  })

  it('renders overpayment as a mismatch, not verified', async () => {
    const observation = scriptedObservation([included({ valueLuna: AMOUNT_LUNA + 1 })])
    const { result } = await runFlow(observation)
    const view = toVerificationView({
      screen: 'complete',
      intent: submittedIntent(),
      result,
    })

    assert.equal(result.outcome, 'MISMATCH')
    assert.equal(result.reason, 'OVERPAID')
    assert.equal(view.kind, 'overpaid')
    assert.equal(view.title, "Payment doesn't match")
    assert.match(view.message, /greater than the requested amount/)
    assert.equal(view.showVerifiedLabel, false)
  })

  it('renders failed execution as a failed payment', async () => {
    const observation = scriptedObservation([included({ executionResult: false })])
    const { result } = await runFlow(observation)
    const view = toVerificationView({
      screen: 'complete',
      intent: submittedIntent(),
      result,
    })

    assert.equal(result.outcome, 'FAILED')
    assert.equal(result.reason, 'EXECUTION_FAILED')
    assert.equal(view.kind, 'failed')
    assert.equal(view.title, 'Payment failed')
    assert.match(view.message, /execution failed/)
    assert.equal(view.showVerifiedLabel, false)
    assert.equal(observation.calls.length, 1)
  })

  it('retries observation after an unresolved state', async () => {
    const observation = scriptedObservation([
      { status: 'not_found', hash: HASH },
      { status: 'not_found', hash: HASH },
      { status: 'not_found', hash: HASH },
      included(),
    ])

    const first = await runFlow(observation)
    assert.equal(first.result.outcome, 'UNRESOLVED')
    assert.equal(toVerificationView({
      screen: 'complete',
      intent: submittedIntent(),
      result: first.result,
    }).canRetry, true)

    const retry = await runFlow(observation)
    assert.equal(retry.result.outcome, 'VERIFIED')
    assert.equal(observation.calls.length, DEFAULT_MAX_OBSERVATION_ATTEMPTS + 1)
  })

  it('does not trigger wallet confirmation while observing', async () => {
    let walletCalls = 0
    const sendBasicTransaction = async () => {
      walletCalls += 1
      return HASH
    }

    const observation = scriptedObservation([{ status: 'not_found', hash: HASH }])
    await runFlow(observation)

    assert.equal(walletCalls, 0)
    assert.equal(typeof sendBasicTransaction, 'function')

    const flowSource = readFileSync(new URL('../src/lib/verification-flow.ts', import.meta.url), 'utf8')
    const viewSource = readFileSync(new URL('../src/lib/verification-view.ts', import.meta.url), 'utf8')
    assert.doesNotMatch(flowSource, /sendBasicTransaction|sendBasicNimPayment/)
    assert.doesNotMatch(viewSource, /sendBasicTransaction|sendBasicNimPayment/)
  })

  it('passes the intent network into observation and never infers it from "Nimiq"', async () => {
    const observation = scriptedObservation([included()])
    await runFlow(observation)

    assert.equal(observation.calls[0]?.network, 'NIMIQ_TESTNET')
    assert.notEqual(observation.calls[0]?.network, 'Nimiq')
  })
})
