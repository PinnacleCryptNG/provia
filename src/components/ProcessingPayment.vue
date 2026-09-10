<script setup lang="ts">
import type { PaymentIntent } from '../lib/intent'
import { shortenTransactionHash } from '../lib/address'

defineProps<{
  intent: PaymentIntent
}>()

const emit = defineEmits<{
  restart: []
}>()
</script>

<template>
  <section class="panel">
    <h2>Payment submitted</h2>
    <p class="hint">
      The payment was submitted to Nimiq Pay. PROVIA has not verified it yet.
    </p>

    <dl>
      <div>
        <dt>Transaction hash</dt>
        <dd>{{ intent.transactionHash ? shortenTransactionHash(intent.transactionHash) : 'Unavailable' }}</dd>
      </div>
      <div>
        <dt>Status</dt>
        <dd>Waiting for confirmation</dd>
      </div>
      <div>
        <dt>Amount</dt>
        <dd>{{ intent.amountNim }} NIM</dd>
      </div>
    </dl>

    <button type="button" @click="emit('restart')">Create another payment</button>
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

button {
  width: 100%;
  min-height: 44px;
  border: none;
  border-radius: 0.625rem;
  padding: 0.625rem 0.875rem;
  font-weight: 600;
  background: var(--primary);
  color: #f4f8fc;
}
</style>
