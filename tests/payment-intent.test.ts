import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ValidationUtils } from '@nimiq/utils'
import { isValidNimiqAddress, normalizeNimiqAddress } from '../src/lib/address.ts'
import { formatLunaAsNim, parseNimToLuna } from '../src/lib/amount.ts'
import { createPaymentIntent, validatePaymentDraft } from '../src/lib/intent.ts'
import { isNimiqNetwork } from '../src/lib/network.ts'

const VALID_ADDRESS = 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000'

describe('NIM amount parsing', () => {
  it('converts a whole NIM amount to Luna without floating point', () => {
    const parsed = parseNimToLuna('1')
    assert.deepEqual(parsed, { ok: true, luna: 100_000n })
    assert.equal(formatLunaAsNim(100_000n), '1')
  })

  it('accepts up to 5 decimal places', () => {
    const parsed = parseNimToLuna('1.23456')
    assert.deepEqual(parsed, { ok: true, luna: 123_456n })
    assert.equal(formatLunaAsNim(123_456n), '1.23456')
  })

  it('rejects empty, zero, and negative amounts', () => {
    assert.equal(parseNimToLuna('').ok, false)
    assert.equal(parseNimToLuna('0').ok, false)
    assert.equal(parseNimToLuna('-1').ok, false)
    assert.equal(parseNimToLuna('0.00000').ok, false)
  })

  it('rejects more than 5 decimal places', () => {
    const parsed = parseNimToLuna('1.000001')
    assert.equal(parsed.ok, false)
    if (!parsed.ok) {
      assert.match(parsed.message, /5 decimal/)
    }
  })
})

describe('Nimiq address validation', () => {
  it('accepts the documented Nimiq address example after official checksum validation', () => {
    assert.equal(ValidationUtils.isValidAddress(VALID_ADDRESS), true)
    assert.equal(isValidNimiqAddress(VALID_ADDRESS), true)
    assert.equal(
      normalizeNimiqAddress('nq07-0000-0000-0000-0000-0000-0000-0000-0000'),
      VALID_ADDRESS,
    )
  })

  it('rejects an empty or malformed recipient', () => {
    assert.equal(isValidNimiqAddress(''), false)
    assert.equal(isValidNimiqAddress('not-an-address'), false)
    assert.equal(isValidNimiqAddress('NQ07 0000'), false)
  })
})

describe('Payment intent creation', () => {
  it('creates an in-memory NIM intent from a valid draft', () => {
    const result = createPaymentIntent({
      recipient: VALID_ADDRESS,
      amount: '2.5',
      purpose: 'Test invoice',
    })

    assert.equal(result.ok, true)
    if (result.ok) {
      assert.equal(result.intent.asset, 'NIM')
      assert.equal(result.intent.network, 'NIMIQ_TESTNET')
      assert.notEqual(result.intent.network, 'Nimiq')
      assert.equal(result.intent.amountLuna, 250_000)
      assert.equal(result.intent.amountNim, '2.5')
      assert.equal(result.intent.purpose, 'Test invoice')
      assert.equal(result.intent.status, 'created')
      assert.equal(result.intent.transactionHash, null)
    }
  })

  it('does not use the generic string Nimiq as a network identifier', () => {
    assert.equal(isNimiqNetwork('Nimiq'), false)
    assert.equal(isNimiqNetwork('NIMIQ_TESTNET'), true)
    assert.equal(isNimiqNetwork('NIMIQ_MAINNET'), true)
  })

  it('returns field errors for an empty recipient and a zero amount', () => {
    const emptyRecipient = validatePaymentDraft({
      recipient: '   ',
      amount: '1',
      purpose: '',
    })
    assert.equal(emptyRecipient.recipient, 'Enter a recipient address.')

    const zeroAmount = validatePaymentDraft({
      recipient: VALID_ADDRESS,
      amount: '0',
      purpose: '',
    })
    assert.equal(zeroAmount.amount, 'Amount must be greater than zero.')
  })
})
