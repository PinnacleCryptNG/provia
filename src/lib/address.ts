import { ValidationUtils } from '@nimiq/utils'

export function isValidNimiqAddress(address: string): boolean {
  return ValidationUtils.isValidAddress(address.trim())
}

export function normalizeNimiqAddress(address: string): string {
  return ValidationUtils.normalizeAddress(address.trim())
}

export function shortenNimiqAddress(address: string): string {
  const normalized = normalizeNimiqAddress(address)
  const parts = normalized.split(' ')

  if (parts.length < 3) {
    return normalized
  }

  return `${parts[0]} ${parts[1]} … ${parts[parts.length - 1]}`
}

export function shortenTransactionHash(hash: string): string {
  const compact = hash.trim()

  if (compact.length <= 18) {
    return compact
  }

  return `${compact.slice(0, 8)}…${compact.slice(-6)}`
}
