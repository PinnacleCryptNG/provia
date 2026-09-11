export function formatVerificationTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return 'Unknown time'
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function confirmationProgressLabel(current: number, required: number): string {
  return `${current} / ${required} confirmations`
}
