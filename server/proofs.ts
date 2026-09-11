import type { VerificationResult } from '../src/lib/verify.ts'

/**
 * Future public proofs will be issued only from a server VERIFIED result,
 * not from Mini App or browser state.
 *
 * Proof generation is not implemented in this phase.
 */
export type ProofInput = {
  result: VerificationResult
}

export type ProofRecord = {
  id: string
  createdAt: string
  verification: VerificationResult
}

export function createProofFromVerifiedResult(_input: ProofInput): ProofRecord {
  throw new Error('Proof generation is not implemented yet.')
}
