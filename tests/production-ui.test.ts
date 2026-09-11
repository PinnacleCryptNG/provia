import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const PRODUCTION_UI_FILES = [
  'src/App.vue',
  'src/components/AppHeader.vue',
  'src/components/HomeLanding.vue',
  'src/components/CreatePayment.vue',
  'src/components/PaymentDetailsChecked.vue',
  'src/components/ReviewPayment.vue',
  'src/components/VerificationPayment.vue',
  'src/components/ProofReceipt.vue',
  'src/components/JourneySteps.vue',
  'src/lib/verification-view.ts',
]

const FORBIDDEN_PRODUCTION_COPY = [
  'Phase 6B',
  'Temporary Testnet',
  'sendBasicTransactionWithData',
  'Data supplied',
  'Returned value',
  'verifier unchanged',
  'will not accept this payment',
  'HTLC',
  'fromType',
  'recipientData',
  'shared liquidity',
]

const PRIMARY_FLOW_FILES = [
  'src/App.vue',
  'src/components/HomeLanding.vue',
  'src/components/CreatePayment.vue',
  'src/components/PaymentDetailsChecked.vue',
  'src/components/ReviewPayment.vue',
  'src/components/VerificationPayment.vue',
  'src/components/ProofReceipt.vue',
]

function read(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

describe('production UI copy', () => {
  for (const relativePath of PRODUCTION_UI_FILES) {
    it(`keeps ${relativePath} free of development-only language`, () => {
      const source = read(relativePath)
      for (const phrase of FORBIDDEN_PRODUCTION_COPY) {
        assert.doesNotMatch(
          source,
          new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
          `${relativePath} still contains ${phrase}`,
        )
      }
    })
  }

  it('keeps purpose as an optional dropdown in Send an asset', () => {
    const source = read('src/components/CreatePayment.vue')
    const purposes = read('src/lib/purpose.ts')
    assert.match(source, /<select v-model="purpose"/)
    assert.match(source, /Select a purpose/)
    assert.match(source, /PAYMENT_PURPOSES/)
    assert.match(source, /Nimiq Testnet/)
    assert.match(purposes, /Invoice/)
    assert.match(purposes, /Gift/)
    assert.match(purposes, /Utilities/)
    assert.match(purposes, /Friends & Family/)
    assert.doesNotMatch(source, /type="text"\s+name="purpose"/)
  })

  it('keeps the homepage to a Send an asset prompt', () => {
    const source = read('src/components/HomeLanding.vue')
    assert.match(source, /Send an asset with confidence/)
    assert.match(source, /Send through Nimiq Pay and let PROVIA independently verify the payment on-chain/)
    assert.match(source, />[\s]*Send an asset[\s]*</)
    assert.doesNotMatch(source, /Request a payment/)
    assert.doesNotMatch(source, /60 confirmations/)
    assert.doesNotMatch(source, /intent/i)
  })

  it('gates the send diagnostic panel behind development mode', () => {
    const appSource = read('src/App.vue')
    assert.match(appSource, /showSendDiagnostic = import\.meta\.env\.DEV/)
    assert.match(appSource, /showSendDiagnostic && SendDiagnostic && sendDiagnostic/)
    assert.match(appSource, /defineAsyncComponent/)
    assert.match(appSource, /components\/SendDiagnostic\.vue/)
  })
})

describe('send-an-asset primary flow', () => {
  it('shows Send an asset as the homepage primary action', () => {
    const home = read('src/components/HomeLanding.vue')
    assert.match(home, /Send an asset/)
    assert.doesNotMatch(home, /Request a payment/)
  })

  it('removes Request a payment wording from the primary flow', () => {
    for (const relativePath of PRIMARY_FLOW_FILES) {
      assert.doesNotMatch(
        read(relativePath),
        /Request a payment|Request another payment/,
        `${relativePath} still asks the user to request a payment`,
      )
    }
  })

  it('keeps purpose as a dropdown with four options', () => {
    const create = read('src/components/CreatePayment.vue')
    const purposes = read('src/lib/purpose.ts')
    assert.match(create, /<select v-model="purpose"/)
    assert.equal(
      ['Invoice', 'Gift', 'Utilities', 'Friends & Family'].every((option) => purposes.includes(`'${option}'`)),
      true,
    )
  })

  it('creates a server-owned intent before review and wallet approval', () => {
    const app = read('src/App.vue')
    const checkFn = app.slice(
      app.indexOf('async function checkPaymentDetails'),
      app.indexOf('function goToReview'),
    )
    const confirmFn = app.slice(
      app.indexOf('async function confirmPayment'),
      app.indexOf('function retryVerification'),
    )

    assert.match(checkFn, /validatePaymentDraft/)
    assert.match(checkFn, /createServerIntent/)
    assert.match(checkFn, /screen\.value = 'checked'/)
    assert.doesNotMatch(checkFn, /sendBasicNimPayment/)
    assert.doesNotMatch(checkFn, /screen\.value = 'review'/)
    assert.match(confirmFn, /sendBasicNimPayment/)
  })

  it('shows Payment details checked before Review', () => {
    const app = read('src/App.vue')
    const checked = read('src/components/PaymentDetailsChecked.vue')
    assert.match(app, /PaymentDetailsChecked/)
    assert.match(app, /screen === 'checked' && intent/)
    assert.match(checked, /Payment details checked/)
    assert.match(checked, /Everything looks good\. Your payment is ready to send\./)
    assert.match(checked, /Review payment/)
    assert.doesNotMatch(checked, /Payment verified/)
    assert.doesNotMatch(checked, /intent\.id/)
  })

  it('keeps Review on the locked intent and Confirm in Nimiq Pay as the send action', () => {
    const review = read('src/components/ReviewPayment.vue')
    assert.match(review, /Review your payment/)
    assert.match(review, /intent\.amountNim/)
    assert.match(review, /shortenNimiqAddress\(intent\.recipient\)/)
    assert.match(review, /nimiqNetworkLabel\(intent\.network\)/)
    assert.match(review, /Confirm in Nimiq Pay/)
    assert.match(review, /emit\('confirm'\)/)
  })

  it('does not send from the details-checked screen', () => {
    const checked = read('src/components/PaymentDetailsChecked.vue')
    const app = read('src/App.vue')
    assert.doesNotMatch(checked, /sendBasicNimPayment|Confirm in Nimiq Pay/)
    assert.match(app, /@review="goToReview"/)
    assert.match(app, /@confirm="confirmPayment"/)
  })
})
