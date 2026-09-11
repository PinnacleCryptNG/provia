<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { parseNimToLuna } from '../lib/amount'
import { normalizeNimiqAddress } from '../lib/address'
import type { FieldErrors } from '../lib/intent'
import { fetchRecipientPreflight } from '../lib/observation-service'
import { PAYMENT_PURPOSES } from '../lib/purpose'
import {
  inspectLocalRecipient,
  recipientCheckView,
  sameCheckedRecipient,
  type RecipientCheckStatus,
} from '../lib/recipient-check'
import RecipientCheckCard from './RecipientCheckCard.vue'

const CHECK_DELAY_MS = 350

const props = defineProps<{
  errors: FieldErrors
  isCreating?: boolean
  serverError?: string | null
}>()

const recipient = ref('')
const amount = ref('')
const purpose = ref('')
const checkStatus = ref<RecipientCheckStatus>('idle')
const verifiedRecipient = ref<string | null>(null)

const emit = defineEmits<{
  review: [draft: { recipient: string, amount: string, purpose: string }]
}>()

const checkView = computed(() => recipientCheckView(checkStatus.value))
const amountIsValid = computed(() => parseNimToLuna(amount.value).ok)
const canContinue = computed(() => {
  return checkStatus.value === 'verified'
    && sameCheckedRecipient(recipient.value, verifiedRecipient.value)
    && amountIsValid.value
    && !props.isCreating
})

const continueLabel = computed(() => {
  if (props.isCreating) {
    return 'Checking payment details…'
  }
  if (checkStatus.value === 'checking') {
    return 'Checking recipient…'
  }
  return 'Continue'
})

let checkTimer = 0
let checkSeq = 0

async function runPreflight(value: string) {
  const seq = ++checkSeq
  checkStatus.value = 'checking'
  verifiedRecipient.value = null
  const result = await fetchRecipientPreflight(value)
  if (seq !== checkSeq) {
    return
  }
  checkStatus.value = result.status
  verifiedRecipient.value = result.status === 'verified'
    ? result.recipient ?? normalizeNimiqAddress(value)
    : null
}

function syncRecipientCheck(value: string, immediate = false) {
  window.clearTimeout(checkTimer)
  const local = inspectLocalRecipient(value)
  if (local === 'idle') {
    checkSeq += 1
    checkStatus.value = 'idle'
    verifiedRecipient.value = null
    return
  }
  if (local === 'invalid') {
    checkSeq += 1
    checkStatus.value = 'invalid'
    verifiedRecipient.value = null
    return
  }
  if (sameCheckedRecipient(value, verifiedRecipient.value) && checkStatus.value === 'verified') {
    return
  }
  if (immediate) {
    void runPreflight(value)
    return
  }
  checkStatus.value = 'checking'
  checkTimer = window.setTimeout(() => {
    void runPreflight(value)
  }, CHECK_DELAY_MS)
}

watch(recipient, (value) => {
  syncRecipientCheck(value)
})

onBeforeUnmount(() => {
  window.clearTimeout(checkTimer)
  checkSeq += 1
})

function submit() {
  if (props.isCreating || !canContinue.value) {
    return
  }

  emit('review', {
    recipient: recipient.value,
    amount: amount.value,
    purpose: purpose.value,
  })
}

function revealInvalidField(errors: FieldErrors) {
  const fieldId = errors.amount ? 'amount' : errors.recipient ? 'recipient' : null
  if (!fieldId) {
    return
  }

  const field = document.getElementById(fieldId)
  field?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  field?.focus()
}

watch(() => props.errors, (errors) => {
  revealInvalidField(errors)
})
</script>

