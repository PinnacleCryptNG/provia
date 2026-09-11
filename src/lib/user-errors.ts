function errorText(error: unknown): string {
  return error instanceof Error ? error.message : ''
}

export function toCreatePaymentUserError(error: unknown): string {
  const raw = errorText(error)

  if (/amountLuna|positive integer/i.test(raw)) {
    return 'Enter a valid amount.'
  }

  if (/recipient must be|valid Nimiq address/i.test(raw)) {
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
