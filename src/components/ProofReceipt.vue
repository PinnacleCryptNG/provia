<script setup lang="ts">
import { computed, ref } from 'vue'
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
const verifiedAt = computed(() => formatVerificationTime(props.proof.verifiedAt))

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
    <p class="eyebrow">PROVIA verification proof</p>
    <h2 class="title">Payment verified</h2>
    <p class="badge">VERIFIED</p>
    <p class="message">
      PROVIA verified this payment using independently observed blockchain data.
    </p>
    <p class="disclaimer">
      This is an observation record of what PROVIA saw on the Nimiq blockchain. It is not a cryptographic certificate.
    </p>
    <p class="session">This record is for this session only. It is not stored permanently.</p>

    <dl>
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
      <div>
        <dt>Transaction</dt>
        <dd class="hash">{{ proof.transactionHash }}</dd>
      </div>
      <div>
        <dt>Block</dt>
        <dd>{{ proof.blockNumber === null ? 'Unavailable' : proof.blockNumber }}</dd>
      </div>
      <div>
        <dt>Confirmations</dt>
        <dd>{{ proof.confirmationsAtVerification }} of {{ MIN_CONFIRMATIONS }} required</dd>
      </div>
      <div>
        <dt>Verified</dt>
        <dd>{{ verifiedAt }}</dd>
      </div>
    </dl>

    <p v-if="copyError" class="error" role="alert">{{ copyError }}</p>

    <button type="button" class="primary" @click="copyRecord">
      {{ copied ? 'Copied' : 'Copy this record' }}
    </button>
    <button type="button" class="secondary" @click="emit('restart')">
      Create another payment
    </button>
  </section>
</template>

<style scoped>
.receipt {
  background:
    linear-gradient(180deg, rgb(62 207 159 / 10%), transparent 38%),
    var(--record);
  border-color: rgb(62 207 159 / 40%);
}

.eyebrow {
  margin: 0 0 0.4rem;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}

.title {
  margin: 0 0 0.5rem;
  font-size: clamp(1.35rem, 5vw, 1.75rem);
  line-height: 1.2;
  color: var(--verified);
}

.badge {
  display: inline-block;
  margin: 0 0 0.85rem;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  background: rgb(62 207 159 / 16%);
  color: var(--verified);
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.message,
.disclaimer,
.session {
  margin: 0 0 0.75rem;
  color: var(--muted);
}

.message {
  color: var(--text);
}

.session {
  margin-bottom: 1.1rem;
  font-size: 0.9rem;
}

dl {
  margin: 0 0 1.1rem;
}

dl div {
  padding: 0.8rem 0;
  border-bottom: 1px solid var(--line);
}

dt {
  margin: 0 0 0.25rem;
  font-size: 0.75rem;
  font-weight: 650;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

dd {
  margin: 0;
  font-size: 1.05rem;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.address,
.hash {
  font-size: 0.92rem;
  word-break: break-word;
}

.error {
  margin: 0 0 0.75rem;
  color: var(--danger);
}
</style>
