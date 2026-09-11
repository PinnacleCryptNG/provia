<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref } from 'vue'
import type { NimiqProvider } from '@nimiq/mini-app-sdk'
import AppHeader from './components/AppHeader.vue'
import CreatePayment from './components/CreatePayment.vue'
import HomeLanding from './components/HomeLanding.vue'
import JourneySteps from './components/JourneySteps.vue'
import PaymentDetailsChecked from './components/PaymentDetailsChecked.vue'
import ProofReceipt from './components/ProofReceipt.vue'
import ReviewPayment from './components/ReviewPayment.vue'
import VerificationPayment from './components/VerificationPayment.vue'
import WalletSendOutcome from './components/WalletSendOutcome.vue'
import { shortenNimiqAddress } from './lib/address'
import { isIntentId, isProofId } from './lib/ids'
import {
  validatePaymentDraft,
  withFailedStatus,
  withRejectedStatus,
  withSubmittedHash,
  type FieldErrors,
  type PaymentDraft,
  type PaymentIntent,
} from './lib/intent'
import {
  initializeNimiqProvider,
  listNimiqAccounts,
  sendBasicNimPayment,
  toProviderConnectionError,
  type PaymentSendDiagnostic,
} from './lib/nimiq'
import {
  canStartWalletSend,
  classifyWalletSendError,
  isWalletHashLocator,
} from './lib/wallet-send'
import {
  createProviaApiVerificationService,
  createServerIntent,
  createServerProof,
  fetchServerProof,
  paymentIntentFromServer,
  type ProofRecord,
} from './lib/observation-service'
import { parseNimToLuna, lunaToSafeNumber } from './lib/amount'
import {
  DEFAULT_OBSERVATION_DELAY_MS,
  observePaymentEvidence,
  stateAfterWalletHash,
  type VerificationFlowState,
} from './lib/verification-flow'

type Screen = 'home' | 'create' | 'checked' | 'review' | 'verify'
type JourneyStep = 'create' | 'checked' | 'review' | 'observing' | 'verdict'

const SUBMITTED_DWELL_MS = 1_200
const LIVE_MAX_OBSERVATION_ATTEMPTS = 18

const isConnectingWallet = ref(false)
const isProviderReady = ref(false)
const initError = ref<string | null>(null)
const accountLabel = ref<string | null>(null)
const formErrors = ref<FieldErrors>({})
const createError = ref<string | null>(null)
const submitError = ref<string | null>(null)
const isCreatingIntent = ref(false)
const isSubmitting = ref(false)
const walletOutcome = ref<'cancelled' | 'failed' | null>(null)
const screen = ref<Screen>('home')
const intent = ref<PaymentIntent | null>(null)
const flowState = ref<VerificationFlowState | null>(null)
const proof = ref<ProofRecord | null>(null)
const proofError = ref<string | null>(null)
const sharedProofMissing = ref(false)
const createFormKey = ref(0)
const sendDiagnostic = ref<PaymentSendDiagnostic | null>(null)
const showSendDiagnostic = import.meta.env.DEV
const SendDiagnostic = import.meta.env.DEV
  ? defineAsyncComponent(() => import('./components/SendDiagnostic.vue'))
  : null

let provider: NimiqProvider | null = null
let observationRun = 0
let sendInFlight = false
const verificationService = createProviaApiVerificationService()

const showPaymentFlow = computed(() => {
  return !proof.value && !sharedProofMissing.value
})

const journeyStep = computed<JourneyStep>(() => {
  if (proof.value) {
    return 'verdict'
  }
  if (screen.value === 'checked') {
    return 'checked'
  }
  if (screen.value === 'review') {
    return 'review'
  }
  if (screen.value === 'verify' && flowState.value) {
    if (flowState.value.screen === 'submitted' || flowState.value.screen === 'checking') {
      return 'observing'
    }
    if (flowState.value.result.reason === 'INSUFFICIENT_CONFIRMATIONS') {
      return 'observing'
    }
    return 'verdict'
  }
  return 'create'
})

function proofIdFromLocation(): string | null {
  const value = new URLSearchParams(window.location.search).get('proof')
  return value && isProofId(value) ? value : null
}

function clearProofQuery() {
  const url = new URL(window.location.href)
  url.searchParams.delete('proof')
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}

