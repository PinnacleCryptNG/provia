import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isIntentId } from '../src/lib/ids.ts'
import {
  AMOUNT_LUNA,
  HASH,
  INTENT_DRAFT,
  OTHER_RECIPIENT,
  RECIPIENT,
  createIntent,
  createTrackedRpcObserver,
  postJson,
  rpcNotFound,
  rpcSuccess,
  rpcTx,
  withServer,
  NIMIQ_RPC_URL,
} from './server-harness.ts'

describe('POST /api/intents', () => {
  it('creates a server-owned intent ID', async () => {
    const rpc = createTrackedRpcObserver(() => rpcNotFound())
    await withServer(rpc.observe, async (baseUrl) => {
      const { status, json } = await postJson(baseUrl, '/api/intents', INTENT_DRAFT)
      assert.equal(status, 201)
      assert.equal(typeof json.intentId, 'string')
      assert.equal(isIntentId(json.intentId as string), true)
      assert.equal((json.intent as { recipient: string }).recipient, RECIPIENT)
      assert.equal((json.intent as { amountLuna: number }).amountLuna, AMOUNT_LUNA)
      assert.equal((json.intent as { asset: string }).asset, 'NIM')
      assert.equal((json.intent as { network: string }).network, 'NIMIQ_TESTNET')
    })
  })

  it('issues unpredictable non-sequential intent IDs', async () => {
    const rpc = createTrackedRpcObserver(() => rpcNotFound())
    await withServer(rpc.observe, async (baseUrl) => {
      const ids = [
        await createIntent(baseUrl),
        await createIntent(baseUrl),
        await createIntent(baseUrl),
        await createIntent(baseUrl),
        await createIntent(baseUrl),
      ]

      assert.equal(new Set(ids).size, ids.length)
      for (const id of ids) {
        assert.equal(isIntentId(id), true)
      }
      const suffixes = ids.map((id) => BigInt(`0x${id.slice(3)}`))
      const sequential = suffixes.every((value, index) => index === 0 || value === suffixes[index - 1]! + 1n)
      assert.equal(sequential, false)
    })
  })

  it('stores a retrievable intent', async () => {
    const rpc = createTrackedRpcObserver(() => rpcNotFound())
    await withServer(rpc.observe, async (baseUrl) => {
      const intentId = await createIntent(baseUrl)
      const response = await fetch(`${baseUrl}/api/intents/${intentId}`)
      const json = await response.json() as Record<string, unknown>
      assert.equal(response.status, 200)
      assert.equal(json.intentId, intentId)
      assert.equal((json.intent as { amountLuna: number }).amountLuna, AMOUNT_LUNA)
    })
  })

  it('rejects an invalid recipient', async () => {
    const rpc = createTrackedRpcObserver(() => rpcNotFound())
    await withServer(rpc.observe, async (baseUrl) => {
      const { status, json } = await postJson(baseUrl, '/api/intents', {
        ...INTENT_DRAFT,
        recipient: 'not-an-address',
      })
      assert.equal(status, 400)
      assert.match(String(json.error), /recipient/i)
    })
  })

  it('rejects an invalid amount', async () => {
    const rpc = createTrackedRpcObserver(() => rpcNotFound())
    await withServer(rpc.observe, async (baseUrl) => {
      const zero = await postJson(baseUrl, '/api/intents', { ...INTENT_DRAFT, amountLuna: 0 })
      assert.equal(zero.status, 400)
      assert.match(String(zero.json.error), /amountLuna/)

      const fraction = await postJson(baseUrl, '/api/intents', { ...INTENT_DRAFT, amountLuna: 1.5 })
      assert.equal(fraction.status, 400)
    })
  })

  it('rejects an invalid network', async () => {
    const rpc = createTrackedRpcObserver(() => rpcNotFound())
    await withServer(rpc.observe, async (baseUrl) => {
      const { status, json } = await postJson(baseUrl, '/api/intents', {
        ...INTENT_DRAFT,
        network: 'Nimiq',
      })
      assert.equal(status, 400)
      assert.match(String(json.error), /network/)
    })
  })

  it('does not let the client modify a stored intent after creation', async () => {
    const rpc = createTrackedRpcObserver(() => rpcSuccess(rpcTx()))
    await withServer(rpc.observe, async (baseUrl) => {
      const intentId = await createIntent(baseUrl)
      const verified = await postJson(baseUrl, '/api/verify', {
        intentId,
        transactionHash: HASH,
        recipient: OTHER_RECIPIENT,
        amountLuna: 1,
        network: 'NIMIQ_MAINNET',
        asset: 'USDT',
      })
      assert.equal(verified.json.outcome, 'VERIFIED')
      assert.equal(verified.json.expectedAmountLuna, AMOUNT_LUNA)
      assert.equal(verified.json.expectedRecipient, RECIPIENT)
      assert.equal(verified.json.network, 'NIMIQ_TESTNET')

      const stored = await fetch(`${baseUrl}/api/intents/${intentId}`)
      const json = await stored.json() as { intent: { amountLuna: number, recipient: string, network: string } }
      assert.equal(json.intent.amountLuna, AMOUNT_LUNA)
      assert.equal(json.intent.recipient, RECIPIENT)
      assert.equal(json.intent.network, 'NIMIQ_TESTNET')
    })
  })
})

