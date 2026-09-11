import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { confirmationProgressLabel, formatVerificationTime } from '../src/lib/format.ts'

describe('verification display formatting', () => {
  it('formats confirmation progress as current / required', () => {
    assert.equal(confirmationProgressLabel(34, 60), '34 / 60 confirmations')
  })

  it('formats verification time without raw ISO text', () => {
    const formatted = formatVerificationTime('2026-09-11T13:23:00.000Z')
    assert.notEqual(formatted, '2026-09-11T13:23:00.000Z')
    assert.equal(formatted.includes('T'), false)
    assert.notEqual(formatted, 'Unknown time')
  })
})
