import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  GET_ACCOUNT_BY_ADDRESS,
  getNimAccountByAddress,
  parseNimAccountData,
  parseNimAccountType,
  type LookupAccount,
} from '../src/lib/account.ts'
import { NIMIQ_TESTNET_RPC_URL, rpcUrlForNetwork } from '../src/lib/network.ts'
import { COINBASE_ADDRESS, STAKING_CONTRACT_ADDRESS } from '../src/lib/nimiq-protocol.ts'
import {
  CONTRACT_RECIPIENT_ERROR,
  PROTOCOL_RECIPIENT_ERROR,
  UNRESOLVED_RECIPIENT_ERROR,
  WRONG_NETWORK_ERROR,
  runRecipientPreflight,
} from '../src/lib/recipient-preflight.ts'

const BASIC_RECIPIENT = 'NQ61 XMNV XULY D874 G08H YDXK LK29 E7YR KFP6'
const HTLC_RECIPIENT = 'NQ38 7NCU 6AMJ M6GG 18X9 PNKM YFYD 1YNJ XY09'

function lookupWith(
  status: Awaited<ReturnType<LookupAccount>>,
): LookupAccount {
  return async () => status
}

describe('Nimiq account type parsing', () => {
  it('reads Albatross string types and legacy numeric types', () => {
    assert.equal(parseNimAccountType('basic'), 'basic')
    assert.equal(parseNimAccountType('vesting'), 'vesting')
    assert.equal(parseNimAccountType('htlc'), 'htlc')
    assert.equal(parseNimAccountType('staking'), 'staking')
    assert.equal(parseNimAccountType(0), 'basic')
    assert.equal(parseNimAccountType(1), 'vesting')
    assert.equal(parseNimAccountType(2), 'htlc')
    assert.equal(parseNimAccountType(3), 'staking')
    assert.equal(parseNimAccountType('unknown'), null)
  })

  it('parses a basic account without treating zero balance as a burn', () => {
    const parsed = parseNimAccountData({
      address: BASIC_RECIPIENT,
      balance: 0,
      type: 'basic',
    })
    assert.equal(parsed.status, 'found')
    if (parsed.status === 'found') {
      assert.equal(parsed.account.type, 'basic')
      assert.equal(parsed.account.balanceLuna, 0)
    }
  })
})

