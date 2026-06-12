export type MatchingStatus = 'submitted' | 'unmatched' | 'matched'

export const MATCHING_STATUS = {
  submitted: 'submitted',
  unmatched: 'unmatched',
  matched: 'matched',
} as const

/** Map legacy `Flights.matched` until migration 3 drops the column. */
export const fromLegacyMatched = (matched: boolean | null): MatchingStatus => {
  if (matched === true) return MATCHING_STATUS.matched
  if (matched === false) return MATCHING_STATUS.unmatched
  return MATCHING_STATUS.submitted
}

export const isSubmitted = (status: MatchingStatus) =>
  status === MATCHING_STATUS.submitted

export const isUnmatched = (status: MatchingStatus) =>
  status === MATCHING_STATUS.unmatched

export const isMatched = (status: MatchingStatus) =>
  status === MATCHING_STATUS.matched

/** Student `/unmatched` peer pool — post-algorithm only. */
export const isEligibleForUnmatchedPool = (status: MatchingStatus) =>
  status === MATCHING_STATUS.unmatched

/** Admin dashboard count and CSV export — not yet in a group. */
export const countsTowardAdminUnmatchedCount = (status: MatchingStatus) =>
  status === MATCHING_STATUS.submitted || status === MATCHING_STATUS.unmatched

/** FlightForm default for opt-in to unmatched coordination. */
export const shouldDefaultOptInUnmatched = (status: MatchingStatus) =>
  status !== MATCHING_STATUS.matched
