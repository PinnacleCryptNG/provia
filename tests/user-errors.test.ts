import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  CONNECT_WALLET_USER_ERROR,
  toCreatePaymentUserError,
  toProofUserError,
} from '../src/lib/user-errors.ts'

describe('user-facing error sanitization', () => {
  it('maps technical create-intent failures to simple copy', () => {
    assert.equal(
      toCreatePaymentUserError(new Error('Failed to create payment intent.')),
      'Couldn’t prepare this payment. Please try again.',
    )
    assert.equal(
      toCreatePaymentUserError(new Error('amountLuna must be a positive integer.')),
      'Enter a valid amount.',
    )
    assert.equal(
      toCreatePaymentUserError(new Error('network must be NIMIQ_TESTNET or NIMIQ_MAINNET.')),
      'Something went wrong while preparing the payment.',
    )
    assert.equal(
      toCreatePaymentUserError(new Error('NIMIQ_TESTNET is invalid.')),
      'Something went wrong while preparing the payment.',
    )
    assert.equal(
      toCreatePaymentUserError(new Error('recipient must be a valid Nimiq address.')),
      'Enter a valid recipient address.',
    )
    assert.equal(
      toCreatePaymentUserError('not-an-error'),
      'Couldn’t prepare this payment. Please try again.',
    )
  })

  it('does not pass through intent IDs, RPC text, or reason codes', () => {
    const message = toCreatePaymentUserError(new Error('Unknown payment intent pi_abc RPC HTLC classifier'))
    assert.doesNotMatch(message, /payment intent|pi_|RPC|HTLC|classifier|amountLuna|NIMIQ_/i)
  })

  it('uses a fixed receipt message when proof creation fails', () => {
    assert.equal(
      toProofUserError(new Error('Could not create verification proof.')),
      'Your payment was verified, but the receipt could not be prepared.',
    )
    assert.doesNotMatch(toProofUserError(new Error('internal server error')), /internal|proof|RPC/i)
  })

  it('keeps the connect-wallet error human-readable', () => {
    assert.equal(CONNECT_WALLET_USER_ERROR, 'Couldn’t connect to Nimiq Pay.')
    assert.doesNotMatch(CONNECT_WALLET_USER_ERROR, /provider|SDK|RPC|stack/i)
  })
})
