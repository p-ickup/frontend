'use client'

import { postJson } from '@/utils/api'
import { useCallback, useState } from 'react'

export interface FindNewMatchParams {
  rideId: string
  userId: string
  reasonForDelay: string
  newEtaDate: string
  newEtaTime: string
  newEtaTimeEarliest?: string
  newEtaTimeLatest?: string
  newFlight?: {
    airport: string
    flight_no: string
    date: string
    time: string
  } | null
}

export interface AvailableGroup {
  rideId: number
  date: string
  time: string
  rideType: string
  rideTime: string
  riderCount: number
}

export interface FindNewMatchResult {
  success: boolean
  error?: string
  availableGroups?: AvailableGroup[]
  wasSubsidized?: boolean
  contingencyVoucher?: string | null
  contingencyVoucherApplied?: boolean
  contingencyVoucherNotAppliedReasons?: string[]
  hadContingencyVoucherOnFile?: boolean
  keptOriginalGroupBecauseEarlierEta?: boolean
  movedToUnmatched?: boolean
}

export function getContingencyVoucherDeclineReasons(
  result: FindNewMatchResult,
): string[] {
  if (result.keptOriginalGroupBecauseEarlierEta) return []
  const hasGroups = (result.availableGroups?.length ?? 0) > 0
  if (hasGroups || result.contingencyVoucherApplied === true) return []

  const fromApi = result.contingencyVoucherNotAppliedReasons
  const merged: string[] = fromApi && fromApi.length > 0 ? [...fromApi] : []

  if (merged.length > 0) return Array.from(new Set(merged))

  if (result.wasSubsidized === false) {
    merged.push(
      'Your match was not subsidized before this delay, so a contingency voucher could not be applied.',
    )
  }
  if (result.hadContingencyVoucherOnFile === false) {
    merged.push(
      'No contingency voucher was on file for your ride before this change.',
    )
  }
  if (
    result.wasSubsidized === true &&
    result.hadContingencyVoucherOnFile === true
  ) {
    merged.push(
      'If you expected a voucher, try again or contact ASPC—there may have been a sync issue.',
    )
  }
  if (merged.length === 0) {
    merged.push(
      'A contingency voucher could not be applied. You must have been on a subsidized match with a voucher already on file before this delay.',
    )
  }
  return Array.from(new Set(merged))
}

export function useFindNewMatch() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const findNewMatch = useCallback(
    async (params: FindNewMatchParams): Promise<FindNewMatchResult> => {
      setLoading(true)
      setError(null)

      try {
        return await postJson<FindNewMatchResult>('/api/aspc-delay', {
          action: 'report',
          ...params,
        })
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Something went wrong'
        setError(message)
        return { success: false, error: message }
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  const joinGroup = useCallback(
    async (params: {
      currentRideId: number
      userId: string
      selectedRideId: number
    }): Promise<{ success: boolean; error?: string }> => {
      setLoading(true)
      setError(null)

      try {
        return await postJson<{ success: boolean; error?: string }>(
          '/api/aspc-delay',
          {
            action: 'join',
            currentRideId: params.currentRideId,
            selectedRideId: params.selectedRideId,
          },
        )
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Something went wrong'
        setError(message)
        return { success: false, error: message }
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  const declineAllGroups = useCallback(
    async (params: {
      currentRideId: number
      userId: string
    }): Promise<{ success: boolean; error?: string }> => {
      setLoading(true)
      setError(null)

      try {
        return await postJson<{ success: boolean; error?: string }>(
          '/api/aspc-delay',
          {
            action: 'decline',
            currentRideId: params.currentRideId,
          },
        )
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Something went wrong'
        setError(message)
        return { success: false, error: message }
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  return { findNewMatch, joinGroup, declineAllGroups, loading, error }
}
