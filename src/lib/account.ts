import { normalizeNimiqAddress } from './address.ts'
import { fetchWithTimeout } from './http.ts'
import { rpcUrlForNetwork, type NimiqNetwork } from './network.ts'

export const GET_ACCOUNT_BY_ADDRESS = 'getAccountByAddress'

export type NimAccountType = 'basic' | 'vesting' | 'htlc' | 'staking'

export type NimAccountRecord = {
  address: string
  balanceLuna: number
  type: NimAccountType
}

export type AccountLookupResult =
  | { status: 'found', account: NimAccountRecord, rpcUrl: string }
  | { status: 'unresolved', message: string }
  | { status: 'rpc_error', message: string }

export type LookupAccount = (input: {
  address: string
  network: NimiqNetwork
}) => Promise<AccountLookupResult>

export type AccountLookupOptions = {
  rpcUrl?: string
  fetch?: typeof globalThis.fetch
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

export function parseNimAccountType(value: unknown): NimAccountType | null {
  if (value === 'basic' || value === 0) {
    return 'basic'
  }
  if (value === 'vesting' || value === 1) {
    return 'vesting'
  }
  if (value === 'htlc' || value === 2) {
    return 'htlc'
  }
  if (value === 'staking' || value === 3) {
    return 'staking'
  }
  return null
}

export function isContractAccountType(type: NimAccountType): boolean {
  return type === 'vesting' || type === 'htlc' || type === 'staking'
}

export function parseNimAccountData(raw: unknown): AccountLookupResult {
  if (!isRecord(raw)) {
    return { status: 'rpc_error', message: 'RPC account payload is not an object.' }
  }

  const address = readString(raw.address)
  const balanceLuna = readInteger(raw.balance)
  const type = parseNimAccountType(raw.type)

  if (!address || balanceLuna === null || !type) {
    return { status: 'unresolved', message: 'RPC account payload is missing required fields.' }
  }

  return {
    status: 'found',
    account: {
      address: normalizeNimiqAddress(address),
      balanceLuna,
      type,
    },
    rpcUrl: '',
  }
}

export async function getNimAccountByAddress(
  address: string,
  network: NimiqNetwork,
  options: AccountLookupOptions = {},
): Promise<AccountLookupResult> {
  const rpcUrl = options.rpcUrl ?? rpcUrlForNetwork(network)
  const fetchFn = options.fetch ?? fetchWithTimeout

  let response: Response
  try {
    response = await fetchFn(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: GET_ACCOUNT_BY_ADDRESS,
        params: [address],
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
    const error = payload.error
    const detail = isRecord(error)
      ? readString(error.data) ?? readString(error.message) ?? 'RPC error'
      : 'RPC error'
    return { status: 'unresolved', message: detail }
  }

  if (!isRecord(payload.result) || !('data' in payload.result)) {
    return { status: 'rpc_error', message: 'RPC result is missing the PoS data envelope.' }
  }

  if (payload.result.data === null || payload.result.data === undefined) {
    return { status: 'unresolved', message: 'Account was not returned for this address.' }
  }

  const parsed = parseNimAccountData(payload.result.data)
  if (parsed.status !== 'found') {
    return parsed
  }

  return { ...parsed, rpcUrl }
}

export function createNimiqAccountLookup(options: AccountLookupOptions = {}): LookupAccount {
  return (input) => getNimAccountByAddress(input.address, input.network, {
    rpcUrl: options.rpcUrl ?? rpcUrlForNetwork(input.network),
    fetch: options.fetch,
  })
}
