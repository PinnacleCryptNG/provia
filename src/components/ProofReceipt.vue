<script setup lang="ts">
import { computed, ref } from 'vue'
import { shortenNimiqAddress } from '../lib/address'
import { formatLunaAsNim } from '../lib/amount'
import { formatVerificationTime } from '../lib/format'
import { MIN_CONFIRMATIONS } from '../lib/verify'
import { nimiqNetworkLabel } from '../lib/network'
import type { ProofRecord } from '../lib/observation-service'

const props = defineProps<{
  proof: ProofRecord
}>()

const emit = defineEmits<{
  restart: []
}>()

const copied = ref(false)
const copyError = ref<string | null>(null)

const amount = computed(() => `${formatLunaAsNim(props.proof.observedAmountLuna)} NIM`)
const recipient = computed(() => shortenNimiqAddress(props.proof.recipient))
const verifiedAt = computed(() => formatVerificationTime(props.proof.verifiedAt))
const confirmations = computed(() => {
  return props.proof.confirmationsAtVerification >= MIN_CONFIRMATIONS
    ? `${MIN_CONFIRMATIONS}+`
    : String(props.proof.confirmationsAtVerification)
})

const recordText = computed(() => [
  'PROVIA verification record',
  'Status: VERIFIED',
  `Amount: ${amount.value}`,
  `Recipient: ${props.proof.recipient}`,
  `Network: ${nimiqNetworkLabel(props.proof.network)}`,
  `Transaction: ${props.proof.transactionHash}`,
  `Block: ${props.proof.blockNumber === null ? 'Unavailable' : props.proof.blockNumber}`,
  `Confirmations: ${props.proof.confirmationsAtVerification}`,
  `Verified: ${verifiedAt.value}`,
].join('\n'))

async function copyRecord() {
  copyError.value = null
  try {
    await navigator.clipboard.writeText(recordText.value)
    copied.value = true
    window.setTimeout(() => {
      copied.value = false
    }, 1600)
  }
  catch {
    copied.value = false
    copyError.value = 'Could not copy. You can still screenshot this record.'
  }
}
</script>

<template>
  <section class="receipt">
    <div class="success-mark" aria-hidden="true">✓</div>
    <h2 class="title">Payment verified</h2>
    <p class="message">
      Your payment was independently verified on the Nimiq blockchain.
    </p>
    <p class="amount">{{ amount }}</p>

    <dl>
      <div>
        <dt>Recipient</dt>
        <dd class="address">{{ recipient }}</dd>
      </div>
      <div>
        <dt>Network</dt>
        <dd>{{ nimiqNetworkLabel(proof.network) }}</dd>
      </div>
      <div>
        <dt>Confirmations</dt>
        <dd>{{ confirmations }}</dd>
      </div>
    </dl>

    <details>
      <summary>View verification details</summary>
      <dl>
        <div>
          <dt>Transaction hash</dt>
          <dd class="hash">{{ proof.transactionHash }}</dd>
        </div>
        <div>
          <dt>Block</dt>
          <dd>{{ proof.blockNumber === null ? 'Unavailable' : proof.blockNumber }}</dd>
        </div>
        <div>
          <dt>Confirmations</dt>
          <dd>{{ proof.confirmationsAtVerification }}</dd>
        </div>
        <div>
          <dt>Verification time</dt>
          <dd>{{ verifiedAt }}</dd>
        </div>
        <div>
          <dt>Amount</dt>
          <dd>{{ amount }}</dd>
        </div>
        <div>
          <dt>Recipient</dt>
          <dd class="address">{{ proof.recipient }}</dd>
        </div>
        <div>
          <dt>Network</dt>
          <dd>{{ nimiqNetworkLabel(proof.network) }}</dd>
        </div>
      </dl>
    </details>

    <p class="disclaimer">
      This record reflects PROVIA's observation of the Nimiq blockchain. It is not a cryptographic certificate.
    </p>
    <p class="session">This record is for this session only.</p>

    <p v-if="copyError" class="error" role="alert">{{ copyError }}</p>

    <button type="button" class="primary" @click="copyRecord">
      {{ copied ? 'Copied' : 'Copy verification record' }}
    </button>
    <button type="button" class="secondary" @click="emit('restart')">
      Request another payment
    </button>
  </section>
</template>

<style scoped>
.receipt {
  border-color: rgb(26 163 106 / 28%);
  background:
    linear-gradient(180deg, rgb(26 163 106 / 10%), transparent 42%),
    var(--surface);
}

.success-mark {
  display: grid;
  place-items: center;
  width: 3.2rem;
  height: 3.2rem;
  margin: 0 0 0.85rem;
  border-radius: 999px;
  background: rgb(26 163 106 / 14%);
  color: var(--verified);
  font-size: 1.5rem;
  font-weight: 700;
}

.title {
  margin: 0 0 0.5rem;
  font-size: clamp(1.55rem, 6vw, 1.95rem);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.15;
  color: var(--verified);
}

.message,
.disclaimer,
.session {
  margin: 0 0 0.7rem;
  color: var(--muted);
  font-weight: 500;
}

.disclaimer,
.session {
  font-size: 0.82rem;
  opacity: 0.88;
}

.amount {
  margin: 0.2rem 0 1rem;
  font-size: clamp(2rem, 8vw, 2.55rem);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.1;
  color: var(--text);
}

dl {
  margin: 0 0 0.85rem;
}

dl div {
  padding: 0.7rem 0;
  border-bottom: 1px solid var(--line);
}

dt {
  margin: 0 0 0.2rem;
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--muted);
}

dd {
  margin: 0;
  font-size: 1.02rem;
  font-weight: 600;
  overflow-wrap: anywhere;
  word-break: break-word;
}

details {
  margin: 0 0 0.9rem;
}

summary {
  cursor: pointer;
  font-weight: 600;
  color: var(--primary);
}

.address,
.hash {
  font-size: 0.92rem;
}

.error {
  margin: 0 0 0.75rem;
  color: var(--danger);
}
</style>