<template>
  <form class="panel send-form" @submit.prevent="submit">
    <h2>Send NIM</h2>
    <p class="lede">PROVIA checks your recipient before you send.</p>

    <label for="recipient">Recipient</label>
    <textarea
      id="recipient"
      v-model="recipient"
      name="recipient"
      rows="2"
      autocomplete="off"
      autocapitalize="characters"
      spellcheck="false"
      placeholder="Enter Nimiq address"
      :aria-invalid="checkStatus === 'invalid' || Boolean(errors.recipient)"
      @keydown.enter.prevent
    ></textarea>

    <RecipientCheckCard
      :view="checkView"
      @retry="syncRecipientCheck(recipient, true)"
    />

    <label for="amount">Amount</label>
    <span class="amount-field">
      <input
        id="amount"
        v-model="amount"
        type="text"
        name="amount"
        inputmode="decimal"
        autocomplete="off"
        placeholder="1.00"
        :aria-invalid="Boolean(errors.amount)"
      >
      <span class="suffix">NIM</span>
    </span>
    <p v-if="errors.amount" class="error" role="alert">{{ errors.amount }}</p>

    <p class="asset-label">Asset</p>
    <p class="asset-value">NIM</p>

    <label for="purpose">Purpose</label>
    <select v-model="purpose" id="purpose" name="purpose">
      <option value="">Select a purpose</option>
      <option v-for="option in PAYMENT_PURPOSES" :key="option" :value="option">
        {{ option }}
      </option>
    </select>

    <p class="network">Network</p>
    <p class="network-value">Nimiq Testnet</p>

    <p v-if="serverError" class="error" role="alert">{{ serverError }}</p>

    <div class="actions">
      <button
        type="submit"
        class="primary"
        :disabled="!canContinue"
        :aria-busy="isCreating || checkStatus === 'checking'"
      >
        {{ continueLabel }}
      </button>
    </div>
  </form>
</template>

<style scoped>
.send-form {
  padding-bottom: calc(1.35rem + env(safe-area-inset-bottom, 0px));
}

h2 {
  margin: 0 0 0.4rem;
  font-size: 1.25rem;
  font-weight: 700;
}

.lede {
  margin: 0 0 1.1rem;
  color: var(--muted);
  font-size: 0.98rem;
  font-weight: 500;
}

label,
.asset-label,
.network {
  display: block;
  margin: 0 0 0.3rem;
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--text);
}

.asset-value,
.network-value {
  margin: 0 0 0.95rem;
  color: var(--muted);
  font-size: 1.02rem;
  font-weight: 700;
}

.network {
  margin-top: 0.15rem;
  color: var(--muted);
}

input,
select,
textarea {
  display: block;
  width: 100%;
  min-height: 48px;
  margin: 0 0 0.95rem;
  border: 1px solid var(--line);
  border-radius: 0.9rem;
  padding: 0.7rem 0.85rem;
  background: var(--surface-soft);
  color: var(--text);
  overflow-wrap: anywhere;
}

textarea[name='recipient'] {
  margin-bottom: 0.7rem;
  min-height: 4.35rem;
  resize: none;
  font-size: 0.86rem;
  letter-spacing: 0.01em;
  line-height: 1.4;
  max-width: 100%;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.amount-field {
  position: relative;
  display: block;
  margin: 0 0 0.95rem;
}

.amount-field input {
  margin: 0;
  padding-right: 3.6rem;
  font-size: 1.2rem;
  font-weight: 700;
}

.suffix {
  position: absolute;
  top: 50%;
  right: 0.95rem;
  transform: translateY(-50%);
  color: var(--muted);
  font-weight: 700;
}

select {
  min-height: 44px;
  appearance: none;
  background-image: linear-gradient(45deg, transparent 50%, var(--muted) 50%), linear-gradient(135deg, var(--muted) 50%, transparent 50%);
  background-position: calc(100% - 18px) calc(50% - 3px), calc(100% - 12px) calc(50% - 3px);
  background-size: 6px 6px, 6px 6px;
  background-repeat: no-repeat;
}

input::placeholder,
textarea::placeholder {
  color: #8aa0b5;
  font-weight: 500;
}

input[aria-invalid='true'],
textarea[aria-invalid='true'] {
  border-color: var(--danger);
}

.error {
  margin: -0.55rem 0 0.85rem;
  color: var(--danger);
}

.actions {
  position: sticky;
  bottom: 0;
  z-index: 2;
  padding: 0.55rem 0 calc(0.35rem + env(safe-area-inset-bottom, 0px));
  background: linear-gradient(180deg, rgb(255 255 255 / 0%), var(--surface) 28%);
}

.actions .primary {
  margin-top: 0.35rem;
}
</style>
