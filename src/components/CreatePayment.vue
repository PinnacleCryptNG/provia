<script setup lang="ts">
import { PAYMENT_PURPOSES } from '../lib/purpose'
import type { FieldErrors } from '../lib/intent'
import { ref, watch } from 'vue'

const props = defineProps<{
  errors: FieldErrors
  isCreating?: boolean
  serverError?: string | null
}>()

const recipient = ref('')
const amount = ref('')
const purpose = ref('')

const emit = defineEmits<{
  review: [draft: { recipient: string, amount: string, purpose: string }]
}>()

function submit() {
  if (props.isCreating) {
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
  <form class="panel" @submit.prevent="submit">
    <h2>Send an asset</h2>

    <p class="asset-label">Asset</p>
    <p class="asset-value">NIM</p>

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

    <label for="recipient">Recipient</label>
    <input
      id="recipient"
      v-model="recipient"
      type="text"
      name="recipient"
      autocomplete="off"
      autocapitalize="characters"
      spellcheck="false"
      placeholder="NQ07 0000 … 0000"
      :aria-invalid="Boolean(errors.recipient)"
    >
    <p v-if="errors.recipient" class="error" role="alert">{{ errors.recipient }}</p>

    <label for="purpose">Purpose</label>
    <select v-model="purpose" id="purpose" name="purpose">
      <option value="">Select a purpose</option>
      <option v-for="option in PAYMENT_PURPOSES" :key="option" :value="option">
        {{ option }}
      </option>
    </select>

    <p class="network">Nimiq Testnet</p>

    <p v-if="serverError" class="error" role="alert">{{ serverError }}</p>

    <button
      type="submit"
      class="primary"
      :disabled="isCreating"
      :aria-busy="isCreating"
    >
      {{ isCreating ? 'Checking payment details…' : 'Continue' }}
    </button>
  </form>
</template>

<style scoped>
h2 {
  margin: 0 0 1.1rem;
  font-size: 1.25rem;
  font-weight: 700;
}

label,
.asset-label {
  display: block;
  margin: 0 0 0.3rem;
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--text);
}

.asset-value {
  margin: 0 0 0.95rem;
  color: var(--muted);
  font-size: 1.02rem;
  font-weight: 700;
}

input,
select {
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

input[name='recipient'] {
  font-size: 0.86rem;
  letter-spacing: 0.01em;
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

input::placeholder {
  color: #8aa0b5;
  font-weight: 500;
}

input[aria-invalid='true'] {
  border-color: var(--danger);
}

.network {
  margin: 0.1rem 0 1rem;
  color: var(--muted);
  font-size: 0.95rem;
  font-weight: 600;
}

.error {
  margin: -0.55rem 0 0.85rem;
  color: var(--danger);
}
</style>
