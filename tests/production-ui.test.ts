import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const PRODUCTION_UI_FILES = [
  'src/App.vue',
  'src/components/AppHeader.vue',
  'src/components/HomeLanding.vue',
  'src/components/CreatePayment.vue',
  'src/components/ReviewPayment.vue',
  'src/components/VerificationPayment.vue',
  'src/components/ProofReceipt.vue',
  'src/components/JourneySteps.vue',
  'src/lib/verification-view.ts',
]

const FORBIDDEN_PRODUCTION_COPY = [
  'Phase 6B',
  'Temporary Testnet',
  'sendBasicTransactionWithData',
  'Data supplied',
  'Returned value',
  'verifier unchanged',
  'will not accept this payment',
  'HTLC',
  'fromType',
  'recipientData',
  'shared liquidity',
]

describe('production UI copy', () => {
  for (const relativePath of PRODUCTION_UI_FILES) {
    it(`keeps ${relativePath} free of development-only language`, () => {
      const source = readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
      for (const phrase of FORBIDDEN_PRODUCTION_COPY) {
        assert.doesNotMatch(
          source,
          new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
          `${relativePath} still contains ${phrase}`,
        )
      }
    })
  }

  it('keeps purpose as an optional dropdown in Create Payment', () => {
    const source = readFileSync(new URL('../src/components/CreatePayment.vue', import.meta.url), 'utf8')
    const purposes = readFileSync(new URL('../src/lib/purpose.ts', import.meta.url), 'utf8')
    assert.match(source, /<select v-model="purpose"/)
    assert.match(source, /Select a purpose/)
    assert.match(source, /PAYMENT_PURPOSES/)
    assert.match(source, /Nimiq Testnet/)
    assert.match(purposes, /Invoice/)
    assert.match(purposes, /Gift/)
    assert.match(purposes, /Utilities/)
    assert.match(purposes, /Friends & Family/)
    assert.doesNotMatch(source, /type="text"\s+name="purpose"/)
  })

  it('keeps the homepage to a short request-a-payment prompt', () => {
    const source = readFileSync(new URL('../src/components/HomeLanding.vue', import.meta.url), 'utf8')
    assert.match(source, /Independent payment verification/)
    assert.match(source, /Request a NIM payment and verify it independently on the Nimiq blockchain/)
    assert.match(source, /Request a payment/)
    assert.doesNotMatch(source, /60 confirmations/)
    assert.doesNotMatch(source, /intent/i)
  })

  it('gates the send diagnostic panel behind development mode', () => {
    const appSource = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
    assert.match(appSource, /showSendDiagnostic = import\.meta\.env\.DEV/)
    assert.match(appSource, /showSendDiagnostic && SendDiagnostic && sendDiagnostic/)
    assert.match(appSource, /defineAsyncComponent/)
    assert.match(appSource, /components\/SendDiagnostic\.vue/)
  })
})
