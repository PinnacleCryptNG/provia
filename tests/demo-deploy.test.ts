import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { createProviaServer } from '../server/index.ts'
import { NIMIQ_RPC_URL } from '../server/observation.ts'
import {
  INTENT_DRAFT,
  allowBasicLookup,
  createTrackedRpcObserver,
  postJson,
  rpcNotFound,
} from './server-harness.ts'

function read(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

async function withStaticServer(
  staticDir: string,
  fn: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const rpc = createTrackedRpcObserver(() => rpcNotFound())
  const server = createProviaServer({
    observe: rpc.observe,
    lookupAccount: allowBasicLookup(),
    staticDir,
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

describe('judged-demo long-lived process', () => {
  it('serves the Mini App and API from one Node listener', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'provia-dist-'))
    writeFileSync(join(dir, 'index.html'), '<!doctype html><title>PROVIA</title>')
    await withStaticServer(dir, async (baseUrl) => {
      const page = await fetch(`${baseUrl}/`)
      assert.equal(page.status, 200)
      assert.match(await page.text(), /PROVIA/)

      const preflight = await postJson(baseUrl, '/api/preflight', {
        recipient: INTENT_DRAFT.recipient,
        network: 'NIMIQ_TESTNET',
      })
      assert.equal(preflight.status, 200)
      assert.equal(preflight.json.status, 'verified')

      const created = await postJson(baseUrl, '/api/intents', INTENT_DRAFT)
      assert.equal(created.status, 201)
      const intentId = created.json.intentId as string

      const verify = await postJson(baseUrl, '/api/verify', {
        intentId,
        transactionHash: '0e70ceec09dc5abd954196c004713d241e08a0cb25370b7e711455cd4853c6fc',
      })
      assert.equal(verify.status, 200)
      assert.notEqual(verify.json.outcome, undefined)

      const proofs = await postJson(baseUrl, '/api/proofs', {
        intentId,
        transactionHash: '0e70ceec09dc5abd954196c004713d241e08a0cb25370b7e711455cd4853c6fc',
      })
      assert.ok(proofs.status === 201 || proofs.status === 409 || proofs.status === 400)
    })
  })

  it('defaults the observation RPC to Nimiq Testnet', () => {
    assert.equal(NIMIQ_RPC_URL, process.env.NIMIQ_RPC_URL ?? 'https://rpc.testnet.nimiqwatch.com')
    assert.match(read('server/observation.ts'), /rpc\.testnet\.nimiqwatch\.com/)
  })

  it('keeps judged demo on a long-lived Node start script, not Vercel isolates', () => {
    const pkg = read('package.json')
    const readme = read('README.md')
    const vercel = read('vercel.json')
    const server = read('server/index.ts')
    assert.match(pkg, /"start": "node --experimental-strip-types server\/index.ts"/)
    assert.match(server, /staticDir/)
    assert.match(readme, /cloudflared|HTTPS tunnel|trycloudflare/)
    assert.match(vercel, /api\/index\.ts/)
    assert.match(readme, /Do not use a Vercel URL as the judged demo/)
  })

  it('allows tunnel Host headers on the Vite Mini App origin', () => {
    const vite = read('vite.config.ts')
    assert.match(vite, /allowedHosts: true/)
    assert.match(vite, /cors: true/)
    assert.match(vite, /preview:/)
  })
})
