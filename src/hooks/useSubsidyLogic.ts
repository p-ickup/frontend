'use client'

import {
  AIRPORT_MIN_RIDERS,
  ALLOWED_SCHOOL,
  COVERED_DATES_EXPLICIT,
  COVERED_DATES_INBOUND,
  COVERED_DATES_OUTBOUND,
  DEFAULT_AIRPORT_MIN_RIDERS,
} from '@/config/subsidyConfig'
import { useCallback, useMemo } from 'react'

/**
 * Covered = ride's date + direction are in the allowed list.
 * date: YYYY-MM-DD; we use MM-DD for year-agnostic check.
 * toAirport true = outbound, false = inbound.
 */
function isDateCovered(
  date: string,
  toAirport: boolean,
  explicit: boolean,
  outboundDates: string[],
  inboundDates: string[],
): boolean {
  if (!explicit) return true
  const mmdd = date.includes('-') ? date.slice(5, 10) : date // YYYY-MM-DD -> MM-DD
  const list = toAirport ? outboundDates : inboundDates
  return list.includes(mmdd)
}

export interface ComputeSubsidyInput {
  /** Ride date YYYY-MM-DD */
  date: string
  /** true = outbound (to airport), false = inbound (from airport) */
  toAirport: boolean
  airport: string
  riderCount: number
  /** School for each rider (e.g. from Users). All must be allowed school for subsidy. */
  riderSchools: (string | null | undefined)[]
  /** If Connect, no voucher regardless of subsidy */
  uberType?: string | null
}

export interface ComputeSubsidyResult {
  subsidized: boolean
  covered: boolean
  /** True when subsidized and covered and not Connect — voucher can be assigned */
  assignVoucher: boolean
  /**
   * When assignVoucher is false, human-readable reasons (e.g. delay flow).
   * Empty when assignVoucher is true.
   */
  voucherBlockers: string[]
}

/**
 * Subsidy logic: matching, vouchers, persistence.
 * A ride/group is subsidized only when:
 * 1. Airport threshold: group size >= min for that airport (e.g. LAX 3, ONT 2)
 * 2. School: every rider from allowed school (e.g. Pomona)
 * 3. Covered: ride date + direction in allowed list
 * Connect rides never get vouchers.
 */
export function useSubsidyLogic() {
  const isDateCoveredFn = useCallback(
    (date: string, toAirport: boolean) =>
      isDateCovered(
        date,
        toAirport,
        COVERED_DATES_EXPLICIT,
        COVERED_DATES_OUTBOUND,
        COVERED_DATES_INBOUND,
      ),
    [],
  )

  const computeGroupSubsidized = useCallback(
    (input: ComputeSubsidyInput): ComputeSubsidyResult => {
      const { date, toAirport, airport, riderCount, riderSchools, uberType } =
        input

      const covered = isDateCovered(
        date,
        toAirport,
        COVERED_DATES_EXPLICIT,
        COVERED_DATES_OUTBOUND,
        COVERED_DATES_INBOUND,
      )

      const minRiders =
        AIRPORT_MIN_RIDERS[airport] ?? DEFAULT_AIRPORT_MIN_RIDERS
      const meetsThreshold = riderCount >= minRiders

      const allAllowedSchool = riderSchools.every(
        (s) => (s ?? '').trim() === ALLOWED_SCHOOL,
      )

      const subsidized = meetsThreshold && allAllowedSchool && covered

      const isConnect = uberType?.toLowerCase() === 'connect'
      const assignVoucher = subsidized && covered && !isConnect

      const voucherBlockers: string[] = []
      if (!assignVoucher) {
        if (isConnect) {
          voucherBlockers.push(
            'Contingency vouchers are not applied to Uber Connect rides.',
          )
        }
        if (!allAllowedSchool) {
          const schoolLabel =
            riderSchools.map((s) => (s ?? '').trim()).find(Boolean) ||
            'not on file'
          voucherBlockers.push(
            `ASPC subsidy vouchers are only for ${ALLOWED_SCHOOL} riders (your school: ${schoolLabel}).`,
          )
        }
        if (COVERED_DATES_EXPLICIT && !covered) {
          voucherBlockers.push(
            toAirport
              ? 'Your new ride date is outside the subsidized travel dates for trips to the airport.'
              : 'Your new ride date is outside the subsidized travel dates for trips from the airport.',
          )
        }
        if (!meetsThreshold) {
          voucherBlockers.push(
            `Subsidized rides need at least ${minRiders} rider(s) in the same Uber at ${airport}; after this delay you are solo until you join a group.`,
          )
        }
      }

      return { subsidized, covered, assignVoucher, voucherBlockers }
    },
    [],
  )

  return useMemo(
    () => ({
      isDateCovered: isDateCoveredFn,
      computeGroupSubsidized,
      config: {
        COVERED_DATES_EXPLICIT,
        COVERED_DATES_OUTBOUND,
        COVERED_DATES_INBOUND,
        AIRPORT_MIN_RIDERS,
        ALLOWED_SCHOOL,
      },
    }),
    [isDateCoveredFn, computeGroupSubsidized],
  )
}
