import assert from 'node:assert/strict'
import http from 'node:http'
import { PassThrough } from 'node:stream'
import { describe, it } from 'node:test'
import type { IncomingMessage } from 'node:http'
import {
  adaptVercelRequest,
  createVercelApiHandler,
  createVercelFetchHandler,
  proviaApiUrl,
} from '../api/index.ts'
import { isIntentId } from '../src/lib/ids.ts'
import {
  HASH,
  INTENT_DRAFT,
  allowBasicLookup,
  createTrackedRpcObserver,
  postJson,
  rpcNotFound,
  rpcSuccess,
  rpcTx,
} from './server-harness.ts'

type ParsedRequest = IncomingMessage & {
  body?: unknown
  query?: Record<string, string | string[] | undefined>
}

async function withAdapter(
  observe: ReturnType<typeof createTrackedRpcObserver>['observe'],
  fn: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server = http.createServer(createVercelApiHandler({
    observe,
    lookupAccount: allowBasicLookup(),
  }))
  await new Promise<void>((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => resolve())
    server.on('error', reject)
  })

  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Adapter did not bind a port.')
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

async function readStream(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString('utf8')
}

describe('Vercel API adapter', () => {
  it('exposes POST /api/intents through createProviaRequestListener', async () => {
    const rpc = createTrackedRpcObserver(() => rpcNotFound())
    await withAdapter(rpc.observe, async (baseUrl) => {
      const { status, json } = await postJson(baseUrl, '/api/intents', INTENT_DRAFT)
      assert.equal(status, 201)
      assert.equal(isIntentId(json.intentId as string), true)
    })
  })

  it('routes Vercel /api/:path* rewrites to the existing listener paths', async () => {
    const rpc = createTrackedRpcObserver(() => rpcNotFound())
    await withAdapter(rpc.observe, async (baseUrl) => {
      const created = await postJson(baseUrl, '/api?__path=intents', INTENT_DRAFT)
      assert.equal(created.status, 201)
      const intentId = created.json.intentId as string

      const stored = await fetch(`${baseUrl}/api?__path=intents/${encodeURIComponent(intentId)}`)
      assert.equal(stored.status, 200)
      const payload = await stored.json() as { intentId: string }
      assert.equal(payload.intentId, intentId)

      const verified = await postJson(baseUrl, '/api?__path=verify', {
        intentId,
        transactionHash: HASH,
      })
      assert.equal(verified.status, 200)
      assert.equal(jsonOutcome(verified.json), 'UNRESOLVED')
    })
  })

  it('issues a proof through the rewritten /api/proofs path', async () => {
    const rpc = createTrackedRpcObserver(() => rpcSuccess(rpcTx()))
    await withAdapter(rpc.observe, async (baseUrl) => {
      const created = await postJson(baseUrl, '/api/intents', INTENT_DRAFT)
      const intentId = created.json.intentId as string
      const { status, json } = await postJson(baseUrl, '/api?__path=proofs', {
        intentId,
        transactionHash: HASH,
      })
      assert.equal(status, 201)
      assert.equal(typeof json.proofId, 'string')
      assert.equal(json.status, 'VERIFIED')
    })
  })

  it('maps rewrite query and forwarded URI to /api/intents', () => {
    const rewritten = { url: '/api?__path=intents' } as IncomingMessage
    assert.equal(proviaApiUrl(rewritten).startsWith('/api/intents'), true)

    const nested = { url: '/api?__path=intents/pi_abc' } as IncomingMessage
    assert.equal(proviaApiUrl(nested), '/api/intents/pi_abc')

    const forwarded = {
      url: '/api',
      headers: { 'x-forwarded-uri': '/api/verify' },
    } as IncomingMessage
    assert.equal(proviaApiUrl(forwarded), '/api/verify')
  })

  it('replays a Vercel-parsed JSON body for the existing listener', async () => {
    const req = new PassThrough() as ParsedRequest
    req.method = 'POST'
    req.url = '/api?__path=intents'
    req.headers = { 'content-type': 'application/json' }
    req.body = INTENT_DRAFT
    req.end()

    const adapted = adaptVercelRequest(req)
    assert.equal(adapted.url, '/api/intents')
    assert.equal(await readStream(adapted), JSON.stringify(INTENT_DRAFT))
  })

  it('handles a Web Fetch Request the way Vercel /api functions do', async () => {
    const rpc = createTrackedRpcObserver(() => rpcNotFound())
    const handle = createVercelFetchHandler({ observe: rpc.observe })
    const response = await handle(new Request('http://provia.local/api/intents', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(INTENT_DRAFT),
    }))
    assert.equal(response.status, 201)
    const json = await response.json() as { intentId: string }
    assert.equal(isIntentId(json.intentId), true)
  })
})

function jsonOutcome(json: Record<string, unknown>): string | undefined {
  return json.outcome as string | undefined
}
