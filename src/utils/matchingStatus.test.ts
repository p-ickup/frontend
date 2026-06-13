/** @jest-environment node */

import {
  isMatched,
  isSubmitted,
  isUnmatched,
  shouldDefaultOptInUnmatched,
} from '@/utils/matchingStatus'

describe('isSubmitted', () => {
  it('is true only for submitted', () => {
    expect(isSubmitted('submitted')).toBe(true)
    expect(isSubmitted('unmatched')).toBe(false)
    expect(isSubmitted('matched')).toBe(false)
  })
})

describe('isUnmatched', () => {
  it('is true only for unmatched', () => {
    expect(isUnmatched('unmatched')).toBe(true)
    expect(isUnmatched('submitted')).toBe(false)
    expect(isUnmatched('matched')).toBe(false)
  })
})

describe('isMatched', () => {
  it('is true only for matched', () => {
    expect(isMatched('matched')).toBe(true)
    expect(isMatched('submitted')).toBe(false)
    expect(isMatched('unmatched')).toBe(false)
  })
})

describe('shouldDefaultOptInUnmatched', () => {
  it('defaults opt-in on for submitted and unmatched', () => {
    expect(shouldDefaultOptInUnmatched('submitted')).toBe(true)
    expect(shouldDefaultOptInUnmatched('unmatched')).toBe(true)
    expect(shouldDefaultOptInUnmatched('matched')).toBe(false)
  })
})
