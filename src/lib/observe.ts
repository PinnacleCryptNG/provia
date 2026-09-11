import { normalizeNimiqAddress } from './address.ts'
import { NIMIQ_TESTNET_RPC_URL } from './network.ts'

export { NIMIQ_MAINNET_RPC_URL, NIMIQ_TESTNET_RPC_URL } from './network.ts'

/** JSON-RPC method documented at nimiq.dev/rpc/methods/get-transaction-by-hash */
export const GET_TRANSACTION_BY_HASH = 'getTransactionByHash'

/**
 * Protocol constants returned by `getPolicyConstants` on TestAlbatross.
 * Coinbase matches `Policy::COINBASE_ADDRESS` in core-rs-albatross.
 */
const COINBASE_ADDRESS = 'NQ81 C01N BASE 0000 0000 0000 0000 0000 0000'
const STAKING_CONTRACT_ADDRESS = 'NQ77 0000 0000 0000 0000 0000 0000 0000 0001'

const HASH_PATTERN = /^(?:0x)?[0-9a-fA-F]{64}$/

export type NimTransactionKind = 'basic_transfer' | 'reward' | 'contract' | 'other'

export type NimIncludedObservation = {
  status: 'included'
  hash: string
  from: string
  to: string
  valueLuna: number
  feeLuna: number
  blockNumber: number | null
  confirmations: number | null
  timestampMs: number | null
  executionResult: boolean | null
  fromType: number
  toType: number
  flags: number
  senderData: string
  recipientData: string
  networkId: number
  kind: NimTransactionKind
}

export type NimObservationResult =
  | NimIncludedObservation
  | { status: 'not_found', hash: string }
  | { status: 'invalid_hash', message: string }
  | { status: 'rpc_error', message: string }

export type ObserveOptions = {
  rpcUrl?: string
  fetch?: typeof globalThis.fetch
}

export function normalizeTransactionHash(input: string): string | null {
  const trimmed = input.trim()
  if (!HASH_PATTERN.test(trimmed)) {
    return null
  }

  return trimmed.replace(/^0x/i, '').toLowerCase()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function readInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null
}

function readOptionalInteger(value: unknown): number | null {
  if (value === undefined || value === null) {
    return null
  }

  return readInteger(value)
}

function readOptionalBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

export function classifyObservedTransaction(tx: {
  from: string
  to: string
  fromType: number
  toType: number
  flags: number
  senderData: string
  recipientData: string
}): NimTransactionKind {
  const from = normalizeNimiqAddress(tx.from)
  const to = normalizeNimiqAddress(tx.to)

  if (from === COINBASE_ADDRESS) {
    return 'reward'
  }

  const hasContractSignal = tx.flags !== 0
    || tx.fromType !== 0
    || tx.toType !== 0
    || tx.senderData.length > 0
    || tx.recipientData.length > 0
    || to === STAKING_CONTRACT_ADDRESS

  if (hasContractSignal) {
    return 'contract'
  }

  return 'basic_transfer'
}

export function parseNimTransactionData(raw: unknown, requestedHash: string): NimObservationResult {
  if (!isRecord(raw)) {
    return { status: 'rpc_error', message: 'RPC transaction payload is not an object.' }
  }

  const hash = readString(raw.hash)
  const from = readString(raw.from)
  const to = readString(raw.to)
  const valueLuna = readInteger(raw.value)
  const feeLuna = readInteger(raw.fee)
  const fromType = readInteger(raw.fromType)
  const toType = readInteger(raw.toType)
  const flags = readInteger(raw.flags)
  const senderData = readString(raw.senderData)
  const recipientData = readString(raw.recipientData)
  const networkId = readInteger(raw.networkId)

  if (
    !hash
    || !from
    || !to
    || valueLuna === null
    || feeLuna === null
    || fromType === null
    || toType === null
    || flags === null
    || senderData === null
    || recipientData === null
    || networkId === null
  ) {
    return { status: 'rpc_error', message: 'RPC transaction payload is missing required fields.' }
  }

  const normalizedReturned = normalizeTransactionHash(hash)
  if (!normalizedReturned || normalizedReturned !== requestedHash) {
    return { status: 'rpc_error', message: 'RPC transaction hash did not match the requested hash.' }
  }

  return {
    status: 'included',
    hash: normalizedReturned,
    from,
    to,
    valueLuna,
    feeLuna,
    blockNumber: readOptionalInteger(raw.blockNumber),
    confirmations: readOptionalInteger(raw.confirmations),
    timestampMs: readOptionalInteger(raw.timestamp),
    executionResult: readOptionalBoolean(raw.executionResult),
    fromType,
    toType,
    flags,
    senderData,
    recipientData,
    networkId,
    kind: classifyObservedTransaction({
      from,
      to,
      fromType,
      toType,
      flags,
      senderData,
      recipientData,
    }),
  }
}

function isNotFoundError(payload: unknown): boolean {
  if (!isRecord(payload)) {
    return false
  }

  const message = readString(payload.message) ?? ''
  const data = readString(payload.data) ?? ''
  return /transaction not found/i.test(`${message} ${data}`)
}

export async function getNimTransactionByHash(
  txHash: string,
  options: ObserveOptions = {},
): Promise<NimObservationResult> {
  const hash = normalizeTransactionHash(txHash)
  if (!hash) {
    return {
      status: 'invalid_hash',
      message: 'Enter a 32-byte hex transaction hash.',
    }
  }

  const rpcUrl = options.rpcUrl ?? NIMIQ_TESTNET_RPC_URL
  const fetchFn = options.fetch ?? globalThis.fetch

  let response: Response
  try {
    response = await fetchFn(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: GET_TRANSACTION_BY_HASH,
        params: [hash],
        id: 1,
      }),
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { status: 'rpc_error', message }
  }

  if (!response.ok) {
    return { status: 'rpc_error', message: `RPC HTTP ${response.status}` }
  }

  let payload: unknown
  try {
    payload = await response.json()
  }
  catch {
    return { status: 'rpc_error', message: 'RPC returned non-JSON.' }
  }

  if (!isRecord(payload)) {
    return { status: 'rpc_error', message: 'RPC response is not an object.' }
  }

  if (payload.error) {
    if (isNotFoundError(payload.error)) {
      return { status: 'not_found', hash }
    }

    const error = payload.error
    const detail = isRecord(error)
      ? readString(error.data) ?? readString(error.message) ?? 'RPC error'
      : 'RPC error'
    return { status: 'rpc_error', message: detail }
  }

  if (!isRecord(payload.result) || !('data' in payload.result)) {
    return { status: 'rpc_error', message: 'RPC result is missing the PoS data envelope.' }
  }

  if (payload.result.data === null || payload.result.data === undefined) {
    return { status: 'not_found', hash }
  }

  return parseNimTransactionData(payload.result.data, hash)
}
