<script setup lang="ts">
defineProps<{
  networkLabel: string
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
      <span class="mark" aria-hidden="true" />
      <p class="name">PROVIA</p>
    </div>
    <div class="meta">
      <p class="network">{{ networkLabel }}</p>
      <button
        v-if="!isConnected"
        type="button"
        class="connect"
        :disabled="isConnecting"
        @click="emit('connect')"
      >
        {{ isConnecting ? 'Connecting…' : 'Connect Wallet' }}
      </button>
      <p v-else class="account">{{ accountLabel ?? 'Connected' }}</p>
    </div>
  </header>
</template>

<style scoped>
.top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1.15rem;
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  min-width: 0;
}

.mark {
  width: 2.1rem;
  height: 2.1rem;
  flex: 0 0 auto;
  border-radius: 0.75rem;
  background:
    linear-gradient(180deg, #1aa8ea, var(--primary));
  box-shadow: 0 8px 18px rgb(5 130 202 / 22%);
}

.mark::after {
  content: '';
  display: block;
  width: 0.85rem;
  height: 0.42rem;
  margin: 0.72rem auto 0;
  border-left: 2px solid #fff;
  border-bottom: 2px solid #fff;
  transform: rotate(-45deg);
}

.name {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.35rem;
  min-width: 0;
}

.network,
.account {
  margin: 0;
  font-size: 0.78rem;
  font-weight: 800;
  color: var(--muted);
  text-align: right;
  overflow-wrap: anywhere;
}

.account {
  color: var(--text);
}

.connect {
  width: auto;
  min-height: 36px;
  margin: 0;
  border: none;
  border-radius: 999px;
  padding: 0.4rem 0.8rem;
  background: var(--primary);
  color: #fff;
  font-size: 0.78rem;
  font-weight: 800;
  cursor: pointer;
}

.connect:disabled {
  opacity: 0.7;
}
</style>
