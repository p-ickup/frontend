'use client'

import { useAuth } from '@/hooks/useAuth'
import { createBrowserClient } from '@/utils/supabase'
import { User } from '@supabase/supabase-js'
import {
  Briefcase,
  Luggage,
  Plane,
  PlaneLanding,
  PlaneTakeoff,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

interface AdminDashboardProps {
  user: User
}

interface Rider {
  user_id: string
  flight_id: number
  name: string
  phone: string
  checked_bags: number
  carry_on_bags: number
  time_range: string
  airport: string
  to_airport: boolean
  date: string
  reason?: string
  flight_no?: string
  airline_iata?: string
  originGroupId?: number // Track which group the rider came from (if from a group)
  originType?: 'unmatched' | 'group' // Track if rider came from unmatched or group
}

interface Group {
  ride_id: number
  airport: string
  date: string
  time_range: string
  to_airport: boolean
  riders: Rider[]
  recommended_time?: string
  group_voucher?: string
}

interface ChangeLogEntry {
  id: string
  actor_user_id: string
  actor_role: string
  action:
    | 'RUN_ALGORITHM'
    | 'ADD_TO_GROUP'
    | 'REMOVE_FROM_GROUP'
    | 'CREATE_GROUP'
    | 'DELETE_GROUP'
    | 'IGNORE_ERROR'
  algorithm_run_id?: string | null
  target_group_id?: string | null
  target_user_id?: string | null
  ignored_error: boolean
  metadata?: any
  created_at: string
  // Computed fields
  actor_name?: string
}

export default function GroupsManagement({ user }: AdminDashboardProps) {
  const supabase = createBrowserClient()
  const { user: authUser } = useAuth()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'matched' | 'unmatched'>('matched')
  const [selectedAirports, setSelectedAirports] = useState<string[]>([])
  const [availableAirports, setAvailableAirports] = useState<string[]>([])
  const [dateRangeStart, setDateRangeStart] = useState<string>('')
  const [dateRangeEnd, setDateRangeEnd] = useState<string>('')
  const [timeRangeStart, setTimeRangeStart] = useState<string>('')
  const [timeRangeEnd, setTimeRangeEnd] = useState<string>('')
  const [subsidyFilter, setSubsidyFilter] = useState<
    'subsidized' | 'unsubsidized' | 'all'
  >('all')
  const [minBags, setMinBags] = useState<string>('')
  const [maxBags, setMaxBags] = useState<string>('')
  const [lastAlgorithmRunDate, setLastAlgorithmRunDate] = useState<
    string | null
  >(null)
  const [sortingRules, setSortingRules] = useState<
    Array<{
      field: 'bag_size' | 'group_size' | 'date' | 'time' | 'ride_id'
      direction: 'asc' | 'desc'
    }>
  >([])
  const [draggedSortIndex, setDraggedSortIndex] = useState<number | null>(null)
  const [dragOverSortIndex, setDragOverSortIndex] = useState<number | null>(
    null,
  )
  const [groups, setGroups] = useState<Group[]>([])
  const [unmatchedRiders, setUnmatchedRiders] = useState<Rider[]>([])
  const [corralRiders, setCorralRiders] = useState<Rider[]>([])
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set())
  const [changeLogExpanded, setChangeLogExpanded] = useState(false)
  const [changeLog, setChangeLog] = useState<ChangeLogEntry[]>([])
  const [changeLogOptionsExpanded, setChangeLogOptionsExpanded] =
    useState(false)
  const [changeLogHeight, setChangeLogHeight] = useState(256) // Default height in pixels
  const [changeLogFilterName, setChangeLogFilterName] = useState<string>('')
  const [changeLogFilterActions, setChangeLogFilterActions] = useState<
    Set<string>
  >(new Set())
  const [changeLogFilterDateFrom, setChangeLogFilterDateFrom] =
    useState<string>('')
  const [changeLogFilterDateTo, setChangeLogFilterDateTo] = useState<string>('')
  const [changeLogSortBy, setChangeLogSortBy] = useState<
    'date' | 'actor' | 'action'
  >('date')
  const [changeLogSortDirection, setChangeLogSortDirection] = useState<
    'asc' | 'desc'
  >('desc')
  const [isResizingChangeLog, setIsResizingChangeLog] = useState(false)
  const resizeStartRef = useRef<{ y: number; height: number } | null>(null)
  const [draggedRider, setDraggedRider] = useState<Rider | null>(null)
  // Start collapsed by default (will expand on desktop)
  const [filtersCollapsed, setFiltersCollapsed] = useState(true)
  const [corralCollapsed, setCorralCollapsed] = useState(true)
  const [corralSelectionMode, setCorralSelectionMode] = useState<number | null>(
    null,
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [newGroupSectionExpanded, setNewGroupSectionExpanded] = useState(false)
  const [selectedRidersForNewGroup, setSelectedRidersForNewGroup] = useState<
    Rider[]
  >([])
  const [newGroupDate, setNewGroupDate] = useState<string>('')
  const [newGroupTime, setNewGroupTime] = useState<string>('')
  const [newGroupVoucher, setNewGroupVoucher] = useState<string>('')
  const [newGroupContingencyVoucher, setNewGroupContingencyVoucher] =
    useState<string>('')
  const [isSubsidized, setIsSubsidized] = useState<boolean>(false)
  const [isCreatingGroup, setIsCreatingGroup] = useState(false)
  const [leftSidebarTabs] = useState<Array<'filters' | 'createGroup'>>([
    'filters',
    'createGroup',
  ])
  const [activeLeftTab, setActiveLeftTab] = useState<'filters' | 'createGroup'>(
    'filters',
  )
  const [autoCalculateError, setAutoCalculateError] = useState<string | null>(
    null,
  )
  const [corralCardErrors, setCorralCardErrors] = useState<Map<string, string>>(
    new Map(),
  )
  const [searchQuery, setSearchQuery] = useState<string>('')

  useEffect(() => {
    const loadData = async () => {
      await fetchLastAlgorithmRun()
      await fetchData()
      await fetchChangeLog()
    }
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Set initial collapsed state based on screen size
  useEffect(() => {
    const isMobile = window.innerWidth < 768 // md breakpoint
    if (!isMobile) {
      // Expand on desktop
      setFiltersCollapsed(false)
      setCorralCollapsed(false)
    }
    // On mobile, keep them collapsed (already true by default)
  }, [])

  // Handle changelog resizing with fine control
  useEffect(() => {
    if (!isResizingChangeLog || !resizeStartRef.current) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeStartRef.current) return

      // Calculate new height based on mouse movement
      const deltaY = resizeStartRef.current.y - e.clientY // Positive when dragging up
      const newHeight = resizeStartRef.current.height + deltaY
      const minHeight = 100
      const maxHeight = window.innerHeight - 300 // Leave space for header and other UI
      setChangeLogHeight(Math.max(minHeight, Math.min(maxHeight, newHeight)))
    }

    const handleMouseUp = () => {
      setIsResizingChangeLog(false)
      resizeStartRef.current = null
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizingChangeLog])

  const fetchLastAlgorithmRun = async () => {
    try {
      const { data: lastRun } = await supabase
        .from('AlgorithmStatus')
        .select('finished_at')
        .eq('status', 'success')
        .order('finished_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (lastRun?.finished_at) {
        // Set default date range to start from last algorithm run
        const runDate = new Date(lastRun.finished_at)
        const dateString = runDate.toISOString().split('T')[0]
        setLastAlgorithmRunDate(dateString)
        setDateRangeStart(dateString)

        // Set end date to 15 days after the last successful run
        const endDate = new Date(runDate)
        endDate.setDate(endDate.getDate() + 15)
        const endDateString = endDate.toISOString().split('T')[0]
        setDateRangeEnd(endDateString)
      }
    } catch (error) {
      console.error('Error fetching last algorithm run:', error)
    }
  }

  const fetchData = async () => {
    try {
      setLoading(true)
      const currentUser = authUser || user

      // Fetch all flights with user data
      const { data: flightsData } = await supabase.from('Flights').select(`
          flight_id,
          airport,
          date,
          earliest_time,
          latest_time,
          to_airport,
          bag_no,
          bag_no_large,
          bag_no_personal,
          user_id,
          matched,
          flight_no,
          airline_iata,
          Users:Users!Flights_user_id_fkey(firstname, lastname, phonenumber)
        `)

      if (flightsData) {
        // Extract unique airports
        const airports = Array.from(
          new Set(flightsData.map((f: any) => f.airport).filter(Boolean)),
        )
        setAvailableAirports(airports)
        setSelectedAirports(airports) // Select all by default

        // Fetch matches first to get all ride_ids and flight_ids
        const { data: matchesData } = await supabase
          .from('Matches')
          .select('ride_id, flight_id, user_id, voucher')

        if (!matchesData || matchesData.length === 0) {
          setGroups([])
          setUnmatchedRiders(
            flightsData
              .filter((f: any) => !f.matched)
              .map((flight: any) => {
                const userData = Array.isArray(flight.Users)
                  ? flight.Users[0]
                  : flight.Users
                return {
                  user_id: flight.user_id,
                  flight_id: flight.flight_id,
                  name:
                    `${userData?.firstname || ''} ${userData?.lastname || ''}`.trim() ||
                    'Unknown',
                  phone: userData?.phonenumber || 'N/A',
                  checked_bags:
                    (flight.bag_no || 0) + (flight.bag_no_large || 0),
                  carry_on_bags: flight.bag_no_personal || 0,
                  time_range: `${flight.earliest_time} - ${flight.latest_time}`,
                  airport: flight.airport,
                  to_airport: flight.to_airport,
                  date: flight.date,
                  reason: 'unmatched',
                  flight_no: flight.flight_no || '',
                  airline_iata: flight.airline_iata || '',
                }
              }),
          )
          return
        }

        // Get all unique flight_ids from matches
        const matchFlightIds = Array.from(
          new Set(matchesData.map((m: any) => m.flight_id)),
        )

        // Fetch flights for all matches (this ensures we get all flights even if RLS filtered some out)
        const { data: matchFlightsData } = await supabase
          .from('Flights')
          .select(
            `
            flight_id,
            airport,
            date,
            earliest_time,
            latest_time,
            to_airport,
            bag_no,
            bag_no_large,
            bag_no_personal,
            user_id,
            matched,
            flight_no,
            airline_iata,
            Users:Users!Flights_user_id_fkey(firstname, lastname, phonenumber)
          `,
          )
          .in('flight_id', matchFlightIds)

        // Create a map of flight_id to flight data for quick lookup
        const flightsMap = new Map<number, any>()
        matchFlightsData?.forEach((flight: any) => {
          flightsMap.set(flight.flight_id, flight)
        })

        // Also add flights from initial fetch that might not be in matches
        flightsData.forEach((flight: any) => {
          if (!flightsMap.has(flight.flight_id)) {
            flightsMap.set(flight.flight_id, flight)
          }
        })

        // Build groups from matches
        const groupsMap = new Map<number, Group>()
        const matchedFlightIds = new Set<number>()

        matchesData.forEach((match: any) => {
          const flight = flightsMap.get(match.flight_id)
          if (!flight) {
            console.warn(
              `Match has no associated flight (flight_id: ${match.flight_id}, ride_id: ${match.ride_id})`,
            )
            return
          }

          matchedFlightIds.add(match.flight_id)

          if (!groupsMap.has(match.ride_id)) {
            groupsMap.set(match.ride_id, {
              ride_id: match.ride_id,
              airport: flight.airport,
              date: flight.date,
              time_range: `${flight.earliest_time} - ${flight.latest_time}`,
              to_airport: flight.to_airport,
              riders: [],
              group_voucher: match.voucher || undefined,
            })
          }

          const group = groupsMap.get(match.ride_id)!
          const userData = Array.isArray(flight.Users)
            ? flight.Users[0]
            : flight.Users
          group.riders.push({
            user_id: flight.user_id,
            flight_id: flight.flight_id,
            name:
              `${userData?.firstname || ''} ${userData?.lastname || ''}`.trim() ||
              'Unknown',
            phone: userData?.phonenumber || 'N/A',
            checked_bags: (flight.bag_no || 0) + (flight.bag_no_large || 0),
            carry_on_bags: flight.bag_no_personal || 0,
            time_range: `${flight.earliest_time} - ${flight.latest_time}`,
            airport: flight.airport,
            to_airport: flight.to_airport,
            date: flight.date,
            flight_no: flight.flight_no || '',
            airline_iata: flight.airline_iata || '',
          })
        })

        setGroups(Array.from(groupsMap.values()))

        // Get unmatched riders
        const unmatched = flightsData
          .filter((f: any) => !matchedFlightIds.has(f.flight_id) && !f.matched)
          .map((flight: any) => {
            const userData = Array.isArray(flight.Users)
              ? flight.Users[0]
              : flight.Users
            return {
              user_id: flight.user_id,
              flight_id: flight.flight_id,
              name:
                `${userData?.firstname || ''} ${userData?.lastname || ''}`.trim() ||
                'Unknown',
              phone: userData?.phonenumber || 'N/A',
              checked_bags: (flight.bag_no || 0) + (flight.bag_no_large || 0),
              carry_on_bags: flight.bag_no_personal || 0,
              time_range: `${flight.earliest_time} - ${flight.latest_time}`,
              airport: flight.airport,
              to_airport: flight.to_airport,
              date: flight.date,
              reason: 'unmatched',
              flight_no: flight.flight_no || '',
              airline_iata: flight.airline_iata || '',
            }
          })

        setUnmatchedRiders(unmatched)
      }
    } catch (error) {
      console.error('Error fetching groups data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchChangeLog = async () => {
    try {
      const { data: changeLogData, error } = await supabase
        .from('ChangeLog')
        .select(
          `
          id,
          actor_user_id,
          actor_role,
          action,
          algorithm_run_id,
          target_group_id,
          target_user_id,
          ignored_error,
          metadata,
          created_at,
          Users:Users!ChangeLog_actor_user_id_fkey(firstname, lastname)
        `,
        )
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching changelog:', error)
        return
      }

      if (changeLogData) {
        const entries: ChangeLogEntry[] = changeLogData.map((entry: any) => {
          const userData = Array.isArray(entry.Users)
            ? entry.Users[0]
            : entry.Users
          return {
            id: entry.id,
            actor_user_id: entry.actor_user_id,
            actor_role: entry.actor_role,
            action: entry.action,
            algorithm_run_id: entry.algorithm_run_id,
            target_group_id: entry.target_group_id,
            target_user_id: entry.target_user_id,
            ignored_error: entry.ignored_error,
            metadata: entry.metadata,
            created_at: entry.created_at,
            actor_name: userData
              ? `${userData.firstname || ''} ${userData.lastname || ''}`.trim()
              : 'Unknown',
          }
        })
        setChangeLog(entries)
      }
    } catch (error) {
      console.error('Error fetching changelog:', error)
    }
  }

  const toggleAirport = (airport: string) => {
    setSelectedAirports((prev) =>
      prev.includes(airport)
        ? prev.filter((a) => a !== airport)
        : [...prev, airport],
    )
  }

  const toggleGroupExpanded = (rideId: number) => {
    setExpandedGroups((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(rideId)) {
        newSet.delete(rideId)
      } else {
        newSet.add(rideId)
      }
      return newSet
    })
  }

  const getTotalBags = useCallback((riders: Rider[]) => {
    return riders.reduce(
      (sum, rider) => sum + rider.checked_bags + rider.carry_on_bags,
      0,
    )
  }, [])

  const getCapacityBarColor = useCallback((totalBags: number) => {
    if (totalBags === 0) return 'bg-green-500'
    if (totalBags <= 3) return 'bg-gradient-to-r from-green-500 to-yellow-500'
    if (totalBags <= 6) return 'bg-gradient-to-r from-yellow-500 to-orange-500'
    if (totalBags <= 9) return 'bg-gradient-to-r from-orange-500 to-red-500'
    return 'bg-red-700'
  }, [])

  const getUberType = useCallback((riderCount: number) => {
    if (riderCount <= 3) return 'X'
    if (riderCount === 4) return 'XL'
    return 'XXL'
  }, [])

  const validateTimeCompatibility = useCallback(
    (group: Group, rider: Rider): boolean => {
      // Check if rider's time range overlaps with group's time range
      const groupTimes = group.time_range.split(' - ').map((t) => t.trim())
      const riderTimes = rider.time_range.split(' - ').map((t) => t.trim())

      if (groupTimes.length !== 2 || riderTimes.length !== 2) return false

      // Check if dates match
      if (group.date !== rider.date) return false

      // Check if time ranges overlap (simplified check)
      const groupStart = groupTimes[0]
      const groupEnd = groupTimes[1]
      const riderStart = riderTimes[0]
      const riderEnd = riderTimes[1]

      // Times overlap if: (riderStart <= groupEnd && riderEnd >= groupStart)
      return riderStart <= groupEnd && riderEnd >= groupStart
    },
    [],
  )

  const validateBagConstraints = useCallback(
    (group: Group, rider: Rider): boolean => {
      const currentBags = getTotalBags(group.riders)
      const riderBags = rider.checked_bags + rider.carry_on_bags
      const totalBags = currentBags + riderBags

      // Recommended max is 10 bags
      return totalBags <= 10
    },
    [getTotalBags],
  )

  const handleAddToCorral = useCallback(
    (rider: Rider, fromGroupId?: number) => {
      const riderWithOrigin: Rider = {
        ...rider,
        originType: (fromGroupId ? 'group' : 'unmatched') as
          | 'group'
          | 'unmatched',
        originGroupId: fromGroupId,
      }
      setCorralRiders((prev) => [...prev, riderWithOrigin])
      if (fromGroupId) {
        // Remove from group
        setGroups((prev) =>
          prev.map((g) =>
            g.ride_id === fromGroupId
              ? {
                  ...g,
                  riders: g.riders.filter((r) => r.user_id !== rider.user_id),
                }
              : g,
          ),
        )
      } else {
        // Remove from unmatched
        setUnmatchedRiders((prev) =>
          prev.filter((r) => r.user_id !== rider.user_id),
        )
      }
    },
    [],
  )

  const handleRemoveFromCorral = useCallback((rider: Rider) => {
    // Remove from corral
    setCorralRiders((prev) => prev.filter((r) => r.user_id !== rider.user_id))

    // Return to origin
    if (rider.originType === 'group' && rider.originGroupId) {
      // Return to original group
      setGroups((prev) =>
        prev.map((g) =>
          g.ride_id === rider.originGroupId
            ? {
                ...g,
                riders: [...g.riders, rider],
              }
            : g,
        ),
      )
    } else {
      // Return to unmatched
      setUnmatchedRiders((prev) => [...prev, rider])
    }
  }, [])

  const handleAddFromCorral = useCallback(
    (group: Group) => {
      if (corralRiders.length === 0) return

      setCorralSelectionMode(group.ride_id)
      setCorralCollapsed(false) // Open corral
      setErrorMessage(null)
    },
    [corralRiders.length],
  )

  const handleSelectFromCorral = useCallback(
    (rider: Rider, group: Group) => {
      // Validate time compatibility
      if (!validateTimeCompatibility(group, rider)) {
        const errorKey = `${rider.user_id}-${group.ride_id}`
        setCorralCardErrors((prev) => {
          const newMap = new Map(prev)
          newMap.set(errorKey, 'These flights have no overlap')
          return newMap
        })
        setCorralSelectionMode(null)
        setTimeout(() => {
          setCorralCardErrors((prev) => {
            const newMap = new Map(prev)
            newMap.delete(errorKey)
            return newMap
          })
        }, 3000)
        return
      }

      // Validate bag constraints
      if (!validateBagConstraints(group, rider)) {
        setErrorMessage(
          'You are creating a group over the recommended bag size',
        )
        setCorralSelectionMode(null)
        setTimeout(() => setErrorMessage(null), 3000)
        return
      }

      // Add rider to group
      setGroups((prev) =>
        prev.map((g) =>
          g.ride_id === group.ride_id
            ? {
                ...g,
                riders: [...g.riders, rider],
              }
            : g,
        ),
      )

      // Remove from corral
      setCorralRiders((prev) => prev.filter((r) => r.user_id !== rider.user_id))

      // Clear selection mode
      setCorralSelectionMode(null)
      setErrorMessage(null)
    },
    [validateTimeCompatibility, validateBagConstraints],
  )

  const isDatePassed = (dateString: string) => {
    const groupDate = new Date(dateString)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return groupDate < today
  }

  const handleFiltersToggle = useCallback(() => {
    const isMobile = window.innerWidth < 768
    if (isMobile && filtersCollapsed) {
      // Opening filters on mobile - close corral
      setCorralCollapsed(true)
    }
    setFiltersCollapsed(!filtersCollapsed)
    // Always switch to filters tab when opening
    if (filtersCollapsed) {
      setActiveLeftTab('filters')
    }
  }, [filtersCollapsed])

  const handleCorralToggle = useCallback(() => {
    const isMobile = window.innerWidth < 768
    if (isMobile && corralCollapsed) {
      // Opening corral on mobile - close filters
      setFiltersCollapsed(true)
    }
    setCorralCollapsed(!corralCollapsed)
  }, [corralCollapsed])

  // Handle section drop
  const formatTimeRange = (timeRange: string): string => {
    // timeRange is in format "HH:MM - HH:MM" (24-hour format)
    const [startTime, endTime] = timeRange.split(' - ').map((t) => t.trim())
    if (!startTime || !endTime) return timeRange

    const formatTime = (timeStr: string): string => {
      const [hours, minutes] = timeStr.split(':').map(Number)
      // Convert 24-hour to 12-hour format
      const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
      const ampm = hours < 12 ? 'AM' : 'PM'
      const minStr = minutes ? `:${minutes.toString().padStart(2, '0')}` : ''
      return `${hour12}${minStr} ${ampm}`
    }

    return `${formatTime(startTime)} - ${formatTime(endTime)} PT`
  }

  const formatVoucher = (voucher: string | undefined): string => {
    if (!voucher) return ''
    // Extract the part after the last "/"
    const parts = voucher.split('/')
    return parts[parts.length - 1] || voucher
  }

  // Calculate group date/time from flight windows (overlap calculation)
  const matchDatetimeFromEarliest = (
    riders: Rider[],
  ): { date: string; time: string } | null => {
    if (riders.length === 0) return null

    let latestStart = ''
    let earliestEnd = ''
    let groupDate = ''

    for (const rider of riders) {
      const [startTime, endTime] = rider.time_range
        .split(' - ')
        .map((t) => t.trim())
      if (!startTime || !endTime) continue

      if (!latestStart || startTime > latestStart) {
        latestStart = startTime
        groupDate = rider.date
      }
      if (!earliestEnd || endTime < earliestEnd) {
        earliestEnd = endTime
      }
    }

    if (!latestStart || !earliestEnd || latestStart > earliestEnd) {
      return null // No valid overlap
    }

    // Use latestStart as the match time
    return {
      date: groupDate,
      time: latestStart,
    }
  }

  // Calculate bag units: (large_bags * 2) + normal_bags
  const calculateBagUnits = (riders: Rider[]): number => {
    let numLargeBags = 0
    let numNormalBags = 0

    for (const rider of riders) {
      numLargeBags += rider.checked_bags
      numNormalBags += rider.carry_on_bags
    }

    return numLargeBags * 2 + numNormalBags
  }

  // Determine uber_type based on group size and bag units
  const determineUberType = (
    groupSize: number,
    bagUnits: number,
  ): string | null => {
    if (bagUnits > 10) return null // Hard limit

    if (groupSize >= 2 && groupSize <= 3) {
      if (bagUnits >= 0 && bagUnits <= 4) return 'X'
      if (bagUnits >= 5 && bagUnits <= 10) return 'XL'
      if (bagUnits >= 11 && bagUnits <= 12) return 'XXL'
    } else if (groupSize === 4) {
      if (bagUnits >= 0 && bagUnits <= 3) return 'X'
      if (bagUnits >= 4 && bagUnits <= 7) return 'XL'
      if (bagUnits >= 8 && bagUnits <= 10) return 'XXL'
    } else if (groupSize === 5) {
      if (bagUnits >= 0 && bagUnits <= 5) return 'XL'
      if (bagUnits >= 6 && bagUnits <= 8) return 'XXL'
    } else if (groupSize === 6) {
      if (bagUnits >= 0 && bagUnits <= 3) return 'XL'
      if (bagUnits >= 4 && bagUnits <= 6) return 'XXL'
    }

    return null // Invalid combination
  }

  // Create new group in database
  const createNewGroup = async () => {
    if (
      selectedRidersForNewGroup.length < 2 ||
      selectedRidersForNewGroup.length > 6
    ) {
      setErrorMessage('Group must have 2-6 riders')
      setTimeout(() => setErrorMessage(null), 3000)
      return
    }

    if (!newGroupDate || !newGroupTime) {
      setErrorMessage('Date and time are required')
      setTimeout(() => setErrorMessage(null), 3000)
      return
    }

    setIsCreatingGroup(true)

    try {
      // Calculate bag units and uber_type
      const bagUnits = calculateBagUnits(selectedRidersForNewGroup)
      const uberType = determineUberType(
        selectedRidersForNewGroup.length,
        bagUnits,
      )

      if (!uberType) {
        setErrorMessage('Invalid group size and bag combination')
        setTimeout(() => setErrorMessage(null), 3000)
        setIsCreatingGroup(false)
        return
      }

      // Format date for database (YYYY-MM-DD)
      const rideDate = new Date(newGroupDate).toISOString().split('T')[0]

      // Step 1: Create Rides row and get ride_id
      const { data: rideData, error: rideError } = await supabase
        .from('Rides')
        .insert({ ride_date: rideDate })
        .select('ride_id')
        .single()

      if (rideError || !rideData) {
        console.error('Error creating ride:', rideError)
        setErrorMessage('Failed to create ride')
        setTimeout(() => setErrorMessage(null), 3000)
        setIsCreatingGroup(false)
        return
      }

      const rideId = rideData.ride_id

      // Format time to HH:MM:SS (database expects seconds)
      const formattedTime =
        newGroupTime.includes(':') && newGroupTime.split(':').length === 2
          ? `${newGroupTime}:00`
          : newGroupTime

      // Step 2: Create Matches rows for each rider
      const matchesToInsert = selectedRidersForNewGroup.map((rider) => ({
        ride_id: rideId,
        user_id: rider.user_id,
        flight_id: rider.flight_id,
        date: rideDate,
        time: formattedTime,
        source: 'manual', // Admin-created groups
        voucher: isSubsidized ? newGroupVoucher || '' : '',
        contingency_voucher: null, // Not handling contingency vouchers for now
        is_verified: false,
        is_subsidized: isSubsidized,
        uber_type: uberType,
      }))

      const { error: matchesError } = await supabase
        .from('Matches')
        .insert(matchesToInsert)

      if (matchesError) {
        console.error('Error creating matches:', matchesError)
        setErrorMessage('Failed to create matches')
        setTimeout(() => setErrorMessage(null), 3000)
        setIsCreatingGroup(false)
        return
      }

      // Step 3: Update Flights table to mark as matched
      const flightIds = selectedRidersForNewGroup.map((r) => r.flight_id)
      const { error: flightsError } = await supabase
        .from('Flights')
        .update({ matched: true })
        .in('flight_id', flightIds)

      if (flightsError) {
        console.error('Error updating flights:', flightsError)
        // Don't fail the whole operation, just log it
      }

      // Clear form and refresh data
      setSelectedRidersForNewGroup([])
      setNewGroupDate('')
      setNewGroupTime('')
      setNewGroupVoucher('')
      setNewGroupContingencyVoucher('')
      setIsSubsidized(false)
      setNewGroupSectionExpanded(false)

      // Refresh groups and unmatched riders
      await fetchData()

      setErrorMessage(null)
    } catch (error) {
      console.error('Unexpected error creating group:', error)
      setErrorMessage('An unexpected error occurred')
      setTimeout(() => setErrorMessage(null), 3000)
    } finally {
      setIsCreatingGroup(false)
    }
  }

  // Add rider to new group selection
  const addRiderToNewGroup = (rider: Rider) => {
    if (selectedRidersForNewGroup.length >= 6) {
      setErrorMessage('Maximum 6 riders per group')
      setTimeout(() => setErrorMessage(null), 3000)
      return
    }
    if (selectedRidersForNewGroup.some((r) => r.user_id === rider.user_id)) {
      return // Already selected
    }
    setSelectedRidersForNewGroup((prev) => [...prev, rider])

    // Auto-calculate date/time if not set
    if (!newGroupDate || !newGroupTime) {
      const calculated = matchDatetimeFromEarliest([
        ...selectedRidersForNewGroup,
        rider,
      ])
      if (calculated) {
        setNewGroupDate(calculated.date)
        // Convert time to HH:MM format for time input
        const [hours, minutes] = calculated.time.split(':')
        setNewGroupTime(`${hours}:${minutes || '00'}`)
      }
    }
  }

  const filteredGroups = useMemo(
    () =>
      groups.filter((group) => {
        const airportMatch = selectedAirports.includes(group.airport)
        if (!airportMatch) return false

        // Default: Only show groups after last algorithm run date
        if (lastAlgorithmRunDate && !dateRangeStart && !dateRangeEnd) {
          const groupDate = new Date(group.date)
          const runDate = new Date(lastAlgorithmRunDate)
          groupDate.setHours(0, 0, 0, 0)
          runDate.setHours(0, 0, 0, 0)

          if (groupDate < runDate) {
            return false
          }
        }

        // Date range filter
        if (dateRangeStart && dateRangeEnd) {
          const groupDate = new Date(group.date)
          const startDate = new Date(dateRangeStart)
          const endDate = new Date(dateRangeEnd)
          startDate.setHours(0, 0, 0, 0)
          endDate.setHours(23, 59, 59, 999)
          groupDate.setHours(0, 0, 0, 0)

          if (groupDate < startDate || groupDate > endDate) {
            return false
          }
        }

        // Time range filter (optional)
        if (timeRangeStart && timeRangeEnd) {
          const groupTimeRange = group.time_range.split(' - ')
          const groupStart = groupTimeRange[0]?.trim()
          const groupEnd = groupTimeRange[1]?.trim()

          if (groupStart && groupEnd) {
            // Compare time ranges (simplified - assumes same date)
            const timeInRange =
              (groupStart >= timeRangeStart && groupStart <= timeRangeEnd) ||
              (groupEnd >= timeRangeStart && groupEnd <= timeRangeEnd) ||
              (groupStart <= timeRangeStart && groupEnd >= timeRangeEnd)

            if (!timeInRange) return false
          }
        }

        // Subsidy filter
        const riderCount = group.riders.length
        const isSubsidized = riderCount >= 3
        if (subsidyFilter === 'subsidized' && !isSubsidized) return false
        if (subsidyFilter === 'unsubsidized' && isSubsidized) return false

        // Bag amount filter (only if values are provided)
        if (minBags || maxBags) {
          const totalBags = getTotalBags(group.riders)
          if (minBags && totalBags < parseInt(minBags)) return false
          if (maxBags && totalBags > parseInt(maxBags)) return false
        }

        // Search filter
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase().trim()
          // Search in group ride_id
          const rideIdMatch = group.ride_id.toString().includes(query)

          // Search in rider names
          const nameMatch = group.riders.some((rider) =>
            rider.name.toLowerCase().includes(query),
          )

          // Search in flight_id
          const flightIdMatch = group.riders.some((rider) =>
            rider.flight_id.toString().includes(query),
          )

          // Search in flight_no (voucher)
          const flightNoMatch = group.riders.some((rider) =>
            rider.flight_no?.toString().toLowerCase().includes(query),
          )

          // Search in airline_iata + flight_no combination (e.g., "AA1234")
          const airlineFlightMatch = group.riders.some((rider) => {
            if (rider.airline_iata && rider.flight_no) {
              const combined =
                `${rider.airline_iata}${rider.flight_no}`.toLowerCase()
              return combined.includes(query)
            }
            return false
          })

          // Search in group voucher (formatted - just the code part)
          const groupVoucherMatch = group.group_voucher
            ? formatVoucher(group.group_voucher).toLowerCase().includes(query)
            : false

          if (
            !rideIdMatch &&
            !nameMatch &&
            !flightIdMatch &&
            !flightNoMatch &&
            !airlineFlightMatch &&
            !groupVoucherMatch
          ) {
            return false
          }
        }

        return true
      }),
    [
      groups,
      selectedAirports,
      lastAlgorithmRunDate,
      dateRangeStart,
      dateRangeEnd,
      timeRangeStart,
      timeRangeEnd,
      subsidyFilter,
      minBags,
      maxBags,
      searchQuery,
      getTotalBags,
    ],
  )

  // Apply sorting to filtered groups
  const sortedGroups = useMemo(
    () =>
      [...filteredGroups].sort((a, b) => {
        for (const rule of sortingRules) {
          let comparison = 0

          switch (rule.field) {
            case 'bag_size': {
              const bagsA = getTotalBags(a.riders)
              const bagsB = getTotalBags(b.riders)
              comparison = bagsA - bagsB
              break
            }
            case 'group_size': {
              comparison = a.riders.length - b.riders.length
              break
            }
            case 'date': {
              const dateA = new Date(a.date).getTime()
              const dateB = new Date(b.date).getTime()
              comparison = dateA - dateB
              break
            }
            case 'time': {
              // Compare by earliest time in the range
              const timeA = a.time_range.split(' - ')[0]?.trim() || ''
              const timeB = b.time_range.split(' - ')[0]?.trim() || ''
              comparison = timeA.localeCompare(timeB)
              break
            }
            case 'ride_id': {
              comparison = a.ride_id - b.ride_id
              break
            }
          }

          if (comparison !== 0) {
            return rule.direction === 'asc' ? comparison : -comparison
          }
        }
        return 0
      }),
    [filteredGroups, sortingRules, getTotalBags],
  )

  // Helper function to sort riders
  const sortRiders = useCallback(
    (riders: Rider[]) => {
      return [...riders].sort((a, b) => {
        for (const rule of sortingRules) {
          // Skip group_size for individual riders
          if (rule.field === 'group_size') {
            continue
          }

          let comparison = 0

          switch (rule.field) {
            case 'bag_size': {
              const bagsA = a.checked_bags + a.carry_on_bags
              const bagsB = b.checked_bags + b.carry_on_bags
              comparison = bagsA - bagsB
              break
            }
            case 'date': {
              const dateA = new Date(a.date).getTime()
              const dateB = new Date(b.date).getTime()
              comparison = dateA - dateB
              break
            }
            case 'time': {
              // Compare by earliest time in the range
              const timeA = a.time_range.split(' - ')[0]?.trim() || ''
              const timeB = b.time_range.split(' - ')[0]?.trim() || ''
              comparison = timeA.localeCompare(timeB)
              break
            }
            case 'ride_id': {
              // For unmatched/corral, use flight_id instead
              comparison = a.flight_id - b.flight_id
              break
            }
          }

          if (comparison !== 0) {
            return rule.direction === 'asc' ? comparison : -comparison
          }
        }
        return 0
      })
    },
    [sortingRules],
  )

  const filteredUnmatchedRiders = useMemo(
    () =>
      unmatchedRiders.filter((rider) => {
        // Default: Only show unmatched riders after last algorithm run date
        if (lastAlgorithmRunDate && !dateRangeStart && !dateRangeEnd) {
          const riderDate = new Date(rider.date)
          const runDate = new Date(lastAlgorithmRunDate)
          riderDate.setHours(0, 0, 0, 0)
          runDate.setHours(0, 0, 0, 0)

          if (riderDate < runDate) {
            return false
          }
        }

        // Date range filter for unmatched
        if (dateRangeStart && dateRangeEnd) {
          const riderDate = new Date(rider.date)
          const startDate = new Date(dateRangeStart)
          const endDate = new Date(dateRangeEnd)
          startDate.setHours(0, 0, 0, 0)
          endDate.setHours(23, 59, 59, 999)
          riderDate.setHours(0, 0, 0, 0)

          if (riderDate < startDate || riderDate > endDate) {
            return false
          }
        }

        // Airport filter for unmatched
        if (!selectedAirports.includes(rider.airport)) return false

        // Bag amount filter for unmatched (only if values are provided)
        if (minBags || maxBags) {
          const totalBags = rider.checked_bags + rider.carry_on_bags
          if (minBags && totalBags < parseInt(minBags)) return false
          if (maxBags && totalBags > parseInt(maxBags)) return false
        }

        // Search filter
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase().trim()
          // Search in rider name
          const nameMatch = rider.name.toLowerCase().includes(query)

          // Search in flight_id
          const flightIdMatch = rider.flight_id.toString().includes(query)

          // Search in flight_no (voucher)
          const flightNoMatch = rider.flight_no
            ?.toString()
            .toLowerCase()
            .includes(query)

          // Search in airline_iata + flight_no combination (e.g., "AA1234")
          const airlineFlightMatch =
            rider.airline_iata && rider.flight_no
              ? `${rider.airline_iata}${rider.flight_no}`
                  .toLowerCase()
                  .includes(query)
              : false

          if (
            !nameMatch &&
            !flightIdMatch &&
            !flightNoMatch &&
            !airlineFlightMatch
          ) {
            return false
          }
        }

        return true
      }),
    [
      unmatchedRiders,
      lastAlgorithmRunDate,
      dateRangeStart,
      dateRangeEnd,
      selectedAirports,
      minBags,
      maxBags,
      searchQuery,
    ],
  )

  // Apply sorting to filtered unmatched riders
  const sortedUnmatchedRiders = useMemo(
    () => sortRiders(filteredUnmatchedRiders),
    [filteredUnmatchedRiders, sortRiders],
  )

  // Apply sorting to corral riders
  const sortedCorralRiders = useMemo(
    () => sortRiders(corralRiders),
    [corralRiders, sortRiders],
  )

  // Filter and sort changelog
  const filteredChangeLog = useMemo(
    () =>
      changeLog.filter((entry) => {
        // Filter by name
        if (changeLogFilterName.trim()) {
          const nameMatch = entry.actor_name
            ?.toLowerCase()
            .includes(changeLogFilterName.toLowerCase().trim())
          if (!nameMatch) return false
        }

        // Filter by action (multiple selections)
        if (changeLogFilterActions.size > 0) {
          if (!changeLogFilterActions.has(entry.action)) return false
        }

        // Filter by date range
        if (changeLogFilterDateFrom || changeLogFilterDateTo) {
          const entryDate = new Date(entry.created_at)
          if (changeLogFilterDateFrom) {
            const fromDate = new Date(changeLogFilterDateFrom)
            fromDate.setHours(0, 0, 0, 0)
            entryDate.setHours(0, 0, 0, 0)
            if (entryDate < fromDate) return false
          }
          if (changeLogFilterDateTo) {
            const toDate = new Date(changeLogFilterDateTo)
            toDate.setHours(23, 59, 59, 999)
            entryDate.setHours(23, 59, 59, 999)
            if (entryDate > toDate) return false
          }
        }

        return true
      }),
    [
      changeLog,
      changeLogFilterName,
      changeLogFilterActions,
      changeLogFilterDateFrom,
      changeLogFilterDateTo,
    ],
  )

  const sortedChangeLog = useMemo(
    () =>
      [...filteredChangeLog].sort((a, b) => {
        let comparison = 0

        switch (changeLogSortBy) {
          case 'date':
            comparison =
              new Date(a.created_at).getTime() -
              new Date(b.created_at).getTime()
            break
          case 'actor':
            comparison = (a.actor_name || '').localeCompare(b.actor_name || '')
            break
          case 'action':
            comparison = a.action.localeCompare(b.action)
            break
        }

        return changeLogSortDirection === 'asc' ? comparison : -comparison
      }),
    [filteredChangeLog, changeLogSortBy, changeLogSortDirection],
  )

  // Render create group content (used in both left sidebar and right sidebar)
  const renderCreateGroupContent = () => (
    <>
      {/* Selected Riders */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Selected Riders ({selectedRidersForNewGroup.length}/6)
        </label>
        <div className="max-h-40 space-y-2 overflow-y-auto">
          {selectedRidersForNewGroup.length === 0 ? (
            <p className="text-sm text-gray-500">
              No riders selected. Select from Corral or Unmatched.
            </p>
          ) : (
            selectedRidersForNewGroup.map((rider) => (
              <div
                key={rider.user_id}
                className="flex items-center justify-between rounded border border-gray-200 bg-gray-50 p-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {rider.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {rider.airline_iata} {rider.flight_no} • {rider.date}
                  </p>
                </div>
                <button
                  onClick={() =>
                    setSelectedRidersForNewGroup((prev) =>
                      prev.filter((r) => r.user_id !== rider.user_id),
                    )
                  }
                  className="ml-2 text-red-500 hover:text-red-700"
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
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Date Input */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700">
            Date <span className="text-red-500">*</span>
          </label>
          {selectedRidersForNewGroup.length >= 2 && (
            <div className="flex flex-col items-end">
              <button
                type="button"
                onClick={() => {
                  const calculated = matchDatetimeFromEarliest(
                    selectedRidersForNewGroup,
                  )
                  if (calculated) {
                    setNewGroupDate(calculated.date)
                    const [hours, minutes] = calculated.time.split(':')
                    setNewGroupTime(`${hours}:${minutes || '00'}`)
                    setAutoCalculateError(null)
                  } else {
                    setAutoCalculateError(
                      'No valid time overlap found for selected riders',
                    )
                    setTimeout(() => setAutoCalculateError(null), 3000)
                  }
                }}
                className="text-xs text-teal-600 underline hover:text-teal-800"
              >
                Auto-calculate from riders
              </button>
              {autoCalculateError && (
                <p className="mt-1 text-xs text-red-600">
                  {autoCalculateError}
                </p>
              )}
            </div>
          )}
        </div>
        <input
          type="date"
          value={newGroupDate}
          onChange={(e) => setNewGroupDate(e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
        />
      </div>

      {/* Time Input */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Time <span className="text-red-500">*</span>
        </label>
        <input
          type="time"
          value={newGroupTime}
          onChange={(e) => setNewGroupTime(e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
        />
      </div>

      {/* Voucher */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Group Voucher
        </label>
        <input
          type="text"
          value={newGroupVoucher}
          onChange={(e) => setNewGroupVoucher(e.target.value)}
          placeholder="Optional"
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
        />
      </div>

      {/* Contingency Voucher */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Contingency Voucher
        </label>
        <input
          type="text"
          value={newGroupContingencyVoucher}
          onChange={(e) => setNewGroupContingencyVoucher(e.target.value)}
          placeholder="Optional"
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
        />
      </div>

      {/* Subsidized Checkbox */}
      <div className="flex items-center">
        <input
          type="checkbox"
          id="isSubsidized"
          checked={isSubsidized}
          onChange={(e) => setIsSubsidized(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
        />
        <label htmlFor="isSubsidized" className="ml-2 text-sm text-gray-700">
          Is Subsidized
        </label>
      </div>

      {/* Group Info Preview */}
      {selectedRidersForNewGroup.length > 0 && (
        <div className="rounded border border-gray-200 bg-gray-50 p-3">
          <p className="mb-1 text-xs font-medium text-gray-700">
            Group Preview:
          </p>
          <p className="text-xs text-gray-600">
            Size: {selectedRidersForNewGroup.length} riders
          </p>
          <p className="text-xs text-gray-600">
            Bag Units: {calculateBagUnits(selectedRidersForNewGroup)}
          </p>
          <p className="text-xs text-gray-600">
            Uber Type:{' '}
            {determineUberType(
              selectedRidersForNewGroup.length,
              calculateBagUnits(selectedRidersForNewGroup),
            ) || 'Invalid'}
          </p>
        </div>
      )}

      {/* Create Button */}
      <button
        onClick={createNewGroup}
        disabled={
          isCreatingGroup ||
          selectedRidersForNewGroup.length < 2 ||
          selectedRidersForNewGroup.length > 6 ||
          !newGroupDate ||
          !newGroupTime
        }
        className="w-full rounded-lg bg-gradient-to-r from-teal-500 to-cyan-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:from-teal-600 hover:to-cyan-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isCreatingGroup ? 'Creating...' : 'Create Group'}
      </button>

      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
    </>
  )

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-600">Loading groups...</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex flex-col gap-4">
          {/* Desktop: Title (left) | Search (center) | Buttons (right) */}
          <div className="hidden md:flex md:items-center md:gap-4">
            {/* Title - Left */}
            <h1 className="flex-shrink-0 text-2xl font-bold text-gray-900">
              View & Manage Groups
            </h1>
            {/* Search Bar - Center */}
            <div className="flex flex-1 justify-center">
              <div className="w-full max-w-md">
                <input
                  type="text"
                  placeholder="Search by name, flight, or voucher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
            </div>
            {/* Buttons - Right */}
            <div className="flex flex-shrink-0 items-center gap-3">
              {/* Filters Toggle Button */}
              <button
                onClick={handleFiltersToggle}
                className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                <svg
                  className={`h-4 w-4 flex-shrink-0 transition-transform ${filtersCollapsed ? '' : 'rotate-180'}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                <span>Filters & Options</span>
              </button>
              {/* Corral Toggle Button */}
              <button
                onClick={handleCorralToggle}
                className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                <svg
                  className={`h-4 w-4 flex-shrink-0 transition-transform ${corralCollapsed ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
                <span>Corral</span>
                {corralRiders.length > 0 && (
                  <span className="flex-shrink-0 rounded-full bg-teal-100 px-2 py-0.5 text-xs font-semibold text-teal-800">
                    {corralRiders.length}
                  </span>
                )}
              </button>
              {/* Create Group Toggle Button */}
              <button
                onClick={() => {
                  if (leftSidebarTabs.includes('createGroup')) {
                    // If in left sidebar, expand sidebar and switch to tab
                    if (filtersCollapsed) {
                      setFiltersCollapsed(false)
                    }
                    setActiveLeftTab('createGroup')
                    setNewGroupSectionExpanded(true)
                  } else {
                    // If in right sidebar, toggle expansion
                    setNewGroupSectionExpanded(!newGroupSectionExpanded)
                  }
                }}
                className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                <svg
                  className="h-4 w-4 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                <span>Create Group</span>
                {selectedRidersForNewGroup.length > 0 && (
                  <span className="flex-shrink-0 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-800">
                    {selectedRidersForNewGroup.length}
                  </span>
                )}
              </button>
            </div>
          </div>
          {/* Mobile: Title and Buttons on first row, Create Group on second row, Search on third row */}
          <div className="flex flex-col gap-4 md:hidden">
            {/* First Row: Title and Buttons */}
            <div className="flex items-center justify-between gap-4">
              <h1 className="text-2xl font-bold text-gray-900">
                View & Manage Groups
              </h1>
              <div className="flex items-center gap-3">
                {/* Filters Toggle Button */}
                <button
                  onClick={handleFiltersToggle}
                  className="flex min-w-[120px] items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  <svg
                    className={`h-4 w-4 flex-shrink-0 transition-transform ${filtersCollapsed ? '' : 'rotate-180'}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                  <span className="sm:hidden">Filters</span>
                </button>
                {/* Corral Toggle Button */}
                <button
                  onClick={handleCorralToggle}
                  className="flex min-w-[120px] items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  <svg
                    className={`h-4 w-4 flex-shrink-0 transition-transform ${corralCollapsed ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                  <span>Corral</span>
                  {corralRiders.length > 0 && (
                    <span className="flex-shrink-0 rounded-full bg-teal-100 px-2 py-0.5 text-xs font-semibold text-teal-800">
                      {corralRiders.length}
                    </span>
                  )}
                </button>
              </div>
            </div>
            {/* Second Row: Search Bar with Create Group Button */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search by name, flight, or voucher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
              <button
                onClick={() => {
                  if (leftSidebarTabs.includes('createGroup')) {
                    // If in left sidebar, expand sidebar and switch to tab
                    if (filtersCollapsed) {
                      setFiltersCollapsed(false)
                    }
                    setActiveLeftTab('createGroup')
                    setNewGroupSectionExpanded(true)
                  } else {
                    // If in right sidebar, toggle expansion
                    setNewGroupSectionExpanded(!newGroupSectionExpanded)
                  }
                }}
                className="flex flex-shrink-0 items-center justify-center gap-1 rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                title="Create Group"
              >
                <svg
                  className="h-4 w-4 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                {selectedRidersForNewGroup.length > 0 && (
                  <span className="flex-shrink-0 rounded-full bg-purple-100 px-1.5 py-0.5 text-xs font-semibold text-purple-800">
                    {selectedRidersForNewGroup.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Three Panels */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Filters and Create Group */}
        <div
          className={`${filtersCollapsed ? 'w-0 overflow-hidden md:w-12' : 'w-full md:w-64'} flex flex-col border-r border-gray-200 bg-white transition-all duration-300`}
        >
          {/* Header with Arrow */}
          <div className="flex items-center justify-between border-b border-gray-200 p-4">
            {!filtersCollapsed && (
              <div className="flex-1">
                {/* Tabs */}
                <div className="mb-2 flex gap-1">
                  {leftSidebarTabs.map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveLeftTab(tab)}
                      className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                        activeLeftTab === tab
                          ? 'bg-teal-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {tab === 'filters' ? 'Filters' : 'Create Group'}
                    </button>
                  ))}
                </div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {activeLeftTab === 'filters'
                    ? 'Group Filters and Options'
                    : 'Create New Group'}
                </h2>
              </div>
            )}
            <button
              onClick={handleFiltersToggle}
              className="rounded p-1.5 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              title={filtersCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <svg
                className={`h-5 w-5 transition-transform ${filtersCollapsed ? '' : 'rotate-180'}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
          </div>

          {/* Filters Content */}
          {!filtersCollapsed && activeLeftTab === 'filters' && (
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {/* Airports */}
              <div>
                <label className="mb-2 block text-xs font-medium text-gray-700">
                  Airports
                </label>
                <div className="flex flex-wrap gap-3">
                  {availableAirports.map((airport) => (
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
              </div>

              {/* Date Range */}
              <div>
                <label className="mb-2 block text-xs font-medium text-gray-700">
                  Date Range
                </label>
                <div className="space-y-2">
                  <input
                    type="date"
                    value={dateRangeStart}
                    onChange={(e) => setDateRangeStart(e.target.value)}
                    onClick={(e) =>
                      (e.target as HTMLInputElement).showPicker?.()
                    }
                    placeholder="Start date"
                    className="w-full cursor-pointer rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                  <input
                    type="date"
                    value={dateRangeEnd}
                    onChange={(e) => setDateRangeEnd(e.target.value)}
                    onClick={(e) =>
                      (e.target as HTMLInputElement).showPicker?.()
                    }
                    placeholder="End date"
                    className="w-full cursor-pointer rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>

              {/* Time Range */}
              <div>
                <label className="mb-2 block text-xs font-medium text-gray-700">
                  Time Range
                </label>
                <div className="space-y-2">
                  <input
                    type="time"
                    value={timeRangeStart}
                    onChange={(e) => setTimeRangeStart(e.target.value)}
                    onClick={(e) =>
                      (e.target as HTMLInputElement).showPicker?.()
                    }
                    className="w-full cursor-pointer rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                  <input
                    type="time"
                    value={timeRangeEnd}
                    onChange={(e) => setTimeRangeEnd(e.target.value)}
                    onClick={(e) =>
                      (e.target as HTMLInputElement).showPicker?.()
                    }
                    className="w-full cursor-pointer rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>

              {/* Subsidy Filter */}
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

              {/* Bag Amount */}
              <div>
                <label className="mb-2 block text-xs font-medium text-gray-700">
                  Bag Amount
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

              {/* Sorting Rules */}
              <div>
                <label className="mb-2 block text-xs font-medium text-gray-700">
                  Sorting
                </label>
                <div className="space-y-2">
                  {sortingRules.map((rule, index) => (
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
                        if (
                          draggedSortIndex !== null &&
                          draggedSortIndex !== index
                        ) {
                          setDragOverSortIndex(index)
                        }
                      }}
                      onDragLeave={() => {
                        setDragOverSortIndex(null)
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        if (
                          draggedSortIndex === null ||
                          draggedSortIndex === index
                        ) {
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
                      {/* Drag Handle */}
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
                          newRules[index].direction = e.target.value as
                            | 'asc'
                            | 'desc'
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
                            sortingRules.filter((_, i) => i !== index),
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

              {/* Clear All Filters */}
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
                    // Reset end date to 15 days after last algorithm run
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
          )}

          {/* Create Group Content */}
          {!filtersCollapsed && activeLeftTab === 'createGroup' && (
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {renderCreateGroupContent()}
            </div>
          )}
        </div>

        {/* Center Panel - Group Management */}
        <div
          className={`flex-1 overflow-y-auto bg-gray-100 p-6 ${!filtersCollapsed || !corralCollapsed ? 'hidden md:block' : ''}`}
        >
          {/* Tabs */}
          <div className="mb-4 flex gap-2">
            <button
              onClick={() => setActiveTab('matched')}
              className={`rounded-lg px-6 py-2 font-medium transition-all ${
                activeTab === 'matched'
                  ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white'
                  : 'border border-gray-300 bg-white text-gray-700'
              }`}
            >
              Matched Groups
            </button>
            <button
              onClick={() => setActiveTab('unmatched')}
              className={`rounded-lg px-6 py-2 font-medium transition-all ${
                activeTab === 'unmatched'
                  ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white'
                  : 'border border-gray-300 bg-white text-gray-700'
              }`}
            >
              Unmatched ({sortedUnmatchedRiders.length})
            </button>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3">
              <p className="text-sm text-red-800">{errorMessage}</p>
            </div>
          )}

          {/* Helper Text */}
          <p className="mb-6 text-sm text-gray-600">
            {activeTab === 'matched'
              ? 'Drag and drop riders between groups or to the corral'
              : 'View all unmatched riders - drag them to groups to assign'}
          </p>

          {/* Matched Groups Tab */}
          {activeTab === 'matched' && (
            <div className="space-y-4">
              {sortedGroups.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
                  <p className="text-gray-500">No groups found</p>
                </div>
              ) : (
                sortedGroups.map((group) => {
                  const isExpanded = expandedGroups.has(group.ride_id)
                  const totalBags = getTotalBags(group.riders)
                  const riderCount = group.riders.length
                  const datePassed = isDatePassed(group.date)

                  return (
                    <div
                      key={group.ride_id}
                      className={`overflow-hidden rounded-lg bg-white shadow-md ${
                        datePassed ? 'opacity-60' : ''
                      }`}
                    >
                      {/* Group Header */}
                      <div
                        className={`flex cursor-pointer items-center justify-between border-b border-gray-200 bg-gray-50 p-4 hover:bg-gray-100 ${
                          datePassed ? 'cursor-not-allowed' : ''
                        }`}
                        onClick={() => toggleGroupExpanded(group.ride_id)}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-center gap-2">
                              <p className="font-semibold text-gray-900">
                                Group #{group.ride_id}
                              </p>
                              {group.group_voucher && riderCount >= 3 && (
                                <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-800">
                                  {formatVoucher(group.group_voucher)}
                                </span>
                              )}
                              {datePassed && (
                                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                                  Past Date
                                </span>
                              )}
                            </div>
                            {/* Desktop: single line */}
                            <p className="hidden text-sm text-gray-600 md:block">
                              {group.airport} • {group.date} •{' '}
                              {formatTimeRange(group.time_range)}
                            </p>
                            {/* Mobile: stacked lines */}
                            <div className="space-y-0.5 text-sm text-gray-600 md:hidden">
                              <p>{group.airport}</p>
                              <p>{group.date}</p>
                              <p>{formatTimeRange(group.time_range)}</p>
                            </div>
                          </div>
                          {/* Desktop: inline badge */}
                          <span className="hidden rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-800 md:block">
                            {riderCount} {riderCount === 1 ? 'rider' : 'riders'}
                          </span>
                        </div>

                        <div className="flex flex-shrink-0 items-center gap-3">
                          {/* Desktop: horizontal badges */}
                          <div className="hidden items-center gap-3 md:flex">
                            {/* Direction Badge */}
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
                                  TO Airport
                                </>
                              ) : (
                                <>
                                  <PlaneLanding className="h-3 w-3" />
                                  FROM Airport
                                </>
                              )}
                            </span>

                            {/* Subsidy Badge */}
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                riderCount >= 3
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {riderCount >= 3
                                ? 'Subsidized'
                                : 'Not Subsidized'}
                            </span>

                            {/* Uber Type Badge */}
                            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                              Uber {getUberType(riderCount)}
                            </span>
                          </div>

                          {/* Mobile: stacked badges */}
                          <div className="flex flex-col gap-1 md:hidden">
                            {/* Riders and Direction stacked */}
                            <div className="flex flex-col gap-1">
                              <span className="w-fit rounded-full bg-teal-100 px-2 py-0.5 text-xs font-semibold text-teal-800">
                                {riderCount}{' '}
                                {riderCount === 1 ? 'rider' : 'riders'}
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
                                    TO Airport
                                  </>
                                ) : (
                                  <>
                                    <PlaneLanding className="h-3 w-3" />
                                    FROM Airport
                                  </>
                                )}
                              </span>
                            </div>
                            {/* Subsidized and Uber Type stacked */}
                            <div className="flex flex-col gap-1">
                              <span
                                className={`w-fit rounded-full px-2 py-0.5 text-xs font-semibold ${
                                  riderCount >= 3
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}
                              >
                                {riderCount >= 3
                                  ? 'Subsidized'
                                  : 'Not Subsidized'}
                              </span>
                              <span className="w-fit rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">
                                Uber {getUberType(riderCount)}
                              </span>
                            </div>
                          </div>

                          {/* Expand/Collapse Icon */}
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

                      {/* Capacity Bar - Separate from group header */}
                      <div className="border-b border-gray-200 bg-white px-4 py-2">
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-xs text-gray-600">
                            Bags: {totalBags}/10
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                          <div
                            className={`h-full ${getCapacityBarColor(totalBags)} transition-all`}
                            style={{
                              width: `${Math.min((totalBags / 10) * 100, 100)}%`,
                            }}
                          ></div>
                        </div>
                      </div>

                      {/* Group Content (Expanded) */}
                      {isExpanded && (
                        <div className="p-4">
                          <button
                            onClick={() => handleAddFromCorral(group)}
                            disabled={corralRiders.length === 0 || datePassed}
                            className={`mb-3 text-sm ${
                              corralRiders.length === 0 || datePassed
                                ? 'cursor-not-allowed text-gray-400'
                                : 'text-teal-600 underline hover:text-teal-800'
                            }`}
                          >
                            Add from corral
                          </button>
                          {group.riders.length === 0 ? (
                            <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
                              <p className="text-gray-500">Drop riders here</p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {group.riders.map((rider) => (
                                <div
                                  key={rider.user_id}
                                  className={`flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 ${
                                    datePassed
                                      ? 'cursor-not-allowed opacity-50'
                                      : 'hover:bg-gray-50'
                                  }`}
                                  draggable={!datePassed}
                                  onDragStart={() => {
                                    if (!datePassed) {
                                      setDraggedRider(rider)
                                    }
                                  }}
                                >
                                  <div className="flex items-center gap-4">
                                    <div>
                                      <p className="font-medium text-gray-900">
                                        {rider.name}
                                      </p>
                                      <p className="text-sm text-gray-600">
                                        {rider.phone}
                                      </p>
                                      {rider.airline_iata &&
                                        rider.flight_no && (
                                          <div className="group relative mt-1 flex items-center gap-1">
                                            <Plane className="h-4 w-4 text-gray-600" />
                                            <span className="text-sm text-gray-600">
                                              {rider.airline_iata}{' '}
                                              {rider.flight_no}
                                            </span>
                                            <div className="absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 transform whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white group-hover:block">
                                              Flight Number
                                              <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                                            </div>
                                          </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <div className="group relative flex items-center gap-1">
                                        <Luggage className="h-4 w-4 text-gray-600" />
                                        <span className="text-sm text-gray-600">
                                          {rider.checked_bags}
                                        </span>
                                        <div className="absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 transform whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white group-hover:block">
                                          Checked Bags
                                          <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                                        </div>
                                      </div>
                                      <div className="group relative flex items-center gap-1">
                                        <Briefcase className="h-4 w-4 text-gray-600" />
                                        <span className="text-sm text-gray-600">
                                          {rider.carry_on_bags}
                                        </span>
                                        <div className="absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 transform whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white group-hover:block">
                                          Carry-On Bags
                                          <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                                        </div>
                                      </div>
                                    </div>
                                    <p className="text-sm text-gray-600">
                                      {formatTimeRange(rider.time_range)}
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => {
                                      if (!datePassed) {
                                        handleAddToCorral(rider, group.ride_id)
                                      }
                                    }}
                                    disabled={datePassed}
                                    className={`rounded p-1 ${
                                      datePassed
                                        ? 'cursor-not-allowed text-gray-400'
                                        : 'text-red-500 hover:bg-red-50'
                                    }`}
                                    title={
                                      datePassed
                                        ? 'Cannot modify past groups'
                                        : 'Remove rider'
                                    }
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
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* Unmatched Tab */}
          {activeTab === 'unmatched' && (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sortedUnmatchedRiders.length === 0 ? (
                <div className="col-span-full rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
                  <p className="text-gray-500">No unmatched riders</p>
                </div>
              ) : (
                sortedUnmatchedRiders.map((rider) => (
                  <div
                    key={rider.user_id}
                    className="relative rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                    draggable
                    onDragStart={() => setDraggedRider(rider)}
                  >
                    <p className="font-medium text-gray-900">{rider.name}</p>
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
                          Checked Bags
                          <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                        </div>
                      </div>
                      <div className="group relative flex items-center gap-1">
                        <Briefcase className="h-4 w-4" />
                        <span>{rider.carry_on_bags}</span>
                        <div className="absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 transform whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white group-hover:block">
                          Carry-On Bags
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
                            TO Airport
                          </>
                        ) : (
                          <>
                            <PlaneLanding className="h-3 w-3" />
                            FROM Airport
                          </>
                        )}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {formatTimeRange(rider.time_range)} • {rider.airport}
                    </p>
                    {/* Add to corral and new group links at bottom */}
                    <div className="mt-2 flex gap-3">
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
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Right Sidebar - Corral */}
        <div
          className={`${corralCollapsed ? 'w-0 overflow-hidden md:w-12' : 'w-full md:w-80'} flex flex-col border-l border-gray-200 bg-white transition-all duration-300`}
        >
          {/* Header with Arrow */}
          <div className="flex items-center gap-2 border-b border-gray-200 p-4">
            <button
              onClick={handleCorralToggle}
              className="rounded p-1.5 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              title={corralCollapsed ? 'Expand corral' : 'Collapse corral'}
            >
              <svg
                className={`h-5 w-5 transition-transform ${corralCollapsed ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
            {!corralCollapsed && (
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-gray-900">Corral</h2>
                <span className="rounded-full bg-teal-100 px-2 py-1 text-xs font-semibold text-teal-800">
                  {corralRiders.length}
                </span>
              </div>
            )}
            {corralCollapsed && (
              <span className="rounded-full bg-teal-100 px-2 py-1 text-xs font-semibold text-teal-800">
                {corralRiders.length}
              </span>
            )}
          </div>

          {/* Corral Content */}
          {!corralCollapsed && (
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="mb-4 flex-shrink-0 p-4 pb-2">
                <p className="text-xs text-gray-600">
                  {corralSelectionMode
                    ? 'Select a rider to add to the group'
                    : 'Temporary holding area for removed/unmatched riders'}
                </p>
                {corralSelectionMode && (
                  <button
                    onClick={() => setCorralSelectionMode(null)}
                    className="mt-2 text-xs text-gray-500 underline hover:text-gray-700"
                  >
                    Cancel selection
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto px-4 pb-4">
                <div className="space-y-2">
                  {sortedCorralRiders.length === 0 ? (
                    <p className="text-center text-sm text-gray-500">
                      Corral is empty
                    </p>
                  ) : (
                    sortedCorralRiders.map((rider) => {
                      const group = corralSelectionMode
                        ? groups.find((g) => g.ride_id === corralSelectionMode)
                        : null
                      const isSelectedForNewGroup =
                        selectedRidersForNewGroup.some(
                          (r) => r.user_id === rider.user_id,
                        )
                      const errorKey = group
                        ? `${rider.user_id}-${group.ride_id}`
                        : null
                      const cardError = errorKey
                        ? corralCardErrors.get(errorKey)
                        : null

                      return (
                        <div key={rider.user_id} className="space-y-1">
                          {cardError && (
                            <p className="px-1 text-xs text-red-600">
                              {cardError}
                            </p>
                          )}
                          <div
                            className={`rounded-lg border p-3 ${
                              isSelectedForNewGroup
                                ? 'border-gray-300 bg-gray-100 opacity-50'
                                : corralSelectionMode
                                  ? 'cursor-pointer border-teal-400 bg-teal-50 hover:bg-teal-100'
                                  : 'border-gray-200 bg-gray-50'
                            }`}
                            draggable={!corralSelectionMode}
                            onDragStart={() => {
                              if (!corralSelectionMode) {
                                setDraggedRider(rider)
                              }
                            }}
                            onClick={() => {
                              if (corralSelectionMode && group) {
                                handleSelectFromCorral(rider, group)
                              }
                            }}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-gray-900">
                                  {rider.name}
                                </p>
                                <p className="text-xs text-gray-600">
                                  {rider.phone}
                                </p>
                                {rider.airline_iata && rider.flight_no && (
                                  <div className="group relative mt-1 flex items-center gap-1">
                                    <Plane className="h-3 w-3 text-gray-600" />
                                    <span className="text-xs text-gray-600">
                                      {rider.airline_iata} {rider.flight_no}
                                    </span>
                                    <div className="absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 transform whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white group-hover:block">
                                      Flight Number
                                      <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                                    </div>
                                  </div>
                                )}
                                <p className="mt-1 text-xs text-gray-500">
                                  {rider.date} •{' '}
                                  {formatTimeRange(rider.time_range)}
                                </p>
                                <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                                  <div className="group relative flex items-center gap-1">
                                    <Luggage className="h-3 w-3" />
                                    <span>{rider.checked_bags}</span>
                                    <div className="absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 transform whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white group-hover:block">
                                      Checked Bags
                                      <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                                    </div>
                                  </div>
                                  <div className="group relative flex items-center gap-1">
                                    <Briefcase className="h-3 w-3" />
                                    <span>{rider.carry_on_bags}</span>
                                    <div className="absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 transform whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white group-hover:block">
                                      Carry-On Bags
                                      <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              {!corralSelectionMode && (
                                <div className="flex flex-shrink-0 gap-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      addRiderToNewGroup(rider)
                                    }}
                                    className="rounded p-1 text-purple-500 hover:bg-purple-50"
                                    title="Add to new group"
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
                                        d="M12 4v16m8-8H4"
                                      />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleRemoveFromCorral(rider)
                                    }}
                                    className="rounded p-1 text-red-500 hover:bg-red-50"
                                    title="Remove from corral"
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
                                        d="M6 18L18 6M6 6l12 12"
                                      />
                                    </svg>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Create New Group Section - Only show if not in left sidebar */}
          {!leftSidebarTabs.includes('createGroup') && (
            <div className="flex flex-1 flex-col overflow-hidden border-t border-gray-200">
              <button
                onClick={() =>
                  setNewGroupSectionExpanded(!newGroupSectionExpanded)
                }
                className="flex w-full flex-shrink-0 items-center justify-between p-4 hover:bg-gray-50"
              >
                <h3 className="font-semibold text-gray-900">
                  Create New Group
                </h3>
                <svg
                  className={`h-5 w-5 text-gray-600 transition-transform ${newGroupSectionExpanded ? 'rotate-180' : ''}`}
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

              {newGroupSectionExpanded && (
                <div className="flex-1 space-y-4 overflow-y-auto p-4">
                  {renderCreateGroupContent()}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Panel - Change Log */}
      <div
        className={`border-t border-gray-200 bg-white ${changeLogExpanded ? 'fixed inset-0 z-50 md:relative md:z-auto' : ''}`}
      >
        {!changeLogExpanded && (
          <div className="flex w-full items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setChangeLogExpanded(!changeLogExpanded)}
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
            <button
              onClick={() => setChangeLogExpanded(!changeLogExpanded)}
              className="hover:opacity-80"
            >
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
          </div>
        )}

        {changeLogExpanded && (
          <div className="flex h-full flex-col overflow-y-auto md:h-auto">
            {/* Header - Sticky on mobile */}
            <div className="sticky top-0 z-10 flex w-full items-center justify-between border-b border-gray-200 bg-white px-6 py-4 md:relative md:border-b-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setChangeLogExpanded(!changeLogExpanded)}
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
              <button
                onClick={() => setChangeLogExpanded(!changeLogExpanded)}
                className="hover:opacity-80"
              >
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
            </div>

            <div className="flex-1 overflow-y-auto border-t border-gray-200 md:border-t-0">
              {changeLogOptionsExpanded && (
                <div className="space-y-4 border-b border-gray-200 bg-gray-50 px-6 py-4">
                  {/* Download CSV */}
                  <div>
                    <button
                      onClick={() => {
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
                          ...sortedChangeLog.map((entry) => [
                            new Date(entry.created_at).toLocaleString('en-US', {
                              timeZone: 'America/Los_Angeles',
                            }),
                            entry.actor_name || 'Unknown',
                            entry.actor_role,
                            entry.action,
                            entry.target_group_id || '',
                            entry.target_user_id || '',
                            entry.ignored_error ? 'Yes' : 'No',
                            entry.metadata
                              ? JSON.stringify(entry.metadata)
                              : '',
                          ]),
                        ]
                          .map((row) =>
                            row.map((cell) => `"${cell}"`).join(','),
                          )
                          .join('\n')

                        const blob = new Blob([csv], { type: 'text/csv' })
                        const url = window.URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `changelog-${new Date().toISOString().split('T')[0]}.csv`
                        a.click()
                      }}
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

                  {/* Filters - More Concise */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold uppercase text-gray-700">
                        Filters
                      </h4>
                      <button
                        onClick={() => {
                          setChangeLogFilterName('')
                          setChangeLogFilterActions(new Set())
                          setChangeLogFilterDateFrom('')
                          setChangeLogFilterDateTo('')
                        }}
                        className="text-xs text-gray-500 underline hover:text-gray-700"
                      >
                        Clear All
                      </button>
                    </div>

                    {/* Name and Date Filters - Inline */}
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-700">
                          Name
                        </label>
                        <input
                          type="text"
                          value={changeLogFilterName}
                          onChange={(e) =>
                            setChangeLogFilterName(e.target.value)
                          }
                          placeholder="Actor name..."
                          className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-700">
                          From
                        </label>
                        <input
                          type="date"
                          value={changeLogFilterDateFrom}
                          onChange={(e) =>
                            setChangeLogFilterDateFrom(e.target.value)
                          }
                          className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-700">
                          To
                        </label>
                        <input
                          type="date"
                          value={changeLogFilterDateTo}
                          onChange={(e) =>
                            setChangeLogFilterDateTo(e.target.value)
                          }
                          className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                      </div>
                    </div>

                    {/* Action Filter - Checkboxes */}
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-gray-700">
                        Actions
                      </label>
                      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                        {[
                          { value: 'RUN_ALGORITHM', label: 'Run Algorithm' },
                          { value: 'ADD_TO_GROUP', label: 'Add to Group' },
                          {
                            value: 'REMOVE_FROM_GROUP',
                            label: 'Remove from Group',
                          },
                          { value: 'CREATE_GROUP', label: 'Create Group' },
                          { value: 'DELETE_GROUP', label: 'Delete Group' },
                          { value: 'IGNORE_ERROR', label: 'Ignore Error' },
                        ].map((action) => (
                          <label
                            key={action.value}
                            className="flex cursor-pointer items-center gap-1.5"
                          >
                            <input
                              type="checkbox"
                              checked={changeLogFilterActions.has(action.value)}
                              onChange={(e) => {
                                const newActions = new Set(
                                  changeLogFilterActions,
                                )
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

                  {/* Sorting */}
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

              {/* Resizable Changelog Content */}
              <div
                className="relative flex flex-col"
                style={{ height: `${changeLogHeight}px` }}
              >
                {/* Resize Handle - More visible and functional */}
                <div
                  className="group z-10 flex h-3 cursor-ns-resize items-center justify-center border-y border-gray-200 bg-gray-100 transition-colors hover:bg-teal-100"
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

                {/* Changelog Entries */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                  <div className="space-y-2">
                    {sortedChangeLog.length === 0 ? (
                      <p className="text-center text-sm text-gray-500">
                        {changeLog.length === 0
                          ? 'No changes recorded'
                          : 'No entries match the filters'}
                      </p>
                    ) : (
                      sortedChangeLog.map((entry) => {
                        const date = new Date(entry.created_at)
                        const formattedDate =
                          date.toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                            timeZone: 'America/Los_Angeles',
                          }) + ' PT'

                        return (
                          <div
                            key={entry.id}
                            className="rounded-lg bg-gray-50 p-3 text-sm"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs text-gray-500">
                                {formattedDate}
                              </span>
                              <span className="font-medium text-gray-700">
                                {entry.actor_name || 'Unknown'}
                              </span>
                              <span className="text-xs text-gray-500">
                                ({entry.actor_role})
                              </span>
                              {entry.ignored_error && (
                                <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-600">
                                  Ignored Error
                                </span>
                              )}
                            </div>
                            <p className="mt-1 font-medium text-gray-600">
                              {entry.action}
                            </p>
                            {entry.metadata && (
                              <div className="mt-1 text-xs text-gray-500">
                                <pre className="whitespace-pre-wrap font-sans">
                                  {JSON.stringify(entry.metadata, null, 2)}
                                </pre>
                              </div>
                            )}
                            {(entry.target_group_id ||
                              entry.target_user_id) && (
                              <div className="mt-1 text-xs text-gray-500">
                                {entry.target_group_id && (
                                  <span>Group: {entry.target_group_id}</span>
                                )}
                                {entry.target_group_id &&
                                  entry.target_user_id &&
                                  ' • '}
                                {entry.target_user_id && (
                                  <span>User: {entry.target_user_id}</span>
                                )}
                              </div>
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
    </div>
  )
}