async function bindProvider() {
  provider = await initializeNimiqProvider()
  isProviderReady.value = true
  try {
    const accounts = await listNimiqAccounts(provider)
    accountLabel.value = accounts[0] ? shortenNimiqAddress(accounts[0]) : 'Connected'
  }
  catch {
    accountLabel.value = 'Connected'
  }
}

async function connectWallet() {
  isConnectingWallet.value = true
  initError.value = null

  try {
    await bindProvider()
  }
  catch (error) {
    provider = null
    isProviderReady.value = false
    accountLabel.value = null
    initError.value = toProviderConnectionError(error)
  }
  finally {
    isConnectingWallet.value = false
  }
}

onMounted(async () => {
  const sharedProofId = proofIdFromLocation()
  if (sharedProofId) {
    try {
      proof.value = await fetchServerProof(sharedProofId)
      if (!proof.value) {
        sharedProofMissing.value = true
        proofError.value = 'This verification record is no longer available. PROVIA only keeps records for this session.'
      }
    }
    catch {
      sharedProofMissing.value = true
      proofError.value = 'PROVIA could not load this verification record.'
    }
  }
})

async function checkPaymentDetails(draft: PaymentDraft) {
  submitError.value = null
  createError.value = null
  const errors = validatePaymentDraft(draft)
  if (errors.recipient || errors.amount) {
    formErrors.value = errors
    return
  }

  const parsedAmount = parseNimToLuna(draft.amount)
  if (!parsedAmount.ok) {
    formErrors.value = { amount: parsedAmount.message }
    return
  }

  formErrors.value = {}
  isCreatingIntent.value = true

  try {
    const created = await createServerIntent({
      recipient: draft.recipient,
      amountLuna: lunaToSafeNumber(parsedAmount.luna),
    })
    const purpose = draft.purpose.trim()
    intent.value = paymentIntentFromServer(created, {
      purpose: purpose.length > 0 ? purpose : null,
    })
    screen.value = 'checked'
  }
  catch (error) {
    createError.value = error instanceof Error
      ? error.message
      : 'PROVIA could not check these payment details. Try again.'
  }
  finally {
    isCreatingIntent.value = false
  }
}

function goToReview() {
  submitError.value = null
  walletOutcome.value = null
  screen.value = 'review'
}

function backToCreate() {
  submitError.value = null
  isSubmitting.value = false
  walletOutcome.value = null
  screen.value = 'create'
}

function returnToReview() {
  submitError.value = null
  isSubmitting.value = false
  walletOutcome.value = null
  screen.value = 'review'
}

async function issueProofIfVerified() {
  const current = intent.value
  if (!current?.transactionHash || !isIntentId(current.id)) {
    return
  }

  if (flowState.value?.screen !== 'complete' || flowState.value.result.outcome !== 'VERIFIED') {
    return
  }

  try {
    proof.value = await createServerProof(current.id, current.transactionHash)
    proofError.value = null
  }
  catch (error) {
    proofError.value = error instanceof Error
      ? error.message
      : 'PROVIA could not create a verification record.'
  }
}

async function runObservation() {
  const current = intent.value
  if (!current?.transactionHash || !isIntentId(current.id)) {
    return
  }

  const runId = ++observationRun
  await observePaymentEvidence({
    intent: current,
    verification: verificationService,
    maxAttempts: LIVE_MAX_OBSERVATION_ATTEMPTS,
    delayMs: DEFAULT_OBSERVATION_DELAY_MS,
    onState(state) {
      if (runId !== observationRun) {
        return
      }
      flowState.value = state
    },
  })

  if (runId === observationRun) {
    await issueProofIfVerified()
  }
}

