/**
 * Protocol addresses from Nimiq Albatross `Policy` / `getPolicyConstants`.
 * These match core-rs-albatross and the live Testnet RPC constants.
 *
 * Nimiq does not publish a protocol burn address. Do not treat a zero-balance
 * basic account as a burn destination.
 */
export const STAKING_CONTRACT_ADDRESS = 'NQ77 0000 0000 0000 0000 0000 0000 0000 0001'
export const COINBASE_ADDRESS = 'NQ81 C01N BASE 0000 0000 0000 0000 0000 0000'
