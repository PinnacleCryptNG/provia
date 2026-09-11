<script setup lang="ts">
type StepId = 'create' | 'checked' | 'review' | 'observing' | 'verdict'

const STEPS: { id: StepId, label: string }[] = [
  { id: 'create', label: 'Send' },
  { id: 'checked', label: 'Check' },
  { id: 'review', label: 'Review' },
  { id: 'observing', label: 'Verify' },
  { id: 'verdict', label: 'Done' },
]

const props = defineProps<{
  current: StepId
}>()

const order: StepId[] = STEPS.map((step) => step.id)

function statusFor(id: StepId): 'done' | 'current' | 'upcoming' {
  const currentIndex = order.indexOf(props.current)
  const index = order.indexOf(id)
  if (index < currentIndex) {
    return 'done'
  }
  if (index === currentIndex) {
    return 'current'
  }
  return 'upcoming'
}
</script>

<template>
  <ol class="steps" aria-label="Payment verification steps">
    <li
      v-for="step in STEPS"
      :key="step.id"
      :data-status="statusFor(step.id)"
    >
      <span class="dot" aria-hidden="true" />
      <span class="label">{{ step.label }}</span>
    </li>
  </ol>
</template>

<style scoped>
.steps {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0.25rem;
  margin: 0 0 1.1rem;
  padding: 0;
  list-style: none;
}

li {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
}

.dot {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 999px;
  background: var(--line);
}

.label {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--muted);
  text-align: center;
  line-height: 1.2;
  overflow-wrap: anywhere;
}

li[data-status='done'] .dot {
  background: var(--submitted);
}

li[data-status='current'] .dot {
  background: var(--primary);
  box-shadow: 0 0 0 4px rgb(5 130 202 / 16%);
}

li[data-status='current'] .label {
  color: var(--text);
}
</style>
