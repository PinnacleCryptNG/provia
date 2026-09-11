import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { PaymentIntent } from '../src/lib/intent.ts'
import { GET_TRANSACTION_BY_HASH } from '../src/lib/observe.ts'
import { createProviaApiVerificationService } from '../src/lib/observation-service.ts'
import { MIN_CONFIRMATIONS } from '../src/lib/verify.ts'
import { createProviaServer } from '../server/index.ts'
import { NIMIQ_RPC_URL, createNimiqRpcObserver } from '../server/observation.ts'
import { createProofFromVerifiedResult } from '../server/proofs.ts'
import type { ObserveTransaction } from '../server/observation.ts'

const RECIPIENT = 'NQ61 XMNV XULY D874 G08H YDXK LK29 E7YR KFP6'
const OTHER_RECIPIENT = 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000'
const SENDER = 'NQ37 7C3V VMN8 FRPN FXS9 PLAG JMRE 8SC6 KUSQ'
const HASH = '0e70ceec09dc5abd954196c004713d241e08a0cb25370b7e711455cd4853c6fc'
const AMOUNT_LUNA = 11_000_000_000

const INTENT = {
  recipient: RECIPIENT,
  amountLuna: AMOUNT_LUNA,
  asset: 'NIM',
  network: 'NIMIQ_TESTNET' as const,
}

const CLIENT_INTENT: PaymentIntent = {
  id: 'intent-1',
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

function rpcTx(overrides: Record<string, unknown> = {}) {
  return {
    hash: HASH,
    blockNumber: 11063444,
    timestamp: 1789035147227,
    confirmations: MIN_CONFIRMATIONS,
    from: SENDER,
    fromType: 0,
    to: RECIPIENT,
    toType: 0,
    value: AMOUNT_LUNA,
    fee: 5,
    senderData: '',
    recipientData: '',
    flags: 0,
    networkId: 5,
    executionResult: true,
    ...overrides,
  }
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function rpcSuccess(data: unknown) {
  return {
    jsonrpc: '2.0',
    result: { data, metadata: {} },
    id: 1,
  }
}

function rpcNotFound() {
  return {
    jsonrpc: '2.0',
    error: { code: -32603, message: 'Transaction not found' },
    id: 1,
  }
}

function createTrackedRpcObserver(respond: (hash: string) => unknown): {
  observe: ObserveTransaction
  calls: Array<{ url: string, hash: string }>
} {
  const calls: Array<{ url: string, hash: string }> = []

  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input)
    const body = JSON.parse(String(init?.body))
    const hash = body.params[0]
    calls.push({ url, hash })
    assert.equal(body.method, GET_TRANSACTION_BY_HASH)
    return jsonResponse(respond(hash))
  }

  return {
    calls,
    observe: createNimiqRpcObserver({ fetch: fetchImpl }),
  }
}

async function withServer(
  observe: ObserveTransaction,
  fn: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server = createProviaServer({ observe })
  await new Promise<void>((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => resolve())
    server.on('error', reject)
  })

  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Server did not bind a port.')
  }

  try {
    await fn(`http://127.0.0.1:${address.port}`)
  }
  finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    })
  }
}

