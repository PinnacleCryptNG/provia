<script setup lang="ts">
import { computed } from 'vue'
import type { VerificationFlowState } from '../lib/verification-flow'
import { toVerificationView } from '../lib/verification-view'

const props = defineProps<{
  state: VerificationFlowState
}>()

const emit = defineEmits<{
  retry: []
  restart: []
}>()

const view = computed(() => toVerificationView(props.state))
const checkingLabel = computed(() => {
  if (view.value.kind === 'waiting') {
    return 'Waiting for confirmations'
  }
  if (view.value.kind === 'unresolved' && view.value.title === 'Transaction not found yet') {
    return 'Locating the transaction'
  }
  return 'Observing the Nimiq blockchain'
})
const showNotVerifiedLabel = computed(() => {
  return view.value.kind === 'underpaid'
    || view.value.kind === 'overpaid'
    || view.value.kind === 'wrong_recipient'
    || view.value.kind === 'mismatch'
})
</script>

<template>
  <section class="receipt" :data-kind="view.kind">
    <p class="eyebrow">{{ view.eyebrow }}</p>
    <h2 :class="['title', view.tone]">{{ view.title }}</h2>
    <p v-if="view.showVerifiedLabel" class="badge">VERIFIED</p>
    <p v-else-if="showNotVerifiedLabel" class="badge mismatch">NOT VERIFIED</p>
    <p class="message">{{ view.message }}</p>
    <p v-if="view.note" class="note">{{ view.note }}</p>

    <p v-if="view.isChecking" class="checking" role="status">
      <span class="pulse" aria-hidden="true" />
      {{ checkingLabel }}
    </p>

    <div v-if="view.progress" class="progress">
      <p class="progress-label">{{ view.progress.label }}</p>
      <div class="bar" role="progressbar" :aria-valuenow="view.progress.current" :aria-valuemin="0" :aria-valuemax="view.progress.required">
        <span :style="{ width: `${view.progress.percent}%` }" />
      </div>
    </div>

    <dl>
      <div v-for="row in view.rows" :key="row.label">
        <dt>{{ row.label }}</dt>
        <dd>{{ row.value }}</dd>
      </div>
    </dl>

    <p v-if="view.showVerifiedLabel" class="verified-mark">Verified against the Nimiq blockchain</p>

    <button
      v-if="view.canRetry"
      type="button"
      class="primary"
      @click="emit('retry')"
    >
      Check again
    </button>
    <button
      type="button"
      :class="view.canRetry ? 'secondary' : 'primary'"
      :disabled="view.isChecking"
      @click="emit('restart')"
    >
      Create another payment
    </button>
  </section>
</template>

<style scoped>
.receipt {
  background: var(--record);
}

.receipt[data-kind='waiting'],
.receipt[data-kind='checking'] {
  border-color: rgb(224 180 79 / 45%);
}

.receipt[data-kind='verified'] {
  background:
    linear-gradient(180deg, rgb(62 207 159 / 10%), transparent 38%),
    var(--record);
  border-color: rgb(62 207 159 / 40%);
}

.receipt[data-kind='failed'] {
  border-color: rgb(224 107 107 / 45%);
}

.receipt[data-kind='underpaid'],
.receipt[data-kind='overpaid'],
.receipt[data-kind='wrong_recipient'],
.receipt[data-kind='mismatch'] {
  border-color: rgb(224 154 74 / 45%);
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
  font-size: clamp(1.3rem, 5vw, 1.7rem);
  line-height: 1.2;
}

.title.positive {
  color: var(--verified);
}

.title.waiting {
  color: var(--waiting);
}

.title.mismatch {
  color: var(--mismatch);
}

.title.negative {
  color: var(--danger);
}

.title.neutral {
  color: var(--text);
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

.badge.mismatch {
  background: rgb(224 154 74 / 16%);
  color: var(--mismatch);
}

.message,
.note {
  margin: 0 0 0.85rem;
  color: var(--muted);
}

.checking {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  margin: 0 0 1rem;
  color: var(--text);
}

.pulse {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 999px;
  background: var(--waiting);
  animation: pulse 1.4s ease-in-out infinite;
}

.receipt[data-kind='checking'] .pulse {
  background: var(--submitted);
}

@keyframes pulse {
  0%,
  100% {
    opacity: 0.35;
  }
  50% {
    opacity: 1;
  }
}

.progress {
  margin: 0 0 1.1rem;
}

.progress-label {
  margin: 0 0 0.45rem;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--waiting);
}

.bar {
  height: 0.45rem;
  overflow: hidden;
  border-radius: 999px;
  background: rgb(224 180 79 / 16%);
}

.bar span {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--waiting);
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

.verified-mark {
  margin: 0 0 1rem;
  font-size: 0.92rem;
  font-weight: 650;
  color: var(--verified);
}
</style>
