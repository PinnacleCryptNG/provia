<script setup lang="ts">
import type { RecipientCheckView } from '../lib/recipient-check'

defineProps<{
  view: RecipientCheckView
}>()

const emit = defineEmits<{
  retry: []
}>()
</script>

<template>
  <section
    v-if="view.status !== 'idle'"
    class="card"
    :data-status="view.status"
    aria-live="polite"
  >
    <p class="title">
      <span v-if="view.status === 'checking'" class="pulse" aria-hidden="true" />
      <span v-else-if="view.status === 'verified'" class="mark" aria-hidden="true">✓</span>
      <span v-else class="warn" aria-hidden="true">⚠</span>
      {{ view.title }}
    </p>
    <p class="message">{{ view.message }}</p>
    <ul v-if="view.checks.length > 0" class="checks">
      <li v-for="check in view.checks" :key="check.label">
        <span aria-hidden="true">✓</span>
        {{ check.label }}
      </li>
    </ul>
    <button
      v-if="view.canRetry"
      type="button"
      class="retry"
      @click="emit('retry')"
    >
      Try again
    </button>
  </section>
</template>

<style scoped>
.card {
  margin: 0 0 1rem;
  padding: 0.85rem 0.9rem 0.9rem;
  border: 1px solid var(--line);
  border-radius: 1rem;
  background: var(--surface-soft);
}

.card[data-status='verified'] {
  border-color: rgb(26 163 106 / 22%);
  background: rgb(26 163 106 / 6%);
}

.card[data-status='invalid'],
.card[data-status='unsupported'],
.card[data-status='error'] {
  border-color: rgb(208 122 47 / 28%);
  background: rgb(208 122 47 / 7%);
}

.title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0 0.35rem;
  font-size: 0.98rem;
  font-weight: 700;
}

.message {
  margin: 0;
  color: var(--muted);
  font-size: 0.9rem;
  font-weight: 500;
}

.checks {
  margin: 0.7rem 0 0;
  padding: 0;
  list-style: none;
}

.checks li {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  margin: 0 0 0.3rem;
  color: var(--text);
  font-size: 0.88rem;
  font-weight: 600;
}

.mark {
  color: var(--verified);
}

.warn {
  color: var(--mismatch);
}

.pulse {
  width: 0.5rem;
  height: 0.5rem;
  flex: 0 0 auto;
  border-radius: 999px;
  background: var(--primary);
  animation: pulse 1.4s ease-in-out infinite;
}

.retry {
  width: auto;
  min-height: 36px;
  margin: 0.7rem 0 0;
  border: none;
  padding: 0;
  background: transparent;
  color: var(--primary);
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
}

@keyframes pulse {
  0%,
  100% { opacity: 0.35; }
  50% { opacity: 1; }
}
</style>
