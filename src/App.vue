<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { NimiqProvider } from '@nimiq/mini-app-sdk'
import CreatePayment from './components/CreatePayment.vue'
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
  sendBasicNimPayment,
  toUserFacingError,
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
  observePaymentEvidence,
  stateAfterWalletHash,
  type VerificationFlowState,
} from './lib/verification-flow'

type Screen = 'create' | 'review' | 'verify'

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

let provider: NimiqProvider | null = null
let observationRun = 0
const verificationService = createProviaApiVerificationService()

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
        proofError.value = 'This PROVIA verification proof was not found.'
      }
    }
    catch {
      sharedProofMissing.value = true
      proofError.value = 'PROVIA could not load this verification proof.'
    }
  }

  try {
    provider = await initializeNimiqProvider()
    isProviderReady.value = true
  }
  catch (error) {
    initError.value = toUserFacingError(error)
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
      : 'PROVIA could not create the payment intent. Try again.'
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
      : 'PROVIA could not create a verification proof.'
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
    submitError.value = 'This payment has no server-owned intent ID.'
    return
  }

  if (!provider) {
    submitError.value = 'Nimiq provider is not ready. Open this app inside Nimiq Pay.'
    return
  }

  submitError.value = null
  isSubmitting.value = true

  try {
    const transactionHash = await sendBasicNimPayment(provider, {
      recipient: intent.value.recipient,
      valueLuna: intent.value.amountLuna,
    })
    const submitted = withSubmittedHash(intent.value, transactionHash)
    intent.value = submitted
    flowState.value = stateAfterWalletHash(submitted)
    screen.value = 'verify'
    queueMicrotask(() => {
      void runObservation()
    })
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
  screen.value = 'create'
  clearProofQuery()
}
</script>

<template>
  <main class="app">
    <header>
      <p class="eyebrow">Payment verification</p>
      <h1>PROVIA</h1>
      <p class="lede">
        Create a NIM payment intent, submit it through Nimiq Pay, then verify it
        against independent blockchain evidence.
      </p>
      <p v-if="isProviderReady && !proof" class="connected">Nimiq Pay connected</p>
      <p v-else-if="!proof && !isInitializing" class="status">
        Sending a payment requires Nimiq Pay. You can still create and review an intent here.
      </p>
    </header>

    <ProofReceipt
      v-if="proof"
      :proof="proof"
      @restart="restart"
    />

    <section v-else-if="sharedProofMissing" class="panel" aria-live="polite">
      <h2>Proof not available</h2>
      <p class="error">{{ proofError }}</p>
      <p>Ask the sender to create the payment again, or create a new payment in Nimiq Pay.</p>
    </section>

    <p v-if="isInitializing && !proof && !sharedProofMissing" class="status" role="status">
      Waiting for Nimiq Pay to initialize the provider...
    </p>

    <template v-if="!proof && !sharedProofMissing">
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
        @back="backToCreate"
        @confirm="confirmPayment"
      />
      <VerificationPayment
        v-if="screen === 'verify' && flowState && !proof"
        :state="flowState"
        @retry="retryVerification"
        @restart="restart"
      />
      <p v-if="proofError && screen === 'verify'" class="error">{{ proofError }}</p>
    </template>
  </main>
</template>

<style scoped>
.app {
  max-width: 42rem;
  margin: 0 auto;
  padding: 1.25rem 1rem 2.5rem;
}

header {
  margin-bottom: 1.25rem;
}

.eyebrow {
  margin: 0 0 0.35rem;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
}

h1 {
  margin: 0 0 0.6rem;
  font-size: clamp(1.75rem, 7vw, 2.4rem);
  line-height: 1.15;
}

.lede,
.status,
.panel p {
  margin: 0 0 0.85rem;
}

.connected {
  display: inline-block;
  margin: 0 0 0.5rem;
  color: var(--mint);
  font-size: 0.9rem;
  font-weight: 600;
}

.panel {
  padding: 1rem;
  border-radius: 0.75rem;
  background: var(--panel);
}

.error {
  color: var(--danger);
}

code {
  font-size: 0.92em;
}
</style>
