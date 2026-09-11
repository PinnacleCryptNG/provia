import {
  CONTRACT_RECIPIENT_ERROR,
  INVALID_RECIPIENT_ERROR,
  PROTOCOL_RECIPIENT_ERROR,
  UNRESOLVED_RECIPIENT_ERROR,
  WRONG_NETWORK_ERROR,
} from './recipient-preflight.ts'

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : ''
}

export function toCreatePaymentUserError(error: unknown): string {
  const raw = errorText(error)

  if (raw === CONTRACT_RECIPIENT_ERROR) {
    return CONTRACT_RECIPIENT_ERROR
  }

  if (raw === PROTOCOL_RECIPIENT_ERROR) {
    return PROTOCOL_RECIPIENT_ERROR
  }

  if (raw === UNRESOLVED_RECIPIENT_ERROR || /couldn’t check this recipient/i.test(raw)) {
    return UNRESOLVED_RECIPIENT_ERROR
  }

  if (raw === WRONG_NETWORK_ERROR) {
    return 'Something went wrong while preparing the payment.'
  }

  if (/amountLuna|positive integer/i.test(raw)) {
    return 'Enter a valid amount.'
  }

  if (/recipient must be|valid Nimiq address/i.test(raw) || raw === INVALID_RECIPIENT_ERROR) {
    return 'Enter a valid recipient address.'
  }

  if (/NIMIQ_|network must be/i.test(raw)) {
    return 'Something went wrong while preparing the payment.'
  }

  return 'Couldn’t prepare this payment. Please try again.'
}

export function toProofUserError(_error: unknown): string {
  return 'Your payment was verified, but the receipt could not be prepared.'
}

export const CONNECT_WALLET_USER_ERROR = 'Couldn’t connect to Nimiq Pay.'
