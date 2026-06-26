import {
  estimateCancellationFee,
  formatCancellationFee,
} from '@/utils/cancellationFees'

describe('estimateCancellationFee', () => {
  it('returns 0 when waived', () => {
    expect(
      estimateCancellationFee({
        airport: 'LAX',
        cancelled_after_deadline: true,
        cancelled_before_1hr: false,
        waived: true,
      }),
    ).toBe(0)
  })

  it('applies no-show tier for billable LAX when cancelled within 1hr window', () => {
    expect(
      estimateCancellationFee({
        airport: 'LAX',
        cancelled_after_deadline: true,
        cancelled_before_1hr: false,
        waived: false,
      }),
    ).toBe(40)
  })

  it('applies after-deadline tier for billable ONT when cancelled before 1hr', () => {
    expect(
      estimateCancellationFee({
        airport: 'ONT',
        cancelled_after_deadline: true,
        cancelled_before_1hr: true,
        waived: false,
      }),
    ).toBe(8)
  })

  it('returns 0 for billable rider before deadline and before 1hr', () => {
    expect(
      estimateCancellationFee({
        airport: 'LAX',
        cancelled_after_deadline: false,
        cancelled_before_1hr: true,
        waived: false,
      }),
    ).toBe(0)
  })
})

describe('formatCancellationFee', () => {
  it('formats positive fees as dollars', () => {
    expect(formatCancellationFee(20)).toBe('$20')
  })

  it('formats zero as dash', () => {
    expect(formatCancellationFee(0)).toBe('-')
  })
})
