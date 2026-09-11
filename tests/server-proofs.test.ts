import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isProofId } from '../src/lib/ids.ts'
import { MIN_CONFIRMATIONS } from '../src/lib/verify.ts'
import {
  AMOUNT_LUNA,
  HASH,
  OTHER_RECIPIENT,
  RECIPIENT,
  createIntent,
  createTrackedRpcObserver,
  postJson,
  rpcNotFound,
  rpcSuccess,
  rpcTx,
  withServer,
} from './server-harness.ts'

describe('POST /api/proofs', () => {
  it('creates a proof only for a VERIFIED transaction', async () => {
    const rpc = createTrackedRpcObserver(() => rpcSuccess(rpcTx()))
    await withServer(rpc.observe, async (baseUrl) => {
      const intentId = await createIntent(baseUrl)
      const { status, json } = await postJson(baseUrl, '/api/proofs', {
        intentId,
        transactionHash: HASH,
        status: 'VERIFIED',
      })

      assert.equal(status, 201)
      assert.equal(json.status, 'VERIFIED')
      assert.equal(isProofId(json.proofId as string), true)
      assert.equal(json.intentId, intentId)
      assert.equal(json.asset, 'NIM')
      assert.equal(json.network, 'NIMIQ_TESTNET')
      assert.equal(json.expectedAmountLuna, AMOUNT_LUNA)
      assert.equal(json.observedAmountLuna, AMOUNT_LUNA)
      assert.equal(json.recipient, RECIPIENT)
      assert.equal(json.transactionHash, HASH)
      assert.equal(json.blockNumber, 11063444)
      assert.equal(json.confirmationsAtVerification, MIN_CONFIRMATIONS)
      assert.equal(typeof json.verifiedAt, 'string')
      assert.equal('jsonrpc' in json, false)
      assert.equal('data' in json, false)
    })
  })

  it('does not create a proof for a wrong recipient', async () => {
    const rpc = createTrackedRpcObserver(() => rpcSuccess(rpcTx({ to: OTHER_RECIPIENT })))
    await withServer(rpc.observe, async (baseUrl) => {
      const intentId = await createIntent(baseUrl)
      const { status, json } = await postJson(baseUrl, '/api/proofs', {
        intentId,
        transactionHash: HASH,
      })
      assert.equal(status, 409)
      assert.equal(json.outcome, 'MISMATCH')
      assert.equal(json.reason, 'WRONG_RECIPIENT')
      assert.equal('proofId' in json, false)
    })
  })

  it('does not create a proof for an underpaid transaction', async () => {
    const rpc = createTrackedRpcObserver(() => rpcSuccess(rpcTx({ value: AMOUNT_LUNA - 1 })))
    await withServer(rpc.observe, async (baseUrl) => {
      const intentId = await createIntent(baseUrl)
      const { status, json } = await postJson(baseUrl, '/api/proofs', {
        intentId,
        transactionHash: HASH,
      })
      assert.equal(status, 409)
      assert.equal(json.outcome, 'UNDERPAID')
    })
  })

  it('does not create a proof for a failed transaction', async () => {
    const rpc = createTrackedRpcObserver(() => rpcSuccess(rpcTx({ executionResult: false })))
    await withServer(rpc.observe, async (baseUrl) => {
      const intentId = await createIntent(baseUrl)
      const { status, json } = await postJson(baseUrl, '/api/proofs', {
        intentId,
        transactionHash: HASH,
      })
      assert.equal(status, 409)
      assert.equal(json.outcome, 'FAILED')
    })
  })

  it('does not create a proof for an unresolved transaction', async () => {
    const rpc = createTrackedRpcObserver(() => rpcNotFound())
    await withServer(rpc.observe, async (baseUrl) => {
      const intentId = await createIntent(baseUrl)
      const { status, json } = await postJson(baseUrl, '/api/proofs', {
        intentId,
        transactionHash: HASH,
      })
      assert.equal(status, 409)
      assert.equal(json.outcome, 'UNRESOLVED')
    })
  })

  it('does not create a proof for an unknown intent', async () => {
    const rpc = createTrackedRpcObserver(() => rpcSuccess(rpcTx()))
    await withServer(rpc.observe, async (baseUrl) => {
      const { status, json } = await postJson(baseUrl, '/api/proofs', {
        intentId: `pi_${'c'.repeat(32)}`,
        transactionHash: HASH,
      })
      assert.equal(status, 404)
      assert.match(String(json.error), /unknown payment intent/i)
      assert.equal(rpc.calls.length, 0)
    })
  })

  it('returns the stored proof on retrieval', async () => {
    const rpc = createTrackedRpcObserver(() => rpcSuccess(rpcTx()))
    await withServer(rpc.observe, async (baseUrl) => {
      const intentId = await createIntent(baseUrl)
      const created = await postJson(baseUrl, '/api/proofs', { intentId, transactionHash: HASH })
      const proofId = created.json.proofId as string
      const response = await fetch(`${baseUrl}/api/proofs/${proofId}`)
      const json = await response.json() as Record<string, unknown>
      assert.equal(response.status, 200)
      assert.equal(json.proofId, proofId)
      assert.equal(json.intentId, intentId)
      assert.equal(json.observedAmountLuna, AMOUNT_LUNA)
      assert.equal(json.recipient, RECIPIENT)
      assert.equal(json.transactionHash, HASH)
    })
  })

  it('stores server-observed evidence, not client-supplied VERIFIED claims', async () => {
    const rpc = createTrackedRpcObserver(() => rpcSuccess(rpcTx({
      value: AMOUNT_LUNA,
      confirmations: MIN_CONFIRMATIONS + 12,
      blockNumber: 11063444,
    })))
    await withServer(rpc.observe, async (baseUrl) => {
      const intentId = await createIntent(baseUrl)
      const { json } = await postJson(baseUrl, '/api/proofs', {
        intentId,
        transactionHash: HASH,
        status: 'VERIFIED',
        observedAmountLuna: 1,
        recipient: OTHER_RECIPIENT,
        confirmationsAtVerification: 1,
        blockNumber: 1,
      })

      assert.equal(json.status, 'VERIFIED')
      assert.equal(json.observedAmountLuna, AMOUNT_LUNA)
      assert.equal(json.recipient, RECIPIENT)
      assert.equal(json.confirmationsAtVerification, MIN_CONFIRMATIONS + 12)
      assert.equal(json.blockNumber, 11063444)
    })
  })

  it('issues unpredictable non-sequential proof IDs', async () => {
    const rpc = createTrackedRpcObserver(() => rpcSuccess(rpcTx()))
    await withServer(rpc.observe, async (baseUrl) => {
      const ids: string[] = []
      for (let index = 0; index < 5; index += 1) {
        const intentId = await createIntent(baseUrl)
        const created = await postJson(baseUrl, '/api/proofs', { intentId, transactionHash: HASH })
        ids.push(created.json.proofId as string)
      }

      assert.equal(new Set(ids).size, ids.length)
      for (const id of ids) {
        assert.equal(isProofId(id), true)
      }
      const suffixes = ids.map((id) => BigInt(`0x${id.slice(4)}`))
      const sequential = suffixes.every((value, index) => index === 0 || value === suffixes[index - 1]! + 1n)
      assert.equal(sequential, false)
    })
  })
})