describe('POST /api/intents recipient preflight', () => {
  it('stores the exact normalized recipient after a successful preflight', async () => {
    const rpc = createTrackedRpcObserver(() => rpcNotFound())
    await withServer(rpc.observe, async (baseUrl) => {
      const created = await postJson(baseUrl, '/api/intents', INTENT_DRAFT)
      assert.equal(created.status, 201)
      assert.equal((created.json.intent as { recipient: string }).recipient, RECIPIENT)
    })
  })

  it('does not create an intent when the recipient is a contract', async () => {
    const rpc = createTrackedRpcObserver(() => rpcNotFound())
    const htlc = 'NQ38 7NCU 6AMJ M6GG 18X9 PNKM YFYD 1YNJ XY09'
    await withServer(rpc.observe, async (baseUrl) => {
      const created = await postJson(baseUrl, '/api/intents', {
        ...INTENT_DRAFT,
        recipient: htlc,
      })
      assert.equal(created.status, 400)
      assert.match(String(created.json.error), /can’t receive a regular NIM payment/)
      assert.equal(created.json.intentId, undefined)
    }, {
      lookupAccount: async (input) => ({
        status: 'found',
        account: {
          address: input.address,
          balanceLuna: 1,
          type: 'htlc',
        },
        rpcUrl: 'https://rpc.testnet.nimiqwatch.com',
      }),
    })
  })

  it('does not create an intent when the recipient cannot be resolved', async () => {
    const rpc = createTrackedRpcObserver(() => rpcNotFound())
    await withServer(rpc.observe, async (baseUrl) => {
      const created = await postJson(baseUrl, '/api/intents', INTENT_DRAFT)
      assert.equal(created.status, 400)
      assert.match(String(created.json.error), /Couldn’t check this recipient/)
    }, {
      lookupAccount: async () => ({ status: 'unresolved', message: 'Unknown format' }),
    })
  })

  it('keeps wallet send from happening until a server intent exists', async () => {
    const app = await import('node:fs').then((fs) => (
      fs.readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
    ))
    const checkFn = app.slice(
      app.indexOf('async function checkPaymentDetails'),
      app.indexOf('function goToReview'),
    )
    const confirmFn = app.slice(
      app.indexOf('async function confirmPayment'),
      app.indexOf('function retryVerification'),
    )
    assert.match(checkFn, /createServerIntent/)
    assert.doesNotMatch(checkFn, /sendBasicNimPayment/)
    assert.match(checkFn, /screen\.value = 'checked'/)
    assert.match(confirmFn, /sendBasicNimPayment/)
    assert.match(confirmFn, /isIntentId\(current\.id\)/)
  })
})
