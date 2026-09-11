import { isValidNimiqAddress, normalizeNimiqAddress } from '../src/lib/address.ts'
import { createOpaqueId } from '../src/lib/ids.ts'
import { isNimiqNetwork, type NimiqNetwork } from '../src/lib/network.ts'
import type { ExpectedNimPayment } from '../src/lib/verify.ts'

export type StoredPaymentIntent = {
  intentId: string
  recipient: string
  amountLuna: number
  asset: 'NIM'
  network: NimiqNetwork
  createdAt: string
  status: 'created'
}

export type PublicIntent = {
  recipient: string
  amountLuna: number
  asset: 'NIM'
  network: NimiqNetwork
}

export type IntentStore = {
  create(input: PublicIntent): StoredPaymentIntent
  get(intentId: string): StoredPaymentIntent | null
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

export function createIntentStore(): IntentStore {
  const byId = new Map<string, StoredPaymentIntent>()

  return {
    create(input) {
      const stored: StoredPaymentIntent = {
        intentId: createOpaqueId('pi'),
        recipient: input.recipient,
        amountLuna: input.amountLuna,
        asset: input.asset,
        network: input.network,
        createdAt: new Date().toISOString(),
        status: 'created',
      }
      byId.set(stored.intentId, stored)
      return stored
    },
    get(intentId) {
      return byId.get(intentId) ?? null
    },
  }
}

export function publicIntent(stored: StoredPaymentIntent): PublicIntent {
  return {
    recipient: stored.recipient,
    amountLuna: stored.amountLuna,
    asset: stored.asset,
    network: stored.network,
  }
}

export function expectedPaymentFromStoredIntent(stored: StoredPaymentIntent): ExpectedNimPayment {
  return {
    intentId: stored.intentId,
    recipient: stored.recipient,
    amountLuna: stored.amountLuna,
    asset: stored.asset,
    network: stored.network,
  }
}

export type ParsedCreateIntent =
  | { ok: true, intent: PublicIntent }
  | { ok: false, error: string }

export function parseCreateIntentRequest(body: unknown): ParsedCreateIntent {
  if (!isRecord(body)) {
    return { ok: false, error: 'Request body must be a JSON object.' }
  }

  const recipient = readString(body.recipient)
  const amountLuna = readInteger(body.amountLuna)
  const asset = readString(body.asset)
  const network = readString(body.network)

  if (!recipient || !isValidNimiqAddress(recipient)) {
    return { ok: false, error: 'Enter a valid Nimiq recipient address.' }
  }

  if (amountLuna === null || amountLuna <= 0) {
    return { ok: false, error: 'amountLuna must be a positive integer.' }
  }

  if (asset !== 'NIM') {
    return { ok: false, error: 'Only NIM payments are supported.' }
  }

  if (!network || !isNimiqNetwork(network)) {
    return { ok: false, error: 'network must be NIMIQ_TESTNET or NIMIQ_MAINNET.' }
  }

  return {
    ok: true,
    intent: {
      recipient: normalizeNimiqAddress(recipient),
      amountLuna,
      asset: 'NIM',
      network,
    },
  }
}

