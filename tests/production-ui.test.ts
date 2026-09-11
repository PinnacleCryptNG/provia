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
  'src/components/WalletSendOutcome.vue',
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
  'src/components/WalletSendOutcome.vue',
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

  it('prevents duplicate Confirm in Nimiq Pay submissions', () => {
    const app = read('src/App.vue')
    const review = read('src/components/ReviewPayment.vue')
    assert.match(review, /Opening Nimiq Pay/)
    assert.match(review, /:disabled="isSubmitting"/)
    assert.match(review, /if \(props\.isSubmitting\)/)
    assert.match(app, /canStartWalletSend/)
    assert.match(app, /sendInFlight = true/)
  })

  it('keeps Connect Wallet optional and does not connect on launch', () => {
    const app = read('src/App.vue')
    const mounted = app.slice(app.indexOf('onMounted(async'), app.indexOf('async function checkPaymentDetails'))
    assert.doesNotMatch(mounted, /connectWallet|bindProvider/)
    assert.match(app, /@connect="connectWallet"/)
    assert.match(app, /isConnectingWallet = ref\(false\)/)
  })

  it('routes wallet cancellation and failure to recoverable states without resending', () => {
    const app = read('src/App.vue')
    const outcome = read('src/components/WalletSendOutcome.vue')
    const retry = app.slice(app.indexOf('function returnToReview'), app.indexOf('async function issueProofIfVerified'))
    assert.match(outcome, /Payment cancelled/)
    assert.match(outcome, /Your payment wasn’t sent/)
    assert.match(outcome, /Payment couldn’t be sent/)
    assert.match(outcome, /No automatic retry was made/)
    assert.match(outcome, /Try again/)
    assert.doesNotMatch(retry, /sendBasicNimPayment/)
    assert.match(app, /classifyWalletSendError/)
    assert.match(app, /@retry="returnToReview"/)
  })

  it('treats a successful wallet hash as submitted, then observes independently', () => {
    const app = read('src/App.vue')
    const confirmFn = app.slice(
      app.indexOf('async function confirmPayment'),
      app.indexOf('function retryVerification'),
    )
    assert.match(confirmFn, /sendBasicNimPayment/)
    assert.match(confirmFn, /withSubmittedHash/)
    assert.match(confirmFn, /stateAfterWalletHash/)
    assert.match(confirmFn, /screen\.value = 'verify'/)
    assert.match(confirmFn, /runObservation/)
    assert.doesNotMatch(confirmFn, /verifyPayment\(/)
    assert.doesNotMatch(confirmFn, /Payment verified/)
  })

  it('starts a fresh send from a verified record without reusing the intent', () => {
    const app = read('src/App.vue')
    const receipt = read('src/components/ProofReceipt.vue')
    const verifying = read('src/components/VerificationPayment.vue')
    const restart = app.slice(app.indexOf('function restart'), app.indexOf('</script>'))
    assert.match(receipt, /Send another asset/)
    assert.match(verifying, /Send another asset/)
    assert.match(verifying, /Back to send/)
    assert.match(restart, /intent\.value = null/)
    assert.match(restart, /screen\.value = 'create'/)
    assert.match(restart, /createFormKey\.value \+= 1/)
    assert.doesNotMatch(restart, /sendBasicNimPayment/)
  })
})
