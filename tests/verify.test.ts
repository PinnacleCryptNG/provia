import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { NimIncludedObservation, NimObservationResult } from '../src/lib/observe.ts'
import {
  MAINALBATROSS_NETWORK_ID,
  MIN_CONFIRMATIONS,
  TESTALBATROSS_NETWORK_ID,
  verifyPayment,
  type ExpectedNimPayment,
} from '../src/lib/verify.ts'

const RECIPIENT = 'NQ61 XMNV XULY D874 G08H YDXK LK29 E7YR KFP6'
const SENDER = 'NQ37 7C3V VMN8 FRPN FXS9 PLAG JMRE 8SC6 KUSQ'
const OTHER_SENDER = 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000'
const OTHER_RECIPIENT = 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000'
const HASH = '0e70ceec09dc5abd954196c004713d241e08a0cb25370b7e711455cd4853c6fc'
const AMOUNT_LUNA = 11000000000

function intent(overrides: Partial<ExpectedNimPayment> = {}): ExpectedNimPayment {
  return {
    recipient: RECIPIENT,
    amountLuna: AMOUNT_LUNA,
    asset: 'NIM',
    network: 'NIMIQ_TESTNET',
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

describe('verifyPayment', () => {
  it('returns VERIFIED for a matching basic NIM transfer with enough confirmations', () => {
    const result = verifyPayment(intent(), included())
    assert.equal(result.outcome, 'VERIFIED')
    assert.equal(result.reason, null)
    assert.equal(result.confirmations, MIN_CONFIRMATIONS)
    assert.equal(result.confirmationPolicy, MIN_CONFIRMATIONS)
    assert.equal(result.observedAmountLuna, AMOUNT_LUNA)
    assert.equal(result.expectedAmountLuna, AMOUNT_LUNA)
  })

  it('returns MISMATCH / WRONG_RECIPIENT when the recipient differs', () => {
    const result = verifyPayment(intent(), included({ to: OTHER_RECIPIENT }))
    assert.equal(result.outcome, 'MISMATCH')
    assert.equal(result.reason, 'WRONG_RECIPIENT')
    assert.equal(result.observedRecipient, OTHER_RECIPIENT)
  })

  it('returns UNDERPAID when the observed Luna amount is lower', () => {
    const result = verifyPayment(intent(), included({ valueLuna: AMOUNT_LUNA - 1 }))
    assert.equal(result.outcome, 'UNDERPAID')
    assert.equal(result.expectedAmountLuna, AMOUNT_LUNA)
    assert.equal(result.observedAmountLuna, AMOUNT_LUNA - 1)
  })

  it('returns MISMATCH / OVERPAID when the observed Luna amount is higher', () => {
    const result = verifyPayment(intent(), included({ valueLuna: AMOUNT_LUNA + 1 }))
    assert.equal(result.outcome, 'MISMATCH')
    assert.equal(result.reason, 'OVERPAID')
    assert.equal(result.expectedAmountLuna, AMOUNT_LUNA)
    assert.equal(result.observedAmountLuna, AMOUNT_LUNA + 1)
  })

  it('returns MISMATCH / WRONG_ASSET when the expected asset is not NIM', () => {
    const result = verifyPayment(intent({ asset: 'USDT' }), included())
    assert.equal(result.outcome, 'MISMATCH')
    assert.equal(result.reason, 'WRONG_ASSET')
  })

  it('returns MISMATCH / WRONG_NETWORK for MainAlbatross evidence', () => {
    const result = verifyPayment(intent(), included({ networkId: MAINALBATROSS_NETWORK_ID }))
    assert.equal(result.outcome, 'MISMATCH')
    assert.equal(result.reason, 'WRONG_NETWORK')
    assert.equal(result.observedNetworkId, MAINALBATROSS_NETWORK_ID)
  })

  it('uses observed networkId as evidence against the explicit intent network', () => {
    const result = verifyPayment(
      intent({ network: 'NIMIQ_TESTNET' }),
      included({ networkId: MAINALBATROSS_NETWORK_ID }),
    )
    assert.equal(result.outcome, 'MISMATCH')
    assert.equal(result.reason, 'WRONG_NETWORK')
  })

  it('accepts MainAlbatross evidence when the intent is NIMIQ_MAINNET', () => {
    const result = verifyPayment(
      intent({ network: 'NIMIQ_MAINNET' }),
      included({ networkId: MAINALBATROSS_NETWORK_ID }),
    )
    assert.equal(result.outcome, 'VERIFIED')
  })

  it('returns FAILED when executionResult is false', () => {
    const result = verifyPayment(intent(), included({ executionResult: false }))
    assert.equal(result.outcome, 'FAILED')
    assert.equal(result.reason, 'EXECUTION_FAILED')
  })

  it('returns UNRESOLVED when the transaction is not found', () => {
    const observation: NimObservationResult = { status: 'not_found', hash: HASH }
    const result = verifyPayment(intent(), observation)
    assert.equal(result.outcome, 'UNRESOLVED')
    assert.equal(result.reason, 'NOT_FOUND')
  })

  it('returns UNRESOLVED for RPC errors and invalid hashes, never FAILED or VERIFIED', () => {
    assert.equal(
      verifyPayment(intent(), { status: 'rpc_error', message: 'timeout' }).outcome,
      'UNRESOLVED',
    )
    assert.equal(
      verifyPayment(intent(), { status: 'invalid_hash', message: 'bad' }).outcome,
      'UNRESOLVED',
    )
  })

  it('returns MISMATCH / UNSUPPORTED_TRANSACTION for rewards and contracts', () => {
    const reward = verifyPayment(intent(), included({ kind: 'reward' }))
    assert.equal(reward.outcome, 'MISMATCH')
    assert.equal(reward.reason, 'UNSUPPORTED_TRANSACTION')

    const contract = verifyPayment(intent(), included({ kind: 'contract', flags: 1, toType: 2 }))
    assert.equal(contract.outcome, 'MISMATCH')
    assert.equal(contract.reason, 'UNSUPPORTED_TRANSACTION')
  })

  it('treats normalized address formatting as the same recipient', () => {
    const result = verifyPayment(
      intent({ recipient: 'nq61xmnvxulyd874g08hydxklk29e7yrkfp6' }),
      included({ to: RECIPIENT }),
    )
    assert.equal(result.outcome, 'VERIFIED')
    assert.equal(result.expectedRecipient, RECIPIENT)
    assert.equal(result.observedRecipient, RECIPIENT)
  })

  it('compares amounts as exact integers, not floating point', () => {
    const expected = 100_000
    const under = verifyPayment(
      intent({ amountLuna: expected }),
      included({ valueLuna: 99_999 }),
    )
    const exact = verifyPayment(
      intent({ amountLuna: expected }),
      included({ valueLuna: 100_000 }),
    )
    assert.equal(under.outcome, 'UNDERPAID')
    assert.equal(exact.outcome, 'VERIFIED')
    assert.equal(expected + 0.1 === expected, false)
  })

  it('does not return VERIFIED when confirmations are below the policy', () => {
    const result = verifyPayment(intent(), included({ confirmations: MIN_CONFIRMATIONS - 1 }))
    assert.equal(result.outcome, 'UNRESOLVED')
    assert.equal(result.reason, 'INSUFFICIENT_CONFIRMATIONS')
    assert.equal(result.confirmations, MIN_CONFIRMATIONS - 1)
    assert.equal(result.confirmationPolicy, MIN_CONFIRMATIONS)
  })

  it('does not treat a missing confirmation count as VERIFIED', () => {
    const result = verifyPayment(intent(), included({ confirmations: null }))
    assert.equal(result.outcome, 'UNRESOLVED')
    assert.equal(result.reason, 'INSUFFICIENT_CONFIRMATIONS')
  })

  it('does not mismatch solely because the sender differs', () => {
    const result = verifyPayment(intent(), included({ from: OTHER_SENDER }))
    assert.equal(result.outcome, 'VERIFIED')
    assert.equal(result.sender, OTHER_SENDER)
  })

  it('cannot be fed a VERIFIED outcome as an input', () => {
    const observation = included()
    assert.equal('outcome' in observation, false)
    assert.equal(verifyPayment(intent(), observation).outcome, 'VERIFIED')
  })
})

