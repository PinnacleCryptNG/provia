/** 1 NIM = 100,000 Luna, as documented by the Nimiq Mini Apps provider API. */
export const LUNA_PER_NIM = 100_000n

const NIM_AMOUNT_PATTERN = /^(0|[1-9]\d*)(?:\.(\d{1,5}))?$/

export type AmountParseResult =
  | { ok: true, luna: bigint }
  | { ok: false, message: string }

export function parseNimToLuna(input: string): AmountParseResult {
  const trimmed = input.trim()

  if (!trimmed) {
    return { ok: false, message: 'Enter an amount.' }
  }

  if (trimmed.startsWith('-')) {
    return { ok: false, message: 'Amount must be greater than zero.' }
  }

  if (trimmed.includes('e') || trimmed.includes('E')) {
    return { ok: false, message: 'Enter a valid NIM amount.' }
  }

  if (/\.\d{6,}$/.test(trimmed)) {
    return { ok: false, message: 'NIM amounts can have at most 5 decimal places.' }
  }

  if (!NIM_AMOUNT_PATTERN.test(trimmed)) {
    return { ok: false, message: 'Enter a valid NIM amount.' }
  }

  const [whole, fraction = ''] = trimmed.split('.')
  const luna = BigInt(whole) * LUNA_PER_NIM + BigInt(fraction.padEnd(5, '0'))

  if (luna <= 0n) {
    return { ok: false, message: 'Amount must be greater than zero.' }
  }

  if (luna > BigInt(Number.MAX_SAFE_INTEGER)) {
    return { ok: false, message: 'Amount is too large.' }
  }

  return { ok: true, luna }
}

export function lunaToSafeNumber(luna: bigint): number {
  if (luna > BigInt(Number.MAX_SAFE_INTEGER) || luna < 0n) {
    throw new Error('Luna amount is outside the safe integer range.')
  }

  return Number(luna)
}

export function formatLunaAsNim(luna: bigint | number): string {
  const value = typeof luna === 'number' ? BigInt(luna) : luna
  const whole = value / LUNA_PER_NIM
  const fraction = value % LUNA_PER_NIM

  if (fraction === 0n) {
    return whole.toString()
  }

  return `${whole}.${fraction.toString().padStart(5, '0').replace(/0+$/, '')}`
}
