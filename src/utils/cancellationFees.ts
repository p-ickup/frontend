export type CancellationFeeInput = {
  airport: string
  cancelled_after_deadline: boolean
  cancelled_before_1hr: boolean
  waived: boolean
}

export function estimateCancellationFee(row: CancellationFeeInput): number {
  if (row.waived) return 0

  const isLAX = row.airport?.toUpperCase() === 'LAX'
  const isONT = row.airport?.toUpperCase() === 'ONT'

  if (!row.cancelled_before_1hr) {
    return isLAX ? 40 : isONT ? 15 : 0
  }

  if (row.cancelled_after_deadline) {
    return isLAX ? 20 : isONT ? 8 : 0
  }

  return 0
}

export function formatCancellationFee(fee: number): string {
  return fee > 0 ? `$${fee}` : '-'
}
