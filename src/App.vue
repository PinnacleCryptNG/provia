<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { NimiqProvider } from '@nimiq/mini-app-sdk'
import {
  initializeNimiqProvider,
  listNimiqAccounts,
  toUserFacingError,
} from './lib/nimiq'

const isInitializing = ref(true)
const isProviderReady = ref(false)
const isConnecting = ref(false)
const initError = ref<string | null>(null)
const connectionError = ref<string | null>(null)
const accounts = ref<string[] | null>(null)

let provider: NimiqProvider | null = null

onMounted(async () => {
  try {
    provider = await initializeNimiqProvider()
    isProviderReady.value = true
  }
  catch (error) {
    initError.value = toUserFacingError(error)
  }
  finally {
    isInitializing.value = false
  }
})

async function connectNimiqPay() {
  connectionError.value = null
  accounts.value = null

  if (!provider) {
    connectionError.value = 'Nimiq provider is not ready. Open this app inside Nimiq Pay.'
    return
  }

  isConnecting.value = true

  try {
    accounts.value = await listNimiqAccounts(provider)
  }
  catch (error) {
    connectionError.value = toUserFacingError(error)
  }
  finally {
    isConnecting.value = false
  }
}
</script>

<template>
  <main class="app">
    <p class="eyebrow">Nimiq Pay Mini App</p>
    <h1>PROVIA</h1>
    <p class="lede">
      Payment verification for Nimiq Pay. This first step only checks that the
      Nimiq provider can initialize.
    </p>

    <p v-if="isInitializing" class="status" role="status">
      Waiting for Nimiq Pay to initialize the provider...
    </p>

    <section v-else-if="!isProviderReady" class="panel" aria-live="polite">
      <h2>Open this app inside Nimiq Pay</h2>
      <p>
        The Nimiq provider was not found. PROVIA has to run in Nimiq Pay's Mini
        Apps browser so the wallet can inject the provider.
      </p>
      <p v-if="initError" class="error">{{ initError }}</p>
      <p>
        In Nimiq Pay, open Mini Apps and enter this machine's Network URL, for
        example <code>http://192.168.x.x:5173</code>. Do not use localhost.
      </p>
    </section>

    <section v-else class="panel">
      <p class="ready">Nimiq provider is ready.</p>
      <p>
        Connecting asks Nimiq Pay to share your Nimiq address. Approve the
        native confirmation dialog if you want to continue.
      </p>

      <button
        type="button"
        :disabled="isConnecting"
        @click="connectNimiqPay"
      >
        {{ isConnecting ? 'Connecting…' : 'Connect Nimiq Pay' }}
      </button>

      <p v-if="isConnecting" class="status" role="status">
        Requesting your Nimiq address...
      </p>

      <p v-if="connectionError" class="error" role="alert">
        {{ connectionError }}
      </p>

      <div v-if="accounts" class="result">
        <h2>Connected address</h2>
        <p
          v-for="address in accounts"
          :key="address"
          class="address"
        >
          {{ address }}
        </p>
      </div>
    </section>
  </main>
</template>

<style scoped>
.app {
  max-width: 42rem;
  margin: 0 auto;
  padding: 1.25rem 1rem 2.5rem;
}

.eyebrow {
  margin: 0 0 0.35rem;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #53657d;
}

h1 {
  margin: 0 0 0.75rem;
  font-size: clamp(1.75rem, 7vw, 2.4rem);
  line-height: 1.15;
}

h2 {
  margin: 0 0 0.5rem;
  font-size: 1.05rem;
}

.lede,
.panel p,
.status {
  margin: 0 0 0.85rem;
}

.panel {
  padding: 1rem;
  border-radius: 0.75rem;
  background: #fff;
}

.ready {
  font-weight: 600;
}

button {
  width: 100%;
  min-height: 44px;
  margin: 0.25rem 0 0.85rem;
  border: none;
  border-radius: 0.625rem;
  padding: 0.625rem 0.875rem;
  font-weight: 600;
  background: #1f3553;
  color: #fff;
}

button:disabled {
  opacity: 0.55;
}

.error {
  color: #b31b1b;
}

.result {
  margin-top: 0.5rem;
}

.address {
  margin: 0;
  padding: 0.75rem;
  border-radius: 0.5rem;
  background: #f5f8fc;
  overflow-wrap: anywhere;
  word-break: break-word;
}

code {
  font-size: 0.92em;
}
</style>
