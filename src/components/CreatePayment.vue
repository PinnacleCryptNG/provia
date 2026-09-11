<script setup lang="ts">
import { ref } from 'vue'

import type { FieldErrors } from '../lib/intent'
import { DEFAULT_NIMIQ_NETWORK, nimiqNetworkLabel } from '../lib/network'

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
    <h2>Create payment</h2>
    <p class="hint">Enter the NIM payment you want PROVIA to verify. Nothing is sent until you approve it in Nimiq Pay.</p>

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
      Amount
      <input
        v-model="amount"
        type="text"
        name="amount"
        inputmode="decimal"
        autocomplete="off"
        placeholder="0.00"
        :aria-invalid="Boolean(errors.amount)"
      >
    </label>
    <p v-if="errors.amount" class="error" role="alert">{{ errors.amount }}</p>

    <p class="network">
      <span>Network</span>
      <strong>{{ nimiqNetworkLabel(DEFAULT_NIMIQ_NETWORK) }}</strong>
    </p>

    <label>
      Purpose
      <span class="optional">Optional</span>
      <input
        v-model="purpose"
        type="text"
        name="purpose"
        maxlength="140"
        autocomplete="off"
        placeholder="Invoice, rent, or a short note"
      >
    </label>

    <p v-if="serverError" class="error" role="alert">{{ serverError }}</p>

    <button type="submit" class="primary" :disabled="isCreating">
      {{ isCreating ? 'Creating request…' : 'Review payment' }}
    </button>
  </form>
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

label {
  display: block;
  margin: 0 0 0.35rem;
  font-size: 0.85rem;
  font-weight: 650;
}

.optional {
  margin-left: 0.4rem;
  font-weight: 500;
  color: var(--muted);
}

input {
  display: block;
  width: 100%;
  min-height: 44px;
  margin: 0.35rem 0 0.75rem;
  border: 1px solid var(--line);
  border-radius: 0.7rem;
  padding: 0.625rem 0.75rem;
  background: var(--ink);
  color: var(--text);
  overflow-wrap: anywhere;
}

input::placeholder {
  color: #6d7f96;
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
  margin: 0 0 1rem;
  padding: 0.75rem 0.85rem;
  border: 1px solid var(--line);
  border-radius: 0.7rem;
  font-size: 0.85rem;
  font-weight: 650;
}

.network strong {
  font-size: 1rem;
  font-weight: 650;
  overflow-wrap: anywhere;
}

.error {
  margin: -0.45rem 0 0.75rem;
  color: var(--danger);
}
</style>
