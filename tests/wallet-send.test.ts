import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { WalletRequestError } from '../src/lib/nimiq.ts'
import {
  WALLET_CANCELLED_MESSAGE,
  WALLET_CANCELLED_TITLE,
  WALLET_FAILED_MESSAGE,
  WALLET_FAILED_TITLE,
  WALLET_OPENING_LABEL,
  canStartWalletSend,
  classifyWalletSendError,
  isWalletHashLocator,
} from '../src/lib/wallet-send.ts'

describe('wallet send guards', () => {
  it('blocks a second confirm while a send is in flight', () => {
    assert.equal(canStartWalletSend({ inFlight: false, hasSubmittedHash: false }), true)
    assert.equal(canStartWalletSend({ inFlight: true, hasSubmittedHash: false }), false)
  })

  it('does not start another send after a hash has already been returned', () => {
    assert.equal(canStartWalletSend({ inFlight: false, hasSubmittedHash: true }), false)
  })

  it('treats a returned string as a hash locator, not as verification', () => {
    assert.equal(isWalletHashLocator('48ffc230fac51deb7b670e8e116e9ccfbeb1818cf722faf685e1d716a987d79e'), true)
    assert.equal(isWalletHashLocator('  '), false)
    assert.equal(isWalletHashLocator({ error: { message: 'nope' } }), false)
  })

  it('classifies wallet cancellation without exposing SDK errors', () => {
    const cancelled = classifyWalletSendError(new WalletRequestError(
      'PermissionDeniedError',
      'User rejected the confirmation dialog.',
    ))
    assert.equal(cancelled, 'cancelled')
    assert.equal(WALLET_CANCELLED_TITLE, 'Payment cancelled')
    assert.equal(WALLET_CANCELLED_MESSAGE, 'Your payment wasn’t sent.')
  })

  it('classifies a failed send as recoverable and not an automatic retry', () => {
    assert.equal(classifyWalletSendError(new Error('provider timeout')), 'failed')
    assert.equal(WALLET_FAILED_TITLE, 'Payment couldn’t be sent')
    assert.equal(WALLET_FAILED_MESSAGE, 'Nimiq Pay could not complete this payment. No automatic retry was made.')
    assert.equal(WALLET_OPENING_LABEL, 'Opening Nimiq Pay…')
  })
})
