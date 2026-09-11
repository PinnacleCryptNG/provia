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

export type StatusStep = {
  label: string
  done: boolean
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
  summaryRows: EvidenceRow[]
  detailRows: EvidenceRow[]
  statusSteps: StatusStep[]
  heroAmount: string | null
  detailsLabel: string
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

function confirmationsDisplay(current: number, required: number): string {
  return current >= required ? `${required}+` : confirmationProgressLabel(current, required)
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

function statusSteps(found: boolean, confirmed: boolean): StatusStep[] {
  return [
    { label: 'Payment submitted', done: true },
    { label: 'Payment found', done: found },
    { label: 'Confirming …', done: confirmed },
  ]
}

function withLayout(
  view: Omit<VerificationViewModel, 'summaryRows' | 'detailRows' | 'statusSteps' | 'heroAmount' | 'detailsLabel' | 'rows'> & {
    summaryRows: EvidenceRow[]
    detailRows?: EvidenceRow[]
    statusSteps?: StatusStep[]
    heroAmount?: string | null
    detailsLabel?: string
    rows?: EvidenceRow[]
  },
): VerificationViewModel {
  const detailRows = view.detailRows ?? []
  const summaryRows = view.summaryRows
  return {
    ...view,
    rows: view.rows ?? [...summaryRows, ...detailRows],
    summaryRows,
    detailRows,
    statusSteps: view.statusSteps ?? [],
    heroAmount: view.heroAmount ?? null,
    detailsLabel: view.detailsLabel ?? 'View transaction details',
  }
}

function transactionDetails(intent: PaymentIntent, result?: VerificationResult): EvidenceRow[] {
  const rows: EvidenceRow[] = [
    {
      label: 'Transaction hash',
      value: hashLabel(result?.transactionHash ?? intent.transactionHash),
    },
  ]

  if (result?.observedBlockNumber !== null && result?.observedBlockNumber !== undefined) {
    rows.push({
      label: 'Block',
      value: String(result.observedBlockNumber),
    })
  }

  if (result?.confirmations !== null && result?.confirmations !== undefined) {
    rows.push({
      label: 'Confirmations',
      value: confirmationProgressLabel(result.confirmations, result.confirmationPolicy),
    })
  }

  rows.push({
    label: 'Network',
    value: nimiqNetworkLabel(intent.network),
  })

  return rows
}

export function submittedView(intent: PaymentIntent): VerificationViewModel {
  return withLayout({
    kind: 'submitted',
    eyebrow: 'Submitted',
    title: 'Payment submitted',
    message: 'Your payment was submitted. PROVIA is checking the Nimiq blockchain now.',
    note: null,
    tone: 'neutral',
    showVerifiedLabel: false,
    canRetry: false,
    isChecking: false,
    progress: null,
    heroAmount: null,
    summaryRows: [],
    detailRows: transactionDetails(intent),
    statusSteps: statusSteps(false, false),
  })
}

export function observingView(intent: PaymentIntent): VerificationViewModel {
  return withLayout({
    kind: 'checking',
    eyebrow: 'Verifying',
    title: 'Verifying payment',
    message: 'PROVIA is independently checking the Nimiq blockchain.',
    note: null,
    tone: 'neutral',
    showVerifiedLabel: false,
    canRetry: false,
    isChecking: true,
    progress: null,
    heroAmount: `${intent.amountNim} NIM`,
    summaryRows: [],
    detailRows: transactionDetails(intent),
    statusSteps: statusSteps(false, false),
  })
}

function waitingView(intent: PaymentIntent, result: VerificationResult): VerificationViewModel {
  return withLayout({
    kind: 'waiting',
    eyebrow: 'Verifying',
    title: 'Verifying payment',
    message: 'PROVIA is independently checking the Nimiq blockchain.',
    note: null,
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
    heroAmount: `${intent.amountNim} NIM`,
    summaryRows: [],
    detailRows: transactionDetails(intent, result),
    statusSteps: statusSteps(true, false),
  })
}

function notFoundView(intent: PaymentIntent, result: VerificationResult): VerificationViewModel {
  return withLayout({
    kind: 'unresolved',
    eyebrow: 'Verifying',
    title: 'Looking for the payment',
    message: 'PROVIA will not mark this payment as failed. The transaction may still be pending.',
    note: null,
    tone: 'neutral',
    showVerifiedLabel: false,
    canRetry: true,
    isChecking: false,
    progress: null,
    heroAmount: `${intent.amountNim} NIM`,
    summaryRows: [],
    detailRows: transactionDetails(intent, result),
    statusSteps: statusSteps(false, false),
  })
}

function unresolvedEvidenceView(intent: PaymentIntent, result: VerificationResult): VerificationViewModel {
  const lookupFailed = result.reason === 'RPC_ERROR'

  return withLayout({
    kind: 'unresolved',
    eyebrow: 'Verifying',
    title: lookupFailed ? 'Could not check yet' : 'Still checking',
    message: lookupFailed
      ? 'PROVIA could not check the blockchain right now. This does not mean the payment failed.'
      : 'PROVIA does not yet have enough blockchain information to verify this payment.',
    note: 'This is not a failed payment.',
    tone: 'neutral',
    showVerifiedLabel: false,
    canRetry: true,
    isChecking: false,
    progress: null,
    heroAmount: `${intent.amountNim} NIM`,
    summaryRows: [],
    detailRows: transactionDetails(intent, result),
    statusSteps: statusSteps(false, false),
  })
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
  const amount = amountLabel(result.observedAmountLuna)
  const confirmations = result.confirmations === null
    ? 'Unavailable'
    : confirmationsDisplay(result.confirmations, result.confirmationPolicy)

  return withLayout({
    kind: 'verified',
    eyebrow: 'Verified',
    title: 'Payment verified',
    message: 'Your payment was independently verified on the Nimiq blockchain.',
    note: "This record reflects PROVIA's observation of the Nimiq blockchain. It is not a cryptographic certificate.",
    tone: 'positive',
    showVerifiedLabel: true,
    canRetry: false,
    isChecking: false,
    progress: null,
    heroAmount: amount,
    detailsLabel: 'View verification details',
    summaryRows: [
      {
        label: 'Recipient',
        value: recipientLabel(result.observedRecipient),
      },
      {
        label: 'Network',
        value: nimiqNetworkLabel(intent.network),
      },
      {
        label: 'Confirmations',
        value: confirmations,
      },
    ],
    detailRows: [
      {
        label: 'Transaction hash',
        value: result.transactionHash ?? 'Unavailable',
      },
      {
        label: 'Block',
        value: result.observedBlockNumber === null ? 'Unavailable' : String(result.observedBlockNumber),
      },
      {
        label: 'Confirmations',
        value: result.confirmations === null
          ? 'Unavailable'
          : confirmationProgressLabel(result.confirmations, result.confirmationPolicy),
      },
      {
        label: 'Amount',
        value: amount,
      },
      {
        label: 'Recipient',
        value: recipientLabel(result.observedRecipient),
      },
      {
        label: 'Network',
        value: nimiqNetworkLabel(intent.network),
      },
    ],
    statusSteps: statusSteps(true, true),
  })
}

const NOT_VERIFIED_MESSAGE = 'The observed transaction does not satisfy this payment request.'

function mismatchKind(result: VerificationResult): 'underpaid' | 'overpaid' | 'wrong_recipient' | 'mismatch' {
  if (result.outcome === 'UNDERPAID') {
    return 'underpaid'
  }

  if (result.reason === 'OVERPAID') {
    return 'overpaid'
  }

  if (result.reason === 'WRONG_RECIPIENT') {
    return 'wrong_recipient'
  }

  return 'mismatch'
}

function mismatchView(intent: PaymentIntent, result: VerificationResult): VerificationViewModel {
  return withLayout({
    kind: mismatchKind(result),
    eyebrow: 'Not verified',
    title: 'Payment not verified',
    message: NOT_VERIFIED_MESSAGE,
    note: null,
    tone: 'mismatch',
    showVerifiedLabel: false,
    canRetry: false,
    isChecking: false,
    progress: null,
    heroAmount: null,
    summaryRows: [],
    detailRows: transactionDetails(intent, result),
    statusSteps: statusSteps(true, false),
  })
}

function failedView(intent: PaymentIntent, result: VerificationResult): VerificationViewModel {
  return withLayout({
    kind: 'failed',
    eyebrow: 'Not verified',
    title: 'Payment not verified',
    message: NOT_VERIFIED_MESSAGE,
    note: null,
    tone: 'negative',
    showVerifiedLabel: false,
    canRetry: false,
    isChecking: false,
    progress: null,
    heroAmount: null,
    summaryRows: [],
    detailRows: transactionDetails(intent, result),
    statusSteps: statusSteps(true, false),
  })
}

export function resultView(intent: PaymentIntent, result: VerificationResult): VerificationViewModel {
  if (result.outcome === 'VERIFIED') {
    return verifiedView(intent, result)
  }

  if (result.outcome === 'FAILED') {
    return failedView(intent, result)
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
