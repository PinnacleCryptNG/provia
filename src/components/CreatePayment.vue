<script setup lang="ts">
import { PAYMENT_PURPOSES } from '../lib/purpose'
import type { FieldErrors } from '../lib/intent'
import { DEFAULT_NIMIQ_NETWORK, nimiqNetworkLabel } from '../lib/network'
import { ref } from 'vue'

defineProps<{
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
  emit('review', {
    recipient: recipient.value,
    amount: amount.value,
    purpose: purpose.value,
  })
}
</script>

<template>
  <form class="panel" @submit.prevent="submit">
    <h2>Request a payment</h2>
    <p class="hint">Nothing is sent until you approve it in Nimiq Pay.</p>

    <label>
      Amount
      <span class="amount-field">
        <input
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
    </label>
    <p v-if="errors.amount" class="error" role="alert">{{ errors.amount }}</p>

    <label>
      Recipient
      <input
        v-model="recipient"
        type="text"
        name="recipient"
        autocomplete="off"
        autocapitalize="characters"
        spellcheck="false"
        placeholder="NQ07 0000 0000 0000 0000 0000 0000 0000 0000"
        :aria-invalid="Boolean(errors.recipient)"
      >
    </label>
    <p v-if="errors.recipient" class="error" role="alert">{{ errors.recipient }}</p>

    <label>
      Purpose
      <span class="optional">Optional</span>
      <select v-model="purpose" name="purpose">
        <option value="">Select a purpose</option>
        <option v-for="option in PAYMENT_PURPOSES" :key="option" :value="option">
          {{ option }}
        </option>
      </select>
    </label>

    <p class="network">
      <span>Network</span>
      <strong>{{ nimiqNetworkLabel(DEFAULT_NIMIQ_NETWORK) }}</strong>
    </p>

    <p v-if="serverError" class="error" role="alert">{{ serverError }}</p>

    <button type="submit" class="primary" :disabled="isCreating">
      {{ isCreating ? 'Creating request…' : 'Continue' }}
    </button>
  </form>
</template>

<style scoped>
h2 {
  margin: 0 0 0.35rem;
  font-size: 1.35rem;
  font-weight: 800;
}

.hint {
  margin: 0 0 1.15rem;
  color: var(--muted);
  font-weight: 600;
}

label {
  display: block;
  margin: 0 0 0.3rem;
  font-size: 0.82rem;
  font-weight: 800;
  color: var(--muted);
}

.optional {
  margin-left: 0.4rem;
  font-weight: 600;
  color: var(--muted);
}

input,
select {
  display: block;
  width: 100%;
  min-height: 48px;
  margin: 0.35rem 0 0.85rem;
  border: 1px solid var(--line);
  border-radius: 0.9rem;
  padding: 0.7rem 0.85rem;
  background: var(--surface-soft);
  color: var(--text);
  overflow-wrap: anywhere;
}

.amount-field {
  position: relative;
  display: block;
  margin: 0.35rem 0 0.85rem;
}

.amount-field input {
  margin: 0;
  padding-right: 3.6rem;
  font-size: 1.2rem;
  font-weight: 800;
}

.suffix {
  position: absolute;
  top: 50%;
  right: 0.95rem;
  transform: translateY(-50%);
  color: var(--muted);
  font-weight: 800;
}

select {
  appearance: none;
  background-image: linear-gradient(45deg, transparent 50%, var(--muted) 50%), linear-gradient(135deg, var(--muted) 50%, transparent 50%);
  background-position: calc(100% - 18px) calc(50% - 3px), calc(100% - 12px) calc(50% - 3px);
  background-size: 6px 6px, 6px 6px;
  background-repeat: no-repeat;
}

input::placeholder {
  color: #8aa0b5;
  font-weight: 600;
}

input[aria-invalid='true'] {
  border-color: var(--danger);
}

.network {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.35rem 0.75rem;
  margin: 0.15rem 0 0.85rem;
  padding: 0.85rem 0.95rem;
  border: 1px solid var(--line);
  border-radius: 0.9rem;
  background: var(--surface-soft);
  font-size: 0.82rem;
  font-weight: 800;
  color: var(--muted);
}

.network strong {
  font-size: 1rem;
  color: var(--text);
}

.error {
  margin: -0.55rem 0 0.85rem;
  color: var(--danger);
}
</style>
