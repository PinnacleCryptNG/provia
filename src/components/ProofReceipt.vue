<script setup lang="ts">
import { computed, ref } from 'vue'
import { shortenNimiqAddress, shortenTransactionHash } from '../lib/address'
import { formatLunaAsNim } from '../lib/amount'
import { nimiqNetworkLabel } from '../lib/network'
import type { ProofRecord } from '../lib/observation-service'

const props = defineProps<{
  proof: ProofRecord
}>()

const emit = defineEmits<{
  restart: []
}>()

const copied = ref(false)

const amount = computed(() => `${formatLunaAsNim(props.proof.observedAmountLuna)} NIM`)
const shareUrl = computed(() => {
  const url = new URL(window.location.href)
  url.searchParams.set('proof', props.proof.proofId)
  return url.toString()
})

async function copyLink() {
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    copied.value = true
    window.setTimeout(() => {
      copied.value = false
    }, 1600)
  }
  catch {
    copied.value = false
  }
}
</script>

<template>
  <section class="receipt">
    <p class="eyebrow">PROVIA verification proof</p>
    <h2 class="title positive">Payment verified</h2>
    <p class="verified-mark">Verified against Nimiq blockchain evidence</p>
    <p class="message">
      This is a PROVIA verification proof. It records what the PROVIA server
      observed on the Nimiq blockchain at verification time. It is not a
      cryptographic certificate.
    </p>

    <dl>
      <div>
        <dt>Amount</dt>
        <dd>{{ amount }}</dd>
      </div>
      <div>
        <dt>Recipient</dt>
        <dd>{{ shortenNimiqAddress(proof.recipient) }}</dd>
      </div>
      <div>
        <dt>Network</dt>
        <dd>{{ nimiqNetworkLabel(proof.network) }}</dd>
      </div>
      <div>
        <dt>Transaction</dt>
        <dd>{{ shortenTransactionHash(proof.transactionHash) }}</dd>
      </div>
      <div>
        <dt>Block</dt>
        <dd>{{ proof.blockNumber === null ? 'Unavailable' : proof.blockNumber }}</dd>
      </div>
      <div>
        <dt>Confirmations</dt>
        <dd>{{ proof.confirmationsAtVerification }}+</dd>
      </div>
      <div>
        <dt>Verified</dt>
        <dd>{{ proof.verifiedAt }}</dd>
      </div>
    </dl>

    <button type="button" class="primary" @click="copyLink">
      {{ copied ? 'Copied' : 'Copy proof link' }}
    </button>
    <button type="button" class="secondary" @click="emit('restart')">
      Create another payment
    </button>
  </section>
</template>

<style scoped>
.receipt {
  padding: 1.25rem 1rem 1.5rem;
  border-radius: 0.75rem;
  background: var(--panel);
}

.eyebrow {
  margin: 0 0 0.45rem;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}

.title {
  margin: 0 0 0.45rem;
  font-size: clamp(1.35rem, 5vw, 1.7rem);
  line-height: 1.2;
}

.title.positive {
  color: var(--mint);
}

.verified-mark {
  margin: 0 0 0.75rem;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--mint);
}

.message {
  margin: 0 0 1.15rem;
  color: var(--muted);
}

dl {
  margin: 0 0 1.15rem;
}

dl div {
  padding: 0.85rem 0;
  border-bottom: 1px solid var(--line);
}

dt {
  margin: 0 0 0.25rem;
  font-size: 0.78rem;
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
</style>
