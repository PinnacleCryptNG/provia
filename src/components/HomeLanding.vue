<script setup lang="ts">
defineEmits<{
  start: []
}>()
</script>

<template>
  <section class="hero">
    <h2>Send an asset with confidence.</h2>
    <p class="lede">
      Send through Nimiq Pay and let PROVIA independently verify the payment on-chain.
    </p>
    <button type="button" class="primary" @click="$emit('start')">
      Send an asset
    </button>
  </section>
</template>

<style scoped>
.hero {
  padding: 1.5rem 1.15rem 1.45rem;
  border-radius: 1.35rem;
  background: var(--surface);
  border: 1px solid rgb(213 227 240 / 90%);
  box-shadow: var(--shadow);
}

h2 {
  margin: 0 0 0.65rem;
  font-size: clamp(1.45rem, 6vw, 1.8rem);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.2;
}

.lede {
  margin: 0 0 1.25rem;
  color: var(--muted);
  font-size: 1.02rem;
  font-weight: 500;
}
</style>
