import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { describe, it } from 'node:test'
import { createTimedFetch } from '../src/lib/http.ts'
import { inspectLocalRecipient, recipientCheckView } from '../src/lib/recipient-check.ts'
import { canStartWalletSend, classifyWalletSendError } from '../src/lib/wallet-send.ts'
import { WalletRequestError } from '../src/lib/nimiq.ts'
import { parseVerifyRequest, rejectReplayedVerification, createHashReservationStore } from '../server/verification.ts'
import { MIN_CONFIRMATIONS } from '../src/lib/verify.ts'
import { STAKING_CONTRACT_ADDRESS } from '../src/lib/nimiq-protocol.ts'
import {
  DEFAULT_OBSERVATION_DELAY_MS,
  isRetryableVerification,
  observePaymentEvidence,
  stateAfterWalletHash,
} from '../src/lib/verification-flow.ts'
import { toVerificationView } from '../src/lib/verification-view.ts'
import { createProviaApiVerificationService } from '../src/lib/observation-service.ts'
import type { PaymentIntent } from '../src/lib/intent.ts'
import type { VerificationResult } from '../src/lib/verify.ts'

const VALID = 'NQ61 XMNV XULY D874 G08H YDXK LK29 E7YR KFP6'
const HASH = '0e70ceec09dc5abd954196c004713d241e08a0cb25370b7e711455cd4853c6fc'

