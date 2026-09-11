import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const PRODUCTION_UI_FILES = [
  'src/App.vue',
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

  it('gates the send diagnostic panel behind development mode', () => {
    const appSource = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
    assert.match(appSource, /showSendDiagnostic = import\.meta\.env\.DEV/)
    assert.match(appSource, /v-if="showSendDiagnostic && sendDiagnostic/)
  })
})
