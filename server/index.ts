import http from 'node:http'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isIntentId, isProofId } from '../src/lib/ids.ts'
import {
  createIntentStore,
  expectedPaymentFromStoredIntent,
  parseCreateIntentRequest,
  publicIntent,
  type IntentStore,
} from './intents.ts'
import { createNimiqAccountLookup, type LookupAccount } from '../src/lib/account.ts'
import { runRecipientPreflight } from '../src/lib/recipient-preflight.ts'
import { createNimiqRpcObserver, type ObserveTransaction } from './observation.ts'
import {
  createProofStore,
  issueProof,
  type ProofStore,
} from './proofs.ts'
import {
  createHashReservationStore,
  parseProofRequest,
  parseVerifyRequest,
  toVerifyApiResponse,
  verifyIntentAgainstChain,
  type HashReservationStore,
} from './verification.ts'

export const DEFAULT_SERVER_PORT = 43124
export const DEFAULT_SERVER_HOST = '127.0.0.1'

const MAX_BODY_BYTES = 32 * 1024

export type ProviaServerOptions = {
  observe?: ObserveTransaction
  lookupAccount?: LookupAccount
  intents?: IntentStore
  proofs?: ProofStore
  reservations?: HashReservationStore
  host?: string
  port?: number
}

function json(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  res.end(payload)
}

function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = []
    let size = 0

    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Request body is too large.'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })

    req.on('end', () => {
      if (chunks.length === 0) {
        resolveBody(null)
        return
      }

      try {
        resolveBody(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      }
      catch {
        reject(new Error('Request body is not valid JSON.'))
      }
    })

    req.on('error', reject)
  })
}

function matchNamedId(pathname: string, prefix: string): string | null {
  if (!pathname.startsWith(prefix)) {
    return null
  }

  const id = pathname.slice(prefix.length)
  if (!id || id.includes('/')) {
    return null
  }

  return id
}

export function createProviaRequestListener(options: {
  observe: ObserveTransaction
  lookupAccount: LookupAccount
  intents: IntentStore
  proofs: ProofStore
  reservations: HashReservationStore
}): http.RequestListener {
  const { observe, lookupAccount, intents, proofs, reservations } = options

  return async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://provia.local')
    const { pathname } = url

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      })
      res.end()
      return
    }

    if (req.method === 'GET' && pathname === '/health') {
      json(res, 200, { ok: true, service: 'provia-verify' })
      return
    }

    if (req.method === 'POST' && pathname === '/api/intents') {
      let body: unknown
      try {
        body = await readBody(req)
      }
      catch (error) {
        json(res, 400, { error: error instanceof Error ? error.message : 'Invalid request body.' })
        return
      }

      const parsed = parseCreateIntentRequest(body)
      if (!parsed.ok) {
        json(res, 400, { error: parsed.error })
        return
      }

      const preflight = await runRecipientPreflight(parsed.intent, lookupAccount)
      if (!preflight.ok) {
        json(res, 400, { error: preflight.error })
        return
      }

      const stored = intents.create({
        ...parsed.intent,
        recipient: preflight.recipient,
        network: preflight.network,
      })
      json(res, 201, {
        intentId: stored.intentId,
        intent: publicIntent(stored),
      })
      return
    }

    const intentId = matchNamedId(pathname, '/api/intents/')
    if (req.method === 'GET' && intentId) {
      if (!isIntentId(intentId)) {
        json(res, 404, { error: 'Unknown payment intent.' })
        return
      }

      const stored = intents.get(intentId)
      if (!stored) {
        json(res, 404, { error: 'Unknown payment intent.' })
        return
      }

      json(res, 200, {
        intentId: stored.intentId,
        intent: publicIntent(stored),
        createdAt: stored.createdAt,
      })
      return
    }

    if (pathname === '/api/verify') {
      if (req.method !== 'POST') {
        json(res, 405, { error: 'Use POST /api/verify.' })
        return
      }

      let body: unknown
      try {
        body = await readBody(req)
      }
      catch (error) {
        json(res, 400, { error: error instanceof Error ? error.message : 'Invalid request body.' })
        return
      }

      const parsed = parseVerifyRequest(body)
      if (!parsed.ok) {
        json(res, 400, { error: parsed.error })
        return
      }

      const stored = intents.get(parsed.intentId)
      if (!stored) {
        json(res, 404, { error: 'Unknown payment intent.' })
        return
      }

      try {
        const result = await verifyIntentAgainstChain(
          expectedPaymentFromStoredIntent(stored),
          parsed.transactionHash,
          observe,
          reservations,
        )
        json(res, 200, toVerifyApiResponse(stored.intentId, stored.network, result))
      }
      catch (error) {
        json(res, 500, { error: error instanceof Error ? error.message : 'Verification failed.' })
      }
      return
    }

    if (pathname === '/api/proofs' && req.method === 'POST') {
      let body: unknown
      try {
        body = await readBody(req)
      }
      catch (error) {
        json(res, 400, { error: error instanceof Error ? error.message : 'Invalid request body.' })
        return
      }

      const parsed = parseProofRequest(body)
      if (!parsed.ok) {
        json(res, 400, { error: parsed.error })
        return
      }

      try {
        const issued = await issueProof({
          intentId: parsed.intentId,
          transactionHash: parsed.transactionHash,
          intents,
          proofs,
          observe,
          reservations,
        })

        if (!issued.ok) {
          json(res, issued.status, {
            error: issued.error,
            outcome: issued.result?.outcome ?? null,
            reason: issued.result?.reason ?? null,
          })
          return
        }

        json(res, 201, issued.proof)
      }
      catch (error) {
        json(res, 500, { error: error instanceof Error ? error.message : 'Proof creation failed.' })
      }
      return
    }

    const proofId = matchNamedId(pathname, '/api/proofs/')
    if (req.method === 'GET' && proofId) {
      if (!isProofId(proofId)) {
        json(res, 404, { error: 'Proof not found.' })
        return
      }

      const proof = proofs.get(proofId)
      if (!proof) {
        json(res, 404, { error: 'Proof not found.' })
        return
      }

      json(res, 200, proof)
      return
    }

    json(res, 404, { error: 'Not found.' })
  }
}

export function createProviaServer(options: ProviaServerOptions = {}): http.Server {
  const observe = options.observe ?? createNimiqRpcObserver()
  const lookupAccount = options.lookupAccount ?? createNimiqAccountLookup()
  const intents = options.intents ?? createIntentStore()
  const proofs = options.proofs ?? createProofStore()
  const reservations = options.reservations ?? createHashReservationStore()
  return http.createServer(createProviaRequestListener({
    observe,
    lookupAccount,
    intents,
    proofs,
    reservations,
  }))
}

export function startProviaServer(options: ProviaServerOptions = {}): http.Server {
  const host = options.host ?? process.env.PROVIA_SERVER_HOST ?? DEFAULT_SERVER_HOST
  const port = options.port ?? Number(process.env.PROVIA_SERVER_PORT ?? DEFAULT_SERVER_PORT)
  const server = createProviaServer(options)

  server.listen(port, host, () => {
    console.log(`PROVIA verification server listening on http://${host}:${port}`)
  })

  return server
}

if (
  !process.env.VERCEL
  && process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  startProviaServer()
}
