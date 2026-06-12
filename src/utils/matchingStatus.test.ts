/** @jest-environment node */

import {
  countsTowardAdminUnmatchedCount,
  fromLegacyMatched,
  isEligibleForUnmatchedPool,
  isMatched,
  isSubmitted,
  isUnmatched,
  shouldDefaultOptInUnmatched,
} from '@/utils/matchingStatus'

describe('fromLegacyMatched', () => {
  it('maps null to submitted', () => {
    expect(fromLegacyMatched(null)).toBe('submitted')
  })

  it('maps false to unmatched', () => {
    expect(fromLegacyMatched(false)).toBe('unmatched')
  })

  it('maps true to matched', () => {
    expect(fromLegacyMatched(true)).toBe('matched')
  })
})

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

describe('isEligibleForUnmatchedPool', () => {
  it('includes only post-algorithm unmatched riders', () => {
    expect(isEligibleForUnmatchedPool('unmatched')).toBe(true)
    expect(isEligibleForUnmatchedPool('submitted')).toBe(false)
    expect(isEligibleForUnmatchedPool('matched')).toBe(false)
  })
})

describe('countsTowardAdminUnmatchedCount', () => {
  it('includes submitted and unmatched but not matched', () => {
    expect(countsTowardAdminUnmatchedCount('submitted')).toBe(true)
    expect(countsTowardAdminUnmatchedCount('unmatched')).toBe(true)
    expect(countsTowardAdminUnmatchedCount('matched')).toBe(false)
  })
})

describe('shouldDefaultOptInUnmatched', () => {
  it('defaults opt-in on for submitted and unmatched', () => {
    expect(shouldDefaultOptInUnmatched('submitted')).toBe(true)
    expect(shouldDefaultOptInUnmatched('unmatched')).toBe(true)
    expect(shouldDefaultOptInUnmatched('matched')).toBe(false)
  })
})
