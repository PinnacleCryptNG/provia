<script setup lang="ts">
defineProps<{
  kind: 'cancelled' | 'failed'
}>()

const emit = defineEmits<{
  retry: []
  back: []
}>()
</script>

<template>
  <section class="panel" :data-kind="kind" aria-live="polite">
    <h2>{{ kind === 'cancelled' ? 'Payment cancelled' : 'Payment couldn’t be sent' }}</h2>
    <p class="lede">
      {{ kind === 'cancelled'
        ? 'Your payment wasn’t sent.'
        : 'Nimiq Pay could not complete this payment. No automatic retry was made.' }}
    </p>
    <button type="button" class="primary" @click="emit('retry')">
      Try again
    </button>
    <button
      type="button"
      class="secondary"
      @click="emit('back')"
    >
      Back
    </button>
  </section>
</template>

<style scoped>
h2 {
  margin: 0 0 0.55rem;
  font-size: 1.35rem;
  font-weight: 700;
}

.lede {
  margin: 0 0 1.15rem;
  color: var(--muted);
  font-weight: 500;
}
</style>
