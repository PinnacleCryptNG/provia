import { init, type ErrorResponse, type NimiqProvider } from '@nimiq/mini-app-sdk'

const INIT_TIMEOUT_MS = 10_000

let providerPromise: ReturnType<typeof init> | null = null

export function initializeNimiqProvider(): Promise<NimiqProvider> {
  if (!providerPromise) {
    providerPromise = init({ timeout: INIT_TIMEOUT_MS })
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

  if (error instanceof Error && error.message) {
    return error.message
  }

  return String(error)
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

export async function sendBasicNimPayment(
  provider: NimiqProvider,
  payment: { recipient: string, valueLuna: number },
): Promise<string> {
  const result = await provider.sendBasicTransaction({
    recipient: payment.recipient,
    value: payment.valueLuna,
  })

  const errorMessage = getProviderErrorMessage(result)
  if (errorMessage) {
    throw new WalletRequestError(getProviderErrorType(result), errorMessage)
  }

  if (typeof result !== 'string' || result.length === 0) {
    throw new Error('Unexpected sendBasicTransaction response shape.')
  }

  return result
}
