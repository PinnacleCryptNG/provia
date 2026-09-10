import { init, type NimiqProvider } from '@nimiq/mini-app-sdk'

const INIT_TIMEOUT_MS = 10_000

let providerPromise: ReturnType<typeof init> | null = null

export function initializeNimiqProvider(): Promise<NimiqProvider> {
  if (!providerPromise) {
    providerPromise = init({ timeout: INIT_TIMEOUT_MS })
  }

  return providerPromise
}

function getProviderErrorMessage(value: unknown): string | null {
  if (typeof value !== 'object' || value === null || !('error' in value)) {
    return null
  }

  const maybeError = (value as { error?: { message?: unknown } }).error
  if (maybeError && typeof maybeError.message === 'string') {
    return maybeError.message
  }

  return 'Provider request failed.'
}

export async function listNimiqAccounts(provider: NimiqProvider): Promise<string[]> {
  const result = await provider.listAccounts()
  const errorMessage = getProviderErrorMessage(result)

  if (errorMessage) {
    throw new Error(errorMessage)
  }

  if (!Array.isArray(result) || result.length === 0) {
    throw new Error('No Nimiq addresses returned by Nimiq Pay.')
  }

  if (!result.every((address) => typeof address === 'string')) {
    throw new Error('Unexpected listAccounts response shape.')
  }

  return result
}

export function toUserFacingError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
