import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  GET_TRANSACTION_BY_HASH,
  NIMIQ_TESTNET_RPC_URL,
  getNimTransactionByHash,
} from '../src/lib/observe.ts'
import type { NimIncludedObservation } from '../src/lib/observe.ts'
import { recipientDataMatchesIntent } from '../src/lib/payment-data.ts'
import {
  MAINALBATROSS_NETWORK_ID,
  MIN_CONFIRMATIONS,
  TESTALBATROSS_NETWORK_ID,
  verifyPayment,
  type ExpectedNimPayment,
} from '../src/lib/verify.ts'
import {
  createHashReservationStore,
  rejectReplayedVerification,
} from '../server/verification.ts'
import {
  AMOUNT_LUNA,
  HASH,
  OTHER_RECIPIENT,
  RECIPIENT,
  createIntent,
  createTrackedRpcObserver,
  postJson,
  rpcSuccess,
  rpcTx,
  withServer,
} from './server-harness.ts'

const INTENT_A = 'pi_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const INTENT_B = 'pi_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const KNOWN_HASH = '48ffc230fac51deb7b670e8e116e9ccfbeb1818cf722faf685e1d716a987d79e'
const KNOWN_INTENT = 'pi_32421cc2c4d05af6db86fedc3f92c322'
const KNOWN_RECIPIENT = 'NQ93 AG3N NRH8 FPTH Q705 VKNU JVX5 8MS5 HD3F'
const KNOWN_HEX = '50524f5649413a70695f3332343231636332633464303561663664623836666564633366393263333232'

function utf8Hex(value: string): string {
  return Buffer.from(value, 'utf8').toString('hex')
}

function expected(overrides: Partial<ExpectedNimPayment> = {}): ExpectedNimPayment {
  return {
    intentId: INTENT_A,
    recipient: RECIPIENT,
    amountLuna: AMOUNT_LUNA,
    asset: 'NIM',
    network: 'NIMIQ_TESTNET',
    ...overrides,
  }
}

