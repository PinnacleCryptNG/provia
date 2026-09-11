export const PAYMENT_PURPOSES = [
  'Invoice',
  'Gift',
  'Utilities',
  'Friends & Family',
] as const

export type PaymentPurpose = (typeof PAYMENT_PURPOSES)[number]
