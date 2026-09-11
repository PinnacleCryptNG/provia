import { init, type ErrorResponse, type NimiqProvider } from '@nimiq/mini-app-sdk'
import { proviaIntentPaymentData } from './payment-data.ts'

export { proviaIntentPaymentData } from './payment-data.ts'

const INIT_TIMEOUT_MS = 10_000

let providerPromise: ReturnType<typeof init> | null = null

export function initializeNimiqProvider(): Promise<NimiqProvider> {
  if (!providerPromise) {
    providerPromise = init({ timeout: INIT_TIMEOUT_MS }).catch((error) => {
      providerPromise = null
      throw error
    })
  }

  return providerPromise
}

export function isErrorResponse(value: unknown): value is ErrorResponse {
  if (typeof value !== 'object' || value === null || !('error' in value)) {
    return false
  }

  const maybeError = (value as { error?: { message?: unknown, type?: unknown } }).error
  return Boolean(maybeError && typeof maybeError.message === 'string')
}

function getProviderErrorMessage(value: unknown): string | null {
  if (!isErrorResponse(value)) {
    return null
  }

  return value.error.message || 'Provider request failed.'
}

function getProviderErrorType(value: unknown): string {
  if (isErrorResponse(value) && typeof value.error.type === 'string') {
    return value.error.type
  }

  if (value instanceof Error && value.name && value.name !== 'Error') {
    return value.name
  }

  return 'ProviderError'
}

export function isUserRejection(error: unknown): boolean {
  const type = error instanceof WalletRequestError ? error.type : getProviderErrorType(error)
  const message = error instanceof Error ? error.message : String(error)
  return /permission|denied|reject|cancel/i.test(`${type} ${message}`)
}

export class WalletRequestError extends Error {
  readonly type: string

  constructor(type: string, message: string) {
    super(message)
    this.name = 'WalletRequestError'
    this.type = type
  }
}

export function toUserFacingError(error: unknown): string {
  if (isUserRejection(error)) {
    return 'You declined the payment in Nimiq Pay. No transaction was sent.'
  }

  const message = error instanceof Error ? error.message : String(error)
  if (/timeout|timed out|not available|provider/i.test(message)) {
    return 'PROVIA could not connect to Nimiq Pay. Open this Mini App inside Nimiq Pay.'
  }

  return 'Nimiq Pay could not submit this payment. No transaction was verified.'
}

export function toProviderConnectionError(_error: unknown): string {
  return 'PROVIA could not connect to Nimiq Pay. Open this Mini App inside Nimiq Pay. A browser window cannot submit a payment.'
}

export async function listNimiqAccounts(provider: NimiqProvider): Promise<string[]> {
  const result = await provider.listAccounts()
  const errorMessage = getProviderErrorMessage(result)

  if (errorMessage) {
    throw new WalletRequestError(getProviderErrorType(result), errorMessage)
  }

  if (!Array.isArray(result) || result.length === 0) {
    throw new Error('No Nimiq addresses returned by Nimiq Pay.')
  }

  if (!result.every((address) => typeof address === 'string')) {
    throw new Error('Unexpected listAccounts response shape.')
  }

  return result
}

/** Nimiq Pay Mini App send path. Data is the server-owned intent binding. */
export const NIMIQ_PAY_SEND_METHOD = 'sendBasicTransactionWithData' as const

export type PaymentSendDiagnostic = {
  intentId: string
  method: typeof NIMIQ_PAY_SEND_METHOD
  data: string
  returnedValue: string
  transactionHash: string
}

export async function sendBasicNimPayment(
  provider: NimiqProvider,
  payment: { recipient: string, valueLuna: number, intentId: string },
): Promise<PaymentSendDiagnostic> {
  const data = proviaIntentPaymentData(payment.intentId)
  const result = await provider.sendBasicTransactionWithData({
    recipient: payment.recipient,
    value: payment.valueLuna,
    data,
  })

  const errorMessage = getProviderErrorMessage(result)
  if (errorMessage) {
    throw new WalletRequestError(getProviderErrorType(result), errorMessage)
  }

  if (typeof result !== 'string' || result.length === 0) {
    throw new Error('Unexpected sendBasicTransactionWithData response shape.')
  }

  const diagnostic: PaymentSendDiagnostic = {
    intentId: payment.intentId,
    method: NIMIQ_PAY_SEND_METHOD,
    data,
    returnedValue: result,
    transactionHash: result,
  }

  if (import.meta.env?.DEV) {
    console.info('[PROVIA send]', diagnostic)
  }

  return diagnostic
}