function basicTx(overrides: Partial<NimIncludedObservation> = {}): NimIncludedObservation {
  return {
    status: 'included',
    hash: HASH,
    from: 'NQ37 7C3V VMN8 FRPN FXS9 PLAG JMRE 8SC6 KUSQ',
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

function boundTx(overrides: Partial<NimIncludedObservation> = {}): NimIncludedObservation {
  return basicTx({
    fromType: 2,
    kind: 'htlc_payout',
    recipientData: utf8Hex(`PROVIA:${INTENT_A}`),
    ...overrides,
  })
}

describe('Phase 7 verification hardening', () => {
  it('1. verifies a correct bound payment', () => {
    const result = verifyPayment(expected(), boundTx())
    assert.equal(result.outcome, 'VERIFIED')
    assert.equal(result.reason, null)
  })

  it('2. rejects a valid bound transaction verified against a different intent ID', () => {
    const result = verifyPayment(expected({ intentId: INTENT_B }), boundTx())
    assert.equal(result.outcome, 'MISMATCH')
    assert.equal(result.reason, 'UNSUPPORTED_TRANSACTION')
    assert.equal(recipientDataMatchesIntent(boundTx().recipientData, INTENT_B), false)
    assert.equal(recipientDataMatchesIntent(boundTx().recipientData, INTENT_A), true)
  })

  it('3. rejects a bound payment to the wrong recipient', () => {
    const result = verifyPayment(expected(), boundTx({ to: OTHER_RECIPIENT }))
    assert.equal(result.outcome, 'MISMATCH')
    assert.equal(result.reason, 'WRONG_RECIPIENT')
  })

  it('4. rejects a bound payment with the wrong amount', () => {
    const under = verifyPayment(expected(), boundTx({ valueLuna: AMOUNT_LUNA - 1 }))
    assert.equal(under.outcome, 'UNDERPAID')
    assert.notEqual(under.outcome, 'VERIFIED')

    const over = verifyPayment(expected(), boundTx({ valueLuna: AMOUNT_LUNA + 1 }))
    assert.equal(over.outcome, 'MISMATCH')
    assert.equal(over.reason, 'OVERPAID')
  })

  it('5. rejects an unbound HTLC with matching recipient and amount', () => {
    const result = verifyPayment(expected(), basicTx({
      fromType: 2,
      kind: 'contract',
      recipientData: '',
    }))
    assert.equal(result.outcome, 'MISMATCH')
    assert.equal(result.reason, 'UNSUPPORTED_TRANSACTION')
  })

  it('6. rejects malformed and incomplete recipientData', () => {
    const cases = [
      '505',
      '80',
      '',
      'deadbeef',
      utf8Hex('PROVIA'),
      utf8Hex('PROVIA:'),
      utf8Hex(`PROVIA:${INTENT_B}`),
    ]

    for (const recipientData of cases) {
      const result = verifyPayment(expected(), boundTx({
        recipientData,
        kind: recipientData.length > 0 ? 'htlc_payout' : 'contract',
        fromType: 2,
      }))
      assert.notEqual(result.outcome, 'VERIFIED', recipientData)
    }
  })

  it('7. rejects extra data on a basic transfer', () => {
    const withRecipientData = verifyPayment(expected(), basicTx({
      recipientData: utf8Hex(`PROVIA:${INTENT_A}`),
      kind: 'contract',
    }))
    assert.equal(withRecipientData.outcome, 'MISMATCH')
    assert.equal(withRecipientData.reason, 'UNSUPPORTED_TRANSACTION')

    const withSenderData = verifyPayment(expected(), basicTx({
      senderData: '00ab',
      kind: 'contract',
    }))
    assert.equal(withSenderData.outcome, 'MISMATCH')
    assert.equal(withSenderData.reason, 'UNSUPPORTED_TRANSACTION')
  })

  it('8. does not verify before 60 confirmations', () => {
    const result = verifyPayment(expected(), boundTx({ confirmations: MIN_CONFIRMATIONS - 1 }))
    assert.equal(result.outcome, 'UNRESOLVED')
    assert.equal(result.reason, 'INSUFFICIENT_CONFIRMATIONS')
    assert.equal(result.confirmationPolicy, MIN_CONFIRMATIONS)
  })

  it('9. never verifies a failed execution', () => {
    const result = verifyPayment(expected(), boundTx({ executionResult: false }))
    assert.equal(result.outcome, 'FAILED')
    assert.equal(result.reason, 'EXECUTION_FAILED')
  })

  it('10. rejects a transaction from the wrong network', () => {
    const result = verifyPayment(expected(), boundTx({ networkId: MAINALBATROSS_NETWORK_ID }))
    assert.equal(result.outcome, 'MISMATCH')
    assert.equal(result.reason, 'WRONG_NETWORK')
  })

  it('11. rejects replaying PROVIA:pi_A against intent B', () => {
    const replay = verifyPayment(expected({ intentId: INTENT_B }), boundTx({
      recipientData: utf8Hex(`PROVIA:${INTENT_A}`),
    }))
    assert.equal(replay.outcome, 'MISMATCH')
    assert.equal(replay.reason, 'UNSUPPORTED_TRANSACTION')
  })

  it('12. treats a hash as an identifier, not as proof', () => {
    const otherPayment = boundTx({
      hash: 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      recipientData: utf8Hex(`PROVIA:${INTENT_B}`),
    })
    const result = verifyPayment(expected({ intentId: INTENT_A }), otherPayment)
    assert.equal(result.outcome, 'MISMATCH')
    assert.equal(result.reason, 'UNSUPPORTED_TRANSACTION')
  })
})

describe('server hash reservation', () => {
  it('allows the same intent to be re-checked with the same hash', () => {
    const reservations = createHashReservationStore()
    const first = rejectReplayedVerification(
      verifyPayment(expected(), basicTx()),
      INTENT_A,
      HASH,
      reservations,
    )
    const second = rejectReplayedVerification(
      verifyPayment(expected(), basicTx()),
      INTENT_A,
      HASH,
      reservations,
    )
    assert.equal(first.outcome, 'VERIFIED')
    assert.equal(second.outcome, 'VERIFIED')
  })

  it('does not let one verified hash satisfy a second intent with the same recipient and amount', () => {
    const reservations = createHashReservationStore()
    const first = rejectReplayedVerification(
      verifyPayment(expected({ intentId: INTENT_A }), basicTx()),
      INTENT_A,
      HASH,
      reservations,
    )
    const replay = rejectReplayedVerification(
      verifyPayment(expected({ intentId: INTENT_B }), basicTx()),
      INTENT_B,
      HASH,
      reservations,
    )
    assert.equal(first.outcome, 'VERIFIED')
    assert.equal(replay.outcome, 'MISMATCH')
    assert.equal(replay.reason, 'REPLAYED_TRANSACTION')
  })

  it('does not reserve a hash that failed verification', () => {
    const reservations = createHashReservationStore()
    const failed = rejectReplayedVerification(
      verifyPayment(expected({ intentId: INTENT_A }), basicTx({ to: OTHER_RECIPIENT })),
      INTENT_A,
      HASH,
      reservations,
    )
    const later = rejectReplayedVerification(
      verifyPayment(expected({ intentId: INTENT_B }), basicTx()),
      INTENT_B,
      HASH,
      reservations,
    )
    assert.equal(failed.outcome, 'MISMATCH')
    assert.equal(later.outcome, 'VERIFIED')
  })
})

describe('POST /api/verify replay protection', () => {
  it('rejects a second intent that reuses a hash already used to verify another intent', async () => {
    const rpc = createTrackedRpcObserver(() => rpcSuccess(rpcTx()))
    await withServer(rpc.observe, async (baseUrl) => {
      const intentA = await createIntent(baseUrl)
      const intentB = await createIntent(baseUrl)
      const first = await postJson(baseUrl, '/api/verify', {
        intentId: intentA,
        transactionHash: HASH,
      })
      const replay = await postJson(baseUrl, '/api/verify', {
        intentId: intentB,
        transactionHash: HASH,
      })

      assert.equal(first.json.outcome, 'VERIFIED')
      assert.equal(replay.json.outcome, 'MISMATCH')
      assert.equal(replay.json.reason, 'REPLAYED_TRANSACTION')
    })
  })

  it('rejects a bound HTLC tagged with another intent even when recipient and amount match', async () => {
    let intentA = ''
    const rpc = createTrackedRpcObserver(() => rpcSuccess(rpcTx({
      fromType: 2,
      recipientData: Buffer.from(`PROVIA:${intentA}`, 'utf8').toString('hex'),
    })))

    await withServer(rpc.observe, async (baseUrl) => {
      intentA = await createIntent(baseUrl)
      const intentB = await createIntent(baseUrl)
      const againstB = await postJson(baseUrl, '/api/verify', {
        intentId: intentB,
        transactionHash: HASH,
      })
      assert.equal(againstB.json.outcome, 'MISMATCH')
      assert.equal(againstB.json.reason, 'UNSUPPORTED_TRANSACTION')
    })
  })
})

describe('Live known successful 1 NIM Testnet payment', () => {
  it(`still verifies ${KNOWN_HASH} against ${KNOWN_INTENT}`, async () => {
    const observation = await getNimTransactionByHash(KNOWN_HASH, { rpcUrl: NIMIQ_TESTNET_RPC_URL })
    assert.equal(observation.status, 'included', JSON.stringify(observation))
    if (observation.status !== 'included') {
      return
    }

    assert.equal(observation.kind, 'htlc_payout')
    assert.equal(observation.to, KNOWN_RECIPIENT)
    assert.equal(observation.valueLuna, 100_000)
    assert.equal(observation.recipientData, KNOWN_HEX)
    assert.equal(recipientDataMatchesIntent(observation.recipientData, KNOWN_INTENT), true)
    assert.ok((observation.confirmations ?? 0) >= MIN_CONFIRMATIONS)

    const result = verifyPayment({
      intentId: KNOWN_INTENT,
      recipient: KNOWN_RECIPIENT,
      amountLuna: 100_000,
      asset: 'NIM',
      network: 'NIMIQ_TESTNET',
    }, observation)

    assert.equal(result.outcome, 'VERIFIED')
    assert.equal(result.reason, null)
    console.log(`${GET_TRANSACTION_BY_HASH} known payment`, {
      hash: observation.hash,
      intentId: KNOWN_INTENT,
      outcome: result.outcome,
      confirmations: result.confirmations,
    })
  })
})
