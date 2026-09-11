<script setup lang="ts">
import type { PaymentIntent } from '../lib/intent'
import { nimiqNetworkLabel } from '../lib/network'

defineProps<{
  intent: PaymentIntent
  isSubmitting: boolean
  errorMessage: string | null
}>()

const emit = defineEmits<{
  back: []
  confirm: []
}>()
</script>

<template>
  <section class="panel">
    <h2>Review payment</h2>
    <p class="amount">{{ intent.amountNim }} NIM</p>

    <dl>
      <div>
        <dt>To</dt>
        <dd class="address">{{ intent.recipient }}</dd>
      </div>
      <div>
        <dt>Network</dt>
        <dd>{{ nimiqNetworkLabel(intent.network) }}</dd>
      </div>
      <div v-if="intent.purpose">
        <dt>Purpose</dt>
        <dd>{{ intent.purpose }}</dd>
      </div>
    </dl>

    <p class="notice">
      After you approve the payment in Nimiq Pay, PROVIA will independently verify it on the Nimiq blockchain.
    </p>

    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <button
      type="button"
      class="primary"
      :disabled="isSubmitting"
      @click="emit('confirm')"
    >
      {{ isSubmitting ? 'Waiting for Nimiq Pay…' : 'Confirm in Nimiq Pay' }}
    </button>
    <button
      type="button"
      class="secondary"
      :disabled="isSubmitting"
      @click="emit('back')"
    >
      Back
    </button>
  </section>
</template>

<style scoped>
h2 {
  margin: 0 0 0.85rem;
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--muted);
}

.amount {
  margin: 0 0 1rem;
  font-size: clamp(2rem, 8vw, 2.6rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.1;
}

dl {
  margin: 0 0 1rem;
}

dl div {
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--line);
}

dt {
  margin: 0 0 0.25rem;
  font-size: 0.75rem;
  font-weight: 800;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

dd {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.address {
  font-size: 0.95rem;
}

.notice {
  margin: 0 0 1rem;
  padding: 0.9rem 0.95rem;
  border-radius: 0.95rem;
  background: rgb(5 130 202 / 8%);
  color: var(--text);
  font-size: 0.95rem;
  font-weight: 600;
}

.error {
  margin: 0 0 0.85rem;
  color: var(--danger);
}
</style>
