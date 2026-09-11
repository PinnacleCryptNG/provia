import { isIntentId } from './ids.ts'

export const PROVIA_PAYMENT_DATA_PREFIX = 'PROVIA:'

export function proviaIntentPaymentData(intentId: string): string {
  return `${PROVIA_PAYMENT_DATA_PREFIX}${intentId}`
}

function stripHexPrefix(value: string): string {
  return value.startsWith('0x') || value.startsWith('0X') ? value.slice(2) : value
}

function isEvenLengthHex(value: string): boolean {
  return value.length > 0 && value.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(value)
}

/**
 * Normalize RPC extra data for exact comparison.
 * Testnet `getTransactionByHash` stores UTF-8 as hex (no 0x prefix).
 * Returns null for malformed encodings so the verifier cannot treat them as a match.
 */
export function decodeOnChainData(raw: string): string | null {
  if (raw.length === 0) {
    return ''
  }

  const hex = stripHexPrefix(raw)
  if (isEvenLengthHex(hex)) {
    try {
      const bytes = new Uint8Array(hex.length / 2)
      for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16)
      }
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    }
    catch {
      return null
    }
  }

  if (/^[0-9a-fA-F]+$/.test(hex) && hex.length % 2 === 1) {
    return null
  }

  return raw
}

export function recipientDataMatchesIntent(rawRecipientData: string, intentId: string): boolean {
  if (!isIntentId(intentId)) {
    return false
  }

  const decoded = decodeOnChainData(rawRecipientData)
  if (decoded === null || decoded.length === 0) {
    return false
  }

  return decoded === proviaIntentPaymentData(intentId)
}
