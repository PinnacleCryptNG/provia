<script setup lang="ts">
import { ref } from 'vue'
import { shortenNimiqAddress } from '../lib/address'
import type { PaymentIntent } from '../lib/intent'
import { nimiqNetworkLabel } from '../lib/network'

const props = defineProps<{
  intent: PaymentIntent
  isSubmitting: boolean
  errorMessage: string | null
}>()

const emit = defineEmits<{
  back: []
  confirm: []
}>()

const showFullRecipient = ref(false)

function confirm() {
  if (props.isSubmitting) {
    return
  }

  emit('confirm')
}
</script>

<template>
  <section class="panel">
    <h2>Review your payment</h2>
    <p class="amount">{{ intent.amountNim }} NIM</p>

    <dl>
      <div>
        <dt>To</dt>
        <dd class="address">{{ shortenNimiqAddress(intent.recipient) }}</dd>
        <button type="button" class="link" @click="showFullRecipient = !showFullRecipient">
          {{ showFullRecipient ? 'Hide full address' : 'Show full address' }}
        </button>
        <dd v-if="showFullRecipient" class="address-full">{{ intent.recipient }}</dd>
      </div>
      <div v-if="intent.purpose">
        <dt>Purpose</dt>
        <dd>{{ intent.purpose }}</dd>
      </div>
      <div>
        <dt>Network</dt>
        <dd>{{ nimiqNetworkLabel(intent.network) }}</dd>
      </div>
    </dl>

    <p class="notice">
      <span aria-hidden="true">✓</span>
      Recipient checked before payment
    </p>

    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <button
      type="button"
      class="primary"
      :disabled="isSubmitting"
      :aria-busy="isSubmitting"
      @click="confirm"
    >
      {{ isSubmitting ? 'Opening Nimiq Pay…' : 'Confirm in Nimiq Pay' }}
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
  font-weight: 600;
  color: var(--muted);
}

.amount {
  margin: 0 0 1rem;
  font-size: clamp(2rem, 8vw, 2.6rem);
  font-weight: 700;
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
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--muted);
}

dd {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.address {
  font-size: 0.95rem;
}

.address-full {
  margin-top: 0.45rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--muted);
}

.link {
  width: auto;
  min-height: 32px;
  margin: 0.35rem 0 0;
  border: none;
  padding: 0;
  background: transparent;
  color: var(--primary);
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
}

.notice {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0 0 1rem;
  padding: 0.75rem 0.9rem;
  border-radius: 0.95rem;
  background: rgb(26 163 106 / 8%);
  color: var(--text);
  font-size: 0.95rem;
  font-weight: 600;
}

.notice span {
  color: var(--verified);
}

.error {
  margin: 0 0 0.85rem;
  color: var(--danger);
}
</style>
