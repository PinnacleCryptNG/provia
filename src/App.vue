<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { NimiqProvider } from '@nimiq/mini-app-sdk'
import CreatePayment from './components/CreatePayment.vue'
import ReviewPayment from './components/ReviewPayment.vue'
import VerificationPayment from './components/VerificationPayment.vue'
import {
  createPaymentIntent,
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
import { createRpcObservationService } from './lib/observation-service'
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
const submitError = ref<string | null>(null)
const isSubmitting = ref(false)
const screen = ref<Screen>('create')
const intent = ref<PaymentIntent | null>(null)
const flowState = ref<VerificationFlowState | null>(null)
const createFormKey = ref(0)

let provider: NimiqProvider | null = null
let observationRun = 0
const observationService = createRpcObservationService()

onMounted(async () => {
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

function reviewPayment(draft: PaymentDraft) {
  submitError.value = null
  const result = createPaymentIntent(draft)
  if (!result.ok) {
    formErrors.value = result.errors
    return
  }

  formErrors.value = {}
  intent.value = result.intent
  screen.value = 'review'
}

function backToCreate() {
  submitError.value = null
  isSubmitting.value = false
  screen.value = 'create'
}

async function runObservation() {
  const current = intent.value
  if (!current?.transactionHash) {
    return
  }

  const runId = ++observationRun
  await observePaymentEvidence({
    intent: current,
    observation: observationService,
    onState(state) {
      if (runId !== observationRun) {
        return
      }
      flowState.value = state
    },
  })
}

async function confirmPayment() {
  if (!intent.value) {
    submitError.value = 'No payment intent to confirm.'
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
  submitError.value = null
  intent.value = null
  flowState.value = null
  createFormKey.value += 1
  screen.value = 'create'
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
      <p v-if="isProviderReady" class="connected">Nimiq Pay connected</p>
    </header>

    <p v-if="isInitializing" class="status" role="status">
      Waiting for Nimiq Pay to initialize the provider...
    </p>

    <section v-else-if="!isProviderReady" class="panel" aria-live="polite">
      <h2>Open this app inside Nimiq Pay</h2>
      <p>
        The Nimiq provider was not found. PROVIA has to run in Nimiq Pay's Mini
        Apps browser so the wallet can inject the provider.
      </p>
      <p v-if="initError" class="error">{{ initError }}</p>
      <p>
        In Nimiq Pay, open Mini Apps and enter this machine's Network URL, for
        example <code>http://192.168.x.x:5173</code>. Do not use localhost.
      </p>
    </section>

    <template v-else>
      <CreatePayment
        :key="createFormKey"
        v-show="screen === 'create'"
        :errors="formErrors"
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
        v-if="screen === 'verify' && flowState"
        :state="flowState"
        @retry="retryVerification"
        @restart="restart"
      />
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
