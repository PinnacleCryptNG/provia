<script setup lang="ts">
import { shortenNimiqAddress } from '../lib/address'
import type { PaymentIntent } from '../lib/intent'
import { nimiqNetworkLabel } from '../lib/network'

defineProps<{
  intent: PaymentIntent
}>()

const emit = defineEmits<{
  back: []
  review: []
}>()
</script>

<template>
  <section class="panel">
    <h2>Payment details checked</h2>
    <p class="lede">Everything looks good. Your payment is ready to send.</p>

    <ul class="checks">
      <li>
        <span class="tick" aria-hidden="true">✓</span>
        <span>
          <strong>Amount</strong>
          <span class="value">{{ intent.amountNim }} NIM</span>
        </span>
      </li>
      <li>
        <span class="tick" aria-hidden="true">✓</span>
        <span>
          <strong>Recipient</strong>
          <span class="value">{{ shortenNimiqAddress(intent.recipient) }}</span>
        </span>
      </li>
      <li>
        <span class="tick" aria-hidden="true">✓</span>
        <span>
          <strong>Network</strong>
          <span class="value">{{ nimiqNetworkLabel(intent.network) }}</span>
        </span>
      </li>
    </ul>

    <p class="notice">
      PROVIA will independently verify the payment after you approve it in Nimiq Pay.
    </p>

    <button type="button" class="primary" @click="emit('review')">
      Review payment
    </button>
    <button type="button" class="secondary" @click="emit('back')">
      Back
    </button>
  </section>
</template>

<style scoped>
h2 {
  margin: 0 0 0.55rem;
  font-size: 1.25rem;
  font-weight: 700;
}

.lede {
  margin: 0 0 1.1rem;
  color: var(--muted);
  font-weight: 500;
}

.checks {
  margin: 0 0 1.1rem;
  padding: 0;
  list-style: none;
}

.checks li {
  display: flex;
  align-items: flex-start;
  gap: 0.7rem;
  padding: 0.7rem 0;
  border-bottom: 1px solid var(--line);
}

.tick {
  display: grid;
  place-items: center;
  width: 1.45rem;
  height: 1.45rem;
  flex: 0 0 auto;
  margin-top: 0.1rem;
  border-radius: 999px;
  background: rgb(26 163 106 / 14%);
  color: var(--verified);
  font-size: 0.85rem;
  font-weight: 700;
}

strong {
  display: block;
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--muted);
}

.value {
  display: block;
  margin-top: 0.15rem;
  font-size: 1.05rem;
  font-weight: 600;
}

.notice {
  margin: 0 0 1rem;
  color: var(--muted);
  font-size: 0.95rem;
  font-weight: 500;
}
</style>
