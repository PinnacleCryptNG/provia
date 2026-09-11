import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import {
  createProviaRequestListener,
  type ProviaServerOptions,
} from '../server/index.ts'
import { createIntentStore } from '../server/intents.ts'
import { createNimiqRpcObserver } from '../server/observation.ts'
import { createProofStore } from '../server/proofs.ts'
import { createHashReservationStore } from '../server/verification.ts'
import { createNimiqAccountLookup } from '../src/lib/account.ts'

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

export async function incomingFromWebRequest(request: Request): Promise<IncomingMessage> {
  const url = new URL(request.url)
  const body = request.method === 'GET' || request.method === 'HEAD'
    ? Buffer.alloc(0)
    : Buffer.from(await request.arrayBuffer())
  const req = Readable.from(body) as IncomingMessage
  req.method = request.method
  req.url = `${url.pathname}${url.search}`
  req.headers = Object.fromEntries(request.headers.entries())
  return req
}

function collectListenerResponse(
  listener: (req: IncomingMessage, res: ServerResponse) => unknown,
  req: IncomingMessage,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    let statusCode = 200
    const headers = new Headers()
    const chunks: Buffer[] = []
    let finished = false

    const finish = () => {
      if (finished) {
        return
      }
      finished = true
      resolve(new Response(chunks.length > 0 ? Buffer.concat(chunks) : null, {
        status: statusCode,
        headers,
      }))
    }

    const res = {
      writeHead(status: number, hdrs?: NodeJS.Dict<number | string | string[]>) {
        statusCode = status
        if (hdrs) {
          for (const [key, value] of Object.entries(hdrs)) {
            if (value === undefined) {
              continue
            }
            headers.set(key, Array.isArray(value) ? value.join(', ') : String(value))
          }
        }
        return res
      },
      end(chunk?: unknown) {
        if (chunk !== undefined && chunk !== null) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)))
        }
        finish()
        return res
      },
    } as ServerResponse

    Promise.resolve(listener(req, res)).catch(reject)
  })
}

export function createVercelApiHandler(options: ProviaServerOptions = {}) {
  const observe = options.observe ?? createNimiqRpcObserver()
  const lookupAccount = options.lookupAccount ?? createNimiqAccountLookup()
  const intents = options.intents ?? createIntentStore()
  const proofs = options.proofs ?? createProofStore()
  const reservations = options.reservations ?? createHashReservationStore()
  const listener = createProviaRequestListener({
    observe,
    lookupAccount,
    intents,
    proofs,
    reservations,
  })

  return (req: IncomingMessage, res: ServerResponse) => listener(adaptVercelRequest(req), res)
}

export function createVercelFetchHandler(options: ProviaServerOptions = {}) {
  const nodeHandler = createVercelApiHandler(options)
  return async (request: Request) => {
    return collectListenerResponse(nodeHandler, await incomingFromWebRequest(request))
  }
}

const nodeHandler = createVercelApiHandler()

async function fetchHandler(request: Request) {
  return collectListenerResponse(nodeHandler, await incomingFromWebRequest(request))
}

function isNodeResponse(res: ServerResponse | undefined): res is ServerResponse {
  return typeof res?.writeHead === 'function'
}

export default async function vercelApiHandler(
  req: IncomingMessage | Request,
  res?: ServerResponse,
): Promise<Response | void> {
  if (isNodeResponse(res) && !(req instanceof Request)) {
    await nodeHandler(req, res)
    return
  }

  return fetchHandler(req as Request)
}

export const GET = vercelApiHandler
export const POST = vercelApiHandler
export const OPTIONS = vercelApiHandler
