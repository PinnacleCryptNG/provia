import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { fetchRecipientPreflight } from '../src/lib/observation-service.ts'
import {
  inspectLocalRecipient,
  recipientCheckView,
  sameCheckedRecipient,
} from '../src/lib/recipient-check.ts'

const VALID = 'NQ61 XMNV XULY D874 G08H YDXK LK29 E7YR KFP6'

function read(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

describe('Send recipient preflight UX', () => {
  const create = read('src/components/CreatePayment.vue')
  const card = read('src/components/RecipientCheckCard.vue')
  const app = read('src/App.vue')
  const review = read('src/components/ReviewPayment.vue')
  const adapter = read('src/lib/recipient-check.ts')

  it('shows no preflight card while the recipient is empty', () => {
    assert.equal(inspectLocalRecipient(''), 'idle')
    assert.match(card, /v-if="view\.status !== 'idle'"/)
    assert.match(create, /placeholder="Enter Nimiq address"/)
  })

  it('fails a clearly invalid address locally without calling the preflight API', () => {
    const sync = create.slice(
      create.indexOf('function syncRecipientCheck'),
      create.indexOf('watch(recipient'),
    )
    assert.equal(inspectLocalRecipient('NQZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ'), 'invalid')
    assert.match(sync, /if \(local === 'invalid'\)/)
    assert.match(sync, /checkStatus\.value = 'invalid'/)
    const invalidBranch = sync.slice(
      sync.indexOf("if (local === 'invalid')"),
      sync.indexOf('if (sameCheckedRecipient'),
    )
    assert.doesNotMatch(invalidBranch, /fetchRecipientPreflight|runPreflight/)
  })

  it('enters checking after a checksum-valid address is entered', () => {
    assert.equal(inspectLocalRecipient(VALID), 'ready')
    assert.match(create, /checkStatus\.value = 'checking'/)
    assert.equal(recipientCheckView('checking').title, 'Recipient verification')
    assert.equal(recipientCheckView('checking').message, 'Checking this recipient…')
  })

  it('keeps Continue disabled while the recipient is still being checked', () => {
    const gate = create.slice(
      create.indexOf('const canContinue = computed'),
      create.indexOf('const continueLabel'),
    )
    assert.match(gate, /checkStatus\.value === 'verified'/)
    assert.match(create, /:disabled="!canContinue"/)
    assert.match(create, /Checking recipient…/)
    assert.equal(recipientCheckView('checking').canContinue, false)
  })

  it('keeps Continue disabled after a failed preflight', () => {
    assert.equal(recipientCheckView('invalid').canContinue, false)
    assert.equal(recipientCheckView('unsupported').canContinue, false)
    assert.equal(recipientCheckView('error').canContinue, false)
    assert.match(create, /checkStatus\.value === 'verified'/)
    assert.match(create, /sameCheckedRecipient\(recipient\.value, verifiedRecipient\.value\)/)
  })

  it('allows Continue only after a successful preflight and a valid amount', () => {
    const gate = create.slice(
      create.indexOf('const canContinue = computed'),
      create.indexOf('const continueLabel'),
    )
    assert.match(gate, /checkStatus\.value === 'verified'/)
    assert.match(gate, /amountIsValid\.value/)
    assert.match(gate, /!props\.isCreating/)
    assert.equal(recipientCheckView('verified').canContinue, true)
    assert.equal(sameCheckedRecipient(VALID, VALID), true)
  })

  it('passes the exact entered recipient through to server intent creation', () => {
    assert.match(create, /recipient: recipient\.value/)
    assert.doesNotMatch(create, /shortenNimiqAddress\(recipient/)
    const checkFn = app.slice(
      app.indexOf('async function checkPaymentDetails'),
      app.indexOf('function backToCreate'),
    )
    assert.match(checkFn, /recipient: draft\.recipient/)
    assert.doesNotMatch(checkFn, /shortenNimiqAddress/)
  })

  it('shows the intended recipient on Review, with a way to see the full address', () => {
    assert.match(review, /shortenNimiqAddress\(intent\.recipient\)/)
    assert.match(review, /Show full address/)
    assert.match(review, /intent\.recipient/)
    assert.match(review, /Recipient checked before payment/)
  })

  it('keeps Purpose as optional UX metadata, not verification truth', () => {
    assert.match(create, /<select v-model="purpose"/)
    const checkFn = app.slice(
      app.indexOf('async function checkPaymentDetails'),
      app.indexOf('function backToCreate'),
    )
    const intentCallStart = checkFn.indexOf('createServerIntent({')
    const intentCall = checkFn.slice(intentCallStart, checkFn.indexOf('})', intentCallStart) + 2)
    assert.match(intentCall, /recipient: draft\.recipient/)
    assert.doesNotMatch(intentCall, /purpose/)
    assert.match(checkFn, /purpose: purpose\.length > 0 \? purpose : null/)
  })

  it('keeps Confirm in Nimiq Pay behind a successful preflight and Review', () => {
    assert.doesNotMatch(create, /sendBasicNimPayment|Confirm in Nimiq Pay/)
    assert.match(app, /@review="checkPaymentDetails"/)
    assert.match(app, /@confirm="confirmPayment"/)
    assert.match(review, /Confirm in Nimiq Pay/)
  })

  it('does not invent poisoning or burn-address claims in the Send UX', () => {
    assert.doesNotMatch(create, /poison|burn address|unsafe/i)
    assert.doesNotMatch(card, /poison|burn address|unsafe/i)
    assert.doesNotMatch(adapter, /poison|burn address|unsafe/i)
    assert.doesNotMatch(review, /poison|burn address/i)
  })

  it('does not expose RPC internals in the recipient-check adapter or card', () => {
    for (const phrase of ['accountType', 'fromType', 'toType', 'HTLC', 'classifier', 'network ID', 'Luna']) {
      assert.doesNotMatch(adapter, new RegExp(phrase))
      assert.doesNotMatch(card, new RegExp(phrase))
    }
  })
})

describe('fetchRecipientPreflight client adapter', () => {
  it('maps a verified API result without exposing account type', async () => {
    const result = await fetchRecipientPreflight(VALID, {
      fetch: async () => new Response(JSON.stringify({
        status: 'verified',
        recipient: VALID,
        network: 'NIMIQ_TESTNET',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    })
    assert.equal(result.status, 'verified')
    assert.equal(result.recipient, VALID)
    assert.equal(result.network, 'NIMIQ_TESTNET')
    assert.equal('accountType' in result, false)
  })

  it('maps unsupported and error responses for the Send card', async () => {
    const unsupported = await fetchRecipientPreflight(VALID, {
      fetch: async () => new Response(JSON.stringify({ status: 'unsupported' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    })
    const failed = await fetchRecipientPreflight(VALID, {
      fetch: async () => new Response(JSON.stringify({ status: 'error' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    })
    const down = await fetchRecipientPreflight(VALID, {
      fetch: async () => {
        throw new Error('network down')
      },
    })
    assert.equal(unsupported.status, 'unsupported')
    assert.equal(failed.status, 'error')
    assert.equal(down.status, 'error')
  })

  it('always checks the current Testnet network', async () => {
    let body = ''
    await fetchRecipientPreflight(VALID, {
      fetch: async (_url, init) => {
        body = String(init?.body)
        return new Response(JSON.stringify({ status: 'verified', recipient: VALID, network: 'NIMIQ_TESTNET' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      },
    })
    assert.match(body, /NIMIQ_TESTNET/)
    assert.doesNotMatch(body, /NIMIQ_MAINNET/)
  })
})
