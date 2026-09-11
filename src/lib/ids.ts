/** Unpredictable opaque IDs. No amounts, addresses, or timestamps. */

export function createOpaqueId(prefix: 'pi' | 'prf'): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${prefix}_${hex}`
}

export function isIntentId(value: string): boolean {
  return /^pi_[0-9a-f]{32}$/.test(value)
}

export function isProofId(value: string): boolean {
  return /^prf_[0-9a-f]{32}$/.test(value)
}
