'use client'

import {
  Briefcase,
  Clock,
  Flag,
  Lock,
  Luggage,
  Pencil,
  Plane,
  PlaneLanding,
  PlaneTakeoff,
  Unlock,
} from 'lucide-react'
import type { DragEvent } from 'react'

import { noShowTooltip } from '@/utils/adminMatchNoShows'

import {
  useGroupsActionsContext,
  useGroupsDataContext,
  useGroupsUiContext,
} from './context'
import {
  calculateBagUnits,
  calculateGroupTimeRange,
  formatTime,
  formatTimeRange,
  formatUberTypeDisplay,
  formatVoucher,
  getCapacityBarColor,
  getMaxBagUnits,
  getUberType,
  isDatePassed,
  isGroupSubsidized,
  validateTimeCompatibility,
} from './utils'

export default function MatchedGroupsPanel() {
  const {
    addRiderToNewGroup,
    handleAddFromCorral,
    handleAddToCorral,
    handleRemoveFromGroupToUnmatched,
    handleSelectFromCorral,
    openEditGroupOverrides,
    openEditRider,
    openEditTime,
    openEditVoucher,
    setCorralRiders,
    setUnmatchedRiders,
    toggleGroupExpanded,
  } = useGroupsActionsContext()
  const { corralRiders, groups, sortedGroups, unmatchedRiders } =
    useGroupsDataContext()
  const {
    dragOverGroupId,
    draggedRider,
    expandedGroups,
    recentlyAddedToNewGroup,
    selectedRidersForNewGroup,
    setDragOverGroupId,
    setDraggedRider,
    setTimeConflictModal,
  } = useGroupsUiContext()

  const clearDragState = () => {
    setDraggedRider(null)
    setDragOverGroupId(null)
  }

  const handleDropToGroup = async (group: any) => {
    setDragOverGroupId(null)
    if (!draggedRider) return

    const riderAlreadyInGroup = group.riders.some(
      (rider: any) => rider.flight_id === draggedRider.flight_id,
    )

    if (riderAlreadyInGroup) {
      setDraggedRider(null)
      return
    }

    const corralRider = corralRiders.find(
      (rider: any) => rider.flight_id === draggedRider.flight_id,
    )
    const isFromCorral = !!corralRider
    const isFromUnmatched = unmatchedRiders.some(
      (rider: any) => rider.flight_id === draggedRider.flight_id,
    )

    const addDraggedRiderToGroup = async (skipValidation = false) => {
      const sourceGroup = groups.find((candidateGroup: any) =>
        candidateGroup.riders.some(
          (rider: any) => rider.flight_id === draggedRider.flight_id,
        ),
      )
      const isFromGroup = !!sourceGroup && sourceGroup.ride_id !== group.ride_id

      if (isFromGroup) {
        await handleSelectFromCorral(
          draggedRider,
          group,
          skipValidation,
          sourceGroup.ride_id,
        )
      } else if (isFromCorral) {
        const isOriginalGroup =
          corralRider?.originGroupId === group.ride_id &&
          corralRider?.originType === 'group'

        if (isOriginalGroup) {
          setCorralRiders((prev: any[]) =>
            prev.filter((rider) => rider.flight_id !== draggedRider.flight_id),
          )
          clearDragState()
          return
        }

        await handleSelectFromCorral(draggedRider, group, skipValidation)
      } else if (isFromUnmatched) {
        await handleSelectFromCorral(draggedRider, group, skipValidation)
        setUnmatchedRiders((prev: any[]) =>
          prev.filter((rider) => rider.flight_id !== draggedRider.flight_id),
        )
      }

      setDraggedRider(null)
    }

    const timeCompatible = validateTimeCompatibility(group, draggedRider)
    if (!timeCompatible) {
      setTimeConflictModal({
        rider: draggedRider,
        group,
        onConfirm: async () => {
          await addDraggedRiderToGroup(true)
          setTimeConflictModal(null)
        },
      })
      return
    }

    await addDraggedRiderToGroup()
  }

  const handleGroupDragLeave = (
    event: DragEvent<HTMLDivElement>,
    rideId: number,
  ) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX
    const y = event.clientY

    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      if (dragOverGroupId === rideId) {
        setDragOverGroupId(null)
      }
    }
  }

  if (sortedGroups.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
        <p className="text-gray-500">No groups found</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {sortedGroups.map((group: any) => {
        const isExpanded = expandedGroups.has(group.ride_id)
        const totalBagUnits = calculateBagUnits(group.riders)
        const riderCount = group.riders.length
        const datePassed = isDatePassed(group.date)
        const hasManualOverrides =
          group.subsidized_override || group.uber_type_override

        return (
          <div
            key={group.ride_id}
            className={`overflow-hidden rounded-lg bg-white shadow-md transition-colors ${
              dragOverGroupId === group.ride_id && draggedRider
                ? 'bg-teal-50 ring-2 ring-teal-500'
                : ''
            }`}
            onDragOver={(event) => {
              event.preventDefault()
              if (draggedRider) {
                event.dataTransfer.dropEffect = 'move'
                setDragOverGroupId(group.ride_id)
              } else {
                event.dataTransfer.dropEffect = 'none'
              }
            }}
            onDragLeave={(event) => handleGroupDragLeave(event, group.ride_id)}
            onDrop={async (event) => {
              event.preventDefault()
              event.stopPropagation()
              await handleDropToGroup(group)
            }}
          >
            <div
              className="flex cursor-pointer items-center justify-between border-b border-gray-200 bg-gray-50 p-4 hover:bg-gray-100"
              onClick={() => toggleGroupExpanded(group.ride_id)}
            >
              <div className="flex min-w-0 flex-1 items-center gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <p className="font-semibold text-gray-900">
                      Group #{group.ride_id}
                    </p>
                    {datePassed && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                        Past Date
                      </span>
                    )}
                    {(() => {
                      const flaggedRiders = group.riders.filter(
                        (rider: any) => rider.no_show,
                      )
                      if (flaggedRiders.length === 0) return null

                      const reporterIds = new Set<string>()
                      for (const rider of flaggedRiders) {
                        for (const id of rider.no_show?.reporterUserIds ?? []) {
                          reporterIds.add(id)
                        }
                      }

                      const distinctReporterCount = reporterIds.size
                      const flaggedCount = flaggedRiders.length

                      return (
                        <span
                          className="bg-rose-50 text-rose-950 ring-rose-200 max-w-[20rem] rounded-full px-2.5 py-0.5 text-xs font-medium ring-1"
                          title={`${flaggedCount} rider(s) in this group were reported missing on ASPC Ready. ${distinctReporterCount} distinct rider(s) filed those reports. Red/orange flags on names = delay log status.`}
                        >
                          {flaggedCount} rider{flaggedCount === 1 ? '' : 's'}{' '}
                          reported missing (By {distinctReporterCount})
                        </span>
                      )
                    })()}
                  </div>
                  <p className="hidden text-sm text-gray-600 md:block">
                    {group.date} •{' '}
                    {group.match_time ? (
                      <>
                        {formatTime(group.match_time)}
                        <span className="ml-1 text-xs italic text-gray-500">
                          ({formatTimeRange(group.time_range)})
                        </span>
                      </>
                    ) : (
                      formatTimeRange(calculateGroupTimeRange(group.riders))
                    )}
                  </p>
                  <div className="space-y-0.5 text-sm text-gray-600 md:hidden">
                    <p>{group.date}</p>
                    <p>
                      {group.match_time ? (
                        <>
                          {formatTime(group.match_time)}
                          <span className="ml-1 text-xs italic text-gray-500">
                            ({formatTimeRange(group.time_range)})
                          </span>
                        </>
                      ) : (
                        formatTimeRange(calculateGroupTimeRange(group.riders))
                      )}
                    </p>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <p className="text-xs text-gray-600">
                      Uber Voucher:{' '}
                      {group.group_voucher ? (
                        <span className="font-bold text-gray-900">
                          {formatVoucher(group.group_voucher)}
                        </span>
                      ) : (
                        'N/A'
                      )}
                    </p>
                    <button
                      onClick={(event) => {
                        event.stopPropagation()
                        openEditVoucher(group)
                      }}
                      className="flex items-center text-gray-500 transition-colors hover:text-teal-600"
                      title="Edit voucher"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-shrink-0 items-center gap-2">
                <div className="hidden items-center gap-2 md:flex">
                  <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-800">
                    {riderCount} {riderCount === 1 ? 'rider' : 'riders'}
                  </span>
                  <span
                    className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                      group.to_airport
                        ? 'bg-teal-100 text-teal-800'
                        : 'bg-orange-100 text-orange-800'
                    }`}
                  >
                    {group.to_airport ? (
                      <>
                        <PlaneTakeoff className="h-3 w-3" />
                        TO {group.airport}
                      </>
                    ) : (
                      <>
                        <PlaneLanding className="h-3 w-3" />
                        FROM {group.airport}
                      </>
                    )}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      (group.is_subsidized ??
                      isGroupSubsidized(group.airport, riderCount))
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {(group.is_subsidized ??
                    isGroupSubsidized(group.airport, riderCount))
                      ? 'Subsidized'
                      : 'Not Subsidized'}
                  </span>
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                    {formatUberTypeDisplay(
                      group.uber_type,
                      getUberType(riderCount),
                    )}
                  </span>
                </div>

                <div className="flex flex-col gap-1 md:hidden">
                  <div className="flex flex-col gap-1">
                    <span className="w-fit rounded-full bg-teal-100 px-2 py-0.5 text-xs font-semibold text-teal-800">
                      {riderCount} {riderCount === 1 ? 'rider' : 'riders'}
                    </span>
                    <span
                      className={`flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                        group.to_airport
                          ? 'bg-teal-100 text-teal-800'
                          : 'bg-orange-100 text-orange-800'
                      }`}
                    >
                      {group.to_airport ? (
                        <>
                          <PlaneTakeoff className="h-3 w-3" />
                          TO {group.airport}
                        </>
                      ) : (
                        <>
                          <PlaneLanding className="h-3 w-3" />
                          FROM {group.airport}
                        </>
                      )}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span
                      className={`w-fit rounded-full px-2 py-0.5 text-xs font-semibold ${
                        (group.is_subsidized ??
                        isGroupSubsidized(group.airport, riderCount))
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {(group.is_subsidized ??
                      isGroupSubsidized(group.airport, riderCount))
                        ? 'Subsidized'
                        : 'Not Subsidized'}
                    </span>
                    <span className="w-fit rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">
                      {formatUberTypeDisplay(
                        group.uber_type,
                        getUberType(riderCount),
                      )}
                    </span>
                  </div>
                </div>

                <button
                  onClick={(event) => {
                    event.stopPropagation()
                    if (!datePassed) {
                      openEditTime(group)
                    }
                  }}
                  className="rounded p-1.5 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                  title="Edit group time"
                >
                  <Clock className="h-5 w-5" />
                </button>

                <button
                  onClick={(event) => {
                    event.stopPropagation()
                    openEditGroupOverrides(group)
                  }}
                  className={`rounded p-1.5 transition-colors ${
                    hasManualOverrides
                      ? 'text-amber-600 hover:bg-amber-50 hover:text-amber-800'
                      : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                  }`}
                  title={
                    hasManualOverrides
                      ? 'Locked: manual values (click to unlock or change)'
                      : 'Unlocked: auto-updates on add/move (click to lock)'
                  }
                >
                  {hasManualOverrides ? (
                    <Lock className="h-5 w-5" />
                  ) : (
                    <Unlock className="h-5 w-5" />
                  )}
                </button>

                <svg
                  className={`h-5 w-5 flex-shrink-0 text-gray-500 transition-transform ${
                    isExpanded ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>

            <div className="border-b border-gray-200 bg-white px-4 py-2">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs text-gray-600">
                  Bag Units: {totalBagUnits}/
                  {group.uber_type?.toLowerCase() === 'connect'
                    ? 'unlimited'
                    : getMaxBagUnits(riderCount)}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className={`h-full ${getCapacityBarColor(totalBagUnits, group.uber_type)} transition-all`}
                  style={{
                    width:
                      group.uber_type?.toLowerCase() === 'connect'
                        ? '25%'
                        : `${Math.min((totalBagUnits / getMaxBagUnits(riderCount)) * 100, 100)}%`,
                  }}
                ></div>
              </div>
            </div>

            {isExpanded && (
              <div
                className={`p-4 transition-colors ${
                  dragOverGroupId === group.ride_id && draggedRider
                    ? 'bg-teal-50'
                    : ''
                }`}
                onDragOver={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  if (draggedRider) {
                    event.dataTransfer.dropEffect = 'move'
                    setDragOverGroupId(group.ride_id)
                  } else {
                    event.dataTransfer.dropEffect = 'none'
                  }
                }}
                onDragLeave={(event) =>
                  handleGroupDragLeave(event, group.ride_id)
                }
                onDrop={async (event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  await handleDropToGroup(group)
                }}
              >
                <button
                  onClick={() => handleAddFromCorral(group)}
                  disabled={corralRiders.length === 0}
                  className={`mb-3 text-sm ${
                    corralRiders.length === 0
                      ? 'cursor-not-allowed text-gray-400'
                      : 'text-teal-600 underline hover:text-teal-800'
                  }`}
                >
                  Add from corral
                </button>
                {(() => {
                  const activeRiders = group.riders
                  const corralRidersForGroup = corralRiders.filter(
                    (rider: any) =>
                      rider.originGroupId === group.ride_id &&
                      rider.originType === 'group',
                  )
                  const allRiders = [...activeRiders, ...corralRidersForGroup]

                  if (allRiders.length === 0) {
                    return (
                      <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
                        <p className="text-gray-500">Drop riders here</p>
                      </div>
                    )
                  }

                  return (
                    <div className="space-y-2">
                      {allRiders.map((rider: any) => {
                        const isBeingDragged =
                          draggedRider?.flight_id === rider.flight_id
                        const isInCorral = corralRiders.some(
                          (candidateRider: any) =>
                            candidateRider.flight_id === rider.flight_id,
                        )
                        const riderDatePassed = isDatePassed(rider.date)
                        const isSelectedForNewGroup =
                          selectedRidersForNewGroup.some(
                            (selectedRider: any) =>
                              selectedRider.flight_id === rider.flight_id,
                          )
                        const isRecentlyAdded = recentlyAddedToNewGroup.has(
                          String(rider.flight_id),
                        )

                        return (
                          <div
                            key={`${rider.user_id}-${rider.flight_id}`}
                            className={`flex items-center justify-between rounded-lg border p-3 transition-all ${
                              riderDatePassed
                                ? 'border border-red-300 bg-gray-200 hover:bg-gray-300'
                                : 'border-gray-200 bg-white'
                            } ${
                              isBeingDragged
                                ? 'bg-gray-100 opacity-30'
                                : isInCorral ||
                                    isSelectedForNewGroup ||
                                    isRecentlyAdded
                                  ? 'cursor-not-allowed bg-gray-100 opacity-40'
                                  : !riderDatePassed
                                    ? 'hover:bg-gray-50'
                                    : ''
                            }`}
                            draggable={!isInCorral}
                            onDragStart={() => {
                              if (!isInCorral) {
                                setDraggedRider(rider)
                              }
                            }}
                            onDragEnd={() => {
                              if (draggedRider?.flight_id === rider.flight_id) {
                                setDraggedRider(null)
                              }
                            }}
                          >
                            <div className="flex items-center gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-3">
                                  <p className="flex items-center gap-1.5 font-medium text-gray-900">
                                    {rider.name}
                                    {rider.original_unmatched && (
                                      <span title="Originally unmatched">
                                        <Flag className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
                                      </span>
                                    )}
                                    {rider.no_show && (
                                      <span
                                        title={noShowTooltip(rider.no_show)}
                                        className="inline-flex items-center"
                                      >
                                        <Flag
                                          className={`h-3.5 w-3.5 flex-shrink-0 ${
                                            rider.no_show.flag === 'orange'
                                              ? 'text-orange-500'
                                              : 'text-red-600'
                                          }`}
                                        />
                                      </span>
                                    )}
                                  </p>
                                  <div className="flex items-center gap-2">
                                    <div className="group relative flex items-center gap-1">
                                      <Luggage className="h-4 w-4 text-gray-600" />
                                      <span className="text-sm text-gray-600">
                                        {rider.checked_bags}
                                      </span>
                                      <div className="absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 transform whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white group-hover:block">
                                        Checked Bags (2 Units Each)
                                        <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                                      </div>
                                    </div>
                                    <div className="group relative flex items-center gap-1">
                                      <Briefcase className="h-4 w-4 text-gray-600" />
                                      <span className="text-sm text-gray-600">
                                        {rider.carry_on_bags}
                                      </span>
                                      <div className="absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 transform whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white group-hover:block">
                                        Carry-On Bags (1 Unit Each)
                                        <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <p className="text-sm text-gray-600">
                                  {rider.phone}
                                </p>
                                <div className="mt-1 flex items-center gap-3 text-sm text-gray-600">
                                  {rider.airline_iata && rider.flight_no && (
                                    <span className="flex items-center gap-1 text-xs font-medium text-gray-700">
                                      <Plane className="h-3 w-3 text-gray-600" />
                                      {rider.airline_iata} {rider.flight_no}
                                    </span>
                                  )}
                                  <span
                                    className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                                      rider.to_airport
                                        ? 'bg-teal-100 text-teal-800'
                                        : 'bg-orange-100 text-orange-800'
                                    }`}
                                  >
                                    {rider.to_airport ? (
                                      <>
                                        <PlaneTakeoff className="h-3 w-3" />
                                        TO {rider.airport}
                                      </>
                                    ) : (
                                      <>
                                        <PlaneLanding className="h-3 w-3" />
                                        FROM {rider.airport}
                                      </>
                                    )}
                                  </span>
                                </div>
                                <p className="mt-1 text-xs text-gray-500">
                                  {rider.date} •{' '}
                                  {formatTimeRange(rider.time_range)}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <button
                                onClick={(event) => {
                                  event.stopPropagation()
                                  if (!datePassed) {
                                    openEditRider(rider)
                                  }
                                }}
                                disabled={datePassed}
                                className={`rounded p-1 ${
                                  datePassed
                                    ? 'cursor-not-allowed text-gray-400'
                                    : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                                }`}
                                title={
                                  datePassed
                                    ? 'Cannot modify past groups'
                                    : 'Edit rider details'
                                }
                              >
                                <Pencil className="h-5 w-5" />
                              </button>
                              <button
                                onClick={() => {
                                  handleAddToCorral(rider, group.ride_id)
                                }}
                                className="rounded p-1 text-teal-500 hover:bg-teal-50"
                                title="Move to corral"
                              >
                                <svg
                                  className="h-5 w-5"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                                  />
                                </svg>
                              </button>
                              <button
                                onClick={() => {
                                  handleRemoveFromGroupToUnmatched(
                                    rider,
                                    group.ride_id,
                                  )
                                }}
                                className="rounded p-1 text-red-500 hover:bg-red-50"
                                title="Remove from group and make unmatched"
                              >
                                <svg
                                  className="h-5 w-5"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12"
                                  />
                                </svg>
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
