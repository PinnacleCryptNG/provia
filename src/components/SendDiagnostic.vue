<script setup lang="ts">
import type { PaymentSendDiagnostic } from '../lib/nimiq'

defineProps<{
  diagnostic: PaymentSendDiagnostic
}>()
</script>

<template>
  <section class="panel diagnostic">
    <h2>Send diagnostic</h2>
    <p class="hint">Development only. Not shown in production.</p>
    <dl>
      <div>
        <dt>Intent ID</dt>
        <dd class="mono">{{ diagnostic.intentId }}</dd>
      </div>
      <div>
        <dt>Method</dt>
        <dd class="mono">{{ diagnostic.method }}</dd>
      </div>
      <div>
        <dt>Data supplied</dt>
        <dd class="mono">{{ diagnostic.data }}</dd>
      </div>
      <div>
        <dt>Returned value</dt>
        <dd class="mono">{{ diagnostic.returnedValue }}</dd>
      </div>
      <div>
        <dt>Transaction hash used for verify</dt>
        <dd class="mono">{{ diagnostic.transactionHash }}</dd>
      </div>
    </dl>
  </section>
</template>

<style scoped>
.diagnostic {
  margin-top: 1rem;
  border-color: rgb(224 180 79 / 45%);
}

.hint {
  margin: 0 0 0.85rem;
  color: var(--muted);
  font-size: 0.92rem;
}

dl {
  margin: 0;
}

dl div {
  padding: 0.7rem 0;
  border-bottom: 1px solid var(--line);
}

dt {
  margin: 0 0 0.25rem;
  font-size: 0.75rem;
  font-weight: 650;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

dd {
  margin: 0;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.88rem;
}

h2 {
  margin: 0 0 0.5rem;
  font-size: 1.15rem;
}
</style>
