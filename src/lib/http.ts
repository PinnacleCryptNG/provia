/** Bound HTTP wait so a hung RPC or API call cannot freeze the Mini App. */
export const PROVIA_REQUEST_TIMEOUT_MS = 20_000

export function createTimedFetch(
  timeoutMs = PROVIA_REQUEST_TIMEOUT_MS,
  fetchFn: typeof globalThis.fetch = globalThis.fetch,
): typeof globalThis.fetch {
  return (input, init) => {
    const signal = init?.signal ?? AbortSignal.timeout(timeoutMs)
    return fetchFn(input, { ...init, signal })
  }
}

export const fetchWithTimeout = createTimedFetch()
