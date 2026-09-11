<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { NimiqProvider } from '@nimiq/mini-app-sdk'
import CreatePayment from './components/CreatePayment.vue'
import JourneySteps from './components/JourneySteps.vue'
import ProofReceipt from './components/ProofReceipt.vue'
import ReviewPayment from './components/ReviewPayment.vue'
import VerificationPayment from './components/VerificationPayment.vue'
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
  PHASE_6B_SEND_METHOD,
  proviaIntentPaymentData,
  sendBasicNimPayment,
  toProviderConnectionError,
  toUserFacingError,
  type Phase6bSendDiagnostic,
} from './lib/nimiq'
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

type Screen = 'create' | 'review' | 'verify'
type JourneyStep = 'create' | 'review' | 'submitted' | 'observing' | 'verdict'

const SUBMITTED_DWELL_MS = 1_200
const LIVE_MAX_OBSERVATION_ATTEMPTS = 18

const isInitializing = ref(true)
const isProviderReady = ref(false)
const initError = ref<string | null>(null)
const formErrors = ref<FieldErrors>({})
const createError = ref<string | null>(null)
const submitError = ref<string | null>(null)
const isCreatingIntent = ref(false)
const isSubmitting = ref(false)
const screen = ref<Screen>('create')
const intent = ref<PaymentIntent | null>(null)
const flowState = ref<VerificationFlowState | null>(null)
const proof = ref<ProofRecord | null>(null)
const proofError = ref<string | null>(null)
const sharedProofMissing = ref(false)
const createFormKey = ref(0)
const sendDiagnostic = ref<Phase6bSendDiagnostic | null>(null)

const phase6bPreviewData = computed(() => {
  return intent.value && isIntentId(intent.value.id)
    ? proviaIntentPaymentData(intent.value.id)
    : null
})

let provider: NimiqProvider | null = null
let observationRun = 0
const verificationService = createProviaApiVerificationService()

const showPaymentFlow = computed(() => {
  return !isInitializing.value && !proof.value && !sharedProofMissing.value
})