async function postVerify(baseUrl: string, body: unknown) {
  const response = await fetch(`${baseUrl}/api/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  return {
    status: response.status,
    json: await response.json() as Record<string, unknown>,
  }
}

describe('POST /api/verify', () => {
  it('returns VERIFIED for a matching observed transaction', async () => {
    const rpc = createTrackedRpcObserver(() => rpcSuccess(rpcTx()))
    await withServer(rpc.observe, async (baseUrl) => {
      const { status, json } = await postVerify(baseUrl, {
        intent: INTENT,
        transactionHash: HASH,
      })

      assert.equal(status, 200)
      assert.equal(json.outcome, 'VERIFIED')
      assert.equal(json.reason, null)
      assert.equal(json.expectedAmountLuna, AMOUNT_LUNA)
      assert.equal(json.observedAmountLuna, AMOUNT_LUNA)
      assert.equal(json.expectedRecipient, RECIPIENT)
      assert.equal(json.observedRecipient, RECIPIENT)
      assert.equal(json.transactionHash, HASH)
      assert.equal(json.confirmations, MIN_CONFIRMATIONS)
      assert.equal(json.observedBlockNumber, 11063444)
      assert.equal(json.network, 'NIMIQ_TESTNET')
      assert.equal(typeof json.explanation, 'string')
      assert.equal('jsonrpc' in json, false)
      assert.equal('data' in json, false)
    })
  })

  it('returns MISMATCH for a wrong recipient', async () => {
    const rpc = createTrackedRpcObserver(() => rpcSuccess(rpcTx({ to: OTHER_RECIPIENT })))
    await withServer(rpc.observe, async (baseUrl) => {
      const { json } = await postVerify(baseUrl, {
        intent: INTENT,
        transactionHash: HASH,
      })
      assert.equal(json.outcome, 'MISMATCH')
      assert.equal(json.reason, 'WRONG_RECIPIENT')
      assert.equal(json.observedRecipient, OTHER_RECIPIENT)
    })
  })

  it('returns UNDERPAID when the observed amount is lower', async () => {
    const rpc = createTrackedRpcObserver(() => rpcSuccess(rpcTx({ value: AMOUNT_LUNA - 1 })))
    await withServer(rpc.observe, async (baseUrl) => {
      const { json } = await postVerify(baseUrl, {
        intent: INTENT,
        transactionHash: HASH,
      })
      assert.equal(json.outcome, 'UNDERPAID')
      assert.equal(json.expectedAmountLuna, AMOUNT_LUNA)
      assert.equal(json.observedAmountLuna, AMOUNT_LUNA - 1)
    })
  })

  it('returns MISMATCH for an overpayment', async () => {
    const rpc = createTrackedRpcObserver(() => rpcSuccess(rpcTx({ value: AMOUNT_LUNA + 1 })))
    await withServer(rpc.observe, async (baseUrl) => {
      const { json } = await postVerify(baseUrl, {
        intent: INTENT,
        transactionHash: HASH,
      })
      assert.equal(json.outcome, 'MISMATCH')
      assert.equal(json.reason, 'OVERPAID')
    })
  })

  it('returns FAILED when execution failed', async () => {
    const rpc = createTrackedRpcObserver(() => rpcSuccess(rpcTx({ executionResult: false })))
    await withServer(rpc.observe, async (baseUrl) => {
      const { json } = await postVerify(baseUrl, {
        intent: INTENT,
        transactionHash: HASH,
      })
      assert.equal(json.outcome, 'FAILED')
      assert.equal(json.reason, 'EXECUTION_FAILED')
    })
  })

  it('returns UNRESOLVED when the transaction is not found', async () => {
    const rpc = createTrackedRpcObserver(() => rpcNotFound())
    await withServer(rpc.observe, async (baseUrl) => {
      const { json } = await postVerify(baseUrl, {
        intent: INTENT,
        transactionHash: HASH,
      })
      assert.equal(json.outcome, 'UNRESOLVED')
      assert.equal(json.reason, 'NOT_FOUND')
    })
  })

  it('returns UNRESOLVED when confirmations are insufficient', async () => {
    const rpc = createTrackedRpcObserver(() => rpcSuccess(rpcTx({ confirmations: MIN_CONFIRMATIONS - 1 })))
    await withServer(rpc.observe, async (baseUrl) => {
      const { json } = await postVerify(baseUrl, {
        intent: INTENT,
        transactionHash: HASH,
      })
      assert.equal(json.outcome, 'UNRESOLVED')
      assert.equal(json.reason, 'INSUFFICIENT_CONFIRMATIONS')
    })
  })

  it('returns UNRESOLVED for an invalid hash without calling RPC', async () => {
    const rpc = createTrackedRpcObserver(() => {
      throw new Error('RPC should not be called for an invalid hash')
    })
    await withServer(rpc.observe, async (baseUrl) => {
      const { status, json } = await postVerify(baseUrl, {
        intent: INTENT,
        transactionHash: 'not-a-hash',
      })
      assert.equal(status, 200)
      assert.equal(json.outcome, 'UNRESOLVED')
      assert.equal(json.reason, 'INVALID_HASH')
      assert.equal(rpc.calls.length, 0)
    })
  })

  it('cannot be forced VERIFIED by fake observed transaction data from the browser', async () => {
    const rpc = createTrackedRpcObserver(() => rpcNotFound())
    await withServer(rpc.observe, async (baseUrl) => {
      const { json } = await postVerify(baseUrl, {
        intent: INTENT,
        transactionHash: HASH,
        outcome: 'VERIFIED',
        verified: true,
        confirmations: 99,
        observedAmountLuna: AMOUNT_LUNA,
        observedRecipient: RECIPIENT,
        executionResult: true,
        observation: rpcTx(),
        rpcUrl: 'https://evil.example',
      })

      assert.equal(json.outcome, 'UNRESOLVED')
      assert.equal(json.reason, 'NOT_FOUND')
      assert.equal(rpc.calls[0]?.url, NIMIQ_RPC_URL)
      assert.notEqual(rpc.calls[0]?.url, 'https://evil.example')
    })
  })

  it('observes the chain through the configured Nimiq RPC, not client-supplied evidence', async () => {
    const rpc = createTrackedRpcObserver((hash) => {
      assert.equal(hash, HASH)
      return rpcSuccess(rpcTx())
    })

    await withServer(rpc.observe, async (baseUrl) => {
      const { json } = await postVerify(baseUrl, {
        intent: INTENT,
        transactionHash: HASH,
      })

      assert.equal(json.outcome, 'VERIFIED')
      assert.equal(rpc.calls.length, 1)
      assert.equal(rpc.calls[0]?.url, NIMIQ_RPC_URL)
      assert.equal(rpc.calls[0]?.hash, HASH)
    })
  })
})

describe('PROVIA verification client', () => {
  it('posts only the payment intent and transaction hash', async () => {
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
    assert.deepEqual(Object.keys(body).sort(), ['intent', 'transactionHash'])
    assert.equal('outcome' in body, false)
    assert.equal('confirmations' in body, false)
    assert.equal('observation' in body, false)
    assert.equal('executionResult' in body, false)
    assert.equal('verified' in body, false)
    assert.equal(body.transactionHash, HASH)
  })
})

describe('proof stub', () => {
  it('does not issue proofs in this phase', () => {
    assert.throws(
      () => createProofFromVerifiedResult({
        result: {
          outcome: 'VERIFIED',
          reason: null,
          confirmations: MIN_CONFIRMATIONS,
          confirmationPolicy: MIN_CONFIRMATIONS,
          expectedRecipient: RECIPIENT,
          observedRecipient: RECIPIENT,
          expectedAmountLuna: AMOUNT_LUNA,
          observedAmountLuna: AMOUNT_LUNA,
          observedNetworkId: 5,
          observedKind: 'basic_transfer',
          transactionHash: HASH,
          sender: SENDER,
          observedBlockNumber: 11063444,
        },
      }),
      /not implemented/,
    )
  })
})
