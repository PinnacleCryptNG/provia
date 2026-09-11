<script setup lang="ts">
defineEmits<{
  start: []
}>()
</script>

<template>
  <section class="hero">
    <p class="kicker">PROVIA</p>
    <h2>Independent payment verification</h2>
    <p class="lede">
      Verify your NIM payments on-chain instead of relying only on a wallet confirmation.
    </p>
    <button type="button" class="primary" @click="$emit('start')">
      Request a payment
    </button>
    <ol>
      <li>Create a payment request.</li>
      <li>Pay with Nimiq Pay.</li>
      <li>PROVIA independently verifies the transaction.</li>
    </ol>
  </section>
</template>

<style scoped>
.hero {
  padding: 1.4rem 1.1rem 1.5rem;
  border-radius: 1.35rem;
  background: var(--surface);
  border: 1px solid rgb(213 227 240 / 90%);
  box-shadow: var(--shadow);
}

.kicker {
  margin: 0 0 0.45rem;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--primary);
}

h2 {
  margin: 0 0 0.7rem;
  font-size: clamp(1.55rem, 6vw, 1.9rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.15;
}

.lede {
  margin: 0 0 1.2rem;
  color: var(--muted);
  font-size: 1.02rem;
}

ol {
  margin: 1.15rem 0 0;
  padding: 0;
  list-style: none;
  color: var(--muted);
}

li {
  position: relative;
  margin: 0 0 0.55rem;
  padding-left: 1.35rem;
  font-weight: 600;
}

li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.55rem;
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 999px;
  background: var(--primary);
}
</style>
