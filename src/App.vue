<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { NimiqProvider } from '@nimiq/mini-app-sdk'
import CreatePayment from './components/CreatePayment.vue'
import ReviewPayment from './components/ReviewPayment.vue'
import ProcessingPayment from './components/ProcessingPayment.vue'
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

type Screen = 'create' | 'review' | 'processing'

const isInitializing = ref(true)
const isProviderReady = ref(false)
const initError = ref<string | null>(null)
const formErrors = ref<FieldErrors>({})
const submitError = ref<string | null>(null)
const isSubmitting = ref(false)
const screen = ref<Screen>('create')
const intent = ref<PaymentIntent | null>(null)
const createFormKey = ref(0)

let provider: NimiqProvider | null = null

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
    intent.value = withSubmittedHash(intent.value, transactionHash)
    screen.value = 'processing'
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

function restart() {
  formErrors.value = {}
  submitError.value = null
  intent.value = null
  createFormKey.value += 1
  screen.value = 'create'
}
</script>

<template>
  <main class="app">
    <header>
      <p class="eyebrow">Nimiq Pay Mini App</p>
      <h1>PROVIA</h1>
      <p class="lede">Create a NIM payment intent, review it, then approve it in Nimiq Pay.</p>
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
      <ProcessingPayment
        v-if="screen === 'processing' && intent"
        :intent="intent"
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
  margin-bottom: 1rem;
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
