import { isValidNimiqAddress, normalizeNimiqAddress } from './address.ts'
import {
  isContractAccountType,
  type LookupAccount,
} from './account.ts'
import { COINBASE_ADDRESS, STAKING_CONTRACT_ADDRESS } from './nimiq-protocol.ts'
import { isNimiqNetwork, rpcUrlForNetwork, type NimiqNetwork } from './network.ts'

export const CONTRACT_RECIPIENT_ERROR = 'This recipient can’t receive a regular NIM payment.'
export const PROTOCOL_RECIPIENT_ERROR = 'This recipient can’t receive this payment.'
export const UNRESOLVED_RECIPIENT_ERROR = 'Couldn’t check this recipient. Please try again.'
export const INVALID_RECIPIENT_ERROR = 'Enter a valid Nimiq recipient address.'
export const WRONG_NETWORK_ERROR = 'This payment is not on the selected Nimiq network.'

export type RecipientPreflightSuccess = {
  ok: true
  recipient: string
  network: NimiqNetwork
  accountType: 'basic'
}

export type RecipientPreflightFailure = {
  ok: false
  reason:
    | 'invalid_recipient'
    | 'wrong_network'
    | 'unresolved'
    | 'contract_recipient'
    | 'protocol_recipient'
    | 'rpc_error'
  error: string
}

export type RecipientPreflightResult = RecipientPreflightSuccess | RecipientPreflightFailure

/**
 * Pre-payment recipient checks that Nimiq data actually supports:
 * - checksummed address validity
 * - lookup on the selected network RPC only (no fallback)
 * - contract detection from getAccountByAddress `type`
 * - protocol special addresses from getPolicyConstants (staking, coinbase)
 *
 * Not implemented, because the RPC does not support them:
 * - burn-address detection (no protocol burn address; zero balance is not a burn)
 * - address-poisoning detection (no reliable lookalike/history signal)
 */
export async function runRecipientPreflight(
  input: { recipient: string, network: NimiqNetwork },
  lookupAccount: LookupAccount,
): Promise<RecipientPreflightResult> {
  if (!isNimiqNetwork(input.network)) {
    return { ok: false, reason: 'wrong_network', error: WRONG_NETWORK_ERROR }
  }

  if (!isValidNimiqAddress(input.recipient)) {
    return { ok: false, reason: 'invalid_recipient', error: INVALID_RECIPIENT_ERROR }
  }

  const recipient = normalizeNimiqAddress(input.recipient)

  if (recipient === COINBASE_ADDRESS || recipient === STAKING_CONTRACT_ADDRESS) {
    return { ok: false, reason: 'protocol_recipient', error: PROTOCOL_RECIPIENT_ERROR }
  }

  const lookup = await lookupAccount({ address: recipient, network: input.network })
  if (lookup.status === 'rpc_error') {
    return { ok: false, reason: 'rpc_error', error: UNRESOLVED_RECIPIENT_ERROR }
  }

  if (lookup.status !== 'found') {
    return { ok: false, reason: 'unresolved', error: UNRESOLVED_RECIPIENT_ERROR }
  }

  if (lookup.rpcUrl && lookup.rpcUrl !== rpcUrlForNetwork(input.network)) {
    return { ok: false, reason: 'wrong_network', error: WRONG_NETWORK_ERROR }
  }

  if (lookup.account.address !== recipient) {
    return { ok: false, reason: 'unresolved', error: UNRESOLVED_RECIPIENT_ERROR }
  }

  if (isContractAccountType(lookup.account.type)) {
    return { ok: false, reason: 'contract_recipient', error: CONTRACT_RECIPIENT_ERROR }
  }

  return {
    ok: true,
    recipient,
    network: input.network,
    accountType: 'basic',
  }
}
