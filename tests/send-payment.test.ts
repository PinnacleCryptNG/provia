import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { NimiqProvider } from '@nimiq/mini-app-sdk'
import {
  isUserRejection,
  PHASE_6B_SEND_METHOD,
  proviaIntentPaymentData,
  sendBasicNimPayment,
  toUserFacingError,
} from '../src/lib/nimiq.ts'

const RECIPIENT = 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000'
const INTENT_ID = 'pi_0123456789abcdef0123456789abcdef'

function mockProvider(
  sendBasicTransactionWithData: NimiqProvider['sendBasicTransactionWithData'],
): NimiqProvider {
  return { sendBasicTransactionWithData } as NimiqProvider
}

describe('sendBasicNimPayment Phase 6B', () => {
  it('formats the intent identifier as PROVIA:<intentId>', () => {
    assert.equal(proviaIntentPaymentData(INTENT_ID), `PROVIA:${INTENT_ID}`)
    assert.equal(PHASE_6B_SEND_METHOD, 'sendBasicTransactionWithData')
  })

  it('calls sendBasicTransactionWithData with recipient, value, and intent data', async () => {
    const hash = '8f14e45fceea167a5a36dedd4bea2543'
    const provider = mockProvider(async (tx) => {
      assert.equal(tx.recipient, RECIPIENT)
      assert.equal(tx.value, 100_000)
      assert.equal(tx.data, `PROVIA:${INTENT_ID}`)
      assert.equal('fee' in tx, false)
      return hash
    })

    const result = await sendBasicNimPayment(provider, {
      recipient: RECIPIENT,
      valueLuna: 100_000,
      intentId: INTENT_ID,
    })

    assert.equal(result.method, 'sendBasicTransactionWithData')
    assert.equal(result.intentId, INTENT_ID)
    assert.equal(result.data, `PROVIA:${INTENT_ID}`)
    assert.equal(result.returnedValue, hash)
    assert.equal(result.transactionHash, hash)
  })

  it('treats PermissionDeniedError as a user rejection', async () => {
    const provider = mockProvider(async () => ({
      error: {
        type: 'PermissionDeniedError',
        message: 'User rejected the confirmation dialog.',
      },
    }))

    await assert.rejects(
      () => sendBasicNimPayment(provider, {
        recipient: RECIPIENT,
        valueLuna: 100_000,
        intentId: INTENT_ID,
      }),
      (error: unknown) => {
        assert.equal(isUserRejection(error), true)
        assert.equal(
          toUserFacingError(error),
          'You declined the payment in Nimiq Pay. No transaction was sent.',
        )
        return true
      },
    )
  })
})
