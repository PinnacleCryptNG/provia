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
  back: []
}>()

const view = computed(() => toVerificationView(props.state))
const showNotVerified = computed(() => {
  return view.value.kind === 'underpaid'
    || view.value.kind === 'overpaid'
    || view.value.kind === 'wrong_recipient'
    || view.value.kind === 'mismatch'
    || view.value.kind === 'failed'
})
const showStatus = computed(() => {
  return view.value.kind === 'submitted'
    || view.value.kind === 'checking'
    || view.value.kind === 'waiting'
    || view.value.kind === 'unresolved'
})
</script>

<template>
  <section class="receipt" :data-kind="view.kind">
    <div v-if="view.showVerifiedLabel" class="success-mark" aria-hidden="true">✓</div>
    <h2 :class="['title', view.tone]">{{ view.title }}</h2>
    <p class="message">{{ view.message }}</p>
    <p v-if="view.note && !view.showVerifiedLabel" class="note">{{ view.note }}</p>

    <p v-if="view.heroAmount && view.kind !== 'submitted'" class="amount">{{ view.heroAmount }}</p>

    <p v-if="view.isChecking" class="checking" role="status">
      <span class="pulse" aria-hidden="true" />
      Checking the Nimiq blockchain…
    </p>

    <div v-if="view.progress" class="progress">
      <p class="progress-label">{{ view.progress.label }}</p>
      <div class="bar" role="progressbar" :aria-valuenow="view.progress.current" :aria-valuemin="0" :aria-valuemax="view.progress.required">
        <span :style="{ width: `${view.progress.percent}%` }" />
      </div>
    </div>

    <p v-if="showStatus" class="confirm-hint">
      PROVIA checks the payment after 60 Nimiq confirmations.
    </p>

    <ol v-if="showStatus && view.statusSteps.length > 0" class="steps">
      <li v-for="step in view.statusSteps" :key="step.label" :data-done="step.done">
        <span class="tick" aria-hidden="true">{{ step.done ? '✓' : '○' }}</span>
        {{ step.label }}
      </li>
    </ol>

    <dl v-if="view.summaryRows.length > 0" class="summary">
      <div v-for="row in view.summaryRows" :key="row.label">
        <dt>{{ row.label }}</dt>
        <dd>{{ row.value }}</dd>
      </div>
    </dl>

    <details v-if="view.detailRows.length > 0" class="details">
      <summary>{{ view.detailsLabel }}</summary>
      <dl>
        <div v-for="row in view.detailRows" :key="row.label">
          <dt>{{ row.label }}</dt>
          <dd>{{ row.value }}</dd>
        </div>
      </dl>
    </details>

    <p v-if="view.note && view.showVerifiedLabel" class="disclaimer">{{ view.note }}</p>

    <button
      v-if="view.canRetry"
      type="button"
      class="primary"
      @click="emit('retry')"
    >
      Check again
    </button>
    <button
      v-if="showNotVerified || view.canRetry"
      type="button"
      class="secondary"
      @click="emit('back')"
    >
      Back to send
    </button>
    <button
      v-else-if="view.showVerifiedLabel"
      type="button"
      class="primary"
      @click="emit('restart')"
    >
      Send another asset
    </button>
  </section>
</template>

<style scoped>
.receipt {
  text-align: left;
}

.receipt[data-kind='verified'] {
  border-color: rgb(26 163 106 / 28%);
  background:
    linear-gradient(180deg, rgb(26 163 106 / 10%), transparent 42%),
    var(--surface);
}

.receipt[data-kind='waiting'],
.receipt[data-kind='checking'],
.receipt[data-kind='submitted'] {
  border-color: rgb(5 130 202 / 22%);
}

.receipt[data-kind='failed'],
.receipt[data-kind='underpaid'],
.receipt[data-kind='overpaid'],
.receipt[data-kind='wrong_recipient'],
.receipt[data-kind='mismatch'] {
  border-color: rgb(208 122 47 / 28%);
}

.success-mark {
  display: grid;
  place-items: center;
  width: 3.1rem;
  height: 3.1rem;
  margin: 0 0 0.85rem;
  border-radius: 999px;
  background: rgb(26 163 106 / 14%);
  color: var(--verified);
  font-size: 1.45rem;
  font-weight: 700;
}

.title {
  margin: 0 0 0.45rem;
  font-size: clamp(1.4rem, 6vw, 1.8rem);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.15;
}

.title.positive {
  color: var(--verified);
}

.title.waiting {
  color: var(--waiting);
}

.title.mismatch,
.title.negative {
  color: var(--mismatch);
}

.message,
.note,
.disclaimer,
.confirm-hint {
  margin: 0 0 0.85rem;
  color: var(--muted);
  font-weight: 500;
}

.confirm-hint {
  font-size: 0.9rem;
}

.disclaimer {
  font-size: 0.84rem;
  opacity: 0.88;
}

.amount {
  margin: 0 0 1rem;
  font-size: clamp(1.8rem, 7vw, 2.35rem);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.1;
}

.checking {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  margin: 0 0 1rem;
  font-weight: 700;
}

.pulse {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 999px;
  background: var(--primary);
  animation: pulse 1.4s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% { opacity: 0.35; }
  50% { opacity: 1; }
}

.progress {
  margin: 0 0 1rem;
}

.progress-label {
  margin: 0 0 0.45rem;
  font-size: 0.98rem;
  font-weight: 700;
  color: var(--waiting);
}

.bar {
  height: 0.55rem;
  overflow: hidden;
  border-radius: 999px;
  background: rgb(196 138 18 / 14%);
}

.bar span {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--waiting);
}

.steps {
  margin: 0 0 1rem;
  padding: 0;
  list-style: none;
}

.steps li {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  margin: 0 0 0.4rem;
  color: var(--muted);
  font-weight: 600;
}

.steps li[data-done='true'] {
  color: var(--verified);
}

.tick {
  width: 1.1rem;
  font-weight: 700;
}

.summary,
.details dl {
  margin: 0 0 1rem;
}

.summary div,
.details dl div {
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
  font-size: 1rem;
  font-weight: 600;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.details {
  margin: 0 0 1rem;
}

.details summary {
  cursor: pointer;
  font-weight: 600;
  color: var(--primary);
}
</style>
