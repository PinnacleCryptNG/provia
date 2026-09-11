import http from 'node:http'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createNimiqRpcObserver, type ObserveTransaction } from './observation.ts'
import {
  parseVerifyRequest,
  toVerifyApiResponse,
  verifyIntentAgainstChain,
  type VerifyApiResponse,
} from './verification.ts'

export const DEFAULT_SERVER_PORT = 43124
export const DEFAULT_SERVER_HOST = '127.0.0.1'

const MAX_BODY_BYTES = 32 * 1024

export type ProviaServerOptions = {
  observe?: ObserveTransaction
  host?: string
  port?: number
}

function json(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  res.end(payload)
}

function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
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
        resolve(null)
        return
      }

      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      }
      catch {
        reject(new Error('Request body is not valid JSON.'))
      }
    })

    req.on('error', reject)
  })
}

export function createProviaRequestListener(observe: ObserveTransaction): http.RequestListener {
  return async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://provia.local')

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      })
      res.end()
      return
    }

    if (req.method === 'GET' && url.pathname === '/health') {
      json(res, 200, { ok: true, service: 'provia-verify' })
      return
    }

    if (url.pathname !== '/api/verify') {
      json(res, 404, { error: 'Not found.' })
      return
    }

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

    try {
      const result = await verifyIntentAgainstChain(
        parsed.intent,
        parsed.transactionHash,
        observe,
      )
      const response: VerifyApiResponse = toVerifyApiResponse(parsed.intent, result)
      json(res, 200, response)
    }
    catch (error) {
      json(res, 500, { error: error instanceof Error ? error.message : 'Verification failed.' })
    }
  }
}

export function createProviaServer(options: ProviaServerOptions = {}): http.Server {
  const observe = options.observe ?? createNimiqRpcObserver()
  return http.createServer(createProviaRequestListener(observe))
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

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startProviaServer()
}
