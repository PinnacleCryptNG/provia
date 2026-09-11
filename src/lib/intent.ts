import { isValidNimiqAddress, normalizeNimiqAddress } from './address.ts'
import { formatLunaAsNim, lunaToSafeNumber, parseNimToLuna } from './amount.ts'
import { DEFAULT_NIMIQ_NETWORK, type NimiqNetwork } from './network.ts'

export type PaymentAsset = 'NIM'
export type PaymentStatus = 'created' | 'submitted' | 'rejected' | 'failed'

export type PaymentIntent = {
  id: string
  recipient: string
  amountNim: string
  amountLuna: number
  asset: PaymentAsset
  network: NimiqNetwork
  purpose: string | null
  createdAt: string
  status: PaymentStatus
  transactionHash: string | null
}

export type PaymentDraft = {
  recipient: string
  amount: string
  purpose: string
}

export type FieldErrors = {
  recipient?: string
  amount?: string
}

export type IntentCreateResult =
  | { ok: true, intent: PaymentIntent }
  | { ok: false, errors: FieldErrors }

function createIntentId(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function validatePaymentDraft(draft: PaymentDraft): FieldErrors {
  const errors: FieldErrors = {}
  const recipient = draft.recipient.trim()
  const amount = draft.amount.trim()

  if (!recipient) {
    errors.recipient = 'Enter a recipient address.'
  }
  else if (!isValidNimiqAddress(recipient)) {
    errors.recipient = 'Enter a valid Nimiq address.'
  }

  const parsedAmount = parseNimToLuna(amount)
  if (!parsedAmount.ok) {
    errors.amount = parsedAmount.message
  }

  return errors
}

export function createPaymentIntent(draft: PaymentDraft): IntentCreateResult {
  const errors = validatePaymentDraft(draft)

  if (errors.recipient || errors.amount) {
    return { ok: false, errors }
  }

  const parsedAmount = parseNimToLuna(draft.amount)
  if (!parsedAmount.ok) {
    return { ok: false, errors: { amount: parsedAmount.message } }
  }

  const purpose = draft.purpose.trim()

  return {
    ok: true,
    intent: {
      id: createIntentId(),
      recipient: normalizeNimiqAddress(draft.recipient),
      amountNim: formatLunaAsNim(parsedAmount.luna),
      amountLuna: lunaToSafeNumber(parsedAmount.luna),
      asset: 'NIM',
      network: DEFAULT_NIMIQ_NETWORK,
      purpose: purpose.length > 0 ? purpose : null,
      createdAt: new Date().toISOString(),
      status: 'created',
      transactionHash: null,
    },
  }
}

export function withSubmittedHash(intent: PaymentIntent, transactionHash: string): PaymentIntent {
  return {
    ...intent,
    status: 'submitted',
    transactionHash,
  }
}

export function withRejectedStatus(intent: PaymentIntent): PaymentIntent {
  return {
    ...intent,
    status: 'rejected',
    transactionHash: null,
  }
}

export function withFailedStatus(intent: PaymentIntent): PaymentIntent {
  return {
    ...intent,
    status: 'failed',
    transactionHash: null,
  }
}
