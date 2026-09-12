<script setup lang="ts">
defineProps<{
  isConnecting: boolean
  isConnected: boolean
  accountLabel: string | null
}>()

const emit = defineEmits<{
  connect: []
}>()
</script>

<template>
  <header class="top">
    <div class="brand">
      <img
        class="mark"
        src="/provia-icon.png"
        alt=""
        width="32"
        height="32"
        decoding="async"
      />
      <p class="name">PROVIA</p>
    </div>
    <button
      v-if="!isConnected"
      type="button"
      class="connect"
      :disabled="isConnecting"
      @click="emit('connect')"
    >
      {{ isConnecting ? 'Connecting…' : 'Connect wallet' }}
    </button>
    <p v-else class="account">{{ accountLabel ?? 'Connected' }}</p>
  </header>
</template>

<style scoped>
.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1.15rem;
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-width: 0;
}

.mark {
  width: 2rem;
  height: 2rem;
  flex: 0 0 auto;
  display: block;
  object-fit: contain;
}

.name {
  margin: 0;
  font-size: 1.12rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.account {
  margin: 0;
  max-width: 11rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--muted);
  text-align: right;
  overflow-wrap: anywhere;
}

.connect {
  width: auto;
  min-height: 36px;
  margin: 0;
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 0.35rem 0.8rem;
  background: var(--surface);
  color: var(--text);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
}

.connect:hover:not(:disabled) {
  background: var(--surface-soft);
}

.connect:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

.connect:disabled {
  opacity: 0.65;
}
</style>
