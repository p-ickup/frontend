'use client'

import { Calendar, Clock } from 'lucide-react'
import type { CSSProperties } from 'react'

import {
  useGroupsActionsContext,
  useGroupsDataContext,
  useGroupsUiContext,
} from './context'
import { UBER_TYPE_OPTIONS } from './utils'

export default function FiltersPanel() {
  const { availableAirports, lastAlgorithmRunDate } = useGroupsDataContext()
  const { toggleAirport } = useGroupsActionsContext()
  const {
    dateRangeEnd,
    dateRangeStart,
    dragOverSortIndex,
    draggedSortIndex,
    filterDirectionFrom,
    filterDirectionTo,
    maxBags,
    minBags,
    selectedAirports,
    selectedUberTypes,
    setDateRangeEnd,
    setDateRangeStart,
    setDragOverSortIndex,
    setDraggedSortIndex,
    setFilterDirectionFrom,
    setFilterDirectionTo,
    setMaxBags,
    setMinBags,
    setSelectedUberTypes,
    setSortingRules,
    setSubsidyFilter,
    setTimeRangeEnd,
    setTimeRangeStart,
    sortingRules,
    subsidyFilter,
    timeRangeEnd,
    timeRangeStart,
  } = useGroupsUiContext()

  return (
    <div className="flex-1 space-y-4 overflow-y-auto p-4">
      <div>
        <label className="mb-2 block text-xs font-medium text-gray-700">
          Airports
        </label>
        <div className="flex flex-wrap gap-3">
          {availableAirports.map((airport: string) => (
            <label
              key={airport}
              className="flex cursor-pointer items-center gap-2"
            >
              <input
                type="checkbox"
                checked={selectedAirports.includes(airport)}
                onChange={() => toggleAirport(airport)}
                className="h-3.5 w-3.5 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              <span className="text-xs text-gray-700">{airport}</span>
            </label>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-4">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={filterDirectionTo}
              onChange={(e) => setFilterDirectionTo(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
            />
            <span className="text-xs text-gray-700">To airport</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={filterDirectionFrom}
              onChange={(e) => setFilterDirectionFrom(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
            />
            <span className="text-xs text-gray-700">From airport</span>
          </label>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-xs font-medium text-gray-700">
          Date Range
        </label>
        <div className="flex flex-col gap-2 md:flex-row md:gap-2">
          <div className="relative md:min-w-0 md:flex-1">
            <input
              type="date"
              value={dateRangeStart}
              onChange={(e) => setDateRangeStart(e.target.value)}
              placeholder="Start date"
              className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 pr-8 text-xs text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
              style={
                {
                  WebkitAppearance: 'none',
                } as CSSProperties
              }
            />
            <button
              type="button"
              onClick={(e) => {
                const input = e.currentTarget
                  .previousElementSibling as HTMLInputElement
                input?.showPicker?.()
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-teal-600"
              title="Open calendar"
            >
              <Calendar className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="relative md:min-w-0 md:flex-1">
            <input
              type="date"
              value={dateRangeEnd}
              onChange={(e) => setDateRangeEnd(e.target.value)}
              placeholder="End date"
              className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 pr-8 text-xs text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
              style={
                {
                  WebkitAppearance: 'none',
                } as CSSProperties
              }
            />
            <button
              type="button"
              onClick={(e) => {
                const input = e.currentTarget
                  .previousElementSibling as HTMLInputElement
                input?.showPicker?.()
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-teal-600"
              title="Open calendar"
            >
              <Calendar className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-xs font-medium text-gray-700">
          Time Range
        </label>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="time"
              value={timeRangeStart}
              onChange={(e) => setTimeRangeStart(e.target.value)}
              className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 pr-8 text-xs text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
              style={
                {
                  WebkitAppearance: 'none',
                } as CSSProperties
              }
            />
            <button
              type="button"
              onClick={(e) => {
                const input = e.currentTarget
                  .previousElementSibling as HTMLInputElement
                input?.showPicker?.()
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-teal-600"
              title="Open time picker"
            >
              <Clock className="h-3.5 w-3.5" />
            </button>
          </div>
          <span className="text-xs text-gray-500">-</span>
          <div className="relative flex-1">
            <input
              type="time"
              value={timeRangeEnd}
              onChange={(e) => setTimeRangeEnd(e.target.value)}
              className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 pr-8 text-xs text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
              style={
                {
                  WebkitAppearance: 'none',
                } as CSSProperties
              }
            />
            <button
              type="button"
              onClick={(e) => {
                const input = e.currentTarget
                  .previousElementSibling as HTMLInputElement
                input?.showPicker?.()
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-teal-600"
              title="Open time picker"
            >
              <Clock className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-xs font-medium text-gray-700">
          Subsidy
        </label>
        <select
          value={subsidyFilter}
          onChange={(e) =>
            setSubsidyFilter(
              e.target.value as 'subsidized' | 'unsubsidized' | 'all',
            )
          }
          className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
        >
          <option value="all">All</option>
          <option value="subsidized">Subsidized</option>
          <option value="unsubsidized">Unsubsidized</option>
        </select>
      </div>

      <div>
        <label className="mb-2 block text-xs font-medium text-gray-700">
          Uber type
        </label>
        <div className="flex flex-wrap gap-x-3 gap-y-1.5">
          {UBER_TYPE_OPTIONS.map((type: string) => {
            const label =
              type === 'Connect' ? 'Connect Shuttle' : `Uber ${type}`
            const checked = selectedUberTypes.has(type)

            return (
              <label
                key={type}
                className="flex cursor-pointer items-center gap-1.5"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    setSelectedUberTypes((prev: Set<string>) => {
                      const next = new Set(prev)
                      if (next.has(type)) next.delete(type)
                      else next.add(type)
                      return next
                    })
                  }}
                  className="h-3.5 w-3.5 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                />
                <span className="text-xs text-gray-700">{label}</span>
              </label>
            )
          })}
        </div>
      </div>

      <div>
        <label className="mb-2 block text-xs font-medium text-gray-700">
          Bag Units
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            value={minBags}
            onChange={(e) => setMinBags(e.target.value)}
            placeholder="Min"
            className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
          <span className="text-xs text-gray-500">-</span>
          <input
            type="number"
            min="0"
            value={maxBags}
            onChange={(e) => setMaxBags(e.target.value)}
            placeholder="Max"
            className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-xs font-medium text-gray-700">
          Sorting
        </label>
        <div className="space-y-2">
          {sortingRules.map((rule: any, index: number) => (
            <div
              key={index}
              draggable
              onDragStart={(e) => {
                setDraggedSortIndex(index)
                e.dataTransfer.effectAllowed = 'move'
              }}
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                if (draggedSortIndex !== null && draggedSortIndex !== index) {
                  setDragOverSortIndex(index)
                }
              }}
              onDragLeave={() => {
                setDragOverSortIndex(null)
              }}
              onDrop={(e) => {
                e.preventDefault()
                if (draggedSortIndex === null || draggedSortIndex === index) {
                  setDragOverSortIndex(null)
                  return
                }

                const newRules = [...sortingRules]
                const [removed] = newRules.splice(draggedSortIndex, 1)
                newRules.splice(index, 0, removed)
                setSortingRules(newRules)
                setDraggedSortIndex(null)
                setDragOverSortIndex(null)
              }}
              onDragEnd={() => {
                setDraggedSortIndex(null)
                setDragOverSortIndex(null)
              }}
              className={`flex items-center gap-1 rounded border p-1 transition-colors ${
                draggedSortIndex === index
                  ? 'border-teal-500 bg-teal-50 opacity-50'
                  : dragOverSortIndex === index
                    ? 'border-teal-400 bg-teal-100'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
              } ${draggedSortIndex !== null && draggedSortIndex !== index ? 'cursor-move' : ''}`}
            >
              <div className="flex-shrink-0 cursor-grab text-gray-400 hover:text-gray-600 active:cursor-grabbing">
                <svg
                  className="h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 8h16M4 16h16"
                  />
                </svg>
              </div>
              <select
                value={rule.field}
                onChange={(e) => {
                  const newRules = [...sortingRules]
                  newRules[index].field = e.target.value as
                    | 'bag_size'
                    | 'group_size'
                    | 'date'
                    | 'time'
                    | 'ride_id'
                  setSortingRules(newRules)
                }}
                className="min-w-0 flex-1 rounded border border-gray-300 bg-white px-1.5 py-1 text-xs text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                <option value="ride_id">Group ID</option>
                <option value="bag_size">Bag Size</option>
                <option value="group_size">Group Size</option>
                <option value="date">Date</option>
                <option value="time">Time</option>
              </select>
              <select
                value={rule.direction}
                onChange={(e) => {
                  const newRules = [...sortingRules]
                  newRules[index].direction = e.target.value as 'asc' | 'desc'
                  setSortingRules(newRules)
                }}
                className="w-16 flex-shrink-0 rounded border border-gray-300 bg-white px-1.5 py-1 text-xs text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                <option value="asc">Asc</option>
                <option value="desc">Desc</option>
              </select>
              <button
                onClick={() => {
                  setSortingRules(
                    sortingRules.filter((_: any, i: number) => i !== index),
                  )
                }}
                className="flex-shrink-0 rounded p-0.5 text-red-500 hover:bg-red-50"
                title="Remove sorting rule"
              >
                <svg
                  className="h-3 w-3"
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
          ))}
          <button
            onClick={() => {
              setSortingRules([
                ...sortingRules,
                { field: 'date', direction: 'asc' },
              ])
            }}
            className="w-full rounded border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
          >
            + Add Sorting Rule
          </button>
        </div>
      </div>

      {(dateRangeStart ||
        dateRangeEnd ||
        timeRangeStart ||
        timeRangeEnd ||
        subsidyFilter !== 'all' ||
        minBags ||
        maxBags ||
        sortingRules.length > 0) && (
        <button
          onClick={() => {
            setDateRangeStart(lastAlgorithmRunDate || '')
            if (lastAlgorithmRunDate) {
              const runDate = new Date(lastAlgorithmRunDate)
              const endDate = new Date(runDate)
              endDate.setDate(endDate.getDate() + 15)
              setDateRangeEnd(endDate.toISOString().split('T')[0])
            } else {
              setDateRangeEnd('')
            }
            setTimeRangeStart('')
            setTimeRangeEnd('')
            setSubsidyFilter('all')
            setMinBags('')
            setMaxBags('')
            setSortingRules([])
          }}
          className="mt-2 w-full rounded border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
        >
          Clear All Filters
        </button>
      )}
    </div>
  )
}
