<script setup lang="ts">
import type { PaymentIntent } from '../lib/intent'
import { shortenNimiqAddress } from '../lib/address'

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
    <p class="hint">Check the details. Nimiq Pay will ask you to approve the transaction only after you confirm.</p>

    <dl>
      <div>
        <dt>You're sending</dt>
        <dd>{{ intent.amountNim }} NIM</dd>
      </div>
      <div>
        <dt>To</dt>
        <dd>{{ shortenNimiqAddress(intent.recipient) }}</dd>
      </div>
      <div>
        <dt>Network</dt>
        <dd>{{ intent.network }}</dd>
      </div>
      <div v-if="intent.purpose">
        <dt>Purpose</dt>
        <dd>{{ intent.purpose }}</dd>
      </div>
    </dl>

    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <button
      type="button"
      class="primary"
      :disabled="isSubmitting"
      @click="emit('confirm')"
    >
      {{ isSubmitting ? 'Waiting for Nimiq Pay…' : 'Confirm payment' }}
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
.panel {
  padding: 1rem;
  border-radius: 0.75rem;
  background: var(--panel);
}

h2 {
  margin: 0 0 0.4rem;
  font-size: 1.1rem;
}

.hint {
  margin: 0 0 1rem;
  color: var(--muted);
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
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

dd {
  margin: 0;
  font-size: 1.05rem;
  overflow-wrap: anywhere;
}

.error {
  margin: 0 0 0.85rem;
  color: var(--danger);
}

button {
  width: 100%;
  min-height: 44px;
  margin-top: 0.5rem;
  border: none;
  border-radius: 0.625rem;
  padding: 0.625rem 0.875rem;
  font-weight: 600;
}

.primary {
  background: var(--primary);
  color: #f4f8fc;
}

.secondary {
  background: transparent;
  color: var(--text);
  border: 1px solid var(--line);
}

button:disabled {
  opacity: 0.55;
}
</style>