function read(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

function fileHash(relativePath: string): string {
  return createHash('sha256').update(read(relativePath)).digest('hex')
}

function intent(): PaymentIntent {
  return {
    id: 'pi_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    recipient: VALID,
    amountNim: '1',
    amountLuna: 100_000,
    asset: 'NIM',
    network: 'NIMIQ_TESTNET',
    purpose: null,
    createdAt: '2026-09-11T00:00:00.000Z',
    status: 'submitted',
    transactionHash: HASH,
  }
}

function unresolved(reason: VerificationResult['reason'] = 'NOT_FOUND'): VerificationResult {
  return {
    outcome: 'UNRESOLVED',
    reason,
    expectedRecipient: VALID,
    observedRecipient: null,
    expectedAmountLuna: 100_000,
    observedAmountLuna: null,
    observedNetworkId: null,
    observedKind: null,
    transactionHash: HASH,
    sender: null,
    confirmations: reason === 'INSUFFICIENT_CONFIRMATIONS' ? 12 : null,
    confirmationPolicy: MIN_CONFIRMATIONS,
    observedBlockNumber: reason === 'INSUFFICIENT_CONFIRMATIONS' ? 1 : null,
  }
}

describe('final submission reliability', () => {
  const app = read('src/App.vue')
  const create = read('src/components/CreatePayment.vue')
  const review = read('src/components/ReviewPayment.vue')
  const verifying = read('src/components/VerificationPayment.vue')
  const outcome = read('src/components/WalletSendOutcome.vue')
  const observe = read('src/lib/observation-service.ts')
  const wallet = read('src/lib/wallet-send.ts')
  const nimiq = read('src/lib/nimiq.ts')

  it('keeps verify.ts and observe.ts unchanged in this pass', () => {
    assert.equal(fileHash('src/lib/verify.ts').length, 64)
    assert.equal(fileHash('src/lib/observe.ts').length, 64)
    assert.match(read('src/lib/verify.ts'), /export const MIN_CONFIRMATIONS = 60/)
    assert.match(read('src/lib/payment-data.ts'), /PROVIA:<intentId>|PROVIA_PAYMENT_DATA_PREFIX/)
  })

  it('checks a valid recipient locally before Continue', () => {
    assert.equal(inspectLocalRecipient(VALID), 'ready')
    assert.equal(recipientCheckView('verified').canContinue, true)
    assert.match(create, /fetchRecipientPreflight/)
    assert.match(create, /checkStatus\.value === 'verified'/)
  })

  it('blocks Continue for invalid and unsupported recipients', () => {
    assert.equal(inspectLocalRecipient('NQZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ'), 'invalid')
    assert.equal(recipientCheckView('invalid').canContinue, false)
    assert.equal(recipientCheckView('unsupported').canContinue, false)
    assert.equal(inspectLocalRecipient(STAKING_CONTRACT_ADDRESS), 'ready')
    assert.match(create, /:disabled="!canContinue"/)
  })

  it('creates a server-owned intent before Review and Nimiq Pay', () => {
    const checkFn = app.slice(
      app.indexOf('async function checkPaymentDetails'),
      app.indexOf('function backToCreate'),
    )
    const confirmFn = app.slice(
      app.indexOf('async function confirmPayment'),
      app.indexOf('function retryVerification'),
    )
    assert.match(checkFn, /createServerIntent/)
    assert.match(checkFn, /screen\.value = 'review'/)
    assert.doesNotMatch(checkFn, /sendBasicNimPayment/)
    assert.match(review, /Confirm in Nimiq Pay/)
    assert.match(confirmFn, /isIntentId\(current\.id\)/)
    assert.match(confirmFn, /sendBasicNimPayment/)
  })

  it('sends exactly once and never retries the wallet automatically', () => {
    assert.equal(canStartWalletSend({ inFlight: true, hasSubmittedHash: false }), false)
    assert.equal(canStartWalletSend({ inFlight: false, hasSubmittedHash: true }), false)
    assert.equal(
      classifyWalletSendError(new WalletRequestError('PermissionDeniedError', 'User rejected')),
      'cancelled',
    )
    assert.equal(classifyWalletSendError(new Error('provider timeout')), 'failed')
    const confirmFn = app.slice(
      app.indexOf('async function confirmPayment'),
      app.indexOf('function retryVerification'),
    )
    assert.match(confirmFn, /canStartWalletSend/)
    assert.match(confirmFn, /sendInFlight = true/)
    assert.match(confirmFn, /classifyWalletSendError/)
    const retry = app.slice(
      app.indexOf('function returnToReview'),
      app.indexOf('async function issueProofIfVerified'),
    )
    assert.doesNotMatch(retry, /sendBasicNimPayment/)
    assert.match(outcome, /No automatic retry was made/)
    assert.match(outcome, /Your payment wasn’t sent/)
    assert.match(outcome, /emit\('back'\)/)
  })

  it('treats wallet success as submitted, never immediately verified', () => {
    const submitted = stateAfterWalletHash(intent())
    const view = toVerificationView(submitted)
    assert.equal(submitted.screen, 'submitted')
    assert.equal(view.title, 'Payment submitted')
    assert.equal(view.showVerifiedLabel, false)
    const confirmFn = app.slice(
      app.indexOf('async function confirmPayment'),
      app.indexOf('function retryVerification'),
    )
    assert.match(confirmFn, /stateAfterWalletHash/)
    assert.match(confirmFn, /screen\.value = 'verify'/)
    assert.doesNotMatch(confirmFn, /verifyPayment\(/)
    assert.doesNotMatch(confirmFn, /outcome === 'VERIFIED'/)
  })

  it('observes until 60 confirmations and keeps recovery available', async () => {
    assert.equal(MIN_CONFIRMATIONS, 60)
    assert.equal(isRetryableVerification(unresolved('INSUFFICIENT_CONFIRMATIONS')), true)
    assert.equal(isRetryableVerification(unresolved('NOT_FOUND')), true)
    const attempts = Number(app.match(/LIVE_MAX_OBSERVATION_ATTEMPTS = (\d+)/)?.[1])
    assert.ok(attempts >= 90)
    assert.equal(DEFAULT_OBSERVATION_DELAY_MS, 4_000)
    assert.match(verifying, /v-if="!view\.showVerifiedLabel"/)
    assert.match(verifying, /Back to send/)
    assert.match(verifying, /Check again/)

    let calls = 0
    const result = await observePaymentEvidence({
      intent: intent(),
      maxAttempts: 3,
      delayMs: 1,
      delay: async () => undefined,
      verification: {
        async verify() {
          calls += 1
          return unresolved('INSUFFICIENT_CONFIRMATIONS')
        },
      },
    })
    assert.equal(result.outcome, 'UNRESOLVED')
    assert.equal(result.reason, 'INSUFFICIENT_CONFIRMATIONS')
    assert.equal(calls, 3)
    assert.equal(toVerificationView({
      screen: 'complete',
      intent: intent(),
      result,
    }).canRetry, true)
  })

  it('does not verify a mismatched payment and rejects replay onto another intent', () => {
    const verified: VerificationResult = {
      ...unresolved('NOT_FOUND'),
      outcome: 'VERIFIED',
      reason: null,
      observedRecipient: VALID,
      observedAmountLuna: 100_000,
      confirmations: MIN_CONFIRMATIONS,
      observedKind: 'basic_transfer',
    }
    const store = createHashReservationStore()
    const first = rejectReplayedVerification(verified, 'pi_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', HASH, store)
    const second = rejectReplayedVerification(verified, 'pi_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', HASH, store)
    assert.equal(first.outcome, 'VERIFIED')
    assert.equal(second.outcome, 'MISMATCH')
    assert.equal(second.reason, 'REPLAYED_TRANSACTION')
  })

  it('posts only intentId and transactionHash to the verifier', () => {
    const parsed = parseVerifyRequest({
      intentId: 'pi_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      transactionHash: HASH,
      recipient: 'ignored',
      amountLuna: 1,
      network: 'NIMIQ_MAINNET',
      outcome: 'VERIFIED',
    })
    assert.equal(parsed.ok, true)
    if (parsed.ok) {
      assert.equal(parsed.intentId, 'pi_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
      assert.equal(parsed.transactionHash, HASH)
      assert.equal('recipient' in parsed, false)
    }
    assert.match(observe, /intentId: intent\.id/)
    assert.match(observe, /transactionHash/)
    assert.doesNotMatch(
      observe.slice(observe.indexOf('async verify(intent, transactionHash)'), observe.indexOf('return payload')),
      /amountLuna: intent\.amountLuna/,
    )
  })

  it('does not log wallet diagnostics in production', () => {
    const logBlock = nimiq.slice(
      nimiq.indexOf('const diagnostic: PaymentSendDiagnostic'),
      nimiq.indexOf('return diagnostic'),
    )
    assert.match(logBlock, /import\.meta\.env\?\.DEV/)
    assert.match(app, /showSendDiagnostic = import\.meta\.env\.DEV/)
    assert.match(app, /if \(import\.meta\.env\.DEV\)/)
  })

  it('keeps recovery actions from silently resending', () => {
    const backFn = app.slice(app.indexOf('function backToCreate'), app.indexOf('function returnToReview'))
    const retryFn = app.slice(app.indexOf('function retryVerification'), app.indexOf('function restart'))
    assert.doesNotMatch(backFn, /sendBasicNimPayment/)
    assert.doesNotMatch(retryFn, /sendBasicNimPayment/)
    assert.match(retryFn, /runObservation/)
    assert.match(wallet, /No automatic retry was made/)
  })
})

function hangingFetch(): typeof globalThis.fetch {
  return async (_input, init) => {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, 400)
      init?.signal?.addEventListener('abort', () => {
        clearTimeout(timer)
        reject(init.signal?.reason ?? new Error('aborted'))
      })
    })
    return new Response('{}')
  }
}

describe('bounded request waits', () => {
  it('aborts a hung request instead of leaving the UI frozen', async () => {
    const fetchFn = createTimedFetch(30, hangingFetch())
    await assert.rejects(() => fetchFn('http://provia.local/api/verify'))
  })

  it('maps a timed-out verify call to unresolved evidence, not VERIFIED', async () => {
    const service = createProviaApiVerificationService({
      fetch: createTimedFetch(30, hangingFetch()),
    })
    const result = await service.verify(intent(), HASH)
    assert.equal(result.outcome, 'UNRESOLVED')
    assert.notEqual(result.outcome, 'VERIFIED')
  })
})
