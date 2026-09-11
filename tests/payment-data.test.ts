import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  decodeOnChainData,
  proviaIntentPaymentData,
  recipientDataMatchesIntent,
} from '../src/lib/payment-data.ts'

const INTENT_ID = 'pi_6cc2c28dae8755101a844f00de25947a'
const PHASE_6B_HEX = '50524f5649413a70695f3663633263323864616538373535313031613834346630306465323539343761'

describe('on-chain PROVIA payment data', () => {
  it('builds the exact binding from the intent ID', () => {
    assert.equal(proviaIntentPaymentData(INTENT_ID), `PROVIA:${INTENT_ID}`)
  })

  it('decodes Testnet hex recipientData to the exact UTF-8 binding', () => {
    assert.equal(decodeOnChainData(PHASE_6B_HEX), `PROVIA:${INTENT_ID}`)
    assert.equal(recipientDataMatchesIntent(PHASE_6B_HEX, INTENT_ID), true)
  })

  it('accepts already-decoded UTF-8', () => {
    assert.equal(decodeOnChainData(`PROVIA:${INTENT_ID}`), `PROVIA:${INTENT_ID}`)
    assert.equal(recipientDataMatchesIntent(`PROVIA:${INTENT_ID}`, INTENT_ID), true)
  })

  it('does not prefix-match or accept a different intent', () => {
    assert.equal(recipientDataMatchesIntent(PHASE_6B_HEX, 'pi_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'), false)
    assert.equal(
      recipientDataMatchesIntent(
        Buffer.from(`PROVIA:${INTENT_ID}:extra`, 'utf8').toString('hex'),
        INTENT_ID,
      ),
      false,
    )
    assert.equal(recipientDataMatchesIntent('', INTENT_ID), false)
    assert.equal(recipientDataMatchesIntent('505', INTENT_ID), false)
    assert.equal(recipientDataMatchesIntent('PROVIA:', INTENT_ID), false)
    assert.equal(recipientDataMatchesIntent('PROVIA', INTENT_ID), false)
    assert.equal(recipientDataMatchesIntent('deadbeef', INTENT_ID), false)
    assert.equal(recipientDataMatchesIntent('80', INTENT_ID), false)
  })

  it('returns empty string for empty data and null for malformed encodings', () => {
    assert.equal(decodeOnChainData(''), '')
    assert.equal(decodeOnChainData('505'), null)
    assert.equal(decodeOnChainData('80'), null)
  })

  it('does not use prefix or substring matching for a longer payload', () => {
    const prefixed = Buffer.from(`PROVIA:${INTENT_ID}andmore`, 'utf8').toString('hex')
    assert.equal(recipientDataMatchesIntent(prefixed, INTENT_ID), false)
    assert.equal(decodeOnChainData(prefixed)?.startsWith(`PROVIA:${INTENT_ID}`), true)
  })
})
