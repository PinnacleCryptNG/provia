import { isValidNimiqAddress, normalizeNimiqAddress } from './address.ts'
import { DEFAULT_NIMIQ_NETWORK, type NimiqNetwork } from './network.ts'
import type { RecipientPreflightResult } from './recipient-preflight.ts'

/** Nimiq user-friendly addresses are 36 characters without spaces. */
export const NIMIQ_COMPACT_ADDRESS_LENGTH = 36

export type RecipientCheckStatus =
  | 'idle'
  | 'invalid'
  | 'checking'
  | 'verified'
  | 'unsupported'
  | 'error'

export type RecipientCheckView = {
  status: RecipientCheckStatus
  title: string
  message: string
  canContinue: boolean
  canRetry: boolean
  checks: Array<{ label: string, ok: boolean }>
}

export type RecipientCheckApiResult = {
  status: 'verified' | 'invalid' | 'unsupported' | 'error'
  recipient?: string
  network?: NimiqNetwork
}

export function compactNimiqAddress(value: string): string {
  return value.replace(/\s+/g, '').trim().toUpperCase()
}

export function inspectLocalRecipient(value: string): 'idle' | 'invalid' | 'ready' {
  const trimmed = value.trim()
  if (!trimmed) {
    return 'idle'
  }

  if (isValidNimiqAddress(trimmed)) {
    return 'ready'
  }

  const compact = compactNimiqAddress(trimmed)
  if (compact.length < NIMIQ_COMPACT_ADDRESS_LENGTH) {
    return 'idle'
  }

  return 'invalid'
}

export function recipientCheckView(status: RecipientCheckStatus): RecipientCheckView {
  switch (status) {
    case 'idle':
      return {
        status,
        title: '',
        message: '',
        canContinue: false,
        canRetry: false,
        checks: [],
      }
    case 'invalid':
      return {
        status,
        title: 'Recipient address isn’t valid',
        message: 'Please check the address and try again.',
        canContinue: false,
        canRetry: false,
        checks: [],
      }
    case 'checking':
      return {
        status,
        title: 'Recipient verification',
        message: 'Checking this recipient…',
        canContinue: false,
        canRetry: false,
        checks: [],
      }
    case 'verified':
      return {
        status,
        title: 'Recipient verified',
        message: 'This address is valid on Nimiq Testnet and is supported for this payment.',
        canContinue: true,
        canRetry: false,
        checks: [
          { label: 'Address is valid', ok: true },
          { label: 'Network: Nimiq Testnet', ok: true },
          { label: 'Recipient type: Supported', ok: true },
        ],
      }
    case 'unsupported':
      return {
        status,
        title: 'Unsupported recipient',
        message: 'This address isn’t a supported destination for PROVIA payments.',
        canContinue: false,
        canRetry: false,
        checks: [],
      }
    case 'error':
      return {
        status,
        title: 'Couldn’t verify this recipient',
        message: 'Check the address and try again.',
        canContinue: false,
        canRetry: true,
        checks: [],
      }
  }
}

export function recipientCheckFromPreflight(result: RecipientPreflightResult): RecipientCheckApiResult {
  if (result.ok) {
    return {
      status: 'verified',
      recipient: result.recipient,
      network: result.network,
    }
  }

  if (result.reason === 'invalid_recipient') {
    return { status: 'invalid' }
  }

  if (result.reason === 'contract_recipient' || result.reason === 'protocol_recipient') {
    return { status: 'unsupported' }
  }

  return { status: 'error' }
}

export function sameCheckedRecipient(entered: string, verified: string | null): boolean {
  if (!verified || !isValidNimiqAddress(entered)) {
    return false
  }

  return normalizeNimiqAddress(entered) === verified
}

export const RECIPIENT_PREFLIGHT_NETWORK: NimiqNetwork = DEFAULT_NIMIQ_NETWORK
