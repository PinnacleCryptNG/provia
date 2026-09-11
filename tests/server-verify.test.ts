import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { PaymentIntent } from '../src/lib/intent.ts'
import { createProviaApiVerificationService } from '../src/lib/observation-service.ts'
import { MIN_CONFIRMATIONS } from '../src/lib/verify.ts'
import {
  AMOUNT_LUNA,
  HASH,
  OTHER_RECIPIENT,
  RECIPIENT,
  createIntent,
  createTrackedRpcObserver,
  jsonResponse,
  postJson,
  rpcNotFound,
  rpcSuccess,
  rpcTx,
  withServer,
  NIMIQ_RPC_URL,
} from './server-harness.ts'

const CLIENT_INTENT: PaymentIntent = {
  id: `pi_${'a'.repeat(32)}`,
  recipient: RECIPIENT,
  amountNim: '110000',
  amountLuna: AMOUNT_LUNA,
  asset: 'NIM',
  network: 'NIMIQ_TESTNET',
  purpose: null,
  createdAt: '2026-09-11T00:00:00.000Z',
  status: 'submitted',
  transactionHash: HASH,
}

describe('POST /api/verify', () => {
  it('verifies with intentId and a matching observed transaction', async () => {
    const rpc = createTrackedRpcObserver(() => rpcSuccess(rpcTx()))
    await withServer(rpc.observe, async (baseUrl) => {
      const intentId = await createIntent(baseUrl)
      const { status, json } = await postJson(baseUrl, '/api/verify', {
        intentId,
        transactionHash: HASH,
      })

      assert.equal(status, 200)
      assert.equal(json.outcome, 'VERIFIED')
      assert.equal(json.reason, null)
      assert.equal(json.intentId, intentId)
      assert.equal(json.expectedAmountLuna, AMOUNT_LUNA)
      assert.equal(json.observedAmountLuna, AMOUNT_LUNA)
      assert.equal(json.expectedRecipient, RECIPIENT)
      assert.equal(json.observedRecipient, RECIPIENT)
      assert.equal(json.transactionHash, HASH)
      assert.equal(json.confirmations, MIN_CONFIRMATIONS)
      assert.equal(json.observedBlockNumber, 11063444)
      assert.equal(json.network, 'NIMIQ_TESTNET')
      assert.equal('jsonrpc' in json, false)
      assert.equal('data' in json, false)
    })
  })

  it('rejects an unknown intentId', async () => {
    const rpc = createTrackedRpcObserver(() => rpcSuccess(rpcTx()))
    await withServer(rpc.observe, async (baseUrl) => {
      const { status, json } = await postJson(baseUrl, '/api/verify', {
        intentId: `pi_${'b'.repeat(32)}`,
        transactionHash: HASH,
      })
      assert.equal(status, 404)
      assert.match(String(json.error), /unknown payment intent/i)
      assert.equal(rpc.calls.length, 0)
    })
  })

  it('ignores client-supplied fake intent fields', async () => {
    const rpc = createTrackedRpcObserver(() => rpcSuccess(rpcTx()))
    await withServer(rpc.observe, async (baseUrl) => {
      const intentId = await createIntent(baseUrl)
      const { json } = await postJson(baseUrl, '/api/verify', {
        intentId,
        transactionHash: HASH,
        intent: {
          recipient: OTHER_RECIPIENT,
          amountLuna: 1,
          asset: 'USDT',
          network: 'NIMIQ_MAINNET',
        },
      })
      assert.equal(json.outcome, 'VERIFIED')
      assert.equal(json.expectedAmountLuna, AMOUNT_LUNA)
      assert.equal(json.expectedRecipient, RECIPIENT)
    })
  })

  it('cannot be forced VERIFIED by a client-supplied outcome', async () => {
    const rpc = createTrackedRpcObserver(() => rpcNotFound())
    await withServer(rpc.observe, async (baseUrl) => {
      const intentId = await createIntent(baseUrl)
      const { json } = await postJson(baseUrl, '/api/verify', {
        intentId,
        transactionHash: HASH,
        outcome: 'VERIFIED',
        verified: true,
        confirmations: 99,
        observedAmountLuna: AMOUNT_LUNA,
        executionResult: true,
        rpcUrl: 'https://evil.example',
      })

      assert.equal(json.outcome, 'UNRESOLVED')
      assert.equal(json.reason, 'NOT_FOUND')
      assert.equal(rpc.calls[0]?.url, NIMIQ_RPC_URL)
    })
  })

  it('returns MISMATCH for a wrong recipient', async () => {
    const rpc = createTrackedRpcObserver(() => rpcSuccess(rpcTx({ to: OTHER_RECIPIENT })))
    await withServer(rpc.observe, async (baseUrl) => {
      const intentId = await createIntent(baseUrl)
      const { json } = await postJson(baseUrl, '/api/verify', { intentId, transactionHash: HASH })
      assert.equal(json.outcome, 'MISMATCH')
      assert.equal(json.reason, 'WRONG_RECIPIENT')
    })
  })

  it('returns UNDERPAID when the observed amount is lower', async () => {
    const rpc = createTrackedRpcObserver(() => rpcSuccess(rpcTx({ value: AMOUNT_LUNA - 1 })))
    await withServer(rpc.observe, async (baseUrl) => {
      const intentId = await createIntent(baseUrl)
      const { json } = await postJson(baseUrl, '/api/verify', { intentId, transactionHash: HASH })
      assert.equal(json.outcome, 'UNDERPAID')
    })
  })

  it('returns MISMATCH for an overpayment', async () => {
    const rpc = createTrackedRpcObserver(() => rpcSuccess(rpcTx({ value: AMOUNT_LUNA + 1 })))
    await withServer(rpc.observe, async (baseUrl) => {
      const intentId = await createIntent(baseUrl)
      const { json } = await postJson(baseUrl, '/api/verify', { intentId, transactionHash: HASH })
      assert.equal(json.outcome, 'MISMATCH')
      assert.equal(json.reason, 'OVERPAID')
    })
  })

  it('returns FAILED when execution failed', async () => {
    const rpc = createTrackedRpcObserver(() => rpcSuccess(rpcTx({ executionResult: false })))
    await withServer(rpc.observe, async (baseUrl) => {
      const intentId = await createIntent(baseUrl)
      const { json } = await postJson(baseUrl, '/api/verify', { intentId, transactionHash: HASH })
      assert.equal(json.outcome, 'FAILED')
    })
  })

  it('returns UNRESOLVED when the transaction is not found', async () => {
    const rpc = createTrackedRpcObserver(() => rpcNotFound())
    await withServer(rpc.observe, async (baseUrl) => {
      const intentId = await createIntent(baseUrl)
      const { json } = await postJson(baseUrl, '/api/verify', { intentId, transactionHash: HASH })
      assert.equal(json.outcome, 'UNRESOLVED')
      assert.equal(json.reason, 'NOT_FOUND')
    })
  })

  it('returns UNRESOLVED when confirmations are insufficient', async () => {
    const rpc = createTrackedRpcObserver(() => rpcSuccess(rpcTx({ confirmations: MIN_CONFIRMATIONS - 1 })))
    await withServer(rpc.observe, async (baseUrl) => {
      const intentId = await createIntent(baseUrl)
      const { json } = await postJson(baseUrl, '/api/verify', { intentId, transactionHash: HASH })
      assert.equal(json.outcome, 'UNRESOLVED')
      assert.equal(json.reason, 'INSUFFICIENT_CONFIRMATIONS')
    })
  })

  it('returns UNRESOLVED for an invalid hash without calling RPC', async () => {
    const rpc = createTrackedRpcObserver(() => {
      throw new Error('RPC should not be called for an invalid hash')
    })
    await withServer(rpc.observe, async (baseUrl) => {
      const intentId = await createIntent(baseUrl)
      const { json } = await postJson(baseUrl, '/api/verify', {
        intentId,
        transactionHash: 'not-a-hash',
      })
      assert.equal(json.outcome, 'UNRESOLVED')
      assert.equal(json.reason, 'INVALID_HASH')
      assert.equal(rpc.calls.length, 0)
    })
  })

  it('observes the chain through the configured Nimiq RPC', async () => {
    const rpc = createTrackedRpcObserver((hash) => {
      assert.equal(hash, HASH)
      return rpcSuccess(rpcTx())
    })

    await withServer(rpc.observe, async (baseUrl) => {
      const intentId = await createIntent(baseUrl)
      const { json } = await postJson(baseUrl, '/api/verify', { intentId, transactionHash: HASH })
      assert.equal(json.outcome, 'VERIFIED')
      assert.equal(rpc.calls[0]?.url, NIMIQ_RPC_URL)
      assert.equal(rpc.calls[0]?.hash, HASH)
    })
  })
})

describe('PROVIA verification client', () => {
  it('posts only intentId and transactionHash', async () => {
    let sent: unknown
    const service = createProviaApiVerificationService({
      fetch: async (_url, init) => {
        sent = JSON.parse(String(init?.body))
        return jsonResponse({
          outcome: 'UNRESOLVED',
          reason: 'NOT_FOUND',
          confirmations: null,
          confirmationPolicy: MIN_CONFIRMATIONS,
          expectedRecipient: RECIPIENT,
          observedRecipient: null,
          expectedAmountLuna: AMOUNT_LUNA,
          observedAmountLuna: null,
          observedNetworkId: null,
          observedKind: null,
          transactionHash: HASH,
          sender: null,
          observedBlockNumber: null,
        })
      },
    })

    await service.verify(CLIENT_INTENT, HASH)

    assert.ok(sent && typeof sent === 'object')
    const body = sent as Record<string, unknown>
    assert.deepEqual(Object.keys(body).sort(), ['intentId', 'transactionHash'])
    assert.equal(body.intentId, CLIENT_INTENT.id)
    assert.equal(body.transactionHash, HASH)
    assert.equal('outcome' in body, false)
    assert.equal('amountLuna' in body, false)
    assert.equal('recipient' in body, false)
  })
})
