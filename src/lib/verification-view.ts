import { shortenNimiqAddress, shortenTransactionHash } from './address.ts'
import { formatLunaAsNim } from './amount.ts'
import type { PaymentIntent } from './intent.ts'
import { nimiqNetworkLabel } from './network.ts'
import type { VerificationResult } from './verify.ts'
import type { VerificationFlowState } from './verification-flow.ts'

export type VerificationTone = 'neutral' | 'positive' | 'caution' | 'negative'

export type EvidenceRow = {
  label: string
  value: string
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
  title: string
  message: string
  tone: VerificationTone
  showVerifiedLabel: boolean
  canRetry: boolean
  isChecking: boolean
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
    {
      label: 'Network',
      value: nimiqNetworkLabel(intent.network),
    },
  ]
}

export function submittedView(intent: PaymentIntent): VerificationViewModel {
  return {
    kind: 'submitted',
    title: 'Payment submitted',
    message: "Your transaction was submitted to the Nimiq network. We're waiting for blockchain evidence.",
    tone: 'neutral',
    showVerifiedLabel: false,
    canRetry: false,
    isChecking: false,
    rows: intentRows(intent),
  }
}

export function checkingView(intent: PaymentIntent): VerificationViewModel {
  return {
    kind: 'checking',
    title: 'Checking payment',
    message: 'PROVIA is checking the Nimiq network.',
    tone: 'neutral',
    showVerifiedLabel: false,
    canRetry: false,
    isChecking: true,
    rows: [
      {
        label: 'Intended amount',
        value: `${intent.amountNim} NIM`,
      },
      {
        label: 'Recipient',
        value: recipientLabel(intent.recipient),
      },
    ],
  }
}

function unresolvedView(intent: PaymentIntent, result: VerificationResult): VerificationViewModel {
  const isWaiting = result.reason === 'INSUFFICIENT_CONFIRMATIONS'

  return {
    kind: isWaiting ? 'waiting' : 'unresolved',
    title: 'Payment not verified yet',
    message: isWaiting
      ? 'PROVIA found the transaction, but it does not yet have enough confirmations to verify.'
      : 'PROVIA could not establish sufficient blockchain evidence yet.',
    tone: 'caution',
    showVerifiedLabel: false,
    canRetry: true,
    isChecking: false,
    rows: [
      {
        label: 'Transaction',
        value: hashLabel(result.transactionHash ?? intent.transactionHash),
      },
      {
        label: 'Intended amount',
        value: amountLabel(result.expectedAmountLuna),
      },
      {
        label: 'Recipient',
        value: recipientLabel(result.expectedRecipient),
      },
      ...(result.confirmations !== null
        ? [{
            label: 'Confirmations',
            value: `${result.confirmations} of ${result.confirmationPolicy} required`,
          }]
        : []),
    ],
  }
}

function verifiedView(result: VerificationResult): VerificationViewModel {
  return {
    kind: 'verified',
    title: 'Payment verified',
    message:
      'The transaction was found on the Nimiq blockchain. The recipient matches, the amount matches, the transaction executed successfully, and the confirmation requirement was satisfied.',
    tone: 'positive',
    showVerifiedLabel: true,
    canRetry: false,
    isChecking: false,
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
        value: result.confirmations === null ? 'Unavailable' : String(result.confirmations),
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
      title: "Payment doesn't match",
      message: 'PROVIA found the transaction, but the amount received is less than requested.',
      tone: 'caution',
      showVerifiedLabel: false,
      canRetry: false,
      isChecking: false,
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
      title: "Payment doesn't match",
      message: 'PROVIA found the transaction, but the amount is greater than the requested amount.',
      tone: 'caution',
      showVerifiedLabel: false,
      canRetry: false,
      isChecking: false,
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
      title: "Payment doesn't match",
      message: 'The transaction was sent to a different address than the payment intent.',
      tone: 'caution',
      showVerifiedLabel: false,
      canRetry: false,
      isChecking: false,
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
    ? 'PROVIA found the transaction on a different Nimiq network than the payment intent.'
    : result.reason === 'WRONG_ASSET'
      ? 'PROVIA found the transaction, but it is not a NIM payment.'
      : 'PROVIA found the transaction, but it does not match the intended basic NIM payment.'

  return {
    kind: 'mismatch',
    title: "Payment doesn't match",
    message,
    tone: 'caution',
    showVerifiedLabel: false,
    canRetry: false,
    isChecking: false,
    rows: intentRows(intent),
  }
}

function failedView(result: VerificationResult): VerificationViewModel {
  return {
    kind: 'failed',
    title: 'Payment failed',
    message: 'The transaction was included on the Nimiq blockchain, but execution failed.',
    tone: 'negative',
    showVerifiedLabel: false,
    canRetry: false,
    isChecking: false,
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

export function toVerificationView(state: VerificationFlowState): VerificationViewModel {
  if (state.screen === 'submitted') {
    return submittedView(state.intent)
  }

  if (state.screen === 'checking') {
    return checkingView(state.intent)
  }

  return resultView(state.intent, state.result)
}
