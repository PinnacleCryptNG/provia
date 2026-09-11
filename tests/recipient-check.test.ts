import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  inspectLocalRecipient,
  recipientCheckFromPreflight,
  recipientCheckView,
  sameCheckedRecipient,
} from '../src/lib/recipient-check.ts'
import type { RecipientPreflightResult } from '../src/lib/recipient-preflight.ts'

const VALID = 'NQ61 XMNV XULY D874 G08H YDXK LK29 E7YR KFP6'

describe('recipient check UX adapter', () => {
  it('shows no preflight for an empty recipient', () => {
    assert.equal(inspectLocalRecipient(''), 'idle')
    assert.equal(inspectLocalRecipient('   '), 'idle')
    assert.equal(recipientCheckView('idle').title, '')
    assert.equal(recipientCheckView('idle').canContinue, false)
  })

  it('fails incomplete or checksum-invalid addresses locally', () => {
    assert.equal(inspectLocalRecipient('NQ61 XMNV'), 'idle')
    assert.equal(inspectLocalRecipient('NQ00 0000 0000 0000 0000 0000 0000 0000 0000'), 'invalid')
    assert.equal(recipientCheckView('invalid').title, 'Recipient address isn’t valid')
  })

  it('does not treat a locally invalid address as ready for RPC lookup', () => {
    assert.notEqual(inspectLocalRecipient('not-an-address-at-all-and-long-enough-36xx'), 'ready')
    assert.equal(inspectLocalRecipient('NQZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ'), 'invalid')
  })

  it('marks a checksum-valid address as ready to check', () => {
    assert.equal(inspectLocalRecipient(VALID), 'ready')
    assert.equal(recipientCheckView('checking').title, 'Recipient verification')
    assert.equal(recipientCheckView('checking').message, 'Checking this recipient…')
    assert.equal(recipientCheckView('checking').canContinue, false)
  })

  it('maps a successful preflight to Recipient verified with Testnet status', () => {
    const mapped = recipientCheckFromPreflight({
      ok: true,
      recipient: VALID,
      network: 'NIMIQ_TESTNET',
      accountType: 'basic',
    })
    const view = recipientCheckView(mapped.status)
    assert.equal(mapped.status, 'verified')
    assert.equal(mapped.recipient, VALID)
    assert.equal(view.title, 'Recipient verified')
    assert.equal(view.canContinue, true)
    assert.ok(view.checks.some((row) => row.label === 'Address is valid'))
    assert.ok(view.checks.some((row) => row.label === 'Network: Nimiq Testnet'))
    assert.ok(view.checks.some((row) => row.label === 'Recipient type: Supported'))
  })

  it('maps contract and protocol failures to unsupported', () => {
    const contract: RecipientPreflightResult = {
      ok: false,
      reason: 'contract_recipient',
      error: 'nope',
    }
    const protocol: RecipientPreflightResult = {
      ok: false,
      reason: 'protocol_recipient',
      error: 'nope',
    }
    assert.equal(recipientCheckFromPreflight(contract).status, 'unsupported')
    assert.equal(recipientCheckFromPreflight(protocol).status, 'unsupported')
    assert.equal(recipientCheckView('unsupported').canContinue, false)
    assert.match(recipientCheckView('unsupported').title, /Unsupported recipient/)
  })

  it('maps RPC and unresolved failures to a retryable error', () => {
    const error = recipientCheckFromPreflight({
      ok: false,
      reason: 'rpc_error',
      error: 'down',
    })
    const view = recipientCheckView(error.status)
    assert.equal(error.status, 'error')
    assert.equal(view.canRetry, true)
    assert.equal(view.canContinue, false)
    assert.match(view.title, /Couldn’t verify this recipient/)
    assert.doesNotMatch(view.message, /poison|burn/i)
  })

  it('keeps the exact checked recipient for intent creation', () => {
    assert.equal(sameCheckedRecipient(VALID, VALID), true)
    assert.equal(sameCheckedRecipient(` ${VALID} `, VALID), true)
    assert.equal(sameCheckedRecipient('NQ07 0000 0000 0000 0000 0000 0000 0000 0000', VALID), false)
  })
})
