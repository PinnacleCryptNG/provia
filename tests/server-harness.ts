import assert from 'node:assert/strict'
import { GET_TRANSACTION_BY_HASH } from '../src/lib/observe.ts'
import { MIN_CONFIRMATIONS } from '../src/lib/verify.ts'
import { createProviaServer } from '../server/index.ts'
import { NIMIQ_RPC_URL, createNimiqRpcObserver, type ObserveTransaction } from '../server/observation.ts'
import { normalizeNimiqAddress } from '../src/lib/address.ts'
import type { LookupAccount } from '../src/lib/account.ts'
import { rpcUrlForNetwork } from '../src/lib/network.ts'

export const RECIPIENT = 'NQ61 XMNV XULY D874 G08H YDXK LK29 E7YR KFP6'
export const OTHER_RECIPIENT = 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000'
export const SENDER = 'NQ37 7C3V VMN8 FRPN FXS9 PLAG JMRE 8SC6 KUSQ'
export const HASH = '0e70ceec09dc5abd954196c004713d241e08a0cb25370b7e711455cd4853c6fc'
export const AMOUNT_LUNA = 11_000_000_000

export const INTENT_DRAFT = {
  recipient: RECIPIENT,
  amountLuna: AMOUNT_LUNA,
  asset: 'NIM' as const,
  network: 'NIMIQ_TESTNET' as const,
}

export function rpcTx(overrides: Record<string, unknown> = {}) {
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

export function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function rpcSuccess(data: unknown) {
  return {
    jsonrpc: '2.0',
    result: { data, metadata: {} },
    id: 1,
  }
}

export function rpcNotFound() {
  return {
    jsonrpc: '2.0',
    error: { code: -32603, message: 'Transaction not found' },
    id: 1,
  }
}

export function createTrackedRpcObserver(respond: (hash: string) => unknown): {
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

export function allowBasicLookup(): LookupAccount {
  return async (input) => ({
    status: 'found',
    account: {
      address: normalizeNimiqAddress(input.address),
      balanceLuna: 0,
      type: 'basic',
    },
    rpcUrl: rpcUrlForNetwork(input.network),
  })
}

export async function withServer(
  observe: ObserveTransaction,
  fn: (baseUrl: string) => Promise<void>,
  options: { lookupAccount?: LookupAccount } = {},
): Promise<void> {
  const server = createProviaServer({
    observe,
    lookupAccount: options.lookupAccount ?? allowBasicLookup(),
  })
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

export async function postJson(baseUrl: string, path: string, body: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  return {
    status: response.status,
    json: await response.json() as Record<string, unknown>,
  }
}

export async function createIntent(baseUrl: string, draft = INTENT_DRAFT) {
  const created = await postJson(baseUrl, '/api/intents', draft)
  assert.equal(created.status, 201, JSON.stringify(created.json))
  assert.equal(typeof created.json.intentId, 'string')
  return created.json.intentId as string
}

export { NIMIQ_RPC_URL }
