<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref } from 'vue'
import type { NimiqProvider } from '@nimiq/mini-app-sdk'
import AppHeader from './components/AppHeader.vue'
import CreatePayment from './components/CreatePayment.vue'
import HomeLanding from './components/HomeLanding.vue'
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
  isUserRejection,
  listNimiqAccounts,
  sendBasicNimPayment,
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
  CONNECT_WALLET_USER_ERROR,
  toCreatePaymentUserError,
  toProofUserError,
} from './lib/user-errors'
import {
  DEFAULT_OBSERVATION_DELAY_MS,
  observePaymentEvidence,
  stateAfterWalletHash,
  type VerificationFlowState,
} from './lib/verification-flow'

type Screen = 'home' | 'create' | 'review' | 'verify'

const SUBMITTED_DWELL_MS = 1_200
const LIVE_MAX_OBSERVATION_ATTEMPTS = 180

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
let createInFlight = false
const verificationService = createProviaApiVerificationService()

const showPaymentFlow = computed(() => {
  return !proof.value && !sharedProofMissing.value
})

const showConnectError = computed(() => {
  return Boolean(initError.value) && !isProviderReady.value && !isConnectingWallet.value
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

let connectInFlight: Promise<boolean> | null = null

async function connectWallet(): Promise<boolean> {
  if (isProviderReady.value) {
    return true
  }
  if (connectInFlight) {
    return connectInFlight
  }

  connectInFlight = (async () => {
    isConnectingWallet.value = true
    initError.value = null

    try {
      await bindProvider()
      return true
    }
    catch (error) {
      provider = null
      isProviderReady.value = false
      accountLabel.value = null
      if (!isUserRejection(error)) {
        initError.value = CONNECT_WALLET_USER_ERROR
      }
      return false
    }
    finally {
      isConnectingWallet.value = false
    }
  })()

  try {
    return await connectInFlight
  }
  finally {
    connectInFlight = null
  }
}

async function startSendFlow() {
  if (isProviderReady.value) {
    screen.value = 'create'
    return
  }

  const connected = await connectWallet()
  if (connected) {
    screen.value = 'create'
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
  if (createInFlight) {
    return
  }

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
  createInFlight = true
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
    screen.value = 'review'
  }
  catch (error) {
    createError.value = toCreatePaymentUserError(error)
  }
  finally {
    createInFlight = false
    isCreatingIntent.value = false
  }
}

function backToCreate() {
  sendInFlight = false
  createInFlight = false
  observationRun += 1
  submitError.value = null
  createError.value = null
  isSubmitting.value = false
  isCreatingIntent.value = false
  walletOutcome.value = null
  intent.value = null
  flowState.value = null
  proofError.value = null
  sendDiagnostic.value = null
  screen.value = 'create'
}

function backToSend() {
  backToCreate()
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
    proofError.value = toProofUserError(error)
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
  createInFlight = false
  observationRun += 1
  formErrors.value = {}
  createError.value = null
  submitError.value = null
  proofError.value = null
  sharedProofMissing.value = false
  walletOutcome.value = null
  isSubmitting.value = false
  isCreatingIntent.value = false
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
  <main
    class="app"
    :class="{ 'is-home': showPaymentFlow && screen === 'home' }"
  >
    <AppHeader
      :is-connecting="isConnectingWallet"
      :is-connected="isProviderReady"
      :account-label="accountLabel"
      @connect="connectWallet"
    />

    <p v-if="showConnectError" class="connect-error" role="alert">
      Couldn’t connect to Nimiq Pay.
      <button type="button" class="try-again" @click="connectWallet">Try again</button>
    </p>

    <ProofReceipt
      v-if="proof"
      :proof="proof"
      @restart="restart"
    />

    <section v-else-if="sharedProofMissing" class="panel" aria-live="polite">
      <h2>Record not available</h2>
      <p class="error">{{ proofError }}</p>
      <p>Verification records are kept for this session only.</p>
      <button type="button" class="primary" @click="restart">Send NIM</button>
    </section>

    <template v-if="showPaymentFlow">
      <HomeLanding
        v-if="screen === 'home'"
        :is-connecting="isConnectingWallet"
        @start="startSendFlow"
      />
      <CreatePayment
        :key="createFormKey"
        v-show="screen === 'create'"
        :errors="formErrors"
        :is-creating="isCreatingIntent"
        :server-error="createError"
        @review="checkPaymentDetails"
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
        @back="backToSend"
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
  padding:
    1.1rem
    max(1rem, env(safe-area-inset-right, 0px))
    calc(1.6rem + env(safe-area-inset-bottom, 0px))
    max(1rem, env(safe-area-inset-left, 0px));
  overflow-wrap: anywhere;
}

.app.is-home {
  max-width: none;
  padding:
    0.15rem
    0
    calc(1.4rem + env(safe-area-inset-bottom, 0px));
}

.app.is-home :deep(header.top) {
  width: 100%;
  box-sizing: border-box;
  max-width: 72rem;
  margin: 0 auto;
  padding:
    0.85rem
    max(1.1rem, env(safe-area-inset-right, 0px))
    0.65rem
    max(1.1rem, env(safe-area-inset-left, 0px));
}

.app.is-home .connect-error {
  width: min(72rem, calc(100% - 2.2rem));
  margin-inline: auto;
}

.error,
.connect-error {
  color: var(--danger);
}

.connect-error {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem 0.75rem;
  margin: 0 0 1rem;
  padding: 0.7rem 0.85rem;
  border-radius: 0.9rem;
  background: rgb(208 75 75 / 8%);
  font-size: 0.92rem;
  font-weight: 600;
}

.try-again {
  width: auto;
  min-height: 32px;
  margin: 0;
  border: none;
  padding: 0;
  background: transparent;
  color: var(--primary);
  font-size: 0.92rem;
  font-weight: 700;
  cursor: pointer;
}

h2 {
  margin: 0 0 0.5rem;
  font-size: 1.2rem;
  font-weight: 700;
}
</style>
