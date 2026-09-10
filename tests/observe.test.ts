import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  GET_TRANSACTION_BY_HASH,
  NIMIQ_TESTNET_RPC_URL,
  classifyObservedTransaction,
  getNimTransactionByHash,
  normalizeTransactionHash,
  parseNimTransactionData,
} from '../src/lib/observe.ts'

const BASIC_TRANSFER_FIXTURE = {
  hash: '0e70ceec09dc5abd954196c004713d241e08a0cb25370b7e711455cd4853c6fc',
  blockNumber: 11063444,
  timestamp: 1789035147227,
  confirmations: 48930,
  from: 'NQ37 7C3V VMN8 FRPN FXS9 PLAG JMRE 8SC6 KUSQ',
  fromType: 0,
  to: 'NQ61 XMNV XULY D874 G08H YDXK LK29 E7YR KFP6',
  toType: 0,
  value: 11000000000,
  fee: 5,
  senderData: '',
  recipientData: '',
  flags: 0,
  networkId: 5,
  executionResult: true,
}

const REWARD_FIXTURE = {
  hash: 'f6ccc8e0b6b9c434ac9abc8022a976a68babbad868946fd07d642a8673de7d47',
  from: 'NQ81 C01N BASE 0000 0000 0000 0000 0000 0000',
  fromType: 0,
  to: 'NQ57 2F6C X3GB Y9B7 04U5 2BVA 4BVC M2T0 ELRL',
  toType: 0,
  value: 31511599,
  fee: 0,
  senderData: '',
  recipientData: '',
  flags: 0,
  networkId: 5,
}

describe('Nimiq transaction observation parser', () => {
  it('rejects an invalid hash before calling RPC', async () => {
    const result = await getNimTransactionByHash('not-a-hash')
    assert.equal(result.status, 'invalid_hash')
  })

  it('parses a basic NIM transfer without using the proof field', () => {
    const parsed = parseNimTransactionData(
      BASIC_TRANSFER_FIXTURE,
      BASIC_TRANSFER_FIXTURE.hash,
    )
    assert.equal(parsed.status, 'included')
    if (parsed.status === 'included') {
      assert.equal(parsed.kind, 'basic_transfer')
      assert.equal(parsed.from, BASIC_TRANSFER_FIXTURE.from)
      assert.equal(parsed.to, BASIC_TRANSFER_FIXTURE.to)
      assert.equal(parsed.valueLuna, 11000000000)
      assert.equal(parsed.feeLuna, 5)
      assert.equal(parsed.blockNumber, 11063444)
      assert.equal(parsed.confirmations, 48930)
      assert.equal(parsed.executionResult, true)
      assert.equal(parsed.networkId, 5)
      assert.equal('proof' in parsed, false)
    }
  })

  it('classifies coinbase rewards separately from user transfers', () => {
    assert.equal(classifyObservedTransaction(REWARD_FIXTURE), 'reward')
    assert.equal(classifyObservedTransaction(BASIC_TRANSFER_FIXTURE), 'basic_transfer')
    assert.equal(
      classifyObservedTransaction({
        from: BASIC_TRANSFER_FIXTURE.from,
        to: BASIC_TRANSFER_FIXTURE.to,
        fromType: 0,
        toType: 2,
        flags: 1,
        senderData: '',
        recipientData: '00ab',
      }),
      'contract',
    )
  })

  it('does not fabricate a transaction when required fields are missing', () => {
    const parsed = parseNimTransactionData({ hash: BASIC_TRANSFER_FIXTURE.hash }, BASIC_TRANSFER_FIXTURE.hash)
    assert.equal(parsed.status, 'rpc_error')
  })
})

describe('Live TestAlbatross getTransactionByHash', () => {
  it('retrieves a known included basic transfer from the testnet RPC', async () => {
    const hash = normalizeTransactionHash(BASIC_TRANSFER_FIXTURE.hash)
    assert.ok(hash)

    const result = await getNimTransactionByHash(hash, { rpcUrl: NIMIQ_TESTNET_RPC_URL })
    assert.equal(result.status, 'included', JSON.stringify(result))
    if (result.status === 'included') {
      assert.equal(result.hash, hash)
      assert.equal(result.kind, 'basic_transfer')
      assert.equal(result.from, BASIC_TRANSFER_FIXTURE.from)
      assert.equal(result.to, BASIC_TRANSFER_FIXTURE.to)
      assert.equal(result.valueLuna, BASIC_TRANSFER_FIXTURE.value)
      assert.equal(result.feeLuna, BASIC_TRANSFER_FIXTURE.fee)
      assert.equal(result.blockNumber, BASIC_TRANSFER_FIXTURE.blockNumber)
      assert.equal(typeof result.confirmations, 'number')
      assert.ok((result.confirmations ?? 0) >= 1)
      assert.equal(result.executionResult, true)
      console.log(`${GET_TRANSACTION_BY_HASH} ${NIMIQ_TESTNET_RPC_URL}`, {
        hash: result.hash,
        from: result.from,
        to: result.to,
        valueLuna: result.valueLuna,
        feeLuna: result.feeLuna,
        blockNumber: result.blockNumber,
        confirmations: result.confirmations,
        kind: result.kind,
        executionResult: result.executionResult,
      })
    }
  })

  it('returns not_found for an unused hash instead of fabricating a transaction', async () => {
    const result = await getNimTransactionByHash(
      '1111111111111111111111111111111111111111111111111111111111111111',
      { rpcUrl: NIMIQ_TESTNET_RPC_URL },
    )
    assert.equal(result.status, 'not_found')
  })
})
