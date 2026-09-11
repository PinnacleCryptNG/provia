import { normalizeNimiqAddress } from './address.ts'
import { expectedNetworkId, rpcUrlForNetwork, type NimiqNetwork } from './network.ts'
import { getNimTransactionByHash, type NimIncludedObservation, type NimObservationResult, type NimTransactionKind, type ObserveOptions } from './observe.ts'

export {
  MAINALBATROSS_NETWORK_ID,
  TESTALBATROSS_NETWORK_ID,
} from './network.ts'

/**
 * Conservative Testnet inclusion depth: one Albatross batch
 * (`getPolicyConstants().blocksPerBatch === 60`).
 * This is inclusion depth, not protocol finality.
 */
export const MIN_CONFIRMATIONS = 60

export type ExpectedNimPayment = {
  recipient: string
  amountLuna: number
  asset: string
  network: NimiqNetwork
}

export type VerificationOutcome =
  | 'VERIFIED'
  | 'MISMATCH'
  | 'UNDERPAID'
  | 'FAILED'
  | 'UNRESOLVED'

export type MismatchReason =
  | 'WRONG_RECIPIENT'
  | 'WRONG_NETWORK'
  | 'WRONG_ASSET'
  | 'OVERPAID'
  | 'UNSUPPORTED_TRANSACTION'

export type UnresolvedReason =
  | 'NOT_FOUND'
  | 'RPC_ERROR'
  | 'INVALID_HASH'
  | 'INSUFFICIENT_CONFIRMATIONS'
  | 'MISSING_EXECUTION_RESULT'

export type VerificationResult = {
  outcome: VerificationOutcome
  reason: MismatchReason | UnresolvedReason | 'EXECUTION_FAILED' | null
  confirmations: number | null
  confirmationPolicy: number
  expectedRecipient: string
  observedRecipient: string | null
  expectedAmountLuna: number
  observedAmountLuna: number | null
  observedNetworkId: number | null
  observedKind: NimTransactionKind | null
  transactionHash: string | null
  sender: string | null
  observedBlockNumber: number | null
}

function integerLuna(value: number): bigint {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error('Luna values must be non-negative integers.')
  }

  return BigInt(value)
}

function baseResult(intent: ExpectedNimPayment): Omit<VerificationResult, 'outcome' | 'reason'> {
  return {
    confirmations: null,
    confirmationPolicy: MIN_CONFIRMATIONS,
    expectedRecipient: normalizeNimiqAddress(intent.recipient),
    observedRecipient: null,
    expectedAmountLuna: intent.amountLuna,
    observedAmountLuna: null,
    observedNetworkId: null,
    observedKind: null,
    transactionHash: null,
    sender: null,
    observedBlockNumber: null,
  }
}

function withObservation(
  intent: ExpectedNimPayment,
  observation: NimIncludedObservation,
): Omit<VerificationResult, 'outcome' | 'reason'> {
  return {
    confirmations: observation.confirmations,
    confirmationPolicy: MIN_CONFIRMATIONS,
    expectedRecipient: normalizeNimiqAddress(intent.recipient),
    observedRecipient: normalizeNimiqAddress(observation.to),
    expectedAmountLuna: intent.amountLuna,
    observedAmountLuna: observation.valueLuna,
    observedNetworkId: observation.networkId,
    observedKind: observation.kind,
    transactionHash: observation.hash,
    sender: observation.from,
    observedBlockNumber: observation.blockNumber,
  }
}

export function verifyPayment(
  intent: ExpectedNimPayment,
  observation: NimObservationResult,
): VerificationResult {
  const base = baseResult(intent)

  if (observation.status === 'not_found') {
    return {
      ...base,
      outcome: 'UNRESOLVED',
      reason: 'NOT_FOUND',
      transactionHash: observation.hash,
    }
  }

  if (observation.status === 'invalid_hash') {
    return {
      ...base,
      outcome: 'UNRESOLVED',
      reason: 'INVALID_HASH',
    }
  }

  if (observation.status === 'rpc_error') {
    return {
      ...base,
      outcome: 'UNRESOLVED',
      reason: 'RPC_ERROR',
    }
  }

  const observed = withObservation(intent, observation)

  if (observation.executionResult === false) {
    return {
      ...observed,
      outcome: 'FAILED',
      reason: 'EXECUTION_FAILED',
    }
  }

  if (observation.kind !== 'basic_transfer') {
    return {
      ...observed,
      outcome: 'MISMATCH',
      reason: 'UNSUPPORTED_TRANSACTION',
    }
  }

  if (observation.networkId !== expectedNetworkId(intent.network)) {
    return {
      ...observed,
      outcome: 'MISMATCH',
      reason: 'WRONG_NETWORK',
    }
  }

  if (intent.asset !== 'NIM') {
    return {
      ...observed,
      outcome: 'MISMATCH',
      reason: 'WRONG_ASSET',
    }
  }

  if (observed.expectedRecipient !== observed.observedRecipient) {
    return {
      ...observed,
      outcome: 'MISMATCH',
      reason: 'WRONG_RECIPIENT',
    }
  }

  const expectedLuna = integerLuna(intent.amountLuna)
  const observedLuna = integerLuna(observation.valueLuna)

  if (observedLuna < expectedLuna) {
    return {
      ...observed,
      outcome: 'UNDERPAID',
      reason: null,
    }
  }

  if (observedLuna > expectedLuna) {
    return {
      ...observed,
      outcome: 'MISMATCH',
      reason: 'OVERPAID',
    }
  }

  if (observation.executionResult !== true) {
    return {
      ...observed,
      outcome: 'UNRESOLVED',
      reason: 'MISSING_EXECUTION_RESULT',
    }
  }

  const confirmations = observation.confirmations
  if (confirmations === null || confirmations < MIN_CONFIRMATIONS) {
    return {
      ...observed,
      outcome: 'UNRESOLVED',
      reason: 'INSUFFICIENT_CONFIRMATIONS',
    }
  }

  return {
    ...observed,
    outcome: 'VERIFIED',
    reason: null,
  }
}

export async function observeAndVerifyPayment(
  intent: ExpectedNimPayment,
  txHash: string,
  options?: ObserveOptions,
): Promise<VerificationResult> {
  const observation = await getNimTransactionByHash(txHash, {
    rpcUrl: options?.rpcUrl ?? rpcUrlForNetwork(intent.network),
  })
  return verifyPayment(intent, observation)
}
