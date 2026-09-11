import { formatLunaAsNim } from './amount.ts'
import { confirmationProgressLabel } from './format.ts'
import type { PaymentIntent } from './intent.ts'
import { nimiqNetworkLabel } from './network.ts'
import type { VerificationResult } from './verify.ts'
import type { VerificationFlowState } from './verification-flow.ts'

export type VerificationTone = 'neutral' | 'positive' | 'waiting' | 'mismatch' | 'negative'

export type EvidenceRow = {
  label: string
  value: string
}

export type ConfirmationProgress = {
  current: number
  required: number
  label: string
  percent: number
}

export type VerificationViewModel = {
  kind:
    | 'submitted'
    | 'checking'
    | 'verified'
    | 'underpaid'
    | 'overpaid'
    | 'wrong_recipient'
    | 'mismatch'
    | 'failed'
    | 'unresolved'
    | 'waiting'
  eyebrow: string
  title: string
  message: string
  note: string | null
  tone: VerificationTone
  showVerifiedLabel: boolean
  canRetry: boolean
  isChecking: boolean
  progress: ConfirmationProgress | null
  rows: EvidenceRow[]
}

function amountLabel(luna: number | null): string {
  if (luna === null) {
    return 'Unavailable'
  }

  return `${formatLunaAsNim(luna)} NIM`
}

function hashLabel(hash: string | null): string {
  if (!hash) {
    return 'Unavailable'
  }

  return hash
}

function recipientLabel(address: string | null): string {
  if (!address) {
    return 'Unavailable'
  }

  return address
}

function progressFrom(result: VerificationResult): ConfirmationProgress | null {
  if (result.confirmations === null) {
    return null
  }

  const current = result.confirmations
  const required = result.confirmationPolicy
  return {
    current,
    required,
    label: confirmationProgressLabel(current, required),
    percent: required <= 0 ? 0 : Math.max(0, Math.min(100, Math.round((current / required) * 100))),
  }
}

function evidenceRows(intent: PaymentIntent, result?: VerificationResult): EvidenceRow[] {
  return [
    {
      label: 'Amount',
      value: result ? amountLabel(result.expectedAmountLuna) : `${intent.amountNim} NIM`,
    },
    {
      label: 'Recipient',
      value: recipientLabel(result?.expectedRecipient ?? intent.recipient),
    },
    {
      label: 'Network',
      value: nimiqNetworkLabel(intent.network),
    },
    {
      label: 'Transaction',
      value: hashLabel(result?.transactionHash ?? intent.transactionHash),
    },
  ]
}

export function submittedView(intent: PaymentIntent): VerificationViewModel {
  return {
    kind: 'submitted',
    eyebrow: 'Submitted',
    title: 'Payment submitted',
    message: 'Nimiq Pay accepted the transaction. PROVIA has not verified it yet.',
    note: 'PROVIA will now locate this payment on the Nimiq blockchain independently.',
    tone: 'neutral',
    showVerifiedLabel: false,
    canRetry: false,
    isChecking: false,
    progress: null,
    rows: evidenceRows(intent),
  }
}

export function observingView(intent: PaymentIntent): VerificationViewModel {
  return {
    kind: 'checking',
    eyebrow: 'Observing',
    title: 'Observing the blockchain',
    message: 'PROVIA is independently observing the Nimiq blockchain before declaring this payment verified.',
    note: null,
    tone: 'neutral',
    showVerifiedLabel: false,
    canRetry: false,
    isChecking: true,
    progress: null,
    rows: evidenceRows(intent),
  }
}

function waitingView(intent: PaymentIntent, result: VerificationResult): VerificationViewModel {
  return {
    kind: 'waiting',
    eyebrow: 'Observing',
    title: 'Waiting for confirmations',
    message: 'PROVIA is independently observing the Nimiq blockchain before declaring this payment verified. The payment does not yet have enough blockchain confirmations.',
    note: 'Verification requires 60 confirmations.',
    tone: 'waiting',
    showVerifiedLabel: false,
    canRetry: true,
    isChecking: false,
    progress: progressFrom(result) ?? {
      current: 0,
      required: result.confirmationPolicy,
      label: confirmationProgressLabel(0, result.confirmationPolicy),
      percent: 0,
    },
    rows: evidenceRows(intent, result),
  }
}

function notFoundView(intent: PaymentIntent, result: VerificationResult): VerificationViewModel {
  return {
    kind: 'unresolved',
    eyebrow: 'Unresolved',
    title: 'Transaction not found yet',
    message: 'PROVIA will not mark this payment as failed. The transaction may still be pending or the network may not have indexed it yet.',
    note: null,
    tone: 'neutral',
    showVerifiedLabel: false,
    canRetry: true,
    isChecking: false,
    progress: null,
    rows: evidenceRows(intent, result),
  }
}

function unresolvedEvidenceView(intent: PaymentIntent, result: VerificationResult): VerificationViewModel {
  const rpcFailed = result.reason === 'RPC_ERROR'

  return {
    kind: 'unresolved',
    eyebrow: 'Unresolved',
    title: rpcFailed ? 'Could not retrieve evidence' : 'Not enough evidence yet',
    message: rpcFailed
      ? 'Blockchain evidence could not currently be retrieved. This does not mean the payment failed.'
      : 'PROVIA does not yet have enough independent blockchain evidence to verify this payment.',
    note: 'This is not a failed payment.',
    tone: 'neutral',
    showVerifiedLabel: false,
    canRetry: true,
    isChecking: false,
    progress: null,
    rows: evidenceRows(intent, result),
  }
}