describe('recipient preflight', () => {
  it('accepts a valid basic recipient on Testnet', async () => {
    const result = await runRecipientPreflight(
      { recipient: BASIC_RECIPIENT, network: 'NIMIQ_TESTNET' },
      lookupWith({
        status: 'found',
        account: { address: BASIC_RECIPIENT, balanceLuna: 0, type: 'basic' },
        rpcUrl: rpcUrlForNetwork('NIMIQ_TESTNET'),
      }),
    )
    assert.equal(result.ok, true)
    if (result.ok) {
      assert.equal(result.recipient, BASIC_RECIPIENT)
      assert.equal(result.network, 'NIMIQ_TESTNET')
      assert.equal(result.accountType, 'basic')
    }
  })

  it('rejects an invalid recipient before lookup', async () => {
    let called = 0
    const result = await runRecipientPreflight(
      { recipient: 'not-an-address', network: 'NIMIQ_TESTNET' },
      async () => {
        called += 1
        throw new Error('lookup should not run')
      },
    )
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.reason, 'invalid_recipient')
    }
    assert.equal(called, 0)
  })

  it('rejects a wrong network RPC response', async () => {
    const result = await runRecipientPreflight(
      { recipient: BASIC_RECIPIENT, network: 'NIMIQ_TESTNET' },
      lookupWith({
        status: 'found',
        account: { address: BASIC_RECIPIENT, balanceLuna: 1, type: 'basic' },
        rpcUrl: rpcUrlForNetwork('NIMIQ_MAINNET'),
      }),
    )
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.reason, 'wrong_network')
      assert.equal(result.error, WRONG_NETWORK_ERROR)
    }
  })

  it('rejects an unresolved recipient', async () => {
    const result = await runRecipientPreflight(
      { recipient: BASIC_RECIPIENT, network: 'NIMIQ_TESTNET' },
      lookupWith({ status: 'unresolved', message: 'Unknown format' }),
    )
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.reason, 'unresolved')
      assert.equal(result.error, UNRESOLVED_RECIPIENT_ERROR)
    }
  })

  it('rejects a contract recipient from getAccountByAddress type', async () => {
    const result = await runRecipientPreflight(
      { recipient: HTLC_RECIPIENT, network: 'NIMIQ_TESTNET' },
      lookupWith({
        status: 'found',
        account: { address: HTLC_RECIPIENT, balanceLuna: 1, type: 'htlc' },
        rpcUrl: rpcUrlForNetwork('NIMIQ_TESTNET'),
      }),
    )
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.reason, 'contract_recipient')
      assert.equal(result.error, CONTRACT_RECIPIENT_ERROR)
    }
  })

  it('rejects vesting contract recipients', async () => {
    const result = await runRecipientPreflight(
      { recipient: BASIC_RECIPIENT, network: 'NIMIQ_TESTNET' },
      lookupWith({
        status: 'found',
        account: { address: BASIC_RECIPIENT, balanceLuna: 1, type: 'vesting' },
        rpcUrl: rpcUrlForNetwork('NIMIQ_TESTNET'),
      }),
    )
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.reason, 'contract_recipient')
    }
  })

  it('does not invent a burn-address rule for a zero-balance basic account', async () => {
    const result = await runRecipientPreflight(
      { recipient: BASIC_RECIPIENT, network: 'NIMIQ_TESTNET' },
      lookupWith({
        status: 'found',
        account: { address: BASIC_RECIPIENT, balanceLuna: 0, type: 'basic' },
        rpcUrl: rpcUrlForNetwork('NIMIQ_TESTNET'),
      }),
    )
    assert.equal(result.ok, true)
  })

  it('rejects protocol special addresses without calling them burn addresses', async () => {
    const coinbase = await runRecipientPreflight(
      { recipient: COINBASE_ADDRESS, network: 'NIMIQ_TESTNET' },
      async () => {
        throw new Error('lookup should not run for coinbase')
      },
    )
    assert.equal(coinbase.ok, false)
    if (!coinbase.ok) {
      assert.equal(coinbase.reason, 'protocol_recipient')
      assert.equal(coinbase.error, PROTOCOL_RECIPIENT_ERROR)
    }

    const staking = await runRecipientPreflight(
      { recipient: STAKING_CONTRACT_ADDRESS, network: 'NIMIQ_TESTNET' },
      async () => {
        throw new Error('lookup should not run for staking contract')
      },
    )
    assert.equal(staking.ok, false)
    if (!staking.ok) {
      assert.equal(staking.reason, 'protocol_recipient')
    }
  })

  it('does not implement address-poisoning detection from an address string', async () => {
    const source = await import('node:fs').then((fs) => (
      fs.readFileSync(new URL('../src/lib/recipient-preflight.ts', import.meta.url), 'utf8')
    ))
    assert.match(source, /address-poisoning detection/)
    assert.match(source, /Not implemented/)
    const result = await runRecipientPreflight(
      { recipient: BASIC_RECIPIENT, network: 'NIMIQ_TESTNET' },
      lookupWith({
        status: 'found',
        account: { address: BASIC_RECIPIENT, balanceLuna: 100, type: 'basic' },
        rpcUrl: rpcUrlForNetwork('NIMIQ_TESTNET'),
      }),
    )
    assert.equal(result.ok, true)
  })
})

describe('Live Testnet getAccountByAddress', () => {
  it('resolves a known basic recipient on Testnet', async () => {
    const result = await getNimAccountByAddress(BASIC_RECIPIENT, 'NIMIQ_TESTNET')
    assert.equal(result.status, 'found', JSON.stringify(result))
    if (result.status === 'found') {
      assert.equal(result.account.address, BASIC_RECIPIENT)
      assert.equal(result.account.type, 'basic')
      assert.equal(result.rpcUrl, NIMIQ_TESTNET_RPC_URL)
    }
  })

  it('detects the staking contract as a non-basic account', async () => {
    const result = await getNimAccountByAddress(STAKING_CONTRACT_ADDRESS, 'NIMIQ_TESTNET')
    assert.equal(result.status, 'found', JSON.stringify(result))
    if (result.status === 'found') {
      assert.equal(result.account.type, 'staking')
    }
  })

  it('uses getAccountByAddress rather than inventing account types', () => {
    assert.equal(GET_ACCOUNT_BY_ADDRESS, 'getAccountByAddress')
  })
})