async function confirmPayment() {
  const current = intent.value
  if (!current || !isIntentId(current.id)) {
    walletOutcome.value = 'failed'
    return
  }

  if (!canStartWalletSend({
    inFlight: sendInFlight,
    hasSubmittedHash: Boolean(current.transactionHash),
  })) {
    if (current.transactionHash && !sendInFlight) {
      flowState.value = stateAfterWalletHash(current)
      screen.value = 'verify'
      void runObservation()
    }
    return
  }

  sendInFlight = true
  isSubmitting.value = true
  submitError.value = null
  walletOutcome.value = null

  try {
    if (!provider) {
      try {
        await bindProvider()
      }
      catch (error) {
        if (import.meta.env.DEV) {
          console.info('[PROVIA send error]', error)
        }
        walletOutcome.value = 'failed'
        return
      }
    }

    if (!provider) {
      walletOutcome.value = 'failed'
      return
    }

    const diagnostic = await sendBasicNimPayment(provider, {
      recipient: current.recipient,
      valueLuna: current.amountLuna,
      intentId: current.id,
    })

    if (!isWalletHashLocator(diagnostic.transactionHash)) {
      walletOutcome.value = 'failed'
      return
    }

    sendDiagnostic.value = diagnostic
    const submitted = withSubmittedHash(current, diagnostic.transactionHash)
    intent.value = submitted
    flowState.value = stateAfterWalletHash(submitted)
    screen.value = 'verify'
    const runId = observationRun
    window.setTimeout(() => {
      if (runId === observationRun && submitted.transactionHash) {
        void runObservation()
      }
    }, SUBMITTED_DWELL_MS)
  }
  catch (error) {
    if (import.meta.env.DEV) {
      console.info('[PROVIA send error]', error)
    }
    const outcome = classifyWalletSendError(error)
    intent.value = outcome === 'cancelled'
      ? withRejectedStatus(current)
      : withFailedStatus(current)
    walletOutcome.value = outcome
  }
  finally {
    sendInFlight = false
    isSubmitting.value = false
  }
}

function retryVerification() {
  if (sendInFlight || isSubmitting.value) {
    return
  }

  void runObservation()
}

function restart() {
  sendInFlight = false
  observationRun += 1
  formErrors.value = {}
  createError.value = null
  submitError.value = null
  proofError.value = null
  sharedProofMissing.value = false
  walletOutcome.value = null
  isSubmitting.value = false
  intent.value = null
  flowState.value = null
  proof.value = null
  createFormKey.value += 1
  sendDiagnostic.value = null
  screen.value = 'create'
  clearProofQuery()
}
</script>

<template>
  <main class="app">
    <AppHeader
      :is-connecting="isConnectingWallet"
      :is-connected="isProviderReady"
      :account-label="accountLabel"
      @connect="connectWallet"
    />

    <ProofReceipt
      v-if="proof"
      :proof="proof"
      @restart="restart"
    />

    <section v-else-if="sharedProofMissing" class="panel" aria-live="polite">
      <h2>Record not available</h2>
      <p class="error">{{ proofError }}</p>
      <p>Verification records are kept for this session only.</p>
      <button type="button" class="primary" @click="restart">Send an asset</button>
    </section>

    <template v-if="showPaymentFlow">
      <JourneySteps
        v-if="screen === 'checked' || screen === 'review' || screen === 'verify'"
        :current="journeyStep"
      />

      <HomeLanding
        v-if="screen === 'home'"
        @start="screen = 'create'"
      />
      <CreatePayment
        :key="createFormKey"
        v-show="screen === 'create'"
        :errors="formErrors"
        :is-creating="isCreatingIntent"
        :server-error="createError"
        @review="checkPaymentDetails"
      />
      <PaymentDetailsChecked
        v-if="screen === 'checked' && intent"
        :intent="intent"
        @back="backToCreate"
        @review="goToReview"
      />
      <ReviewPayment
        v-if="screen === 'review' && intent && !walletOutcome"
        :intent="intent"
        :is-submitting="isSubmitting"
        :error-message="submitError"
        @back="backToCreate"
        @confirm="confirmPayment"
      />
      <WalletSendOutcome
        v-if="screen === 'review' && intent && walletOutcome"
        :kind="walletOutcome"
        @retry="returnToReview"
        @back="backToCreate"
      />
      <VerificationPayment
        v-if="screen === 'verify' && flowState && !proof"
        :state="flowState"
        @retry="retryVerification"
        @restart="restart"
      />
      <component
        :is="SendDiagnostic"
        v-if="showSendDiagnostic && SendDiagnostic && sendDiagnostic && (screen === 'review' || screen === 'verify')"
        :diagnostic="sendDiagnostic"
      />
      <p v-if="proofError && screen === 'verify'" class="error">{{ proofError }}</p>
    </template>
  </main>
</template>

<style scoped>
.app {
  max-width: 26.5rem;
  width: 100%;
  margin: 0 auto;
  padding: 1.1rem 1rem calc(1.6rem + env(safe-area-inset-bottom, 0px));
  overflow-wrap: anywhere;
}

.error {
  color: var(--danger);
}

h2 {
  margin: 0 0 0.5rem;
  font-size: 1.2rem;
  font-weight: 700;
}
</style>
