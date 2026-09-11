<script setup lang="ts">
import { ref } from 'vue'

import type { FieldErrors } from '../lib/intent'

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
    <p class="hint">Describe the NIM payment you intend to send. Nothing is submitted until you confirm it.</p>
    <p class="network">Network: Nimiq Testnet</p>

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
      Amount in NIM
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

    <button type="submit" :disabled="isCreating">
      {{ isCreating ? 'Creating intent…' : 'Review payment' }}
    </button>
  </form>
</template>

<style scoped>
.panel {
  padding: 1rem;
  border-radius: 0.75rem;
  background: var(--panel);
}

h2 {
  margin: 0 0 0.4rem;
  font-size: 1.1rem;
}

.hint {
  margin: 0 0 0.55rem;
  color: var(--muted);
}

.network {
  margin: 0 0 1rem;
  font-size: 0.9rem;
  color: var(--muted);
}

label {
  display: block;
  margin: 0 0 0.35rem;
  font-size: 0.85rem;
  font-weight: 600;
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
  border-radius: 0.625rem;
  padding: 0.625rem 0.75rem;
  background: var(--ink);
  color: var(--text);
}

input::placeholder {
  color: #6d7f96;
}

input[aria-invalid='true'] {
  border-color: var(--danger);
}

.error {
  margin: -0.45rem 0 0.75rem;
  color: var(--danger);
}

button {
  width: 100%;
  min-height: 44px;
  margin-top: 0.35rem;
  border: none;
  border-radius: 0.625rem;
  padding: 0.625rem 0.875rem;
  font-weight: 600;
  background: var(--primary);
  color: #f4f8fc;
}

button:disabled {
  opacity: 0.55;
}
</style>
