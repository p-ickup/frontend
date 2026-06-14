/**
 * Subsidy and covered-dates config for matching, vouchers, and persistence.
 * Period date ranges live in servicePeriods.ts; lists here are derived at load.
 * Keep ML backend (e.g. config.py) in sync when breaks change.
 */

import { getDerivedCoveredDates } from '@/config/servicePeriodHelpers'

export const COVERED_DATES_EXPLICIT = true

const derivedCoveredDates = getDerivedCoveredDates()

/** Allowed dates for outbound rides (to_airport true), MM-DD year-agnostic */
export const COVERED_DATES_OUTBOUND: string[] = derivedCoveredDates.outbound

/** Allowed dates for inbound rides (to_airport false), MM-DD year-agnostic */
export const COVERED_DATES_INBOUND: string[] = derivedCoveredDates.inbound

/** Min riders for subsidy by airport */
export const AIRPORT_MIN_RIDERS: Record<string, number> = {
  LAX: 3,
  ONT: 2,
}

export const DEFAULT_AIRPORT_MIN_RIDERS = 3

export const ALLOWED_SCHOOL = 'Pomona'
