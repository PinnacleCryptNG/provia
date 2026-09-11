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
    <h2>Review your payment</h2>
    <p class="hint">You are about to approve this payment in Nimiq Pay.</p>

    <dl>
      <div>
        <dt>Amount</dt>
        <dd>{{ intent.amountNim }} NIM</dd>
      </div>
      <div>
        <dt>Recipient</dt>
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
      PROVIA will independently verify this payment on the Nimiq blockchain after it is submitted.
      Verification requires 60 confirmations.
    </p>

    <p class="notice binding">
      <strong>On-chain payment binding.</strong>
      PROVIA attaches a unique payment identifier to the transaction. The identifier is independently checked against the payment request on the Nimiq blockchain.
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
  margin: 0 0 0.4rem;
  font-size: 1.15rem;
}

.hint {
  margin: 0 0 1rem;
  color: var(--muted);
}

dl {
  margin: 0 0 1rem;
}

dl div {
  padding: 0.8rem 0;
  border-bottom: 1px solid var(--line);
}

dt {
  margin: 0 0 0.3rem;
  font-size: 0.75rem;
  font-weight: 650;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

dd {
  margin: 0;
  font-size: 1.08rem;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.address {
  font-size: 0.95rem;
  letter-spacing: 0.01em;
}

.notice {
  margin: 0 0 1rem;
  padding: 0.85rem 0.9rem;
  border-radius: 0.75rem;
  background: rgb(224 180 79 / 10%);
  color: var(--text);
  font-size: 0.92rem;
}

.notice.binding {
  background: rgb(61 134 196 / 12%);
}

.notice.binding strong {
  display: block;
  margin-bottom: 0.3rem;
  font-size: 0.8rem;
  font-weight: 750;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.error {
  margin: 0 0 0.85rem;
  color: var(--danger);
}
</style>
