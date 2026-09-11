import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import {
  createProviaRequestListener,
  type ProviaServerOptions,
} from '../server/index.ts'
import { createIntentStore } from '../server/intents.ts'
import { createNimiqRpcObserver } from '../server/observation.ts'
import { createProofStore } from '../server/proofs.ts'

type VercelIncoming = IncomingMessage & {
  body?: unknown
  query?: Record<string, string | string[] | undefined>
}

function readRewritePath(req: VercelIncoming, url: URL): string | null {
  const fromQuery = url.searchParams.get('__path') ?? req.query?.__path
  if (Array.isArray(fromQuery)) {
    return fromQuery.filter(Boolean).join('/')
  }
  return typeof fromQuery === 'string' && fromQuery.length > 0 ? fromQuery : null
}

function isProviaApiPath(pathname: string): boolean {
  return pathname === '/api/intents'
    || pathname.startsWith('/api/intents/')
    || pathname === '/api/verify'
    || pathname === '/api/proofs'
    || pathname.startsWith('/api/proofs/')
}

export function proviaApiUrl(req: IncomingMessage): string {
  const vercelReq = req as VercelIncoming
  const url = new URL(req.url ?? '/', 'http://provia.local')

  if (isProviaApiPath(url.pathname)) {
    return `${url.pathname}${url.search}`
  }

  const forwarded = vercelReq.headers?.['x-forwarded-uri'] ?? vercelReq.headers?.['x-invoke-path']
  if (typeof forwarded === 'string') {
    const forwardedUrl = new URL(forwarded, 'http://provia.local')
    if (isProviaApiPath(forwardedUrl.pathname)) {
      return `${forwardedUrl.pathname}${forwardedUrl.search}`
    }
  }

  const rewritten = readRewritePath(vercelReq, url)
  if (rewritten) {
    const suffix = rewritten.replace(/^\/+/, '')
    const pathname = suffix.startsWith('api/') ? `/${suffix}` : `/api/${suffix}`
    const search = new URLSearchParams(url.search)
    search.delete('__path')
    const query = search.toString()
    return query.length > 0 ? `${pathname}?${query}` : pathname
  }

  return `${url.pathname}${url.search}`
}

export function adaptVercelRequest(req: IncomingMessage): IncomingMessage {
  const vercelReq = req as VercelIncoming
  const url = proviaApiUrl(vercelReq)
  const parsedBody = vercelReq.body

  if (parsedBody === undefined) {
    vercelReq.url = url
    return vercelReq
  }

  const encoded = typeof parsedBody === 'string' || Buffer.isBuffer(parsedBody)
    ? parsedBody
    : JSON.stringify(parsedBody)
  const replay = Readable.from(Buffer.from(encoded)) as IncomingMessage
  replay.method = req.method
  replay.url = url
  replay.headers = req.headers
  return replay
}

export function createVercelApiHandler(options: ProviaServerOptions = {}) {
  const observe = options.observe ?? createNimiqRpcObserver()
  const intents = options.intents ?? createIntentStore()
  const proofs = options.proofs ?? createProofStore()
  const listener = createProviaRequestListener({ observe, intents, proofs })

  return (req: IncomingMessage, res: ServerResponse) => listener(adaptVercelRequest(req), res)
}

const handler = createVercelApiHandler()

export default async function vercelApiHandler(req: IncomingMessage, res: ServerResponse) {
  await handler(req, res)
}