function unresolvedView(intent: PaymentIntent, result: VerificationResult): VerificationViewModel {
  if (result.reason === 'INSUFFICIENT_CONFIRMATIONS') {
    return waitingView(intent, result)
  }

  if (result.reason === 'NOT_FOUND') {
    return notFoundView(intent, result)
  }

  return unresolvedEvidenceView(intent, result)
}

function verifiedView(intent: PaymentIntent, result: VerificationResult): VerificationViewModel {
  return {
    kind: 'verified',
    eyebrow: 'Verdict',
    title: 'Payment verified',
    message: 'PROVIA verified this payment using independently observed blockchain data.',
    note: 'This is an observation record of what PROVIA saw on the Nimiq blockchain. It is not a cryptographic certificate.',
    tone: 'positive',
    showVerifiedLabel: true,
    canRetry: false,
    isChecking: false,
    progress: progressFrom(result),
    rows: [
      {
        label: 'Amount',
        value: amountLabel(result.observedAmountLuna),
      },
      {
        label: 'Recipient',
        value: recipientLabel(result.observedRecipient),
      },
      {
        label: 'Network',
        value: nimiqNetworkLabel(intent.network),
      },
      {
        label: 'Transaction',
        value: result.transactionHash ?? 'Unavailable',
      },
      {
        label: 'Block',
        value: result.observedBlockNumber === null ? 'Unavailable' : String(result.observedBlockNumber),
      },
      {
        label: 'Confirmations',
        value: result.confirmations === null ? 'Unavailable' : confirmationProgressLabel(result.confirmations, result.confirmationPolicy),
      },
    ],
  }
}

const NOT_VERIFIED_MESSAGE = 'The observed transaction does not satisfy this payment request.'

function mismatchView(intent: PaymentIntent, result: VerificationResult): VerificationViewModel {
  const base = {
    eyebrow: 'Verdict',
    title: 'Payment not verified',
    message: NOT_VERIFIED_MESSAGE,
    tone: 'mismatch' as const,
    showVerifiedLabel: false,
    canRetry: false,
    isChecking: false,
    progress: null,
  }

  if (result.outcome === 'UNDERPAID') {
    return {
      ...base,
      kind: 'underpaid',
      note: 'The amount observed on chain is less than the requested amount.',
      rows: [
        {
          label: 'Expected',
          value: amountLabel(result.expectedAmountLuna),
        },
        {
          label: 'Observed',
          value: amountLabel(result.observedAmountLuna),
        },
        {
          label: 'Transaction',
          value: hashLabel(result.transactionHash ?? intent.transactionHash),
        },
      ],
    }
  }

  if (result.reason === 'OVERPAID') {
    return {
      ...base,
      kind: 'overpaid',
      note: 'The amount observed on chain is greater than the requested amount.',
      rows: [
        {
          label: 'Expected',
          value: amountLabel(result.expectedAmountLuna),
        },
        {
          label: 'Observed',
          value: amountLabel(result.observedAmountLuna),
        },
        {
          label: 'Transaction',
          value: hashLabel(result.transactionHash ?? intent.transactionHash),
        },
      ],
    }
  }

  if (result.reason === 'WRONG_RECIPIENT') {
    return {
      ...base,
      kind: 'wrong_recipient',
      note: 'The transaction was sent to a different address than the payment request.',
      rows: [
        {
          label: 'Expected recipient',
          value: recipientLabel(result.expectedRecipient),
        },
        {
          label: 'Observed recipient',
          value: recipientLabel(result.observedRecipient),
        },
        {
          label: 'Transaction',
          value: hashLabel(result.transactionHash ?? intent.transactionHash),
        },
      ],
    }
  }

  return {
    ...base,
    kind: 'mismatch',
    note: result.reason === 'WRONG_NETWORK'
      ? 'The transaction was found on a different Nimiq network than the payment request.'
      : null,
    rows: evidenceRows(intent, result),
  }
}

function failedView(result: VerificationResult): VerificationViewModel {
  return {
    kind: 'failed',
    eyebrow: 'Failed',
    title: 'Payment failed',
    message: 'The transaction was included on the Nimiq blockchain, but execution failed.',
    note: null,
    tone: 'negative',
    showVerifiedLabel: false,
    canRetry: false,
    isChecking: false,
    progress: null,
    rows: [
      {
        label: 'Transaction',
        value: hashLabel(result.transactionHash),
      },
      {
        label: 'Amount',
        value: amountLabel(result.observedAmountLuna),
      },
      {
        label: 'Recipient',
        value: recipientLabel(result.observedRecipient),
      },
    ],
  }
}

export function resultView(intent: PaymentIntent, result: VerificationResult): VerificationViewModel {
  if (result.outcome === 'VERIFIED') {
    return verifiedView(intent, result)
  }

  if (result.outcome === 'FAILED') {
    return failedView(result)
  }

  if (result.outcome === 'UNRESOLVED') {
    return unresolvedView(intent, result)
  }

  return mismatchView(intent, result)
}

function withChecking(view: VerificationViewModel): VerificationViewModel {
  return {
    ...view,
    isChecking: true,
    canRetry: false,
  }
}

export function toVerificationView(state: VerificationFlowState): VerificationViewModel {
  if (state.screen === 'submitted') {
    return submittedView(state.intent)
  }

  if (state.screen === 'checking') {
    if (state.lastResult) {
      return withChecking(resultView(state.intent, state.lastResult))
    }

    return observingView(state.intent)
  }

  return resultView(state.intent, state.result)
}
