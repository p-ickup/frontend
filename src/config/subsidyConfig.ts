/**
 * Subsidy and covered-dates config for matching, vouchers, and persistence.
 * Keep in sync with backend (e.g. config.py) so rules apply consistently.
 */

export const COVERED_DATES_EXPLICIT = true

/** Allowed dates for outbound rides (to_airport true), MM-DD year-agnostic */
export const COVERED_DATES_OUTBOUND: string[] = [
  '11-21',
  '11-22',
  '11-23',
  '11-24',
  '11-25',
  '11-26', // Thanksgiving departures
  '12-09',
  '12-10',
  '12-11',
  '12-12',
  '12-13', // Winter break departure
  '03-13',
  '03-14',
  '03-15', // Spring break departure
  '5/12',
  '5/13',
  '5/14',
  '5/15',
  '5/16',
  '5/17',
  '5/18',
  '5/19',
]

/** Allowed dates for inbound rides (to_airport false), MM-DD year-agnostic */
export const COVERED_DATES_INBOUND: string[] = [
  '11-29',
  '11-30',
  '12-01', // Thanksgiving returns
  '01-17',
  '01-18',
  '01-19',
  '01-20',
  '01-21', // Winter break return
  '03-20',
  '03-21',
  '03-22', // Spring break return
  '06-30',
]

/** Min riders for subsidy by airport */
export const AIRPORT_MIN_RIDERS: Record<string, number> = {
  LAX: 3,
  ONT: 2,
}

export const DEFAULT_AIRPORT_MIN_RIDERS = 3

export const ALLOWED_SCHOOL = 'Pomona'
