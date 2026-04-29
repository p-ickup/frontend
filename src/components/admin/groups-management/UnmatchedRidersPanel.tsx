'use client'

import {
  Briefcase,
  Flag,
  Luggage,
  Pencil,
  Plane,
  PlaneLanding,
  PlaneTakeoff,
} from 'lucide-react'

import {
  useGroupsActionsContext,
  useGroupsDataContext,
  useGroupsUiContext,
} from './context'
import { formatTimeRange, isDatePassed } from './utils'

export default function UnmatchedRidersPanel() {
  const { addRiderToNewGroup, handleAddToCorral, openEditRider } =
    useGroupsActionsContext()
  const { sortedUnmatchedRiders } = useGroupsDataContext()
  const {
    recentlyAddedToNewGroup,
    selectedRidersForNewGroup,
    setDragOverGroupId,
    setDraggedRider,
  } = useGroupsUiContext()

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {sortedUnmatchedRiders.length === 0 ? (
        <div className="col-span-full rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-gray-500">No unmatched riders</p>
        </div>
      ) : (
        sortedUnmatchedRiders.map((rider: any) => {
          const riderDatePassed = isDatePassed(rider.date)
          const isSelectedForNewGroup = selectedRidersForNewGroup.some(
            (selectedRider: any) => selectedRider.flight_id === rider.flight_id,
          )
          const isRecentlyAdded = recentlyAddedToNewGroup.has(
            String(rider.flight_id),
          )

          return (
            <div
              key={`${rider.user_id}-${rider.flight_id}`}
              className={`relative rounded-lg border p-4 shadow-sm transition-all duration-300 ${
                riderDatePassed
                  ? 'border border-red-300 bg-gray-200 hover:bg-gray-300'
                  : 'border-gray-200 bg-white'
              } ${
                isSelectedForNewGroup || isRecentlyAdded
                  ? 'border-gray-300 bg-gray-100 opacity-60'
                  : !riderDatePassed
                    ? 'hover:bg-gray-50'
                    : ''
              } ${isRecentlyAdded ? 'animate-pulse' : ''}`}
              draggable
              onDragStart={() => setDraggedRider(rider)}
              onDragEnd={() => {
                setDraggedRider(null)
                setDragOverGroupId(null)
              }}
            >
              <div className="flex items-start gap-2">
                <p className="flex flex-1 items-center gap-1.5 font-medium text-gray-900">
                  {rider.name}
                  {rider.original_unmatched && (
                    <span title="Originally unmatched">
                      <Flag className="h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
                    </span>
                  )}
                </p>
              </div>
              <p className="text-sm text-gray-600">{rider.phone}</p>
              {rider.airline_iata && rider.flight_no && (
                <div className="group relative mt-1 flex items-center gap-1">
                  <Plane className="h-4 w-4 text-gray-600" />
                  <span className="text-sm text-gray-600">
                    {rider.airline_iata} {rider.flight_no}
                  </span>
                  <div className="absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 transform whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white group-hover:block">
                    Flight Number
                    <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>
              )}
              <div className="mt-2 flex items-center gap-3 text-sm text-gray-600">
                <div className="group relative flex items-center gap-1">
                  <Luggage className="h-4 w-4" />
                  <span>{rider.checked_bags}</span>
                  <div className="absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 transform whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white group-hover:block">
                    Checked Bags (2 Units Each)
                    <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>
                <div className="group relative flex items-center gap-1">
                  <Briefcase className="h-4 w-4" />
                  <span>{rider.carry_on_bags}</span>
                  <div className="absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 transform whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white group-hover:block">
                    Carry-On Bags (1 Unit Each)
                    <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>
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
                {rider.date} • {formatTimeRange(rider.time_range)}
              </p>
              <div className="mt-2 flex items-center gap-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleAddToCorral(rider)
                  }}
                  className="text-xs text-teal-600 underline hover:text-teal-800"
                >
                  Add to corral
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    addRiderToNewGroup(rider)
                  }}
                  className="text-xs text-purple-600 underline hover:text-purple-800"
                >
                  Add to new group
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!riderDatePassed) {
                      openEditRider(rider)
                    }
                  }}
                  disabled={riderDatePassed}
                  className={`rounded p-1 ${
                    riderDatePassed
                      ? 'cursor-not-allowed text-gray-400'
                      : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                  }`}
                  title="Edit rider details"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
