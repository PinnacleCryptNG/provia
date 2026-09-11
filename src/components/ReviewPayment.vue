<script setup lang="ts">
import type { PaymentIntent } from '../lib/intent'
import { nimiqNetworkLabel } from '../lib/network'

defineProps<{
  intent: PaymentIntent
  isSubmitting: boolean
  errorMessage: string | null
  phase6bMethod: string
  phase6bData: string | null
}>()

const emit = defineEmits<{
  back: []
  confirm: []
}>()
</script>

<template>
  <section class="panel">
    <h2>Review payment</h2>
    <p class="hint">Check every detail before Nimiq Pay asks you to approve. This is the last chance to catch a mistake.</p>

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
      Wallet submission is not verification. PROVIA verifies the payment independently after it is submitted. Verification requires 60 blockchain confirmations.
    </p>

    <p class="notice test">
      Phase 6B Testnet experiment: this confirm calls {{ phase6bMethod }} with data
      <span class="mono">{{ phase6bData ?? 'PROVIA:&lt;intentId&gt;' }}</span>.
      The verifier is unchanged and will not accept the result automatically.
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

.notice.test {
  background: rgb(61 134 196 / 12%);
}

.mono {
  display: inline-block;
  margin-top: 0.2rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  overflow-wrap: anywhere;
}

.error {
  margin: 0 0 0.85rem;
  color: var(--danger);
}
</style>
