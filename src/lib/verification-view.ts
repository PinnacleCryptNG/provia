import { shortenNimiqAddress, shortenTransactionHash } from './address.ts'
import { formatLunaAsNim } from './amount.ts'
import { confirmationProgressLabel } from './format.ts'
import type { PaymentIntent } from './intent.ts'
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

  return shortenTransactionHash(hash)
}

function recipientLabel(address: string | null): string {
  if (!address) {
    return 'Unavailable'
  }

  return shortenNimiqAddress(address)
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

function intentRows(intent: PaymentIntent): EvidenceRow[] {
  return [
    {
      label: 'Transaction',
      value: hashLabel(intent.transactionHash),
    },
    {
      label: 'Amount',
      value: `${intent.amountNim} NIM`,
    },
    {
      label: 'Recipient',
      value: recipientLabel(intent.recipient),
    },
  ]
}

export function submittedView(intent: PaymentIntent): VerificationViewModel {
  return {
    kind: 'submitted',
    eyebrow: 'Submitted',
    title: 'Payment submitted',
    message: 'The wallet accepted the transaction. PROVIA has not verified it yet.',
    note: 'PROVIA will now observe the Nimiq blockchain independently.',
    tone: 'neutral',
    showVerifiedLabel: false,
    canRetry: false,
    isChecking: false,
    progress: null,
    rows: intentRows(intent),
  }
}

export function observingView(intent: PaymentIntent): VerificationViewModel {
  return {
    kind: 'checking',
    eyebrow: 'Observing',
    title: 'Observing the blockchain',
    message: 'PROVIA is looking up this transaction independently. A wallet confirmation is not verification.',
    note: null,
    tone: 'neutral',
    showVerifiedLabel: false,
    canRetry: false,
    isChecking: true,
    progress: null,
    rows: [
      {
        label: 'Amount',
        value: `${intent.amountNim} NIM`,
      },
      {
        label: 'Recipient',
        value: recipientLabel(intent.recipient),
      },
    ],
  }
}

function waitingView(intent: PaymentIntent, result: VerificationResult): VerificationViewModel {
  return {
    kind: 'waiting',
    eyebrow: 'Observing',
    title: 'Waiting for confirmations',
    message: 'PROVIA is waiting for enough blockchain confirmations before declaring this payment verified.',
    note: 'Testnet verification usually takes about a minute.',
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
    rows: [
      {
        label: 'Transaction',
        value: hashLabel(result.transactionHash ?? intent.transactionHash),
      },
      {
        label: 'Amount',
        value: amountLabel(result.expectedAmountLuna),
      },
      {
        label: 'Recipient',
        value: recipientLabel(result.expectedRecipient),
      },
    ],
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
    rows: [
      {
        label: 'Transaction',
        value: hashLabel(result.transactionHash ?? intent.transactionHash),
      },
      {
        label: 'Amount',
        value: amountLabel(result.expectedAmountLuna),
      },
      {
        label: 'Recipient',
        value: recipientLabel(result.expectedRecipient),
      },
    ],
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
    rows: [
      {
        label: 'Transaction',
        value: hashLabel(result.transactionHash ?? intent.transactionHash),
      },
      {
        label: 'Amount',
        value: amountLabel(result.expectedAmountLuna),
      },
      {
        label: 'Recipient',
        value: recipientLabel(result.expectedRecipient),
      },
    ],
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

function verifiedView(result: VerificationResult): VerificationViewModel {
  return {
    kind: 'verified',
    eyebrow: 'Verdict',
    title: 'Payment verified',
    message: 'Recipient matched, amount matched, execution succeeded, and the 60-confirmation requirement was satisfied.',
    note: 'Verified against independent Nimiq blockchain evidence.',
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
        label: 'Transaction',
        value: hashLabel(result.transactionHash),
      },
      {
        label: 'Confirmations',
        value: result.confirmations === null ? 'Unavailable' : confirmationProgressLabel(result.confirmations, result.confirmationPolicy),
      },
      {
        label: 'Block',
        value: result.observedBlockNumber === null ? 'Unavailable' : String(result.observedBlockNumber),
      },
    ],
  }
}

function mismatchView(intent: PaymentIntent, result: VerificationResult): VerificationViewModel {
  if (result.outcome === 'UNDERPAID') {
    return {
      kind: 'underpaid',
      eyebrow: 'Doesn’t match',
      title: "Payment doesn't match",
      message: 'The amount observed on chain is less than the requested amount.',
      note: null,
      tone: 'mismatch',
      showVerifiedLabel: false,
      canRetry: false,
      isChecking: false,
      progress: null,
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
      kind: 'overpaid',
      eyebrow: 'Doesn’t match',
      title: "Payment doesn't match",
      message: 'The amount observed on chain is greater than the requested amount.',
      note: null,
      tone: 'mismatch',
      showVerifiedLabel: false,
      canRetry: false,
      isChecking: false,
      progress: null,
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
      kind: 'wrong_recipient',
      eyebrow: 'Doesn’t match',
      title: "Payment doesn't match",
      message: 'The transaction was sent to a different address than the payment request.',
      note: null,
      tone: 'mismatch',
      showVerifiedLabel: false,
      canRetry: false,
      isChecking: false,
      progress: null,
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

  const message = result.reason === 'WRONG_NETWORK'
    ? 'The transaction was found on a different Nimiq network than the payment request.'
    : result.reason === 'WRONG_ASSET'
      ? 'The transaction is not a NIM payment.'
      : 'The transaction is not the intended basic NIM payment.'

  return {
    kind: 'mismatch',
    eyebrow: 'Doesn’t match',
    title: "Payment doesn't match",
    message,
    note: null,
    tone: 'mismatch',
    showVerifiedLabel: false,
    canRetry: false,
    isChecking: false,
    progress: null,
    rows: intentRows(intent),
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
    return verifiedView(result)
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
