'use client'

import { Calendar } from 'lucide-react'
import type { CSSProperties, JSX } from 'react'

import {
  useGroupsActionsContext,
  useGroupsDataContext,
  useGroupsUiContext,
} from './context'

const ACTION_OPTIONS = [
  { value: 'RUN_ALGORITHM', label: 'Run Algorithm' },
  { value: 'ADD_TO_GROUP', label: 'Add to Group' },
  { value: 'REMOVE_FROM_GROUP', label: 'Remove from Group' },
  { value: 'CREATE_GROUP', label: 'Create Group' },
  { value: 'DELETE_GROUP', label: 'Delete Group' },
  { value: 'IGNORE_ERROR', label: 'Ignore Error' },
  { value: 'UPDATE_GROUP_TIME', label: 'Update Time' },
  { value: 'UPDATE_VOUCHER', label: 'Update Voucher' },
  { value: 'UPDATE_RIDER_DETAILS', label: 'Update Rider Details' },
  { value: 'ADD_FLIGHT', label: 'Add Flight' },
  { value: 'ASPC_DELAY', label: 'ASPC delay (rider)' },
]

export default function ChangeLogPanel() {
  const { clearChangeLogFilters, setChangeLogDateRange } =
    useGroupsActionsContext()
  const { changeLog, formatChangeLogEntry, sortedChangeLog } =
    useGroupsDataContext()
  const {
    changeLogExpanded,
    changeLogFilterActions,
    changeLogFilterDateFrom,
    changeLogFilterDateTo,
    changeLogFilterName,
    changeLogFilterSubjectName,
    changeLogHeight,
    changeLogOptionsExpanded,
    changeLogSortBy,
    changeLogSortDirection,
    resizeStartRef,
    setChangeLogExpanded,
    setChangeLogFilterActions,
    setChangeLogFilterName,
    setChangeLogFilterSubjectName,
    setChangeLogOptionsExpanded,
    setChangeLogSortBy,
    setChangeLogSortDirection,
    setIsResizingChangeLog,
  } = useGroupsUiContext()

  const toggleExpanded = () => setChangeLogExpanded(!changeLogExpanded)

  const clearFilters = () => clearChangeLogFilters()

  const downloadCsv = () => {
    const csv = [
      [
        'Date',
        'Actor',
        'Role',
        'Action',
        'Target Group ID',
        'Target User ID',
        'Ignored Error',
        'Metadata',
      ],
      ...sortedChangeLog.map((entry: any) => [
        new Date(entry.created_at).toLocaleString('en-US', {
          timeZone: 'America/Los_Angeles',
        }),
        entry.actor_name || 'Unknown',
        entry.actor_role,
        entry.action,
        entry.target_group_id || '',
        entry.target_user_id || '',
        entry.ignored_error ? 'Yes' : 'No',
        entry.metadata ? JSON.stringify(entry.metadata) : '',
      ]),
    ]
      .map((row) => row.map((cell: unknown) => `"${cell}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `changelog-${new Date().toISOString().split('T')[0]}.csv`
    anchor.click()
  }

  const renderHeader = () => (
    <>
      <div className="flex items-center gap-3">
        <button
          onClick={toggleExpanded}
          className="flex items-center gap-3 hover:opacity-80"
        >
          <h3 className="font-semibold text-gray-900">Change Log</h3>
          <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
            {sortedChangeLog.length !== changeLog.length
              ? `${sortedChangeLog.length} / ${changeLog.length}`
              : changeLog.length}
          </span>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            setChangeLogOptionsExpanded(!changeLogOptionsExpanded)
          }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          Options and Filters
        </button>
      </div>
      <button onClick={toggleExpanded} className="hover:opacity-80">
        <svg
          className={`h-5 w-5 text-gray-500 transition-transform ${
            changeLogExpanded ? 'rotate-180' : ''
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
      </button>
    </>
  )

  return (
    <div
      className={`w-full border-t border-gray-200 bg-white ${
        changeLogExpanded
          ? 'fixed inset-0 z-50 h-screen md:relative md:z-auto md:h-auto'
          : ''
      }`}
    >
      {!changeLogExpanded && (
        <div className="flex w-full items-center justify-between px-4 py-4 md:px-6">
          {renderHeader()}
        </div>
      )}

      {changeLogExpanded && (
        <div
          className="flex h-full w-full flex-col overflow-hidden md:h-auto md:overflow-y-auto"
          style={
            {
              '--changelog-height': `${changeLogHeight}px`,
            } as CSSProperties
          }
        >
          <div className="sticky top-0 z-10 flex w-full items-center justify-between border-b border-gray-200 bg-white px-4 py-4 md:relative md:border-b-0 md:px-6">
            {renderHeader()}
          </div>

          <div className="min-h-0 w-full flex-1 overflow-y-auto border-t border-gray-200 md:border-t-0">
            {changeLogOptionsExpanded && (
              <div className="space-y-4 border-b border-gray-200 bg-gray-50 px-4 py-4 md:px-6">
                <div>
                  <button
                    onClick={downloadCsv}
                    className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    Download CSV
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase text-gray-700">
                      Filters
                    </h4>
                    <button
                      onClick={clearFilters}
                      className="text-xs text-gray-500 underline hover:text-gray-700"
                    >
                      Clear All
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">
                        Actor (who made change)
                      </label>
                      <input
                        type="text"
                        value={changeLogFilterName}
                        onChange={(e) => setChangeLogFilterName(e.target.value)}
                        placeholder="Admin name..."
                        className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">
                        Affected person
                      </label>
                      <input
                        type="text"
                        value={changeLogFilterSubjectName}
                        onChange={(e) =>
                          setChangeLogFilterSubjectName(e.target.value)
                        }
                        placeholder="Rider / edited person..."
                        className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">
                        From
                      </label>
                      <div className="relative">
                        <input
                          type="date"
                          value={changeLogFilterDateFrom}
                          onChange={(e) =>
                            setChangeLogDateRange(
                              e.target.value,
                              changeLogFilterDateTo,
                            )
                          }
                          className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 pr-8 text-xs text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            const input = e.currentTarget
                              .previousElementSibling as HTMLInputElement
                            input?.showPicker?.()
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          title="Open calendar"
                        >
                          <Calendar className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">
                        To
                      </label>
                      <div className="relative">
                        <input
                          type="date"
                          value={changeLogFilterDateTo}
                          onChange={(e) =>
                            setChangeLogDateRange(
                              changeLogFilterDateFrom,
                              e.target.value,
                            )
                          }
                          className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 pr-8 text-xs text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            const input = e.currentTarget
                              .previousElementSibling as HTMLInputElement
                            input?.showPicker?.()
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          title="Open calendar"
                        >
                          <Calendar className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-700">
                      Actions
                    </label>
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                      {ACTION_OPTIONS.map((action) => (
                        <label
                          key={action.value}
                          className="flex cursor-pointer items-center gap-1.5"
                        >
                          <input
                            type="checkbox"
                            checked={changeLogFilterActions.has(action.value)}
                            onChange={(e) => {
                              const newActions = new Set(changeLogFilterActions)
                              if (e.target.checked) {
                                newActions.add(action.value)
                              } else {
                                newActions.delete(action.value)
                              }
                              setChangeLogFilterActions(newActions)
                            }}
                            className="h-3 w-3 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                          />
                          <span className="text-xs text-gray-700">
                            {action.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase text-gray-700">
                    Sort
                  </h4>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">
                        Sort By
                      </label>
                      <select
                        value={changeLogSortBy}
                        onChange={(e) =>
                          setChangeLogSortBy(
                            e.target.value as 'date' | 'actor' | 'action',
                          )
                        }
                        className="w-full rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                      >
                        <option value="date">Date</option>
                        <option value="actor">Actor</option>
                        <option value="action">Action</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">
                        Direction
                      </label>
                      <select
                        value={changeLogSortDirection}
                        onChange={(e) =>
                          setChangeLogSortDirection(
                            e.target.value as 'asc' | 'desc',
                          )
                        }
                        className="w-full rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                      >
                        <option value="desc">Descending</option>
                        <option value="asc">Ascending</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div
              className="relative flex flex-1 flex-col md:flex-none"
              style={
                typeof window !== 'undefined' && window.innerWidth >= 768
                  ? { height: `${changeLogHeight}px` }
                  : undefined
              }
            >
              <div
                className="group z-10 hidden h-3 cursor-ns-resize items-center justify-center border-y border-gray-200 bg-gray-100 transition-colors hover:bg-teal-100 md:flex"
                onMouseDown={(e) => {
                  resizeStartRef.current = {
                    y: e.clientY,
                    height: changeLogHeight,
                  }
                  setIsResizingChangeLog(true)
                  e.preventDefault()
                }}
                title="Drag to resize changelog height"
              >
                <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="h-1 w-1 rounded-full bg-gray-400"></div>
                  <div className="h-1 w-1 rounded-full bg-gray-400"></div>
                  <div className="h-1 w-1 rounded-full bg-gray-400"></div>
                </div>
              </div>

              <div className="w-full flex-1 overflow-y-auto px-4 py-4 md:px-6">
                <div className="space-y-2">
                  {sortedChangeLog.length === 0 ? (
                    <p className="text-center text-sm text-gray-500">
                      {changeLog.length === 0
                        ? 'No changes recorded'
                        : 'No entries match the filters'}
                    </p>
                  ) : (
                    sortedChangeLog.map((entry: any, entryIndex: number) => {
                      const formatted = formatChangeLogEntry(entry)
                      let actionText = formatted.actionText

                      if (formatted.personName) {
                        actionText = actionText.replace(
                          formatted.personName,
                          `__PERSON_NAME__${formatted.personName}__PERSON_NAME__`,
                        )
                      }

                      const parts: (string | JSX.Element)[] = []
                      const segments: string[] =
                        actionText.split('__PERSON_NAME__')

                      segments.forEach(
                        (segment: string, segmentIndex: number) => {
                          if (segmentIndex % 2 === 1) {
                            parts.push(
                              <span
                                key={`person-${entryIndex}-${segmentIndex}`}
                                className="font-semibold text-gray-900"
                              >
                                {segment}
                              </span>,
                            )
                          } else {
                            const actionWords = [
                              'added',
                              'removed',
                              'moved',
                              'created',
                              'deleted',
                              'ran',
                              'ignored',
                              'left',
                              'updated',
                            ]
                            const words: string[] = segment.split(/(\s+)/)
                            words.forEach((word: string, wordIndex: number) => {
                              const cleanWord = word.trim().toLowerCase()
                              if (
                                actionWords.includes(cleanWord) ||
                                cleanWord === 'unmatched'
                              ) {
                                parts.push(
                                  <span
                                    key={`word-${entryIndex}-${segmentIndex}-${wordIndex}`}
                                    className="font-bold"
                                  >
                                    {word}
                                  </span>,
                                )
                              } else {
                                parts.push(word)
                              }
                            })
                          }
                        },
                      )

                      return (
                        <div
                          key={`changelog-${entry.id}-${entryIndex}`}
                          className="rounded-lg bg-gray-50 p-3 text-sm"
                        >
                          <p className="text-gray-800">
                            <span className="font-semibold">
                              {formatted.role}
                            </span>{' '}
                            <span className="font-bold text-red-900">
                              {formatted.actorName}
                            </span>{' '}
                            {parts}{' '}
                            <span className="text-gray-500">
                              at {formatted.formattedDateTime}
                            </span>
                          </p>
                          {entry.ignored_error && (
                            <span className="mt-2 inline-block rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-600">
                              Ignored Error
                            </span>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
