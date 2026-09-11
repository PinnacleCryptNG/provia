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
</script>

<template>
  <section class="receipt" :data-kind="view.kind">
    <p class="eyebrow">Evidence record</p>
    <h2 :class="['title', view.tone]">{{ view.title }}</h2>
    <p class="message">{{ view.message }}</p>

    <p v-if="view.isChecking" class="checking" role="status">
      <span class="pulse" aria-hidden="true" />
      Looking up independent blockchain evidence
    </p>

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
  margin: 0 0 0.55rem;
  font-size: clamp(1.35rem, 5vw, 1.7rem);
  line-height: 1.2;
}

.title.positive {
  color: var(--mint);
}

.title.negative {
  color: var(--danger);
}

.message {
  margin: 0 0 1.15rem;
  color: var(--muted);
}

.checking {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  margin: 0 0 1.1rem;
  color: var(--text);
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
  100% {
    opacity: 0.35;
  }
  50% {
    opacity: 1;
  }
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

.verified-mark {
  margin: 0 0 1rem;
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--mint);
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

button:disabled {
  opacity: 0.55;
}
</style>