const journeyStep = computed<JourneyStep>(() => {
  if (proof.value) {
    return 'verdict'
  }
  if (screen.value === 'review') {
    return 'review'
  }
  if (screen.value === 'verify' && flowState.value) {
    if (flowState.value.screen === 'submitted') {
      return 'submitted'
    }
    if (flowState.value.screen === 'checking') {
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

  try {
    provider = await initializeNimiqProvider()
    isProviderReady.value = true
  }
  catch (error) {
    initError.value = toProviderConnectionError(error)
  }
  finally {
    isInitializing.value = false
  }
})

async function reviewPayment(draft: PaymentDraft) {
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
    screen.value = 'review'
  }
  catch (error) {
    createError.value = error instanceof Error
      ? error.message
      : 'PROVIA could not create the payment request. Try again.'
  }
  finally {
    isCreatingIntent.value = false
  }
}

function backToCreate() {
  submitError.value = null
  isSubmitting.value = false
  screen.value = 'create'
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
  if (!intent.value || !isIntentId(intent.value.id)) {
    submitError.value = 'This payment has no server-owned request ID.'
    return
  }

  if (!provider) {
    submitError.value = 'Open this Mini App inside Nimiq Pay to submit the payment.'
    return
  }

  submitError.value = null
  isSubmitting.value = true

  try {
    const diagnostic = await sendBasicNimPayment(provider, {
      recipient: intent.value.recipient,
      valueLuna: intent.value.amountLuna,
      intentId: intent.value.id,
    })
    sendDiagnostic.value = diagnostic
    const submitted = withSubmittedHash(intent.value, diagnostic.transactionHash)
    intent.value = submitted
    flowState.value = stateAfterWalletHash(submitted)
    screen.value = 'verify'
    const runId = observationRun
    window.setTimeout(() => {
      if (runId === observationRun) {
        void runObservation()
      }
    }, SUBMITTED_DWELL_MS)
  }
  catch (error) {
    intent.value = isUserRejection(error)
      ? withRejectedStatus(intent.value)
      : withFailedStatus(intent.value)
    submitError.value = toUserFacingError(error)
  }
  finally {
    isSubmitting.value = false
  }
}

function retryVerification() {
  void runObservation()
}

function restart() {
  observationRun += 1
  formErrors.value = {}
  createError.value = null
  submitError.value = null
  proofError.value = null
  sharedProofMissing.value = false
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
    <header>
      <div class="brand">
        <span class="mark" aria-hidden="true" />
        <div>
          <h1>PROVIA</h1>
          <p class="tagline">Independent payment verification</p>
        </div>
      </div>
      <p v-if="showPaymentFlow && screen === 'create'" class="lede">
        A successful wallet submission is not proof of payment. PROVIA checks the Nimiq blockchain independently.
      </p>
      <p v-if="isProviderReady && showPaymentFlow" class="connected">Nimiq Pay connected</p>
    </header>

    <section
      v-if="isInitializing && !proof && !sharedProofMissing"
      class="panel connecting"
      role="status"
    >
      <p class="checking">
        <span class="pulse" aria-hidden="true" />
        Connecting to Nimiq Pay
      </p>
      <p>Nimiq Pay is required to securely submit the payment. PROVIA will not treat a wallet confirmation as verification.</p>
    </section>

    <ProofReceipt
      v-if="proof"
      :proof="proof"
      @restart="restart"
    />

    <section v-else-if="sharedProofMissing" class="panel" aria-live="polite">
      <h2>Record not available</h2>
      <p class="error">{{ proofError }}</p>
      <p>Verification records are kept for this session only.</p>
      <button type="button" class="primary" @click="restart">Create a payment</button>
    </section>

    <template v-if="showPaymentFlow">
      <section v-if="!isProviderReady" class="banner" role="alert">
        <p>{{ initError ?? 'Open this Mini App inside Nimiq Pay. A browser window cannot submit a payment.' }}</p>
      </section>

      <JourneySteps :current="journeyStep" />

      <CreatePayment
        :key="createFormKey"
        v-show="screen === 'create'"
        :errors="formErrors"
        :is-creating="isCreatingIntent"
        :server-error="createError"
        @review="reviewPayment"
      />
      <ReviewPayment
        v-if="screen === 'review' && intent"
        :intent="intent"
        :is-submitting="isSubmitting"
        :error-message="submitError"
        :phase6b-method="PHASE_6B_SEND_METHOD"
        :phase6b-data="phase6bPreviewData"
        @back="backToCreate"
        @confirm="confirmPayment"
      />
      <VerificationPayment
        v-if="screen === 'verify' && flowState && !proof"
        :state="flowState"
        @retry="retryVerification"
        @restart="restart"
      />
      <section
        v-if="sendDiagnostic && (screen === 'review' || screen === 'verify')"
        class="panel diagnostic"
      >
        <h2>Phase 6B send diagnostic</h2>
        <p class="hint">Temporary Testnet experiment. The verifier is unchanged and will not accept this payment because of extra data or an HTLC sender.</p>
        <dl>
          <div>
            <dt>Intent ID</dt>
            <dd class="mono">{{ sendDiagnostic.intentId }}</dd>
          </div>
          <div>
            <dt>Method</dt>
            <dd class="mono">{{ sendDiagnostic.method }}</dd>
          </div>
          <div>
            <dt>Data supplied</dt>
            <dd class="mono">{{ sendDiagnostic.data }}</dd>
          </div>
          <div>
            <dt>Returned value</dt>
            <dd class="mono">{{ sendDiagnostic.returnedValue }}</dd>
          </div>
          <div>
            <dt>Transaction hash used for verify</dt>
            <dd class="mono">{{ sendDiagnostic.transactionHash }}</dd>
          </div>
        </dl>
      </section>
      <p v-if="proofError && screen === 'verify'" class="error">{{ proofError }}</p>
    </template>
  </main>
</template>

<style scoped>
.app {
  max-width: 26.5rem;
  margin: 0 auto;
  padding: 1.15rem 1rem 2.5rem;
}

header {
  margin-bottom: 1.1rem;
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.mark {
  width: 2.15rem;
  height: 2.15rem;
  flex: 0 0 auto;
  border: 1.5px solid var(--verified);
  border-radius: 0.7rem;
  background:
    linear-gradient(180deg, rgb(62 207 159 / 16%), transparent),
    var(--ink);
}

.mark::after {
  content: '';
  display: block;
  width: 0.95rem;
  height: 0.45rem;
  margin: 0.72rem auto 0;
  border-left: 2px solid var(--verified);
  border-bottom: 2px solid var(--verified);
  transform: rotate(-45deg);
}

h1 {
  margin: 0;
  font-size: 1.45rem;
  letter-spacing: 0.08em;
  line-height: 1.1;
}

.tagline {
  margin: 0.2rem 0 0;
  font-size: 0.82rem;
  font-weight: 650;
  color: var(--muted);
}

.lede {
  margin: 0 0 0.75rem;
  color: var(--muted);
}

.connected {
  display: inline-block;
  margin: 0;
  color: var(--verified);
  font-size: 0.82rem;
  font-weight: 650;
}

.connecting p,
.banner p {
  margin: 0 0 0.75rem;
}

.connecting p:last-child,
.banner p:last-child {
  margin-bottom: 0;
}

.checking {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  font-weight: 650;
}

.pulse {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 999px;
  background: var(--submitted);
  animation: pulse 1.4s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% { opacity: 0.35; }
  50% { opacity: 1; }
}

.banner {
  margin: 0 0 1rem;
  padding: 0.9rem 0.95rem;
  border-radius: 0.85rem;
  border: 1px solid rgb(224 180 79 / 35%);
  background: rgb(224 180 79 / 10%);
}

.diagnostic {
  margin-top: 1rem;
  border-color: rgb(224 180 79 / 45%);
}

.diagnostic .hint {
  margin: 0 0 0.85rem;
  color: var(--muted);
  font-size: 0.92rem;
}

.diagnostic dl {
  margin: 0;
}

.diagnostic dl div {
  padding: 0.7rem 0;
  border-bottom: 1px solid var(--line);
}

.diagnostic dt {
  margin: 0 0 0.25rem;
  font-size: 0.75rem;
  font-weight: 650;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.diagnostic dd {
  margin: 0;
  overflow-wrap: anywhere;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.88rem;
}

.error {
  color: var(--danger);
}

h2 {
  margin: 0 0 0.5rem;
  font-size: 1.15rem;
}
</style>
