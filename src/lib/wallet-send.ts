import { isUserRejection } from './nimiq.ts'

export type WalletSendPhase = 'idle' | 'opening' | 'cancelled' | 'failed'

export function canStartWalletSend(options: {
  inFlight: boolean
  hasSubmittedHash: boolean
}): boolean {
  return !options.inFlight && !options.hasSubmittedHash
}

export function classifyWalletSendError(error: unknown): 'cancelled' | 'failed' {
  return isUserRejection(error) ? 'cancelled' : 'failed'
}

export function isWalletHashLocator(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export const WALLET_CANCELLED_TITLE = 'Payment cancelled'
export const WALLET_CANCELLED_MESSAGE = 'Your payment wasn’t sent.'
export const WALLET_FAILED_TITLE = 'Payment couldn’t be sent'
export const WALLET_FAILED_MESSAGE = 'Nimiq Pay could not complete this payment. No automatic retry was made.'
export const WALLET_OPENING_LABEL = 'Opening Nimiq Pay…'
