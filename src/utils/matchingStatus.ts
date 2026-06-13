export type MatchingStatus = 'submitted' | 'unmatched' | 'matched'

export const MATCHING_STATUS = {
  submitted: 'submitted',
  unmatched: 'unmatched',
  matched: 'matched',
} as const

export const isSubmitted = (status: MatchingStatus) =>
  status === MATCHING_STATUS.submitted

export const isUnmatched = (status: MatchingStatus) =>
  status === MATCHING_STATUS.unmatched

export const isMatched = (status: MatchingStatus) =>
  status === MATCHING_STATUS.matched

/** FlightForm default for opt-in to unmatched coordination. */
export const shouldDefaultOptInUnmatched = (status: MatchingStatus) =>
  status !== MATCHING_STATUS.matched
