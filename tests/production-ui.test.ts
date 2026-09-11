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
    assert.match(source, /Independent payment verification/)
    assert.match(source, /Send NIM in Nimiq Pay/)
    assert.match(source, /Nimiq Testnet/)
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
    assert.match(review, /60 confirmations/)
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

  it('locks Continue while payment details are being checked', () => {
    const app = read('src/App.vue')
    const create = read('src/components/CreatePayment.vue')
    const checkFn = app.slice(
      app.indexOf('async function checkPaymentDetails'),
      app.indexOf('function goToReview'),
    )
    assert.match(checkFn, /if \(createInFlight\)/)
    assert.match(checkFn, /createInFlight = true/)
    assert.match(create, /Checking payment details/)
    assert.match(create, /:disabled="isCreating"/)
    assert.match(create, /if \(props\.isCreating\)/)
  })

  it('clears submitted payment state when returning to Send', () => {
    const app = read('src/App.vue')
    const backFn = app.slice(
      app.indexOf('function backToCreate'),
      app.indexOf('function returnToReview'),
    )
    assert.match(backFn, /intent\.value = null/)
    assert.match(backFn, /flowState\.value = null/)
    assert.match(backFn, /sendDiagnostic\.value = null/)
    assert.match(backFn, /screen\.value = 'create'/)
    assert.doesNotMatch(backFn, /sendBasicNimPayment/)
    assert.doesNotMatch(backFn, /createServerIntent/)
    assert.doesNotMatch(backFn, /createFormKey/)
  })

  it('keeps observing until 60 confirmations and offers Back to send if polling stops', () => {
    const app = read('src/App.vue')
    const verifying = read('src/components/VerificationPayment.vue')
    const attempts = Number(app.match(/LIVE_MAX_OBSERVATION_ATTEMPTS = (\d+)/)?.[1])
    assert.equal(Number.isFinite(attempts), true)
    assert.ok(attempts >= 90, `live observation attempts should cover 60 confirmations, got ${attempts}`)
    assert.match(app, /delayMs: DEFAULT_OBSERVATION_DELAY_MS/)
    assert.match(verifying, /Checking the Nimiq blockchain/)
    assert.match(verifying, /PROVIA checks the payment after 60 Nimiq confirmations/)
    assert.match(verifying, /view\.canRetry/)
    assert.match(verifying, /Check again/)
    assert.match(verifying, /Back to send/)
    assert.match(app, /@back="backToSend"/)
    assert.doesNotMatch(verifying, /finality|cryptographic proof|certificate|trustless/i)
  })

  it('does not render the five journey dots in the live flow', () => {
    const app = read('src/App.vue')
    assert.doesNotMatch(app, /JourneySteps/)
  })

  it('presents NIM as information, not a selectable asset control', () => {
    const create = read('src/components/CreatePayment.vue')
    assert.match(create, /Asset/)
    assert.match(create, />NIM</)
    assert.doesNotMatch(create, /<select[^>]*id="asset"/)
    assert.doesNotMatch(create, /<select[^>]*name="asset"/)
  })

  it('surfaces a human connect-wallet error without SDK internals', () => {
    const app = read('src/App.vue')
    assert.match(app, /Couldn’t connect to Nimiq Pay/)
    assert.match(app, /Try again/)
    assert.match(app, /CONNECT_WALLET_USER_ERROR/)
    assert.doesNotMatch(app, /toProviderConnectionError/)
  })

  it('sanitizes create and receipt errors before showing them', () => {
    const app = read('src/App.vue')
    assert.match(app, /toCreatePaymentUserError/)
    assert.match(app, /toProofUserError/)
    assert.doesNotMatch(app, /createError\.value = error instanceof Error/)
  })

  it('makes Copy verification record the primary verified-receipt action', () => {
    const receipt = read('src/components/ProofReceipt.vue')
    const copyIndex = receipt.indexOf('Copy verification record')
    const sendIndex = receipt.indexOf('Send another asset')
    assert.ok(copyIndex > 0)
    assert.ok(sendIndex > copyIndex)
    assert.match(receipt, /class="primary"[^>]*>[\s\S]*Copy verification record/)
    assert.match(receipt, /observation record, not a cryptographic certificate/)
  })

  it('keeps the send diagnostic log behind development mode', () => {
    const nimiq = read('src/lib/nimiq.ts')
    const logBlock = nimiq.slice(
      nimiq.indexOf('const diagnostic: PaymentSendDiagnostic'),
      nimiq.indexOf('return diagnostic'),
    )
    assert.match(logBlock, /import\.meta\.env\?\.DEV/)
    assert.match(logBlock, /console\.info\('\[PROVIA send\]'/)
  })

  it('enables mobile safe-area viewport fitting', () => {
    const html = read('index.html')
    assert.match(html, /viewport-fit=cover/)
  })
})
