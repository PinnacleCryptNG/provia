/** Explicit Nimiq network identifier. Never infer Testnet vs Mainnet from the word "Nimiq". */
export type NimiqNetwork = 'NIMIQ_TESTNET' | 'NIMIQ_MAINNET'

/** Hackathon development default. */
export const DEFAULT_NIMIQ_NETWORK: NimiqNetwork = 'NIMIQ_TESTNET'

/**
 * TestAlbatross `networkId` observed on testnet RPC transactions
 * (`getLatestBlock.network === "TestAlbatross"`).
 */
export const TESTALBATROSS_NETWORK_ID = 5

/** MainAlbatross `networkId` observed on mainnet RPC transactions. */
export const MAINALBATROSS_NETWORK_ID = 24

/** Official Developer Center playground default. Mainnet. No SLA. */
export const NIMIQ_MAINNET_RPC_URL = 'https://rpc.nimiqwatch.com'

/** Same public operator as the playground, TestAlbatross. Confirmed live in the observation spike. */
export const NIMIQ_TESTNET_RPC_URL = 'https://rpc.testnet.nimiqwatch.com'

export function isNimiqNetwork(value: string): value is NimiqNetwork {
  return value === 'NIMIQ_TESTNET' || value === 'NIMIQ_MAINNET'
}

export function expectedNetworkId(network: NimiqNetwork): number {
  switch (network) {
    case 'NIMIQ_TESTNET':
      return TESTALBATROSS_NETWORK_ID
    case 'NIMIQ_MAINNET':
      return MAINALBATROSS_NETWORK_ID
    default: {
      const exhaustive: never = network
      throw new Error(`Unknown Nimiq network: ${String(exhaustive)}`)
    }
  }
}

export function rpcUrlForNetwork(network: NimiqNetwork): string {
  switch (network) {
    case 'NIMIQ_TESTNET':
      return NIMIQ_TESTNET_RPC_URL
    case 'NIMIQ_MAINNET':
      return NIMIQ_MAINNET_RPC_URL
    default: {
      const exhaustive: never = network
      throw new Error(`Unknown Nimiq network: ${String(exhaustive)}`)
    }
  }
}

export function nimiqNetworkLabel(network: NimiqNetwork): string {
  switch (network) {
    case 'NIMIQ_TESTNET':
      return 'Nimiq Testnet'
    case 'NIMIQ_MAINNET':
      return 'Nimiq Mainnet'
    default: {
      const exhaustive: never = network
      throw new Error(`Unknown Nimiq network: ${String(exhaustive)}`)
    }
  }
}
