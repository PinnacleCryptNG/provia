import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { NimiqProvider } from '@nimiq/mini-app-sdk'
import {
  isUserRejection,
  sendBasicNimPayment,
  toUserFacingError,
} from '../src/lib/nimiq.ts'

const RECIPIENT = 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000'

function mockProvider(
  sendBasicTransaction: NimiqProvider['sendBasicTransaction'],
): NimiqProvider {
  return { sendBasicTransaction } as NimiqProvider
}

describe('sendBasicNimPayment', () => {
  it('returns the transaction hash from sendBasicTransaction', async () => {
    const hash = '8f14e45fceea167a5a36dedd4bea2543'
    const provider = mockProvider(async (tx) => {
      assert.equal(tx.recipient, RECIPIENT)
      assert.equal(tx.value, 100_000)
      assert.equal('fee' in tx, false)
      return hash
    })

    const result = await sendBasicNimPayment(provider, {
      recipient: RECIPIENT,
      valueLuna: 100_000,
    })

    assert.equal(result, hash)
  })

  it('treats PermissionDeniedError as a user rejection', async () => {
    const provider = mockProvider(async () => ({
      error: {
        type: 'PermissionDeniedError',
        message: 'User rejected the confirmation dialog.',
      },
    }))

    await assert.rejects(
      () => sendBasicNimPayment(provider, { recipient: RECIPIENT, valueLuna: 100_000 }),
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
