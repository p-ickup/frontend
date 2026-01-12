'use client'

import { useAuth } from '@/hooks/useAuth'
import { createBrowserClient } from '@/utils/supabase'
import { User } from '@supabase/supabase-js'
import {
  Briefcase,
  Calendar,
  Clock,
  Copy,
  Info,
  Luggage,
  Mail,
  Pencil,
  Plane,
  PlaneLanding,
  PlaneTakeoff,
  X,
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
  match_time?: string // Time from Matches table
  to_airport: boolean
  riders: Rider[]
  recommended_time?: string
  group_voucher?: string
  uber_type?: string | null // Uber type from Matches table
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
    | 'UPDATE_GROUP_TIME'
    | 'UPDATE_VOUCHER'
    | 'EMAIL_CONFIRMED'
  algorithm_run_id?: string | null
  target_group_id?: string | null
  target_user_id?: string | null
  ignored_error: boolean
  confirmed?: boolean
  metadata?: any
  created_at: string
  // Computed fields
  actor_name?: string
}

// Helper function to format change descriptions from actions
const getChangeDescription = (action: string): string => {
  switch (action) {
    case 'ADD_TO_GROUP':
      return 'Added member'
    case 'REMOVE_FROM_GROUP':
      return 'Removed member'
    case 'UPDATE_GROUP_TIME':
      return 'Updated time'
    case 'UPDATE_VOUCHER':
      return 'Updated voucher'
    case 'CREATE_GROUP':
      return 'Group created'
    case 'DELETE_GROUP':
      return 'Group deleted'
    default:
      return 'Modified'
  }
}

// Helper function to consolidate member changes into a single description
const consolidateChangeDescriptions = (descriptions: string[]): string[] => {
  const hasAddMember = descriptions.includes('Added member')
  const hasRemoveMember = descriptions.includes('Removed member')
  const otherChanges = descriptions.filter(
    (desc) => desc !== 'Added member' && desc !== 'Removed member',
  )

  const consolidated: string[] = []

  // If both add and remove, consolidate to "Updated group members"
  if (hasAddMember && hasRemoveMember) {
    consolidated.push('Updated group members')
  } else if (hasAddMember) {
    consolidated.push('Added member')
  } else if (hasRemoveMember) {
    consolidated.push('Removed member')
  }

  // Add other changes (time, voucher, etc.)
  consolidated.push(...otherChanges)

  return consolidated
}

// Component for displaying changed groups
const ChangedGroupCard = ({
  changedGroup,
  onConfirmEmail,
  supabase,
}: {
  changedGroup: {
    group: Group
    changeType: 'modified' | 'deleted'
    changedAt: string
    emailsSent: boolean
    changeDescriptions?: string[]
  }
  onConfirmEmail: () => Promise<void>
  supabase: any
}) => {
  const [showEmails, setShowEmails] = useState(false)
  const [memberEmails, setMemberEmails] = useState<string[]>([])
  const [loadingEmails, setLoadingEmails] = useState(false)
  const [copied, setCopied] = useState(false)

  const fetchMemberEmails = async () => {
    if (memberEmails.length > 0) {
      setShowEmails(!showEmails)
      return
    }

    setLoadingEmails(true)
    try {
      const userIds = changedGroup.group.riders.map((r) => r.user_id)
      const { data: users, error } = await supabase
        .from('Users')
        .select('email')
        .in('user_id', userIds)

      if (error) {
        console.error('Error fetching emails:', error)
        setLoadingEmails(false)
        return
      }

      const emails = users?.map((u: any) => u.email).filter(Boolean) || []
      setMemberEmails(emails)
      setShowEmails(true)
    } catch (error) {
      console.error('Error fetching emails:', error)
    } finally {
      setLoadingEmails(false)
    }
  }

  const copyEmailsToClipboard = async () => {
    if (memberEmails.length === 0) return

    try {
      const emailsText = memberEmails.join('\n')
      await navigator.clipboard.writeText(emailsText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy emails:', error)
    }
  }

  return (
    <div
      className={`rounded-lg border ${
        changedGroup.emailsSent
          ? 'border-gray-200 bg-gray-50'
          : 'border-yellow-300 bg-yellow-50'
      } ${showEmails ? 'p-0' : 'p-3'}`}
    >
      <div
        className={`flex items-start justify-between ${showEmails ? 'p-3 pb-0' : ''}`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-900">
              Group #{changedGroup.group.ride_id}
            </p>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                changedGroup.changeType === 'deleted'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-blue-100 text-blue-800'
              }`}
            >
              {changedGroup.changeType === 'deleted' ? 'Deleted' : 'Modified'}
            </span>
            {changedGroup.emailsSent && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
                Emailed
              </span>
            )}
          </div>
          {/* Display change descriptions */}
          {changedGroup.changeDescriptions &&
            changedGroup.changeDescriptions.length > 0 && (
              <div className="mt-1 space-y-0.5">
                {changedGroup.changeDescriptions.map((desc, idx) => (
                  <p key={idx} className="text-xs text-gray-700">
                    {desc}
                  </p>
                ))}
              </div>
            )}
          <p className="mt-1 text-xs text-gray-600">
            {changedGroup.group.riders.length} rider
            {changedGroup.group.riders.length !== 1 ? 's' : ''} •{' '}
            {new Date(changedGroup.changedAt).toLocaleString()}
          </p>
        </div>
        <div className="ml-4 flex flex-shrink-0 flex-col gap-1">
          <button
            onClick={fetchMemberEmails}
            disabled={loadingEmails}
            className="rounded p-1 text-gray-600 hover:bg-gray-200"
            title="View member emails"
          >
            <Mail className="h-4 w-4" />
          </button>
          {!changedGroup.emailsSent && (
            <button
              onClick={onConfirmEmail}
              className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700"
            >
              Confirm
            </button>
          )}
        </div>
      </div>
      {showEmails && (
        <div className="mt-3 w-full rounded-b-lg bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-700">
              Member Emails:
            </p>
            {memberEmails.length > 0 && (
              <button
                onClick={copyEmailsToClipboard}
                className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
                title="Copy emails to clipboard"
              >
                <Copy className="h-3 w-3" />
                {copied ? 'Copied!' : 'Copy'}
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {memberEmails.length > 0 ? (
              <div className="space-y-1">
                {memberEmails.map((email, idx) => (
                  <p key={idx} className="break-words text-xs text-gray-600">
                    {email}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500">No emails found</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Component for displaying unmatched individuals
const UnmatchedIndividualCard = ({
  item,
  onConfirmEmail,
  supabase,
}: {
  item: {
    rider: Rider
    becameUnmatchedAt: string
    emailSent: boolean
  }
  onConfirmEmail: () => Promise<void>
  supabase: any
}) => {
  const [showEmail, setShowEmail] = useState(false)
  const [email, setEmail] = useState<string>('')
  const [loadingEmail, setLoadingEmail] = useState(false)
  const [copied, setCopied] = useState(false)

  const fetchEmail = async () => {
    if (email) {
      setShowEmail(!showEmail)
      return
    }

    setLoadingEmail(true)
    try {
      const { data: user, error } = await supabase
        .from('Users')
        .select('email')
        .eq('user_id', item.rider.user_id)
        .single()

      if (error) {
        console.error('Error fetching email:', error)
        setLoadingEmail(false)
        return
      }

      setEmail(user?.email || 'No email found')
      setShowEmail(true)
    } catch (error) {
      console.error('Error fetching email:', error)
    } finally {
      setLoadingEmail(false)
    }
  }

  const copyEmailToClipboard = async () => {
    if (!email || email === 'No email found') return

    try {
      await navigator.clipboard.writeText(email)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy email:', error)
    }
  }

  return (
    <div
      className={`rounded-lg border p-3 ${
        item.emailSent
          ? 'border-gray-200 bg-gray-50'
          : 'border-orange-300 bg-orange-50'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-900">{item.rider.name}</p>
            {item.emailSent && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
                Emailed
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-gray-600">
            Became unmatched:{' '}
            {new Date(item.becameUnmatchedAt).toLocaleString()}
          </p>
          {showEmail && (
            <div className="mt-2 rounded bg-white p-2">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-700">Email:</p>
                {email && email !== 'No email found' && (
                  <button
                    onClick={copyEmailToClipboard}
                    className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-100"
                    title="Copy email to clipboard"
                  >
                    <Copy className="h-3 w-3" />
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                )}
              </div>
              <p className="break-words text-xs text-gray-600">{email}</p>
            </div>
          )}
        </div>
        <div className="ml-4 flex flex-shrink-0 flex-col gap-1">
          <button
            onClick={fetchEmail}
            disabled={loadingEmail}
            className="rounded p-1 text-gray-600 hover:bg-gray-200"
            title="View email"
          >
            <Mail className="h-4 w-4" />
          </button>
          {!item.emailSent && (
            <button
              onClick={onConfirmEmail}
              className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700"
            >
              Confirm
            </button>
          )}
        </div>
      </div>
    </div>
  )
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
  const [isDraggingOverCorral, setIsDraggingOverCorral] = useState(false)
  const [dragOverGroupId, setDragOverGroupId] = useState<number | null>(null)
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
  const [recentlyAddedToNewGroup, setRecentlyAddedToNewGroup] = useState<
    Set<string>
  >(new Set())
  const [newGroupDate, setNewGroupDate] = useState<string>('')
  const [newGroupTime, setNewGroupTime] = useState<string>('')
  const [newGroupVoucher, setNewGroupVoucher] = useState<string>('')
  const [newGroupContingencyVoucher, setNewGroupContingencyVoucher] =
    useState<string>('')
  const [isSubsidized, setIsSubsidized] = useState<boolean>(false)
  const [isCreatingGroup, setIsCreatingGroup] = useState(false)
  const [deleteGroupConfirmation, setDeleteGroupConfirmation] = useState<{
    rider: Rider
    groupId: number
    callback: () => Promise<void>
  } | null>(null)
  const [editTimeModal, setEditTimeModal] = useState<{
    group: Group
  } | null>(null)
  const [editTimeValue, setEditTimeValue] = useState<string>('')
  const [isUpdatingTime, setIsUpdatingTime] = useState(false)
  const [editVoucherModal, setEditVoucherModal] = useState<{
    group: Group
  } | null>(null)
  const [editVoucherValue, setEditVoucherValue] = useState<string>('')
  const [isUpdatingVoucher, setIsUpdatingVoucher] = useState(false)
  const [timeConflictModal, setTimeConflictModal] = useState<{
    rider: Rider
    group: Group
    onConfirm: () => Promise<void>
  } | null>(null)
  const [validationErrorModal, setValidationErrorModal] = useState<{
    rider: Rider
    group: Group
    issue: 'time' | 'bags'
    onAcknowledge: () => Promise<void>
    onCancel: () => void
  } | null>(null)

  // Log validation error modal state changes
  useEffect(() => {
    if (validationErrorModal) {
      console.log('[ValidationErrorModal] Modal state changed to OPEN', {
        issue: validationErrorModal.issue,
        riderName: validationErrorModal.rider.name,
        groupId: validationErrorModal.group.ride_id,
      })
    } else {
      console.log('[ValidationErrorModal] Modal state changed to CLOSED')
    }
  }, [validationErrorModal])
  const [corralTab, setCorralTab] = useState<'riders' | 'changes'>('riders')
  const [changedGroups, setChangedGroups] = useState<
    Array<{
      group: Group
      changeType: 'modified' | 'deleted'
      changedAt: string
      emailsSent: boolean
      changeLogId?: string
      changeDescriptions?: string[]
    }>
  >([])
  const [unmatchedIndividuals, setUnmatchedIndividuals] = useState<
    Array<{
      rider: Rider
      becameUnmatchedAt: string
      emailSent: boolean
      changeLogId?: string
    }>
  >([])
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

  // Load unconfirmed changes from ChangeLog
  const loadUnconfirmedChanges = useCallback(async () => {
    try {
      // Fetch all unconfirmed change entries from ChangeLog
      // Include target_group_id to make it easier to query group changes
      let { data: unconfirmedChanges, error } = await supabase
        .from('ChangeLog')
        .select('id, metadata, created_at, action, confirmed, target_group_id')
        .eq('confirmed', false)
        .in('action', [
          'UPDATE_GROUP_TIME',
          'ADD_TO_GROUP',
          'REMOVE_FROM_GROUP',
          'CREATE_GROUP',
          'DELETE_GROUP',
        ])
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching unconfirmed changes:', error)
        return
      }

      if (!unconfirmedChanges || unconfirmedChanges.length === 0) {
        setChangedGroups([])
        setUnmatchedIndividuals([])
        return
      }

      // Note: We no longer use group-level confirmation filtering
      // Each change is confirmed individually via the `confirmed` field on the ChangeLog entry
      // This allows new changes to the same group to appear even if previous changes were confirmed

      // Process reversals and delete them from the database
      let processedUnconfirmedChanges = [...unconfirmedChanges]

      if (processedUnconfirmedChanges.length > 0) {
        // Group changes by ride_id
        const groupChangesMap = new Map<
          number,
          {
            ride_id: number
            changeType: 'modified' | 'deleted'
            changedAt: string
            action: string
            changeLogId: string
          }
        >()

        const unmatchedChangesMap = new Map<
          number,
          {
            flight_id: number
            user_id: string
            name: string
            date: string
            becameUnmatchedAt: string
            changeLogId: string
          }
        >()

        // Process each unconfirmed change - only keep the most recent per group/individual
        for (const change of unconfirmedChanges) {
          const metadata = change.metadata || {}

          // Use target_group_id from ChangeLog if available, otherwise fall back to metadata
          const getGroupIdFromChange = (): number | null => {
            // First try target_group_id (most reliable)
            if (change.target_group_id) {
              const parsed = parseInt(change.target_group_id, 10)
              if (!isNaN(parsed)) return parsed
            }
            // Fall back to metadata
            return (
              metadata.ride_id ||
              metadata.to_group ||
              metadata.from_group ||
              null
            )
          }

          // Handle group changes - track both source and destination groups
          if (change.action === 'ADD_TO_GROUP') {
            // Use target_group_id if available (int8 type), otherwise use metadata
            const toGroupId = change.target_group_id
              ? typeof change.target_group_id === 'number'
                ? change.target_group_id
                : parseInt(change.target_group_id, 10)
              : metadata.to_group || metadata.ride_id
            if (toGroupId && !isNaN(toGroupId)) {
              const existing = groupChangesMap.get(toGroupId)
              if (
                !existing ||
                new Date(change.created_at) > new Date(existing.changedAt)
              ) {
                groupChangesMap.set(toGroupId, {
                  ride_id: toGroupId,
                  changeType: 'modified' as const,
                  changedAt: change.created_at,
                  action: change.action,
                  changeLogId: change.id,
                })
              }
            }
            // Also track source group if rider came from another group
            const fromGroupId = metadata.from_group
            if (fromGroupId) {
              const existing = groupChangesMap.get(fromGroupId)
              if (
                !existing ||
                new Date(change.created_at) > new Date(existing.changedAt)
              ) {
                groupChangesMap.set(fromGroupId, {
                  ride_id: fromGroupId,
                  changeType: 'modified' as const,
                  changedAt: change.created_at,
                  action: change.action,
                  changeLogId: change.id,
                })
              }
            }
          } else if (change.action === 'REMOVE_FROM_GROUP') {
            // Use target_group_id if available, otherwise use metadata.from_group
            const fromGroupId = change.target_group_id
              ? parseInt(change.target_group_id, 10)
              : metadata.from_group
            if (fromGroupId && !isNaN(fromGroupId)) {
              const existing = groupChangesMap.get(fromGroupId)
              if (
                !existing ||
                new Date(change.created_at) > new Date(existing.changedAt)
              ) {
                groupChangesMap.set(fromGroupId, {
                  ride_id: fromGroupId,
                  changeType: 'modified' as const,
                  changedAt: change.created_at,
                  action: change.action,
                  changeLogId: change.id,
                })
              }
            }
            // If removed to unmatched, track as unmatched individual
            if (metadata.to === 'unmatched') {
              const flightId = metadata.rider_flight_id || metadata.flight_id
              if (flightId) {
                const existing = unmatchedChangesMap.get(flightId)
                if (
                  !existing ||
                  new Date(change.created_at) >
                    new Date(existing.becameUnmatchedAt)
                ) {
                  unmatchedChangesMap.set(flightId, {
                    flight_id: flightId,
                    user_id: metadata.rider_user_id || metadata.user_id || '',
                    name: metadata.rider_name || 'Unknown',
                    date: metadata.date || '',
                    becameUnmatchedAt: change.created_at,
                    changeLogId: change.id,
                  })
                }
              }
            }
          } else if (
            change.action === 'UPDATE_GROUP_TIME' ||
            change.action === 'UPDATE_VOUCHER' ||
            change.action === 'CREATE_GROUP'
          ) {
            // Use target_group_id if available (int8 type), otherwise use metadata.ride_id
            const rideId = change.target_group_id
              ? typeof change.target_group_id === 'number'
                ? change.target_group_id
                : parseInt(change.target_group_id, 10)
              : metadata.ride_id
            if (rideId && !isNaN(rideId)) {
              const existing = groupChangesMap.get(rideId)
              if (
                !existing ||
                new Date(change.created_at) > new Date(existing.changedAt)
              ) {
                groupChangesMap.set(rideId, {
                  ride_id: rideId,
                  changeType: 'modified' as const,
                  changedAt: change.created_at,
                  action: change.action,
                  changeLogId: change.id,
                })
              }
            }
          } else if (change.action === 'DELETE_GROUP') {
            // Use target_group_id if available (int8 type), otherwise use metadata.ride_id
            const rideId = change.target_group_id
              ? typeof change.target_group_id === 'number'
                ? change.target_group_id
                : parseInt(change.target_group_id, 10)
              : metadata.ride_id
            if (rideId) {
              const existing = groupChangesMap.get(rideId)
              if (
                !existing ||
                new Date(change.created_at) > new Date(existing.changedAt)
              ) {
                groupChangesMap.set(rideId, {
                  ride_id: rideId,
                  changeType: 'deleted' as const,
                  changedAt: change.created_at,
                  action: change.action,
                  changeLogId: change.id,
                })
              }
            }
          }
        }

        // Check for reversals and delete them BEFORE processing groups
        // Group all changes by ride_id to check for reversals
        const changesByRideId = new Map<
          number,
          typeof processedUnconfirmedChanges
        >()
        processedUnconfirmedChanges.forEach((change) => {
          // Use target_group_id if available (int8 type), otherwise fall back to metadata
          let rideId: number | null = null

          if (change.target_group_id) {
            rideId =
              typeof change.target_group_id === 'number'
                ? change.target_group_id
                : parseInt(change.target_group_id, 10)
            if (isNaN(rideId)) {
              rideId = null
            }
          }

          // Fall back to metadata if target_group_id not available
          if (!rideId) {
            const metadata = change.metadata || {}
            if (change.action === 'ADD_TO_GROUP') {
              rideId = metadata.to_group || metadata.ride_id
            } else if (change.action === 'REMOVE_FROM_GROUP') {
              rideId = metadata.from_group
            } else {
              rideId =
                metadata.ride_id || metadata.to_group || metadata.from_group
            }
          }

          if (rideId && !isNaN(rideId)) {
            if (!changesByRideId.has(rideId)) {
              changesByRideId.set(rideId, [])
            }
            changesByRideId.get(rideId)!.push(change)
          }
        })

        // Check for reversals: if REMOVE_FROM_GROUP is followed by ADD_TO_GROUP for same group and same rider
        // DELETE both changes from the database if they cancel each other out and both are unconfirmed
        const changesToDelete: string[] = [] // Array of changeLogIds to delete

        // We need current groups to check if riders are currently in groups
        const currentGroups = groups

        for (const [rideId, changes] of Array.from(changesByRideId.entries())) {
          const group = currentGroups.find((g) => g.ride_id === rideId)
          if (!group) continue // Group doesn't exist, skip

          const sortedChanges = changes.sort(
            (a, b) =>
              new Date(a.created_at).getTime() -
              new Date(b.created_at).getTime(),
          )

          // Track which riders were removed and then added back to the same group (or vice versa)
          const removedRiders = new Map<
            string,
            { changeId: string; change: any }
          >() // `${rideId}-${flightId}` -> { changeId, change }
          const addedRiders = new Map<
            string,
            { changeId: string; change: any }
          >() // `${rideId}-${flightId}` -> { changeId, change }

          sortedChanges.forEach((change) => {
            const metadata = change.metadata || {}
            const flightId = metadata.rider_flight_id || metadata.flight_id

            // Determine which group this change belongs to - use target_group_id if available
            let changeGroupId: number | null = null
            if (change.target_group_id) {
              changeGroupId =
                typeof change.target_group_id === 'number'
                  ? change.target_group_id
                  : parseInt(change.target_group_id, 10)
              if (isNaN(changeGroupId)) {
                changeGroupId = null
              }
            }

            // Fall back to metadata if target_group_id not available
            if (!changeGroupId) {
              if (change.action === 'REMOVE_FROM_GROUP') {
                changeGroupId = metadata.from_group
              } else if (change.action === 'ADD_TO_GROUP') {
                changeGroupId = metadata.to_group || metadata.ride_id
              } else {
                changeGroupId = metadata.ride_id
              }
            }

            // Only process if this change belongs to the current group being checked
            if (changeGroupId !== rideId) {
              return
            }

            if (change.action === 'REMOVE_FROM_GROUP' && flightId) {
              const key = `${rideId}-${flightId}`
              removedRiders.set(key, { changeId: change.id, change })
            } else if (change.action === 'ADD_TO_GROUP' && flightId) {
              const key = `${rideId}-${flightId}`
              addedRiders.set(key, { changeId: change.id, change })
            }
          })

          // Check for reversals: if a rider was removed and then added back (or vice versa) to the same group
          // DELETE both changes if they cancel each other out and both are unconfirmed
          removedRiders.forEach((removeData, key) => {
            if (addedRiders.has(key)) {
              const addData = addedRiders.get(key)!
              const removeChange = removeData.change
              const addChange = addData.change

              if (removeChange && addChange) {
                const removeTime = new Date(removeChange.created_at).getTime()
                const addTime = new Date(addChange.created_at).getTime()

                // Check if removal happened before addition (remove -> add cycle)
                if (removeTime < addTime) {
                  // Check if rider is currently in the group
                  const flightId =
                    removeChange.metadata?.rider_flight_id ||
                    removeChange.metadata?.flight_id
                  if (flightId) {
                    const isCurrentlyInGroup = group.riders.some(
                      (r) => r.flight_id === flightId,
                    )
                    if (isCurrentlyInGroup) {
                      // Check if both changes are unconfirmed - only delete if neither was confirmed
                      if (!removeChange.confirmed && !addChange.confirmed) {
                        // Both changes cancel out and are unconfirmed - DELETE them
                        changesToDelete.push(removeData.changeId)
                        changesToDelete.push(addData.changeId)
                        console.log(
                          '[loadUnconfirmedChanges] Detected reversal: REMOVE then ADD for rider',
                          flightId,
                          'in group',
                          rideId,
                          '- deleting both unconfirmed changes',
                        )
                      }
                    }
                  }
                }
              }
            }
          })

          // Also check for add -> remove cycles
          addedRiders.forEach((addData, key) => {
            if (removedRiders.has(key)) {
              const removeData = removedRiders.get(key)!
              const addChange = addData.change
              const removeChange = removeData.change

              if (addChange && removeChange) {
                const addTime = new Date(addChange.created_at).getTime()
                const removeTime = new Date(removeChange.created_at).getTime()

                // Check if addition happened before removal (add -> remove cycle)
                if (addTime < removeTime) {
                  // Check if rider is currently NOT in the group
                  const flightId =
                    addChange.metadata?.rider_flight_id ||
                    addChange.metadata?.flight_id
                  if (flightId) {
                    const isCurrentlyInGroup = group.riders.some(
                      (r) => r.flight_id === flightId,
                    )
                    if (!isCurrentlyInGroup) {
                      // Check if both changes are unconfirmed - only delete if neither was confirmed
                      if (!addChange.confirmed && !removeChange.confirmed) {
                        // Both changes cancel out and are unconfirmed - DELETE them
                        changesToDelete.push(addData.changeId)
                        changesToDelete.push(removeData.changeId)
                        console.log(
                          '[loadUnconfirmedChanges] Detected reversal: ADD then REMOVE for rider',
                          flightId,
                          'in group',
                          rideId,
                          '- deleting both unconfirmed changes',
                        )
                      }
                    }
                  }
                }
              }
            }
          })
        }

        // Delete all reversed changes from the database
        if (changesToDelete.length > 0) {
          const uniqueChangeIds = Array.from(new Set(changesToDelete))
          console.log(
            '[loadUnconfirmedChanges] Deleting',
            uniqueChangeIds.length,
            'reversed changes from database:',
            uniqueChangeIds,
          )
          const { error: deleteError } = await supabase
            .from('ChangeLog')
            .delete()
            .in('id', uniqueChangeIds)

          if (deleteError) {
            console.error(
              '[loadUnconfirmedChanges] Error deleting reversed changes:',
              deleteError,
            )
          } else {
            console.log(
              '[loadUnconfirmedChanges] Successfully deleted reversed changes',
            )
            // Re-fetch unconfirmed changes after deletion
            // This ensures we don't process deleted changes
            const { data: refreshedUnconfirmedChanges } = await supabase
              .from('ChangeLog')
              .select(
                'id, metadata, created_at, action, confirmed, target_group_id',
              )
              .eq('confirmed', false)
              .in('action', [
                'UPDATE_GROUP_TIME',
                'ADD_TO_GROUP',
                'REMOVE_FROM_GROUP',
                'CREATE_GROUP',
                'DELETE_GROUP',
              ])
              .order('created_at', { ascending: false })

            if (refreshedUnconfirmedChanges) {
              // Update the processedUnconfirmedChanges array to exclude deleted entries
              processedUnconfirmedChanges = refreshedUnconfirmedChanges.filter(
                (change) => !uniqueChangeIds.includes(change.id),
              )
            }
          }
        }

        // Find corresponding groups from current state and verify changes are still valid
        setGroups((prevGroups) => {
          const newChangedGroups: Array<{
            group: Group
            changeType: 'modified' | 'deleted'
            changedAt: string
            emailsSent: boolean
            changeLogId?: string
            changeDescriptions?: string[]
          }> = []

          // Check if groups have any non-reverted changes
          const groupsWithNonRevertedChanges = new Set<number>()

          // First, check all changes for each group to see if any are not reverted
          // Note: Reversed changes have been deleted from the database, so they won't be in processedUnconfirmedChanges
          processedUnconfirmedChanges.forEach((change) => {
            // Use target_group_id if available (int8 type), otherwise fall back to metadata
            let rideId: number | null = null
            if (change.target_group_id) {
              rideId =
                typeof change.target_group_id === 'number'
                  ? change.target_group_id
                  : parseInt(change.target_group_id, 10)
              if (isNaN(rideId)) {
                rideId = null
              }
            }

            // Fall back to metadata if target_group_id not available
            if (!rideId) {
              const metadata = change.metadata || {}
              if (change.action === 'ADD_TO_GROUP') {
                rideId = metadata.to_group || metadata.ride_id
              } else if (change.action === 'REMOVE_FROM_GROUP') {
                rideId = metadata.from_group
              } else {
                rideId = metadata.ride_id
              }
            }

            if (rideId && !isNaN(rideId)) {
              groupsWithNonRevertedChanges.add(rideId)
              console.log(
                '[loadUnconfirmedChanges] Added group to non-reverted changes:',
                rideId,
                'from action:',
                change.action,
                'target_group_id:',
                change.target_group_id,
              )
            } else {
              console.log(
                '[loadUnconfirmedChanges] Could not determine rideId for change:',
                change.id,
                change.action,
                'target_group_id:',
                change.target_group_id,
                'metadata:',
                change.metadata,
              )
            }
          })

          console.log(
            '[loadUnconfirmedChanges] Groups with non-reverted changes:',
            Array.from(groupsWithNonRevertedChanges),
          )

          // Rebuild groupChangesMap to only include non-reverted changes, using the most recent non-reverted change per group
          const finalGroupChangesMap = new Map<
            number,
            {
              ride_id: number
              changeType: 'modified' | 'deleted'
              changedAt: string
              action: string
              changeLogId: string
            }
          >()

          // Find the most recent non-reverted change for each group
          // Note: Reversed changes have been deleted from the database, so they won't be in processedUnconfirmedChanges
          processedUnconfirmedChanges.forEach((change) => {
            // Use target_group_id if available (int8 type, most reliable), otherwise fall back to metadata
            let rideId: number | null = null

            if (change.target_group_id) {
              rideId =
                typeof change.target_group_id === 'number'
                  ? change.target_group_id
                  : parseInt(change.target_group_id, 10)
              if (isNaN(rideId)) {
                rideId = null
              }
            }

            // Fall back to metadata if target_group_id not available
            if (!rideId) {
              const metadata = change.metadata || {}
              if (change.action === 'ADD_TO_GROUP') {
                rideId = metadata.to_group || metadata.ride_id
              } else if (change.action === 'REMOVE_FROM_GROUP') {
                rideId = metadata.from_group
              } else if (
                change.action === 'UPDATE_GROUP_TIME' ||
                change.action === 'UPDATE_VOUCHER' ||
                change.action === 'CREATE_GROUP' ||
                change.action === 'DELETE_GROUP'
              ) {
                rideId = metadata.ride_id
              }
            }

            if (rideId && !isNaN(rideId)) {
              const existing = finalGroupChangesMap.get(rideId)
              if (
                !existing ||
                new Date(change.created_at) > new Date(existing.changedAt)
              ) {
                finalGroupChangesMap.set(rideId, {
                  ride_id: rideId,
                  changeType:
                    change.action === 'DELETE_GROUP'
                      ? ('deleted' as const)
                      : ('modified' as const),
                  changedAt: change.created_at,
                  action: change.action,
                  changeLogId: change.id,
                })
              }
            }
          })

          console.log(
            '[loadUnconfirmedChanges] Final group changes map:',
            Array.from(finalGroupChangesMap.keys()),
          )

          // Collect all unique change types for each group to build change descriptions
          // Note: Reversed changes have been deleted from the database, so they won't be in processedUnconfirmedChanges
          const groupChangeTypesMap = new Map<number, Set<string>>()
          processedUnconfirmedChanges.forEach((change) => {
            // Use target_group_id if available (int8 type), otherwise fall back to metadata
            let rideId: number | null = null
            if (change.target_group_id) {
              rideId =
                typeof change.target_group_id === 'number'
                  ? change.target_group_id
                  : parseInt(change.target_group_id, 10)
              if (isNaN(rideId)) {
                rideId = null
              }
            }

            // Fall back to metadata if target_group_id not available
            if (!rideId) {
              const metadata = change.metadata || {}
              if (change.action === 'ADD_TO_GROUP') {
                rideId = metadata.to_group || metadata.ride_id
              } else if (change.action === 'REMOVE_FROM_GROUP') {
                rideId = metadata.from_group
              } else if (
                change.action === 'UPDATE_GROUP_TIME' ||
                change.action === 'UPDATE_VOUCHER' ||
                change.action === 'CREATE_GROUP' ||
                change.action === 'DELETE_GROUP'
              ) {
                rideId = metadata.ride_id
              }
            }

            if (rideId && !isNaN(rideId)) {
              if (!groupChangeTypesMap.has(rideId)) {
                groupChangeTypesMap.set(rideId, new Set())
              }
              groupChangeTypesMap.get(rideId)!.add(change.action)
            }
          })

          finalGroupChangesMap.forEach((changeInfo) => {
            // Skip if this group has no non-reverted changes (all changes were reverted)
            if (!groupsWithNonRevertedChanges.has(changeInfo.ride_id)) {
              console.log(
                '[loadUnconfirmedChanges] Skipping group',
                changeInfo.ride_id,
                'because all changes have been reverted (no net change). ChangeInfo:',
                changeInfo,
              )
              return
            }

            console.log(
              '[loadUnconfirmedChanges] Processing group change:',
              changeInfo.ride_id,
              'action:',
              changeInfo.action,
            )

            // Note: We no longer filter by group-level confirmation
            // Each change is confirmed individually via the `confirmed` field
            // Unconfirmed changes are already filtered by `.eq('confirmed', false)` in the query

            const group = prevGroups.find(
              (g) => g.ride_id === changeInfo.ride_id,
            )
            if (group) {
              // For DELETE_GROUP, check if group still exists (if it does, it wasn't actually deleted)
              if (changeInfo.changeType === 'deleted') {
                console.log(
                  '[loadUnconfirmedChanges] Skipping deleted group that still exists:',
                  changeInfo.ride_id,
                )
                return // Don't show deleted groups that still exist
              }

              // Build change descriptions from all change types for this group
              const changeTypes =
                groupChangeTypesMap.get(changeInfo.ride_id) || new Set()
              const rawDescriptions =
                Array.from(changeTypes).map(getChangeDescription)
              const changeDescriptions =
                consolidateChangeDescriptions(rawDescriptions)

              console.log(
                '[loadUnconfirmedChanges] Adding group to changed groups:',
                changeInfo.ride_id,
                'actions:',
                Array.from(changeTypes),
                'descriptions:',
                changeDescriptions,
              )
              newChangedGroups.push({
                group,
                changeType: changeInfo.changeType,
                changedAt: changeInfo.changedAt,
                emailsSent: false, // Should not reach here if confirmed, but set to false for safety
                changeLogId: changeInfo.changeLogId,
                changeDescriptions,
              })
            } else {
              console.log(
                '[loadUnconfirmedChanges] Group not found in prevGroups:',
                changeInfo.ride_id,
                'This might be why the card disappears',
              )
            }
          })

          if (newChangedGroups.length > 0) {
            // Only keep the most recent change per group
            const groupsMap = new Map<number, (typeof newChangedGroups)[0]>()
            newChangedGroups.forEach((ncg) => {
              const existing = groupsMap.get(ncg.group.ride_id)
              if (
                !existing ||
                new Date(ncg.changedAt) > new Date(existing.changedAt)
              ) {
                groupsMap.set(ncg.group.ride_id, ncg)
              }
            })
            setChangedGroups(Array.from(groupsMap.values()))
          } else {
            // If no unconfirmed group changes, clear the list
            setChangedGroups([])
          }

          return prevGroups
        })

        // Load unmatched individuals - verify they're actually unmatched in the database
        if (unmatchedChangesMap.size > 0) {
          const flightIds = Array.from(unmatchedChangesMap.keys())

          // Check which flights are actually matched in the database
          const { data: matchesData } = await supabase
            .from('Matches')
            .select('flight_id')
            .in('flight_id', flightIds)

          // Create a set of flight_ids that are currently matched
          const matchedFlightIds = new Set(
            (matchesData || []).map((m: any) => m.flight_id),
          )

          // Fetch rider data for unmatched individuals
          const { data: flightsData } = await supabase
            .from('Flights')
            .select('flight_id, user_id, date')
            .in('flight_id', flightIds)

          const flightsMap = new Map(
            (flightsData || []).map((f: any) => [f.flight_id, f]),
          )

          const userIds = Array.from(
            new Set(
              Array.from(unmatchedChangesMap.values()).map((u) => u.user_id),
            ),
          )

          const { data: usersData } = await supabase
            .from('Users')
            .select('user_id, firstname, lastname')
            .in('user_id', userIds)

          const usersMap = new Map(
            (usersData || []).map((u: any) => [
              u.user_id,
              `${u.firstname || ''} ${u.lastname || ''}`.trim() || 'Unknown',
            ]),
          )

          const newUnmatchedIndividuals: Array<{
            rider: Rider
            becameUnmatchedAt: string
            emailSent: boolean
            changeLogId?: string
          }> = []

          unmatchedChangesMap.forEach((changeInfo, flightId) => {
            // Note: We no longer filter by flight-level confirmation
            // Each change is confirmed individually via the `confirmed` field
            // Unconfirmed changes are already filtered by `.eq('confirmed', false)` in the query

            // Only include if they're actually unmatched (not in Matches table)
            if (!matchedFlightIds.has(flightId)) {
              const flight = flightsMap.get(flightId)
              const name = usersMap.get(changeInfo.user_id) || changeInfo.name

              if (flight) {
                newUnmatchedIndividuals.push({
                  rider: {
                    user_id: changeInfo.user_id,
                    flight_id: flightId,
                    name,
                    phone: 'N/A',
                    checked_bags: 0,
                    carry_on_bags: 0,
                    time_range: '',
                    airport: '',
                    to_airport: false,
                    date: flight.date || changeInfo.date,
                  },
                  becameUnmatchedAt: changeInfo.becameUnmatchedAt,
                  emailSent: false, // Should not reach here if confirmed, but set to false for safety
                  changeLogId: changeInfo.changeLogId,
                })
              }
            }
          })

          if (newUnmatchedIndividuals.length > 0) {
            // Only keep the most recent change per individual
            const individualsMap = new Map<
              number,
              (typeof newUnmatchedIndividuals)[0]
            >()
            newUnmatchedIndividuals.forEach((nui) => {
              const existing = individualsMap.get(nui.rider.flight_id)
              if (
                !existing ||
                new Date(nui.becameUnmatchedAt) >
                  new Date(existing.becameUnmatchedAt)
              ) {
                individualsMap.set(nui.rider.flight_id, nui)
              }
            })
            setUnmatchedIndividuals(Array.from(individualsMap.values()))
          } else {
            // If no unconfirmed unmatched individuals, clear the list
            setUnmatchedIndividuals([])
          }
        } else {
          setUnmatchedIndividuals([])
        }
      }
    } catch (error) {
      console.error('Error loading unconfirmed changes:', error)
    }
  }, [supabase, groups])

  useEffect(() => {
    const loadData = async () => {
      await fetchLastAlgorithmRun()
      await fetchData()
      await fetchChangeLog()
      // Load unconfirmed changes after a short delay to ensure groups are loaded
      setTimeout(async () => {
        await loadUnconfirmedChanges()
      }, 500)
    }
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Log validation error modal state changes
  useEffect(() => {
    if (validationErrorModal) {
      console.log('[ValidationErrorModal] Modal state changed to OPEN', {
        issue: validationErrorModal.issue,
        riderName: validationErrorModal.rider.name,
        groupId: validationErrorModal.group.ride_id,
      })
    } else {
      console.log('[ValidationErrorModal] Modal state changed to CLOSED')
    }
  }, [validationErrorModal])

  // Reload unconfirmed changes when groups change
  useEffect(() => {
    if (groups.length > 0) {
      loadUnconfirmedChanges()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups.length])

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

      // Fetch all flights first (without Users join to avoid RLS issues)
      // Use pagination to fetch all flights (Supabase defaults to 1000 row limit)
      let allFlightsData: any[] = []
      let from = 0
      const pageSize = 1000
      let hasMore = true

      while (hasMore) {
        const { data: flightsPage, error: flightsError } = await supabase
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
            opt_in
          `,
          )
          .range(from, from + pageSize - 1)

        if (flightsError) {
          console.error('Error fetching flights:', flightsError.message)
          break
        }

        if (flightsPage && flightsPage.length > 0) {
          allFlightsData = [...allFlightsData, ...flightsPage]
          from += pageSize
          hasMore = flightsPage.length === pageSize
        } else {
          hasMore = false
        }
      }

      const flightsData = allFlightsData

      // Fetch Users separately to avoid RLS blocking the Flights query
      const userIds = Array.from(
        new Set(flightsData.map((f: any) => f.user_id).filter(Boolean)),
      )

      if (userIds.length === 0) {
        console.warn('No user_ids found in flights data')
      }

      // Batch Users query to avoid URL length limits (Supabase .in() has limits)
      const batchSize = 100
      let allUsersData: any[] = []

      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize)
        const { data: usersBatch, error: usersError } = await supabase
          .from('Users')
          .select('user_id, firstname, lastname, phonenumber')
          .in('user_id', batch)

        if (usersError) {
          console.error(
            `Error fetching Users batch ${i / batchSize + 1}:`,
            usersError,
          )
        } else if (usersBatch) {
          allUsersData = [...allUsersData, ...usersBatch]
        }
      }

      // Create a map of user_id to user data (ensure both keys and lookups use string format)
      const usersMap = new Map(
        allUsersData.map((user: any) => [
          String(user.user_id), // Ensure key is string
          {
            firstname: user.firstname,
            lastname: user.lastname,
            phonenumber: user.phonenumber,
          },
        ]),
      )

      // Attach Users data to flights
      const flightsWithUsers = flightsData.map((flight: any) => {
        // Ensure we use string format for lookup to match the map key
        const userData = flight.user_id
          ? usersMap.get(String(flight.user_id))
          : null
        return {
          ...flight,
          Users: userData || null,
        }
      })

      // Note: Some flights may have null matched or missing Users - this is expected for unmatched flights

      // Use flightsWithUsers instead of flightsData from now on
      const flightsDataToUse = flightsWithUsers
      // Extract unique airports
      const airports = Array.from(
        new Set(flightsDataToUse.map((f: any) => f.airport).filter(Boolean)),
      )
      setAvailableAirports(airports)
      setSelectedAirports(airports) // Select all by default

      // Fetch matches first to get all ride_ids and flight_ids
      // Use pagination to fetch all matches (Supabase defaults to 1000 row limit)
      let allMatchesData: any[] = []
      let matchesFrom = 0
      const matchesPageSize = 1000
      let hasMoreMatches = true

      while (hasMoreMatches) {
        const { data: matchesPage, error: matchesError } = await supabase
          .from('Matches')
          .select('ride_id, flight_id, user_id, voucher, time, uber_type')
          .range(matchesFrom, matchesFrom + matchesPageSize - 1)

        if (matchesError) {
          console.error('Error fetching matches:', matchesError.message)
          break
        }

        if (matchesPage && matchesPage.length > 0) {
          allMatchesData = [...allMatchesData, ...matchesPage]
          matchesFrom += matchesPageSize
          hasMoreMatches = matchesPage.length === matchesPageSize
        } else {
          hasMoreMatches = false
        }
      }

      const matchesData = allMatchesData

      if (!matchesData || matchesData.length === 0) {
        setGroups([])
        setUnmatchedRiders(
          flightsDataToUse
            .filter((f: any) => f.matched === false)
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
                checked_bags: flight.bag_no_large || 0,
                carry_on_bags: flight.bag_no || 0,
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

      // Fetch flights for all matches (without Users join to avoid RLS issues)
      // Batch the .in() query to avoid Supabase limits (typically 100-1000 items)
      const flightIdBatchSize = 500
      let allMatchFlightsData: any[] = []

      for (let i = 0; i < matchFlightIds.length; i += flightIdBatchSize) {
        const batch = matchFlightIds.slice(i, i + flightIdBatchSize)
        const { data: matchFlightsBatch, error: matchFlightsError } =
          await supabase
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
              airline_iata
            `,
            )
            .in('flight_id', batch)

        if (matchFlightsError) {
          console.error(
            `Error fetching match flights batch ${i / flightIdBatchSize + 1}:`,
            matchFlightsError,
          )
        } else if (matchFlightsBatch) {
          allMatchFlightsData = [...allMatchFlightsData, ...matchFlightsBatch]
        }
      }

      const matchFlightsData = allMatchFlightsData

      // Create a map of flight_id to flight data for quick lookup
      const flightsMap = new Map<number, any>()

      // Also add flights from initial fetch that might not be in matches
      // Fetch Users for match flights separately (with batching)
      const matchFlightUserIds = Array.from(
        new Set(
          matchFlightsData?.map((f: any) => f.user_id).filter(Boolean) || [],
        ),
      )

      // Batch Users query to avoid URL length limits
      const matchBatchSize = 100
      let allMatchUsersData: any[] = []

      for (let i = 0; i < matchFlightUserIds.length; i += matchBatchSize) {
        const batch = matchFlightUserIds.slice(i, i + matchBatchSize)
        const { data: matchUsersBatch, error: matchUsersError } = await supabase
          .from('Users')
          .select('user_id, firstname, lastname, phonenumber')
          .in('user_id', batch)

        if (matchUsersError) {
          console.error(
            `Error fetching match Users batch ${i / matchBatchSize + 1}:`,
            matchUsersError,
          )
        } else if (matchUsersBatch) {
          allMatchUsersData = [...allMatchUsersData, ...matchUsersBatch]
        }
      }

      const matchUsersData = allMatchUsersData

      const matchUsersMap = new Map(
        (matchUsersData || []).map((user: any) => [
          user.user_id,
          {
            firstname: user.firstname,
            lastname: user.lastname,
            phonenumber: user.phonenumber,
          },
        ]),
      )

      // Attach Users to match flights
      matchFlightsData?.forEach((flight: any) => {
        const flightWithUsers = {
          ...flight,
          Users: matchUsersMap.get(flight.user_id) || null,
        }
        flightsMap.set(flight.flight_id, flightWithUsers)
      })

      // Also add flights from initial fetch that might not be in matches
      flightsDataToUse.forEach((flight: any) => {
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
            `Match has no associated flight (flight_id: ${match.flight_id}, ride_id: ${match.ride_id}). This match will not appear in groups. Check if: 1) Flight exists in Flights table, 2) RLS policies allow access to this flight, 3) Flight has Users relationship data.`,
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
            match_time: match.time || undefined,
            to_airport: flight.to_airport,
            riders: [],
            group_voucher: match.voucher || undefined,
            uber_type: match.uber_type || undefined,
          })
        }

        const group = groupsMap.get(match.ride_id)!
        // Users is now an object (not an array) since we fetch separately
        const userData = (flight as any).Users || null
        group.riders.push({
          user_id: flight.user_id,
          flight_id: flight.flight_id,
          name:
            `${userData?.firstname || ''} ${userData?.lastname || ''}`.trim() ||
            'Unknown',
          phone: userData?.phonenumber || 'N/A',
          checked_bags: flight.bag_no_large || 0,
          carry_on_bags: flight.bag_no || 0,
          time_range: `${flight.earliest_time} - ${flight.latest_time}`,
          airport: flight.airport,
          to_airport: flight.to_airport,
          date: flight.date,
          flight_no: flight.flight_no || '',
          airline_iata: flight.airline_iata || '',
        })
      })

      // Calculate time range for each group from all its riders
      const finalGroups = Array.from(groupsMap.values()).map((group) => {
        const calculatedTimeRange = calculateGroupTimeRange(group.riders)
        return {
          ...group,
          time_range: calculatedTimeRange,
        }
      })

      setGroups(finalGroups)

      // Get unmatched riders
      const unmatched = flightsDataToUse
        .filter((f: any) => {
          // A flight is unmatched if:
          // 1. It's not in any match (not in matchedFlightIds)
          // 2. AND matched is explicitly false (not null, not true)
          const isNotInMatches = !matchedFlightIds.has(f.flight_id)
          const isNotMatched = f.matched === false
          return isNotInMatches && isNotMatched
        })
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
            checked_bags: flight.bag_no_large || 0,
            carry_on_bags: flight.bag_no || 0,
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
    } catch (error) {
      console.error('Error fetching groups data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchChangeLog = useCallback(async () => {
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
          confirmed,
          metadata,
          created_at
        `,
        )
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching changelog:', error)
        return
      }

      if (changeLogData) {
        // Fetch user names separately
        const actorUserIds = Array.from(
          new Set(changeLogData.map((entry: any) => entry.actor_user_id)),
        )

        const { data: usersData } = await supabase
          .from('Users')
          .select('user_id, firstname, lastname')
          .in('user_id', actorUserIds)

        const usersMap = new Map(
          (usersData || []).map((user: any) => [
            user.user_id,
            `${user.firstname || ''} ${user.lastname || ''}`.trim() ||
              'Unknown',
          ]),
        )

        const entries: ChangeLogEntry[] = changeLogData.map((entry: any) => ({
          id: entry.id,
          actor_user_id: entry.actor_user_id,
          actor_role: entry.actor_role,
          action: entry.action,
          algorithm_run_id: entry.algorithm_run_id,
          target_group_id: entry.target_group_id,
          target_user_id: entry.target_user_id,
          ignored_error: entry.ignored_error,
          confirmed: entry.confirmed ?? false,
          metadata: entry.metadata,
          created_at: entry.created_at,
          actor_name: usersMap.get(entry.actor_user_id) || 'Unknown',
        }))

        // Deduplicate entries by id (in case of duplicates)
        const uniqueEntries = Array.from(
          new Map(entries.map((entry) => [entry.id, entry])).values(),
        )

        setChangeLog(uniqueEntries)
      }
    } catch (error) {
      console.error('Error fetching changelog:', error)
    }
  }, [supabase])

  // Helper function to log changes to ChangeLog
  const logToChangeLog = useCallback(
    async (
      action: ChangeLogEntry['action'],
      metadata?: any,
      targetGroupId?: number,
      targetUserId?: string,
      confirmed: boolean = false,
    ) => {
      try {
        const currentUser = authUser || user
        if (!currentUser) {
          return
        }

        // Fetch user's role from Users table
        const { data: userProfile } = await supabase
          .from('Users')
          .select('role')
          .eq('user_id', currentUser.id)
          .single()

        const actorRole = userProfile?.role || 'Admin'

        // Insert into ChangeLog
        // Ensure metadata is properly serialized (Supabase expects JSON)
        // Use a try-catch to handle any circular references or invalid JSON
        let serializedMetadata = null
        try {
          if (metadata) {
            // Deep clone to avoid circular references
            serializedMetadata = JSON.parse(JSON.stringify(metadata))
          }
        } catch (metadataError) {
          console.error(
            '[logToChangeLog] Error serializing metadata:',
            metadataError,
          )
          console.error('[logToChangeLog] Original metadata:', metadata)
          // Try to create a safe version
          try {
            serializedMetadata = {
              error: 'Metadata serialization failed',
              original_type: typeof metadata,
            }
          } catch {
            serializedMetadata = null
          }
        }

        const changeLogDataToInsert: any = {
          actor_user_id: currentUser.id,
          actor_role: actorRole,
          action,
          target_group_id: targetGroupId || null, // int8 type, same as ride_id in Matches
          target_user_id: targetUserId || null,
          metadata: serializedMetadata,
          ignored_error: false,
        }

        // Only include confirmed if it's explicitly set (some databases might not have this column)
        if (confirmed !== undefined) {
          changeLogDataToInsert.confirmed = confirmed
        }

        console.log('[logToChangeLog] Attempting to insert ChangeLog entry:', {
          action,
          metadata: serializedMetadata,
          targetGroupId,
          targetUserId,
          confirmed,
          changeLogData: changeLogDataToInsert,
        })

        const { data, error } = await supabase
          .from('ChangeLog')
          .insert(changeLogDataToInsert)
          .select()

        if (error) {
          console.error('[logToChangeLog] Error logging to ChangeLog:', error)
          console.error(
            '[logToChangeLog] Full error object:',
            JSON.stringify(error, null, 2),
          )
          console.error(
            '[logToChangeLog] ChangeLog data attempted:',
            JSON.stringify(changeLogDataToInsert, null, 2),
          )
          console.error('[logToChangeLog] Error details:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
          })

          // Try to get more details from the error
          if (error.details) {
            console.error(
              '[logToChangeLog] Error details (parsed):',
              error.details,
            )
          }
          if (error.hint) {
            console.error('[logToChangeLog] Error hint:', error.hint)
          }
        } else {
          console.log(
            '[logToChangeLog] ChangeLog entry created successfully:',
            data,
          )
          // Refresh changelog - add small delay to ensure database commit
          await new Promise((resolve) => setTimeout(resolve, 200))
          await fetchChangeLog()
        }
      } catch (error) {
        console.error('Error in logToChangeLog:', error)
      }
    },
    [authUser, user, supabase, fetchChangeLog],
  )

  // Helper function to convert time string to minutes
  const timeToMinutes = useCallback((timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number)
    return hours * 60 + (minutes || 0)
  }, [])

  // Convert minutes back to time string (HH:MM)
  const minutesToTime = useCallback((minutes: number): string => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
  }, [])

  // Round time to the nearest 5-minute interval
  const roundToNearest5Minutes = useCallback(
    (timeStr: string): string => {
      if (!timeStr) return '00:00'

      // Handle HH:MM:SS format by taking only HH:MM
      const timeOnly = timeStr.split(':').slice(0, 2).join(':')
      const minutes = timeToMinutes(timeOnly)

      // Round to nearest 5 minutes
      const roundedMinutes = Math.round(minutes / 5) * 5
      const wrappedMinutes = roundedMinutes % (24 * 60) // Wrap around if needed

      return minutesToTime(wrappedMinutes)
    },
    [timeToMinutes, minutesToTime],
  )

  // Update group time for all members
  const handleUpdateGroupTime = useCallback(
    async (groupId: number, newTime: string) => {
      if (!newTime || !newTime.includes(':')) {
        setErrorMessage('Invalid time format. Please use HH:MM format.')
        setTimeout(() => setErrorMessage(null), 3000)
        return
      }

      setIsUpdatingTime(true)
      try {
        // Round to nearest 5 minutes and format time to HH:MM:SS
        const roundedTime = roundToNearest5Minutes(newTime)
        const formattedTime =
          roundedTime.includes(':') && roundedTime.split(':').length === 2
            ? `${roundedTime}:00`
            : roundedTime

        // Update all Matches for this group (set is_verified to false when time changes)
        const { error: updateError } = await supabase
          .from('Matches')
          .update({ time: formattedTime, is_verified: false })
          .eq('ride_id', groupId)

        if (updateError) {
          console.error('Error updating group time:', updateError)
          setErrorMessage('Failed to update group time')
          setTimeout(() => setErrorMessage(null), 3000)
          return
        }

        // Update local state and track changes
        setGroups((prev) => {
          const oldGroup = prev.find((g) => g.ride_id === groupId)
          const updatedGroups = prev.map((g) =>
            g.ride_id === groupId ? { ...g, match_time: formattedTime } : g,
          )
          const updatedGroup = updatedGroups.find((g) => g.ride_id === groupId)

          // Log to ChangeLog
          if (oldGroup) {
            logToChangeLog(
              'UPDATE_GROUP_TIME',
              {
                ride_id: groupId, // Store as number in metadata
                old_time: oldGroup.match_time || 'N/A',
                new_time: formattedTime,
                rider_count: oldGroup.riders.length,
              },
              groupId, // Set target_group_id to the group that was changed
            )
          }

          return updatedGroups
        })

        // Track this as a changed group - use updated group from state
        setGroups((prevGroups) => {
          const updatedGroup = prevGroups.find((g) => g.ride_id === groupId)
          if (updatedGroup) {
            setChangedGroups((prevChanged) => {
              const existing = prevChanged.find(
                (cg) => cg.group.ride_id === groupId,
              )
              if (existing) {
                // Merge new change description with existing ones
                const newDescription = getChangeDescription('UPDATE_GROUP_TIME')
                const existingDescriptions = existing.changeDescriptions || []
                const updatedDescriptions = consolidateChangeDescriptions([
                  ...existingDescriptions,
                  newDescription,
                ])
                return prevChanged.map((cg) =>
                  cg.group.ride_id === groupId
                    ? {
                        ...cg,
                        group: updatedGroup, // Update with latest group data
                        changedAt: new Date().toISOString(),
                        emailsSent: false,
                        changeDescriptions: updatedDescriptions,
                      }
                    : cg,
                )
              }
              return [
                ...prevChanged,
                {
                  group: updatedGroup,
                  changeType: 'modified',
                  changedAt: new Date().toISOString(),
                  emailsSent: false,
                  changeDescriptions: [
                    getChangeDescription('UPDATE_GROUP_TIME'),
                  ],
                },
              ]
            })
          }
          return prevGroups
        })

        setEditTimeModal(null)
        setErrorMessage(null)
      } catch (error) {
        console.error('Error in handleUpdateGroupTime:', error)
        setErrorMessage('Failed to update group time')
        setTimeout(() => setErrorMessage(null), 3000)
      } finally {
        setIsUpdatingTime(false)
      }
    },
    [supabase, logToChangeLog, roundToNearest5Minutes],
  )

  // Update group voucher for all members
  const handleUpdateGroupVoucher = useCallback(
    async (groupId: number, newVoucher: string) => {
      if (!authUser || !user) return

      setIsUpdatingVoucher(true)
      try {
        // Normalize voucher URL: if it doesn't start with https://r.uber.com/, prepend it
        let normalizedVoucher = newVoucher.trim()
        if (normalizedVoucher) {
          const uberVoucherPrefix = 'https://r.uber.com/'
          if (!normalizedVoucher.startsWith(uberVoucherPrefix)) {
            // Remove any leading slashes from the voucher code
            const voucherCode = normalizedVoucher.replace(/^\/+/, '')
            normalizedVoucher = `${uberVoucherPrefix}${voucherCode}`
          }
        }

        // Update all Matches for this group with the new voucher
        const { error: updateError } = await supabase
          .from('Matches')
          .update({ voucher: normalizedVoucher || '' })
          .eq('ride_id', groupId)

        if (updateError) {
          console.error('Error updating group voucher:', updateError)
          setErrorMessage('Failed to update group voucher')
          setTimeout(() => setErrorMessage(null), 3000)
          return
        }

        // Update local state and track this as a changed group
        setGroups((prev) => {
          const updatedGroups = prev.map((g) =>
            g.ride_id === groupId
              ? { ...g, group_voucher: normalizedVoucher || undefined }
              : g,
          )

          // Track this as a changed group
          const updatedGroup = updatedGroups.find((g) => g.ride_id === groupId)
          if (updatedGroup) {
            setChangedGroups((prevChanged) => {
              const existing = prevChanged.find(
                (cg) => cg.group.ride_id === groupId,
              )
              if (existing) {
                // Merge new change description with existing ones
                const newDescription = getChangeDescription('UPDATE_VOUCHER')
                const existingDescriptions = existing.changeDescriptions || []
                const updatedDescriptions = consolidateChangeDescriptions([
                  ...existingDescriptions,
                  newDescription,
                ])
                return prevChanged.map((cg) =>
                  cg.group.ride_id === groupId
                    ? {
                        ...cg,
                        group: updatedGroup,
                        changedAt: new Date().toISOString(),
                        emailsSent: false,
                        changeDescriptions: updatedDescriptions,
                      }
                    : cg,
                )
              }
              return [
                ...prevChanged,
                {
                  group: updatedGroup,
                  changeType: 'modified',
                  changedAt: new Date().toISOString(),
                  emailsSent: false,
                  changeDescriptions: [getChangeDescription('UPDATE_VOUCHER')],
                },
              ]
            })
          }

          return updatedGroups
        })

        // Log to ChangeLog
        // Note: target_group_id expects UUID, but ride_id is a number
        // Storing ride_id in metadata instead
        await logToChangeLog(
          'UPDATE_VOUCHER',
          {
            group_id: groupId.toString(),
            ride_id: groupId, // Store as number in metadata
            voucher: normalizedVoucher || '',
          },
          groupId, // Set target_group_id to the group that was changed
        )

        setEditVoucherModal(null)
        setEditVoucherValue('')
        setErrorMessage(null)
      } catch (error) {
        console.error('Error in handleUpdateGroupVoucher:', error)
        setErrorMessage('Failed to update group voucher')
        setTimeout(() => setErrorMessage(null), 3000)
      } finally {
        setIsUpdatingVoucher(false)
      }
    },
    [authUser, user, supabase, logToChangeLog],
  )

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

  // Helper function to determine if a group is subsidized
  // ONT: at least 2 riders = subsidized
  // LAX: at least 3 riders = subsidized
  const isGroupSubsidized = useCallback(
    (airport: string, riderCount: number): boolean => {
      if (airport === 'ONT') {
        return riderCount >= 2
      } else if (airport === 'LAX') {
        return riderCount >= 3
      }
      // Default: use 3+ for other airports
      return riderCount >= 3
    },
    [],
  )

  // Calculate midpoint of a time range
  const calculateTimeMidpoint = useCallback(
    (timeRange: string): string => {
      const [startTime, endTime] = timeRange.split(' - ').map((t) => t.trim())
      if (!startTime || !endTime) return startTime || '00:00'

      const startMinutes = timeToMinutes(startTime)
      let endMinutes = timeToMinutes(endTime)

      // Handle cross-midnight case (end time is earlier in day than start)
      if (endMinutes < startMinutes) {
        endMinutes += 24 * 60 // Add 24 hours
      }

      const midpointMinutes = Math.floor((startMinutes + endMinutes) / 2)
      const actualMidpoint = midpointMinutes % (24 * 60) // Wrap around if needed
      const midpointTime = minutesToTime(actualMidpoint)

      // Round to nearest 5 minutes
      return roundToNearest5Minutes(midpointTime)
    },
    [timeToMinutes, minutesToTime, roundToNearest5Minutes],
  )

  // Calculate overlapping time range for a group from all riders
  const calculateGroupTimeRange = useCallback(
    (riders: Rider[]): string => {
      if (riders.length === 0) return ''
      if (riders.length === 1) return riders[0].time_range

      let latestStart = ''
      let earliestEnd = ''

      for (const rider of riders) {
        const [startTime, endTime] = rider.time_range
          .split(' - ')
          .map((t) => t.trim())

        if (!startTime || !endTime) continue

        const startMinutes = timeToMinutes(startTime)
        const endMinutes = timeToMinutes(endTime)

        if (!latestStart || startMinutes > timeToMinutes(latestStart)) {
          latestStart = startTime
        }

        if (!earliestEnd || endMinutes < timeToMinutes(earliestEnd)) {
          earliestEnd = endTime
        }
      }

      // If there's no valid overlap, return empty or the first rider's range
      if (!latestStart || !earliestEnd) {
        return riders[0]?.time_range || ''
      }

      const latestStartMinutes = timeToMinutes(latestStart)
      const earliestEndMinutes = timeToMinutes(earliestEnd)

      // Check if any rider has a cross-midnight range (end time is earlier in the day than start time)
      const hasCrossMidnight = riders.some((rider) => {
        const [start, end] = rider.time_range.split(' - ').map((t) => t.trim())
        if (!start || !end) return false
        return timeToMinutes(end) < timeToMinutes(start)
      })

      // Check if there's actually an overlap
      if (latestStartMinutes > earliestEndMinutes) {
        // If times cross midnight, this is still valid (end is on next day)
        if (hasCrossMidnight) {
          // For cross-midnight ranges, the overlap is valid
          return `${latestStart} - ${earliestEnd}`
        }
        // No overlap for same-day ranges, return the first rider's range as fallback
        return riders[0]?.time_range || ''
      }

      return `${latestStart} - ${earliestEnd}`
    },
    [timeToMinutes],
  )

  const validateTimeCompatibility = useCallback(
    (group: Group, rider: Rider): boolean => {
      // Check if rider's time range overlaps with group's calculated overlapping time range
      const calculatedGroupTimeRange = calculateGroupTimeRange(group.riders)
      const groupTimes = calculatedGroupTimeRange
        .split(' - ')
        .map((t) => t.trim())
      const riderTimes = rider.time_range.split(' - ').map((t) => t.trim())

      console.log('[validateTimeCompatibility] Checking time compatibility', {
        calculatedGroupTimeRange,
        groupTimes,
        riderTimeRange: rider.time_range,
        riderTimes,
        groupDate: group.date,
        riderDate: rider.date,
      })

      if (groupTimes.length !== 2 || riderTimes.length !== 2) {
        console.log(
          '[validateTimeCompatibility] Invalid time format, returning false',
        )
        return false
      }

      // Check if dates match
      if (group.date !== rider.date) {
        console.log(
          '[validateTimeCompatibility] Dates do not match, returning false',
        )
        return false
      }

      // Check if time ranges overlap (simplified check)
      const groupStart = groupTimes[0]
      const groupEnd = groupTimes[1]
      const riderStart = riderTimes[0]
      const riderEnd = riderTimes[1]

      console.log('[validateTimeCompatibility] Comparing times', {
        groupStart,
        groupEnd,
        riderStart,
        riderEnd,
      })

      // Times overlap if: (riderStart <= groupEnd && riderEnd >= groupStart)
      const overlaps = riderStart <= groupEnd && riderEnd >= groupStart
      console.log('[validateTimeCompatibility] Overlap result', {
        overlaps,
        condition1: `${riderStart} <= ${groupEnd}`,
        condition1Result: riderStart <= groupEnd,
        condition2: `${riderEnd} >= ${groupStart}`,
        condition2Result: riderEnd >= groupStart,
      })
      return overlaps
    },
    [calculateGroupTimeRange],
  )

  // Get max bag units based on group size: 12 for < 3 people, 10 for >= 3 people
  const getMaxBagUnits = useCallback((riderCount: number): number => {
    return riderCount >= 3 ? 10 : 12
  }, [])

  const validateBagConstraints = useCallback(
    (group: Group, rider: Rider): boolean => {
      const currentBags = getTotalBags(group.riders)
      const riderBags = rider.checked_bags + rider.carry_on_bags
      const totalBags = currentBags + riderBags
      const newRiderCount = group.riders.length + 1
      const maxBags = getMaxBagUnits(newRiderCount)

      return totalBags <= maxBags
    },
    [getTotalBags, getMaxBagUnits],
  )

  const handleAddToCorral = useCallback(
    async (rider: Rider, fromGroupId?: number) => {
      if (fromGroupId) {
        try {
          // Find the group to get updated rider list
          const group = groups.find((g) => g.ride_id === fromGroupId)
          if (!group) {
            console.error('Group not found:', fromGroupId)
            return
          }

          const updatedRiders = group.riders.filter(
            (r) => r.flight_id !== rider.flight_id,
          )

          // Check if this is the last person in the group
          if (updatedRiders.length === 0) {
            // Show confirmation modal
            setDeleteGroupConfirmation({
              rider,
              groupId: fromGroupId,
              callback: async () => {
                // Get all flight_ids for this group before deleting
                const allFlightIds = group.riders.map((r) => r.flight_id)

                // Delete all matches for this group
                const { error: deleteAllMatchesError } = await supabase
                  .from('Matches')
                  .delete()
                  .eq('ride_id', fromGroupId)

                if (deleteAllMatchesError) {
                  console.error(
                    'Error deleting all matches:',
                    deleteAllMatchesError,
                  )
                  setErrorMessage('Failed to delete group')
                  setTimeout(() => setErrorMessage(null), 3000)
                  return
                }

                // Delete the ride
                const { error: deleteRideError } = await supabase
                  .from('Rides')
                  .delete()
                  .eq('ride_id', fromGroupId)

                if (deleteRideError) {
                  console.error('Error deleting ride:', deleteRideError)
                  setErrorMessage('Failed to delete group')
                  setTimeout(() => setErrorMessage(null), 3000)
                  return
                }

                // Update Flights table to mark all flights in the group as unmatched
                if (allFlightIds.length > 0) {
                  const { error: flightsError } = await supabase
                    .from('Flights')
                    .update({ matched: false })
                    .in('flight_id', allFlightIds)

                  if (flightsError) {
                    console.error('Error updating flights:', flightsError)
                  }
                }

                // Log to ChangeLog
                // Note: target_group_id expects UUID, but ride_id is a number
                // Storing ride_id in metadata instead
                await logToChangeLog(
                  'REMOVE_FROM_GROUP',
                  {
                    from_group: fromGroupId,
                    to: 'corral',
                    ride_id: fromGroupId, // Store as number in metadata
                    rider_name: rider.name,
                    rider_user_id: rider.user_id,
                    rider_flight_id: rider.flight_id,
                  },
                  fromGroupId, // Set target_group_id to the group that was changed
                  rider.user_id,
                )

                // Update local state - remove group and add rider to corral
                setGroups((prev) =>
                  prev.filter((g) => g.ride_id !== fromGroupId),
                )
                const riderWithOrigin: Rider = {
                  ...rider,
                  originType: 'group' as 'group' | 'unmatched',
                  originGroupId: fromGroupId,
                }
                setCorralRiders((prev) => [...prev, riderWithOrigin])
              },
            })
            return
          }

          // Delete the match from database
          const { error: deleteError } = await supabase
            .from('Matches')
            .delete()
            .eq('ride_id', fromGroupId)
            .eq('user_id', rider.user_id)

          if (deleteError) {
            console.error('Error removing match from database:', deleteError)
            setErrorMessage('Failed to remove rider from group')
            setTimeout(() => setErrorMessage(null), 3000)
            return
          }

          // Update Flights table to mark as unmatched
          const { error: flightsError } = await supabase
            .from('Flights')
            .update({ matched: false })
            .eq('flight_id', rider.flight_id)

          if (flightsError) {
            console.error('Error updating flight:', flightsError)
          }

          // Only update if there are remaining riders (groups need at least 1 rider)
          let newUberType: string | null = null
          let newIsSubsidized: boolean | null = null
          if (updatedRiders.length > 0) {
            // Calculate new bag units and uber_type
            const bagUnits = calculateBagUnits(updatedRiders)
            const uberType = determineUberType(updatedRiders.length, bagUnits)
            const isSubsidized = isGroupSubsidized(
              group.airport,
              updatedRiders.length,
            )

            if (uberType) {
              // Update all matches in the group with new uber_type, is_subsidized, and set is_verified to false
              const { error: updateError } = await supabase
                .from('Matches')
                .update({
                  uber_type: uberType,
                  is_subsidized: isSubsidized,
                  is_verified: false,
                })
                .eq('ride_id', fromGroupId)

              if (updateError) {
                console.error(
                  'Error updating uber_type when removing rider:',
                  updateError,
                )
              } else {
                newUberType = uberType
                newIsSubsidized = isSubsidized
              }
            }
          }

          // Log to ChangeLog
          // Note: target_group_id expects UUID, but ride_id is a number
          // Storing ride_id in metadata instead
          await logToChangeLog(
            'REMOVE_FROM_GROUP',
            {
              from_group: fromGroupId,
              to: 'corral',
              ride_id: fromGroupId, // Store as number in metadata
              rider_name: rider.name,
              rider_user_id: rider.user_id,
              rider_flight_id: rider.flight_id,
            },
            fromGroupId, // Set target_group_id to the group that was changed
            rider.user_id,
          )

          // Only update local state after successful database operations
          const riderWithOrigin: Rider = {
            ...rider,
            originType: 'group' as 'group' | 'unmatched',
            originGroupId: fromGroupId,
          }
          setCorralRiders((prev) => [...prev, riderWithOrigin])

          // Remove from group (local state) and track changes
          setGroups((prev) => {
            const updatedGroups = prev.map((g) =>
              g.ride_id === fromGroupId
                ? {
                    ...g,
                    riders: g.riders.filter(
                      (r) => r.flight_id !== rider.flight_id,
                    ),
                    uber_type: newUberType || g.uber_type, // Update uber_type (always a string, defaults to 'XXL*' for invalid)
                  }
                : g,
            )
            const updatedGroup = updatedGroups.find(
              (g) => g.ride_id === fromGroupId,
            )

            return updatedGroups
          })

          // Track this as a changed group
          setGroups((prevGroups) => {
            const updatedGroup = prevGroups.find(
              (g) => g.ride_id === fromGroupId,
            )
            if (updatedGroup) {
              setChangedGroups((prevChanged) => {
                const existing = prevChanged.find(
                  (cg) => cg.group.ride_id === fromGroupId,
                )
                if (existing) {
                  // Merge new change description with existing ones
                  const newDescription =
                    getChangeDescription('REMOVE_FROM_GROUP')
                  const existingDescriptions = existing.changeDescriptions || []
                  const updatedDescriptions = consolidateChangeDescriptions([
                    ...existingDescriptions,
                    newDescription,
                  ])
                  return prevChanged.map((cg) =>
                    cg.group.ride_id === fromGroupId
                      ? {
                          ...cg,
                          group: updatedGroup, // Update with latest group data
                          changedAt: new Date().toISOString(),
                          emailsSent: false,
                          changeDescriptions: updatedDescriptions,
                        }
                      : cg,
                  )
                }
                return [
                  ...prevChanged,
                  {
                    group: updatedGroup,
                    changeType: 'modified',
                    changedAt: new Date().toISOString(),
                    emailsSent: false,
                    changeDescriptions: [
                      getChangeDescription('REMOVE_FROM_GROUP'),
                    ],
                  },
                ]
              })
            }
            return prevGroups
          })
        } catch (error) {
          console.error('Error in handleAddToCorral:', error)
          setErrorMessage('Failed to remove rider from group')
          setTimeout(() => setErrorMessage(null), 3000)
        }
      } else {
        // Remove from unmatched (no database operations needed)
        const riderWithOrigin: Rider = {
          ...rider,
          originType: 'unmatched' as 'group' | 'unmatched',
          originGroupId: undefined,
        }
        setCorralRiders((prev) => [...prev, riderWithOrigin])
        setUnmatchedRiders((prev) =>
          prev.filter((r) => r.flight_id !== rider.flight_id),
        )
      }
    },
    [groups, supabase, logToChangeLog, isGroupSubsidized],
  )

  const handleRemoveFromGroupToUnmatched = useCallback(
    async (rider: Rider, groupId: number) => {
      try {
        // Delete the match from database
        const { error: deleteError } = await supabase
          .from('Matches')
          .delete()
          .eq('ride_id', groupId)
          .eq('user_id', rider.user_id)

        if (deleteError) {
          console.error('Error removing match from database:', deleteError)
          setErrorMessage('Failed to remove rider from group')
          setTimeout(() => setErrorMessage(null), 3000)
          return
        }

        // Update Flights table to mark as unmatched
        const { error: flightsError } = await supabase
          .from('Flights')
          .update({ matched: false })
          .eq('flight_id', rider.flight_id)

        if (flightsError) {
          console.error('Error updating flight:', flightsError)
        }

        // Find the group to get updated rider list
        const group = groups.find((g) => g.ride_id === groupId)
        let newUberType: string | null = null
        if (group) {
          const updatedRiders = group.riders.filter(
            (r) => r.flight_id !== rider.flight_id,
          )

          // Check if this is the last person in the group
          if (updatedRiders.length === 0) {
            // Show confirmation modal
            setDeleteGroupConfirmation({
              rider,
              groupId,
              callback: async () => {
                // Get all flight_ids for this group before deleting
                const allFlightIds = group.riders.map((r) => r.flight_id)

                // Delete all matches for this group
                const { error: deleteAllMatchesError } = await supabase
                  .from('Matches')
                  .delete()
                  .eq('ride_id', groupId)

                if (deleteAllMatchesError) {
                  console.error(
                    'Error deleting all matches:',
                    deleteAllMatchesError,
                  )
                  setErrorMessage('Failed to delete group')
                  setTimeout(() => setErrorMessage(null), 3000)
                  return
                }

                // Delete the ride
                const { error: deleteRideError } = await supabase
                  .from('Rides')
                  .delete()
                  .eq('ride_id', groupId)

                if (deleteRideError) {
                  console.error('Error deleting ride:', deleteRideError)
                  setErrorMessage('Failed to delete group')
                  setTimeout(() => setErrorMessage(null), 3000)
                  return
                }

                // Update Flights table to mark all flights in the group as unmatched
                if (allFlightIds.length > 0) {
                  const { error: flightsError } = await supabase
                    .from('Flights')
                    .update({ matched: false })
                    .in('flight_id', allFlightIds)

                  if (flightsError) {
                    console.error('Error updating flights:', flightsError)
                  }
                }

                // Log to ChangeLog
                await logToChangeLog(
                  'DELETE_GROUP',
                  {
                    ride_id: groupId, // Store as number in metadata
                    rider_name: rider.name,
                    rider_user_id: rider.user_id,
                  },
                  groupId, // Set target_group_id to the group that was deleted
                )

                // Track as deleted group
                setChangedGroups((prev) => {
                  const existing = prev.find(
                    (cg) => cg.group.ride_id === groupId,
                  )
                  if (existing) {
                    return prev.map((cg) =>
                      cg.group.ride_id === groupId
                        ? {
                            ...cg,
                            changeType: 'deleted',
                            changedAt: new Date().toISOString(),
                            emailsSent: false,
                          }
                        : cg,
                    )
                  }
                  return [
                    ...prev,
                    {
                      group,
                      changeType: 'deleted',
                      changedAt: new Date().toISOString(),
                      emailsSent: false,
                    },
                  ]
                })

                // Track all riders as unmatched individuals
                group.riders.forEach((r) => {
                  setUnmatchedIndividuals((prev) => {
                    const existing = prev.find(
                      (ui) => ui.rider.flight_id === r.flight_id,
                    )
                    if (!existing) {
                      return [
                        ...prev,
                        {
                          rider: r,
                          becameUnmatchedAt: new Date().toISOString(),
                          emailSent: false,
                        },
                      ]
                    }
                    return prev
                  })
                })

                // Update local state - remove group and add rider to unmatched
                setGroups((prev) => prev.filter((g) => g.ride_id !== groupId))
                setUnmatchedRiders((prev) => [...prev, rider])
              },
            })
            return
          }

          // Only update if there are remaining riders (groups need at least 1 rider)
          if (updatedRiders.length > 0) {
            // Calculate new bag units and uber_type
            const bagUnits = calculateBagUnits(updatedRiders)
            const uberType = determineUberType(updatedRiders.length, bagUnits)
            const isSubsidized = isGroupSubsidized(
              group.airport,
              updatedRiders.length,
            )

            // Recalculate time range and midpoint for the group
            const newTimeRange = calculateGroupTimeRange(updatedRiders)
            const midpointTime = calculateTimeMidpoint(newTimeRange)
            const formattedTime =
              midpointTime.includes(':') && midpointTime.split(':').length === 2
                ? `${midpointTime}:00`
                : midpointTime

            if (uberType) {
              // Update all matches in the group with new time, uber_type, is_subsidized, and set is_verified to false
              const { error: updateError } = await supabase
                .from('Matches')
                .update({
                  time: formattedTime,
                  uber_type: uberType,
                  is_subsidized: isSubsidized,
                  is_verified: false,
                })
                .eq('ride_id', groupId)

              if (updateError) {
                console.error(
                  'Error updating matches when removing rider:',
                  updateError,
                )
              } else {
                newUberType = uberType
              }
            }
          }
        }

        // Update local state - remove from group and add to unmatched, and track changes
        setGroups((prev) => {
          const updatedGroups = prev.map((g) => {
            if (g.ride_id === groupId) {
              const remainingRiders = g.riders.filter(
                (r) => r.flight_id !== rider.flight_id,
              )
              // Recalculate time range if there are remaining riders
              const newTimeRange =
                remainingRiders.length > 0
                  ? calculateGroupTimeRange(remainingRiders)
                  : g.time_range
              const midpointTime =
                remainingRiders.length > 0
                  ? calculateTimeMidpoint(newTimeRange)
                  : g.match_time
              const formattedTime =
                remainingRiders.length > 0 && midpointTime
                  ? midpointTime.includes(':') &&
                    midpointTime.split(':').length === 2
                    ? `${midpointTime}:00`
                    : midpointTime
                  : g.match_time

              return {
                ...g,
                riders: remainingRiders,
                time_range: newTimeRange,
                match_time: formattedTime,
                uber_type: newUberType !== null ? newUberType : g.uber_type, // Update uber_type if calculated
              }
            }
            return g
          })
          const updatedGroup = updatedGroups.find((g) => g.ride_id === groupId)

          return updatedGroups
        })

        // Track this as a changed group
        setGroups((prevGroups) => {
          const updatedGroup = prevGroups.find((g) => g.ride_id === groupId)
          if (updatedGroup) {
            setChangedGroups((prevChanged) => {
              const existing = prevChanged.find(
                (cg) => cg.group.ride_id === groupId,
              )
              if (existing) {
                // Merge new change description with existing ones
                const newDescription = getChangeDescription('REMOVE_FROM_GROUP')
                const existingDescriptions = existing.changeDescriptions || []
                const updatedDescriptions = consolidateChangeDescriptions([
                  ...existingDescriptions,
                  newDescription,
                ])
                return prevChanged.map((cg) =>
                  cg.group.ride_id === groupId
                    ? {
                        ...cg,
                        group: updatedGroup, // Update with latest group data
                        changedAt: new Date().toISOString(),
                        emailsSent: false,
                        changeDescriptions: updatedDescriptions,
                      }
                    : cg,
                )
              }
              return [
                ...prevChanged,
                {
                  group: updatedGroup,
                  changeType: 'modified',
                  changedAt: new Date().toISOString(),
                  emailsSent: false,
                  changeDescriptions: [
                    getChangeDescription('REMOVE_FROM_GROUP'),
                  ],
                },
              ]
            })
          }
          return prevGroups
        })

        setUnmatchedRiders((prev) => [...prev, rider])

        // Track this individual as unmatched
        setUnmatchedIndividuals((prev) => {
          const existing = prev.find(
            (ui) => ui.rider.flight_id === rider.flight_id,
          )
          if (!existing) {
            return [
              ...prev,
              {
                rider,
                becameUnmatchedAt: new Date().toISOString(),
                emailSent: false,
              },
            ]
          }
          return prev
        })

        // Log to ChangeLog
        // Note: target_group_id expects UUID, but ride_id is a number
        // Storing ride_id in metadata instead
        // Log the group change - this tracks that the group was modified
        await logToChangeLog(
          'REMOVE_FROM_GROUP',
          {
            from_group: groupId,
            to: 'unmatched',
            ride_id: groupId, // Store as number in metadata
            rider_name: rider.name,
            rider_user_id: rider.user_id,
            rider_flight_id: rider.flight_id,
            flight_id: rider.flight_id,
            date: rider.date,
          },
          groupId, // Set target_group_id to the group that was changed
          rider.user_id,
        )
      } catch (error) {
        console.error('Error removing rider from group to unmatched:', error)
        setErrorMessage('Failed to remove rider from group')
        setTimeout(() => setErrorMessage(null), 3000)
      }
    },
    [
      groups,
      supabase,
      logToChangeLog,
      isGroupSubsidized,
      calculateGroupTimeRange,
      calculateTimeMidpoint,
    ],
  )

  const handleRemoveFromCorral = useCallback((rider: Rider) => {
    // Remove from corral
    setCorralRiders((prev) =>
      prev.filter((r) => r.flight_id !== rider.flight_id),
    )

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

  const handleRemoveFromCorralToUnmatched = useCallback(
    async (rider: Rider) => {
      // If rider came from a group, remove the match from database
      if (rider.originType === 'group' && rider.originGroupId) {
        try {
          // Delete the match from database
          const { error: deleteError } = await supabase
            .from('Matches')
            .delete()
            .eq('ride_id', rider.originGroupId)
            .eq('user_id', rider.user_id)

          if (deleteError) {
            console.error('Error removing match from database:', deleteError)
          }

          // Update Flights table to mark as unmatched
          const { error: flightsError } = await supabase
            .from('Flights')
            .update({ matched: false })
            .eq('flight_id', rider.flight_id)

          if (flightsError) {
            console.error('Error updating flight:', flightsError)
          }

          // Update local state - remove from group and recalculate time range
          setGroups((prev) =>
            prev.map((g) => {
              if (g.ride_id === rider.originGroupId) {
                const remainingRiders = g.riders.filter(
                  (r) => r.flight_id !== rider.flight_id,
                )
                // Recalculate time range if there are remaining riders
                const newTimeRange =
                  remainingRiders.length > 0
                    ? calculateGroupTimeRange(remainingRiders)
                    : g.time_range
                const midpointTime =
                  remainingRiders.length > 0
                    ? calculateTimeMidpoint(newTimeRange)
                    : g.match_time
                const formattedTime =
                  remainingRiders.length > 0 && midpointTime
                    ? midpointTime.includes(':') &&
                      midpointTime.split(':').length === 2
                      ? `${midpointTime}:00`
                      : midpointTime
                    : g.match_time

                // Update all matches in the group with new time
                if (remainingRiders.length > 0 && formattedTime) {
                  supabase
                    .from('Matches')
                    .update({
                      time: formattedTime,
                      is_verified: false,
                    })
                    .eq('ride_id', rider.originGroupId)
                    .then(({ error }) => {
                      if (error) {
                        console.error(
                          'Error updating group matches time:',
                          error,
                        )
                      }
                    })
                }

                return {
                  ...g,
                  riders: remainingRiders,
                  time_range: newTimeRange,
                  match_time: formattedTime,
                }
              }
              return g
            }),
          )
        } catch (error) {
          console.error('Error removing rider from group:', error)
        }
      }

      // Remove from corral and add to unmatched
      setCorralRiders((prev) =>
        prev.filter((r) => r.flight_id !== rider.flight_id),
      )
      // Clear originType and originGroupId since rider is now truly unmatched
      const unmatchedRider = {
        ...rider,
        originType: undefined,
        originGroupId: undefined,
      }
      setUnmatchedRiders((prev) => [...prev, unmatchedRider])
    },
    [supabase, calculateGroupTimeRange, calculateTimeMidpoint],
  )

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
    async (
      rider: Rider,
      group: Group,
      skipValidation = false,
      explicitSourceGroupId?: number,
      customTime?: string,
      customDate?: string,
    ) => {
      // Check for validation errors that require acknowledgment (unless skipping)
      console.log('[handleSelectFromCorral] Starting validation check', {
        skipValidation,
        riderName: rider.name,
        groupId: group.ride_id,
        currentGroupSize: group.riders.length,
      })

      if (!skipValidation) {
        console.log('[handleSelectFromCorral] Running validation checks...')
        const timeCompatible = validateTimeCompatibility(group, rider)
        console.log(
          '[handleSelectFromCorral] Time compatibility result:',
          timeCompatible,
        )

        const updatedRiders = [...group.riders, rider]
        const newRiderCount = updatedRiders.length
        console.log(
          '[handleSelectFromCorral] New rider count after adding:',
          newRiderCount,
        )

        // Calculate bag units manually to avoid dependency issues
        let numLargeBags = 0
        let numNormalBags = 0
        for (const r of updatedRiders) {
          numLargeBags += r.checked_bags
          numNormalBags += r.carry_on_bags
        }
        const bagUnits = numLargeBags * 2 + numNormalBags
        console.log('[handleSelectFromCorral] Bag calculation:', {
          numLargeBags,
          numNormalBags,
          bagUnits,
        })

        // Check if bags would exceed 10 for 4+ members
        const bagsExceedLimit = newRiderCount >= 4 && bagUnits > 10
        console.log('[handleSelectFromCorral] Bag limit check:', {
          newRiderCount,
          is4OrMore: newRiderCount >= 4,
          bagUnits,
          exceeds10: bagUnits > 10,
          bagsExceedLimit,
        })

        console.log('[handleSelectFromCorral] Validation results:', {
          timeCompatible,
          bagsExceedLimit,
          shouldShowModal: !timeCompatible || bagsExceedLimit,
        })

        // Determine which issue(s) we have (prioritize time if both)
        if (!timeCompatible || bagsExceedLimit) {
          const issue = !timeCompatible ? 'time' : 'bags'
          console.log(
            '[handleSelectFromCorral] Validation failed! Showing modal with issue:',
            issue,
          )

          console.log(
            '[handleSelectFromCorral] Setting validationErrorModal state...',
          )
          setValidationErrorModal({
            rider,
            group,
            issue,
            onAcknowledge: async () => {
              // Log IGNORE_ERROR to ChangeLog
              await logToChangeLog(
                'IGNORE_ERROR',
                {
                  ride_id: group.ride_id,
                  rider_name: rider.name,
                  rider_user_id: rider.user_id,
                  rider_flight_id: rider.flight_id,
                  issue: issue,
                  time_compatible: timeCompatible,
                  bags_exceed_limit: bagsExceedLimit,
                  bag_units: bagUnits,
                  new_rider_count: newRiderCount,
                },
                group.ride_id,
                rider.user_id,
                false,
              )

              setValidationErrorModal(null)
              // Recursively call handleSelectFromCorral to proceed with addition
              await handleSelectFromCorral(
                rider,
                group,
                true, // Skip validation (already acknowledged)
                explicitSourceGroupId,
                customTime,
                customDate,
              )
            },
            onCancel: () => {
              setValidationErrorModal(null)
              setCorralSelectionMode(null)
            },
          })
          return
        }
      }

      // Determine source (corral, unmatched, or direct from group) - DON'T remove from corral yet
      const corralRider = corralRiders.find(
        (r) => r.flight_id === rider.flight_id,
      )
      const isFromCorral = !!corralRider

      // If explicitSourceGroupId is provided, use it (direct drag from group)
      // Otherwise, use the originGroupId from corral rider
      const sourceGroupId = explicitSourceGroupId || corralRider?.originGroupId
      const source = explicitSourceGroupId
        ? 'group'
        : isFromCorral
          ? 'corral'
          : 'unmatched'

      try {
        // Calculate bag units and uber_type for the updated group
        const updatedRiders = [...group.riders, rider]
        const bagUnits = calculateBagUnits(updatedRiders)
        const uberType = determineUberType(updatedRiders.length, bagUnits) // Always returns a string (defaults to 'XXL*' for invalid)

        console.log('[handleSelectFromCorral] Calculated values', {
          bagUnits,
          uberType,
          updatedRidersCount: updatedRiders.length,
        })

        // Use custom time/date if provided, otherwise calculate from overlap
        let formattedTime: string
        let finalDate: string
        let newTimeRange: string

        if (customTime && customDate) {
          // Use custom time/date provided by user
          formattedTime =
            customTime.includes(':') && customTime.split(':').length === 2
              ? `${customTime}:00`
              : customTime
          finalDate = customDate
          // For custom time, we still need a time range - use the custom time as both start and end
          // Or calculate from the group's existing time range
          newTimeRange = calculateGroupTimeRange(updatedRiders)
        } else {
          // Calculate new time range overlap for the group
          newTimeRange = calculateGroupTimeRange(updatedRiders)

          // Calculate midpoint of the overlap
          const midpointTime = calculateTimeMidpoint(newTimeRange)

          // Format time to HH:MM:SS
          formattedTime =
            midpointTime.includes(':') && midpointTime.split(':').length === 2
              ? `${midpointTime}:00`
              : midpointTime
          finalDate = group.date
        }

        // uberType will always be a string now (defaults to 'XXL*' for invalid combinations)
        // No need to check for null/undefined

        // Delete any existing matches for this rider (from any group)
        // This ensures we don't have duplicates when moving between groups
        // We delete by user_id and flight_id to catch all possible matches
        const { error: deleteMatchError, data: deletedMatches } = await supabase
          .from('Matches')
          .delete()
          .eq('user_id', rider.user_id)
          .eq('flight_id', rider.flight_id)
          .select()

        if (deleteMatchError) {
          console.error(
            'Error deleting existing matches for rider:',
            deleteMatchError,
          )
          setErrorMessage('Failed to remove rider from original group')
          setCorralSelectionMode(null)
          setTimeout(() => setErrorMessage(null), 3000)
          // Restore corral rider if error
          if (isFromCorral) {
            setCorralRiders((prev) => [...prev, corralRider!])
          }
          return
        }

        if (deletedMatches && deletedMatches.length > 0) {
          console.log(
            `[handleSelectFromCorral] Deleted ${deletedMatches.length} existing match(es) for rider ${rider.name} (flight_id: ${rider.flight_id})`,
          )
        }

        // Check if a match already exists for this rider in the destination group
        // This can happen if the deletion didn't work or if there's a race condition
        const { data: existingMatch } = await supabase
          .from('Matches')
          .select('ride_id, user_id, flight_id')
          .eq('user_id', rider.user_id)
          .eq('flight_id', rider.flight_id)
          .eq('ride_id', group.ride_id)
          .maybeSingle()

        const isSubsidized = isGroupSubsidized(
          group.airport,
          updatedRiders.length,
        )

        let matchError = null
        if (existingMatch) {
          // Match already exists in destination group - update it instead of inserting
          const { error: updateError } = await supabase
            .from('Matches')
            .update({
              date: finalDate,
              time: formattedTime,
              source: 'manual',
              voucher: group.group_voucher || '',
              contingency_voucher: null,
              is_verified: false,
              is_subsidized: isSubsidized,
              uber_type: uberType,
            })
            .eq('ride_id', group.ride_id)
            .eq('user_id', rider.user_id)
            .eq('flight_id', rider.flight_id)
          matchError = updateError
        } else {
          // Insert new Match row
          const { error: insertError } = await supabase.from('Matches').insert({
            ride_id: group.ride_id,
            user_id: rider.user_id,
            flight_id: rider.flight_id,
            date: finalDate,
            time: formattedTime,
            source: 'manual',
            voucher: group.group_voucher || '',
            contingency_voucher: null,
            is_verified: false,
            is_subsidized: isSubsidized,
            uber_type: uberType,
          })
          matchError = insertError
        }

        if (matchError) {
          console.error('Error adding rider to group:', matchError)
          setErrorMessage('Failed to add rider to group')
          setCorralSelectionMode(null)
          setTimeout(() => setErrorMessage(null), 3000)
          // Rider was never removed from corral, so no need to restore
          return
        }

        // Only remove from corral AFTER successful database operations
        if (isFromCorral && corralRider) {
          setCorralRiders((prev) =>
            prev.filter((r) => r.flight_id !== rider.flight_id),
          )
        }

        // Update all existing matches in the group with the new time, uber_type, is_subsidized, and set is_verified to false
        const { error: updateMatchesError } = await supabase
          .from('Matches')
          .update({
            time: formattedTime,
            uber_type: uberType,
            is_subsidized: isSubsidized,
            is_verified: false,
          })
          .eq('ride_id', group.ride_id)

        if (updateMatchesError) {
          console.error('Error updating existing matches:', updateMatchesError)
        }

        // Update Flights table to mark as matched (if not already)
        const { error: flightsError } = await supabase
          .from('Flights')
          .update({ matched: true })
          .eq('flight_id', rider.flight_id)

        if (flightsError) {
          console.error('Error updating flight:', flightsError)
        }

        // Auto-confirm unmatched individual change if rider was previously unmatched
        // Check if there's an unconfirmed ChangeLog entry for this flight_id where they were removed to unmatched
        const { data: unmatchedChangeLogs } = await supabase
          .from('ChangeLog')
          .select('id, metadata')
          .eq('confirmed', false)
          .eq('action', 'REMOVE_FROM_GROUP')
          .eq('target_user_id', rider.user_id)

        if (unmatchedChangeLogs && unmatchedChangeLogs.length > 0) {
          // Filter to find entries where metadata.to === 'unmatched' and metadata.rider_flight_id matches
          const matchingLogs = unmatchedChangeLogs.filter((log: any) => {
            const metadata = log.metadata || {}
            return (
              metadata.to === 'unmatched' &&
              (metadata.rider_flight_id === rider.flight_id ||
                metadata.flight_id === rider.flight_id)
            )
          })

          if (matchingLogs.length > 0) {
            // Mark all matching unconfirmed change logs as confirmed
            const changeLogIds = matchingLogs.map((log: any) => log.id)
            await supabase
              .from('ChangeLog')
              .update({ confirmed: true })
              .in('id', changeLogIds)

            // Remove from unmatched individuals state if present
            setUnmatchedIndividuals((prev) =>
              prev.filter((ui) => ui.rider.flight_id !== rider.flight_id),
            )
          }
        }

        // Update local state and track changes
        setGroups((prev) => {
          const updatedGroups = prev.map((g) => {
            // Update destination group
            if (g.ride_id === group.ride_id) {
              return {
                ...g,
                riders: [...g.riders, rider],
                time_range: newTimeRange, // Update time range
                match_time: formattedTime, // Update match time
                uber_type: uberType, // Update uber_type in local state
              }
            }
            // If rider came from another group, update source group (match already deleted above)
            if (sourceGroupId && g.ride_id === sourceGroupId) {
              // Calculate new uber_type for source group after removing rider
              const remainingRiders = g.riders.filter(
                (r) => r.flight_id !== rider.flight_id,
              )
              if (remainingRiders.length > 0) {
                const bagUnits = calculateBagUnits(remainingRiders)
                const newUberType = determineUberType(
                  remainingRiders.length,
                  bagUnits,
                )
                // Recalculate time range and midpoint for source group
                const newSourceTimeRange =
                  calculateGroupTimeRange(remainingRiders)
                const sourceMidpointTime =
                  calculateTimeMidpoint(newSourceTimeRange)
                const formattedSourceTime =
                  sourceMidpointTime.includes(':') &&
                  sourceMidpointTime.split(':').length === 2
                    ? `${sourceMidpointTime}:00`
                    : sourceMidpointTime

                // Update all matches in source group with new time
                supabase
                  .from('Matches')
                  .update({
                    time: formattedSourceTime,
                    uber_type: newUberType || g.uber_type,
                    is_verified: false,
                  })
                  .eq('ride_id', sourceGroupId)
                  .then(({ error }) => {
                    if (error) {
                      console.error(
                        'Error updating source group matches:',
                        error,
                      )
                    }
                  })

                return {
                  ...g,
                  riders: remainingRiders,
                  time_range: newSourceTimeRange,
                  match_time: formattedSourceTime,
                  uber_type: newUberType || g.uber_type,
                }
              }
            }
            return g
          })
          const updatedGroup = updatedGroups.find(
            (g) => g.ride_id === group.ride_id,
          )
          const updatedSourceGroup = sourceGroupId
            ? updatedGroups.find((g) => g.ride_id === sourceGroupId)
            : null

          return updatedGroups
        })

        // Track destination group as changed
        setGroups((prevGroups) => {
          const updatedGroup = prevGroups.find(
            (g) => g.ride_id === group.ride_id,
          )
          if (updatedGroup) {
            setChangedGroups((prevChanged) => {
              const existing = prevChanged.find(
                (cg) => cg.group.ride_id === group.ride_id,
              )
              if (existing) {
                // Merge new change description with existing ones
                const newDescription = getChangeDescription('ADD_TO_GROUP')
                const existingDescriptions = existing.changeDescriptions || []
                const updatedDescriptions = consolidateChangeDescriptions([
                  ...existingDescriptions,
                  newDescription,
                ])
                return prevChanged.map((cg) =>
                  cg.group.ride_id === group.ride_id
                    ? {
                        ...cg,
                        group: updatedGroup, // Update with latest group data
                        changedAt: new Date().toISOString(),
                        emailsSent: false,
                        changeDescriptions: updatedDescriptions,
                      }
                    : cg,
                )
              }
              return [
                ...prevChanged,
                {
                  group: updatedGroup,
                  changeType: 'modified',
                  changedAt: new Date().toISOString(),
                  emailsSent: false,
                  changeDescriptions: [getChangeDescription('ADD_TO_GROUP')],
                },
              ]
            })
          }
          return prevGroups
        })

        // Track source group as changed (if rider came from another group)
        if (sourceGroupId) {
          setGroups((prevGroups) => {
            const updatedSourceGroup = prevGroups.find(
              (g) => g.ride_id === sourceGroupId,
            )
            if (updatedSourceGroup) {
              setChangedGroups((prevChanged) => {
                const existing = prevChanged.find(
                  (cg) => cg.group.ride_id === sourceGroupId,
                )
                if (existing) {
                  // Merge new change description with existing ones
                  const newDescription =
                    getChangeDescription('REMOVE_FROM_GROUP')
                  const existingDescriptions = existing.changeDescriptions || []
                  const updatedDescriptions = consolidateChangeDescriptions([
                    ...existingDescriptions,
                    newDescription,
                  ])
                  return prevChanged.map((cg) =>
                    cg.group.ride_id === sourceGroupId
                      ? {
                          ...cg,
                          group: updatedSourceGroup, // Update with latest group data
                          changedAt: new Date().toISOString(),
                          emailsSent: false,
                          changeDescriptions: updatedDescriptions,
                        }
                      : cg,
                  )
                }
                return [
                  ...prevChanged,
                  {
                    group: updatedSourceGroup,
                    changeType: 'modified',
                    changedAt: new Date().toISOString(),
                    emailsSent: false,
                    changeDescriptions: [
                      getChangeDescription('REMOVE_FROM_GROUP'),
                    ],
                  },
                ]
              })
            }
            return prevGroups
          })
        }

        // Log to ChangeLog
        // If rider came from another group, log REMOVE_FROM_GROUP first
        if (sourceGroupId) {
          await logToChangeLog(
            'REMOVE_FROM_GROUP',
            {
              from_group: sourceGroupId,
              to: 'corral', // Even if direct drag, we track it as going through corral conceptually
              ride_id: sourceGroupId, // Store as number in metadata
              rider_name: rider.name,
              rider_user_id: rider.user_id,
              rider_flight_id: rider.flight_id,
              flight_id: rider.flight_id,
            },
            sourceGroupId, // Set target_group_id to the source group that was changed
            rider.user_id,
          )
        }

        // Then log ADD_TO_GROUP for the destination group
        await logToChangeLog(
          'ADD_TO_GROUP',
          {
            from: source,
            to_group: group.ride_id,
            from_group: sourceGroupId, // Include source group if coming from another group
            ride_id: group.ride_id, // Store as number in metadata
            rider_name: rider.name,
            rider_user_id: rider.user_id,
            rider_flight_id: rider.flight_id,
          },
          group.ride_id, // Set target_group_id to the group that was changed
          rider.user_id,
        )

        // Clear selection mode
        setCorralSelectionMode(null)
        setErrorMessage(null)
      } catch (error) {
        console.error('Error adding rider from corral to group:', error)
        setErrorMessage('Failed to add rider to group')
        setCorralSelectionMode(null)
        setTimeout(() => setErrorMessage(null), 3000)
      }
    },
    [
      validateTimeCompatibility,
      logToChangeLog,
      supabase,
      corralRiders,
      isGroupSubsidized,
      calculateGroupTimeRange,
      calculateTimeMidpoint,
    ],
  )

  const isDatePassed = useCallback((dateString: string) => {
    const groupDate = new Date(dateString)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return groupDate < today
  }, [])

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
  const formatTime = (timeStr: string): string => {
    // timeStr can be "HH:MM:SS" or "HH:MM" format
    const [hours, minutes] = timeStr.split(':').map(Number)
    // Convert 24-hour to 12-hour format
    const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
    const ampm = hours < 12 ? 'AM' : 'PM'
    const minStr = minutes ? `:${minutes.toString().padStart(2, '0')}` : ''
    return `${hour12}${minStr} ${ampm}`
  }

  const formatTimeRange = (timeRange: string): string => {
    // timeRange is in format "HH:MM - HH:MM" (24-hour format)
    const [startTime, endTime] = timeRange.split(' - ').map((t) => t.trim())
    if (!startTime || !endTime) return timeRange

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
  // Returns 'XXL*' for invalid combinations (default fallback)
  const determineUberType = (groupSize: number, bagUnits: number): string => {
    // Max bag units: 12 for < 3 people, 10 for >= 3 people
    const maxBagUnits = groupSize >= 3 ? 10 : 12
    if (bagUnits > maxBagUnits) return 'XXL*' // Hard limit exceeded, default to XXL*

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

    // Invalid combination - default to XXL*
    return 'XXL*'
  }

  // Create new group in database
  const createNewGroup = async () => {
    console.log('=== Starting createNewGroup ===')
    console.log('Initial state:', {
      selectedRidersCount: selectedRidersForNewGroup.length,
      newGroupDate,
      newGroupTime,
      newGroupVoucher,
      isSubsidized,
      selectedRiders: selectedRidersForNewGroup.map((r) => ({
        name: r.name,
        user_id: r.user_id,
        flight_id: r.flight_id,
        airport: r.airport,
      })),
    })

    if (
      selectedRidersForNewGroup.length < 2 ||
      selectedRidersForNewGroup.length > 6
    ) {
      console.warn(
        'Validation failed: Group must have 2-6 riders, got:',
        selectedRidersForNewGroup.length,
      )
      setErrorMessage('Group must have 2-6 riders')
      setTimeout(() => setErrorMessage(null), 3000)
      return
    }

    if (!newGroupDate) {
      console.warn('Validation failed: Date is required', {
        newGroupDate,
      })
      setErrorMessage('Date is required')
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
      ) // Always returns a string (defaults to 'XXL*' for invalid combinations)

      // No need to check for null/undefined - uberType will always be a string

      // Calculate time range overlap from selected riders
      const calculatedTimeRange = calculateGroupTimeRange(
        selectedRidersForNewGroup,
      )
      const midpointTime = calculateTimeMidpoint(calculatedTimeRange)

      // Format time to HH:MM:SS (database expects seconds)
      const formattedTime =
        midpointTime.includes(':') && midpointTime.split(':').length === 2
          ? `${midpointTime}:00`
          : midpointTime

      // Format date for database (YYYY-MM-DD)
      const rideDate = new Date(newGroupDate).toISOString().split('T')[0]
      console.log('Creating new group:', {
        rideDate,
        riderCount: selectedRidersForNewGroup.length,
        riders: selectedRidersForNewGroup.map((r) => ({
          name: r.name,
          flight_id: r.flight_id,
          airport: r.airport,
        })),
        newGroupDate,
        calculatedTimeRange,
        midpointTime: formattedTime,
      })

      // Step 1: Create Rides row and get ride_id
      // Check authentication status
      const {
        data: { user: currentUser },
        error: authError,
      } = await supabase.auth.getUser()
      console.log('Step 1: Client-side authentication check:', {
        isAuthenticated: !!currentUser,
        userId: currentUser?.id,
        email: currentUser?.email,
        authError,
      })

      // Note: auth.uid() and auth.role() are only available in database context (RLS policies, functions)
      // To check these, run in Supabase SQL Editor while logged in as the same user:
      // SELECT auth.uid(), auth.role();
      // Expected: auth.role() should return 'authenticated'
      console.log('Step 1: Database auth context (from client perspective):', {
        clientUserId: currentUser?.id,
        expectedAuthRole: 'authenticated',
        note: 'To verify auth.uid() and auth.role() in database context, run: SELECT auth.uid(), auth.role(); in Supabase SQL Editor',
      })

      console.log(
        'Step 1: Inserting into Rides table with ride_date:',
        rideDate,
      )
      console.log(
        'Step 1: Purpose - Creating a group container. This ride_id will link all Matches for this group together.',
      )
      const { data: rideData, error: rideError } = await supabase
        .from('Rides')
        .insert({ ride_date: rideDate })
        .select('ride_id')
        .single()

      if (rideError || !rideData) {
        console.error('Error creating ride - Full error details:', {
          error: rideError,
          errorCode: rideError?.code,
          errorMessage: rideError?.message,
          errorDetails: rideError?.details,
          errorHint: rideError?.hint,
          rideData,
          rideDate,
        })
        const errorMessage = rideError?.message || 'Unknown error'
        const errorDetails = rideError?.details || rideError?.hint || ''
        setErrorMessage(
          `Failed to create ride: ${errorMessage}${errorDetails ? ` (${errorDetails})` : ''}`,
        )
        setTimeout(() => setErrorMessage(null), 5000)
        setIsCreatingGroup(false)
        return
      }

      console.log(
        'Step 1: Successfully created ride with ride_id:',
        rideData.ride_id,
      )

      const rideId = rideData.ride_id

      // Calculate is_subsidized based on airport and rider count
      // All riders in a group should have the same airport
      const groupAirport = selectedRidersForNewGroup[0]?.airport || 'LAX'
      const calculatedIsSubsidized = isGroupSubsidized(
        groupAirport,
        selectedRidersForNewGroup.length,
      )

      // Step 2: Create Matches rows for each rider
      // Parse contingency vouchers (comma-separated list)
      const contingencyVouchers = newGroupContingencyVoucher
        ? newGroupContingencyVoucher
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean)
        : []

      console.log('Step 2: Preparing matches to insert:', {
        rideId,
        matchCount: selectedRidersForNewGroup.length,
        groupAirport,
        calculatedIsSubsidized,
        uberType,
        formattedTime,
        contingencyVouchersCount: contingencyVouchers.length,
      })
      // Normalize voucher URL: if it doesn't start with https://r.uber.com/, prepend it
      let normalizedNewGroupVoucher = newGroupVoucher.trim()
      if (normalizedNewGroupVoucher && calculatedIsSubsidized) {
        const uberVoucherPrefix = 'https://r.uber.com/'
        if (!normalizedNewGroupVoucher.startsWith(uberVoucherPrefix)) {
          // Remove any leading slashes from the voucher code
          const voucherCode = normalizedNewGroupVoucher.replace(/^\/+/, '')
          normalizedNewGroupVoucher = `${uberVoucherPrefix}${voucherCode}`
        }
      }

      const matchesToInsert = selectedRidersForNewGroup.map((rider, index) => ({
        ride_id: rideId,
        user_id: rider.user_id,
        flight_id: rider.flight_id,
        date: rideDate,
        time: formattedTime,
        source: 'manual', // Admin-created groups
        voucher: calculatedIsSubsidized ? normalizedNewGroupVoucher || '' : '',
        contingency_voucher: contingencyVouchers[index] || null, // Assign voucher by index
        is_verified: false,
        is_subsidized: calculatedIsSubsidized,
        uber_type: uberType,
      }))

      console.log(
        'Step 2: Inserting matches:',
        matchesToInsert.map((m) => ({
          ride_id: m.ride_id,
          user_id: m.user_id,
          flight_id: m.flight_id,
          date: m.date,
          time: m.time,
          is_subsidized: m.is_subsidized,
          uber_type: m.uber_type,
        })),
      )

      const { error: matchesError } = await supabase
        .from('Matches')
        .insert(matchesToInsert)

      if (matchesError) {
        console.error('Error creating matches - Full error details:', {
          error: matchesError,
          errorCode: matchesError?.code,
          errorMessage: matchesError?.message,
          errorDetails: matchesError?.details,
          errorHint: matchesError?.hint,
          matchesToInsert: matchesToInsert.map((m) => ({
            ride_id: m.ride_id,
            user_id: m.user_id,
            flight_id: m.flight_id,
          })),
        })
        const errorMessage = matchesError?.message || 'Unknown error'
        const errorDetails = matchesError?.details || matchesError?.hint || ''
        setErrorMessage(
          `Failed to create matches: ${errorMessage}${errorDetails ? ` (${errorDetails})` : ''}`,
        )
        setTimeout(() => setErrorMessage(null), 5000)
        setIsCreatingGroup(false)
        return
      }

      console.log('Step 2: Successfully created matches')

      // Step 3: Update Flights table to mark as matched
      const flightIds = selectedRidersForNewGroup.map((r) => r.flight_id)
      console.log('Step 3: Updating flights to matched:', { flightIds })
      const { error: flightsError } = await supabase
        .from('Flights')
        .update({ matched: true })
        .in('flight_id', flightIds)

      if (flightsError) {
        console.error('Error updating flights - Full error details:', {
          error: flightsError,
          errorCode: flightsError?.code,
          errorMessage: flightsError?.message,
          errorDetails: flightsError?.details,
          errorHint: flightsError?.hint,
          flightIds,
        })
        // Don't fail the whole operation, just log it
      } else {
        console.log('Step 3: Successfully updated flights to matched')
      }

      // Auto-confirm unmatched individual changes for riders who were previously unmatched
      // Check for unconfirmed ChangeLog entries where these riders were removed to unmatched
      for (const rider of selectedRidersForNewGroup) {
        const { data: unmatchedChangeLogs } = await supabase
          .from('ChangeLog')
          .select('id, metadata')
          .eq('confirmed', false)
          .eq('action', 'REMOVE_FROM_GROUP')
          .eq('target_user_id', rider.user_id)

        if (unmatchedChangeLogs && unmatchedChangeLogs.length > 0) {
          // Filter to find entries where metadata.to === 'unmatched' and metadata.rider_flight_id matches
          const matchingLogs = unmatchedChangeLogs.filter((log: any) => {
            const metadata = log.metadata || {}
            return (
              metadata.to === 'unmatched' &&
              (metadata.rider_flight_id === rider.flight_id ||
                metadata.flight_id === rider.flight_id)
            )
          })

          if (matchingLogs.length > 0) {
            // Mark all matching unconfirmed change logs as confirmed
            const changeLogIds = matchingLogs.map((log: any) => log.id)
            await supabase
              .from('ChangeLog')
              .update({ confirmed: true })
              .in('id', changeLogIds)

            // Remove from unmatched individuals state if present
            setUnmatchedIndividuals((prev) =>
              prev.filter((ui) => ui.rider.flight_id !== rider.flight_id),
            )
          }
        }
      }

      // Log to ChangeLog
      await logToChangeLog(
        'CREATE_GROUP',
        {
          ride_id: rideId, // Store as number in metadata
          rider_count: selectedRidersForNewGroup.length,
          rider_names: selectedRidersForNewGroup.map((r) => r.name),
          rider_user_ids: selectedRidersForNewGroup.map((r) => r.user_id),
          date: rideDate,
          time: formattedTime,
          uber_type: uberType,
          is_subsidized: calculatedIsSubsidized,
        },
        rideId, // Set target_group_id to the group that was created
      )

      console.log('Group creation completed successfully:', {
        rideId,
        riderCount: selectedRidersForNewGroup.length,
        groupAirport,
        calculatedIsSubsidized,
        uberType,
      })

      // Remove riders from corral immediately to prevent duplicates
      const selectedFlightIds = new Set(
        selectedRidersForNewGroup.map((r) => r.flight_id),
      )
      setCorralRiders((prev) =>
        prev.filter((r) => !selectedFlightIds.has(r.flight_id)),
      )

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
    if (
      selectedRidersForNewGroup.some((r) => r.flight_id === rider.flight_id)
    ) {
      return // Already selected
    }
    setSelectedRidersForNewGroup((prev) => [...prev, rider])

    // Visual feedback: Add to recently added set for animation (use flight_id as string)
    setRecentlyAddedToNewGroup((prev) =>
      new Set(prev).add(String(rider.flight_id)),
    )
    // Clear animation after 1 second
    setTimeout(() => {
      setRecentlyAddedToNewGroup((prev) => {
        const newSet = new Set(prev)
        newSet.delete(String(rider.flight_id))
        return newSet
      })
    }, 1000)

    // On desktop, open the Create new group section
    if (window.innerWidth >= 768) {
      if (filtersCollapsed) {
        setFiltersCollapsed(false)
      }
      if (leftSidebarTabs.includes('createGroup')) {
        setActiveLeftTab('createGroup')
      }
      setNewGroupSectionExpanded(true)
    }

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
        if (dateRangeStart || dateRangeEnd) {
          const groupDate = new Date(group.date)
          groupDate.setHours(0, 0, 0, 0)

          if (dateRangeStart) {
            const startDate = new Date(dateRangeStart)
            startDate.setHours(0, 0, 0, 0)
            if (groupDate < startDate) {
              return false
            }
          }

          if (dateRangeEnd) {
            const endDate = new Date(dateRangeEnd)
            endDate.setHours(23, 59, 59, 999)
            if (groupDate > endDate) {
              return false
            }
          }
        }

        // Time range filter (optional)
        if (timeRangeStart && timeRangeEnd) {
          const calculatedTimeRange = calculateGroupTimeRange(group.riders)
          const groupTimeRange = calculatedTimeRange.split(' - ')
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
        const isSubsidized = isGroupSubsidized(group.airport, riderCount)
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
          const trimmedQuery = searchQuery.trim()
          const isRideIdSearch = trimmedQuery.startsWith('#')
          const query = isRideIdSearch
            ? trimmedQuery.slice(1).toLowerCase().trim()
            : trimmedQuery.toLowerCase().trim()

          // If searching with # prefix, only search by ride_id
          if (isRideIdSearch) {
            const rideIdMatch = group.ride_id.toString().includes(query)
            if (!rideIdMatch) {
              return false
            }
          } else {
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
      calculateGroupTimeRange,
      isGroupSubsidized,
    ],
  )

  // Apply sorting to filtered groups
  const sortedGroups = useMemo(
    () =>
      [...filteredGroups].sort((a, b) => {
        // Default: prioritize non-past date groups over past date groups
        const dateA = new Date(a.date)
        const dateB = new Date(b.date)
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        dateA.setHours(0, 0, 0, 0)
        dateB.setHours(0, 0, 0, 0)

        const aIsPast = dateA < today
        const bIsPast = dateB < today

        // If one is past and the other isn't, non-past comes first
        if (aIsPast && !bIsPast) return 1
        if (!aIsPast && bIsPast) return -1

        // If both are past or both are not past, continue with user-defined sorting
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
        if (dateRangeStart || dateRangeEnd) {
          const riderDate = new Date(rider.date)
          riderDate.setHours(0, 0, 0, 0)

          if (dateRangeStart) {
            const startDate = new Date(dateRangeStart)
            startDate.setHours(0, 0, 0, 0)
            if (riderDate < startDate) {
              return false
            }
          }

          if (dateRangeEnd) {
            const endDate = new Date(dateRangeEnd)
            endDate.setHours(23, 59, 59, 999)
            if (riderDate > endDate) {
              return false
            }
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
  const sortedUnmatchedRiders = useMemo(() => {
    // First, separate past date and non-past date riders
    const nonPastDateRiders = filteredUnmatchedRiders.filter(
      (rider) => !isDatePassed(rider.date),
    )
    const pastDateRiders = filteredUnmatchedRiders.filter((rider) =>
      isDatePassed(rider.date),
    )

    // Sort each group separately, then combine (non-past first)
    return [...sortRiders(nonPastDateRiders), ...sortRiders(pastDateRiders)]
  }, [filteredUnmatchedRiders, sortRiders, isDatePassed])

  // Apply sorting to corral riders
  const sortedCorralRiders = useMemo(
    () => sortRiders(corralRiders),
    [corralRiders, sortRiders],
  )

  // Interface for formatted changelog entry parts
  interface FormattedChangeLogEntry {
    role: string
    actorName: string
    actionText: string
    personName: string | null
    groupId: string | null
    formattedDateTime: string
  }

  // Helper function to format changelog entry as human-readable text
  const formatChangeLogEntry = useCallback(
    (entry: ChangeLogEntry): FormattedChangeLogEntry => {
      const actorName = entry.actor_name || 'Unknown'
      const role = entry.actor_role || 'Admin'

      // Format date and time
      const date = new Date(entry.created_at)
      const formattedDateTime =
        date.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZone: 'America/Los_Angeles',
        }) + ' PT'

      // Extract person name from metadata or use target_user_id
      let personName: string | null = null
      if (entry.metadata?.rider_name) {
        personName = entry.metadata.rider_name
      } else if (entry.target_user_id) {
        // Try to find the user in our data
        const allRiders = [...unmatchedRiders, ...corralRiders]
        const groupRiders = groups.flatMap((g) => g.riders)
        const foundRider = [...allRiders, ...groupRiders].find(
          (r) => r.user_id === entry.target_user_id,
        )
        personName = foundRider?.name || null
      }

      // Extract group ID from metadata (ride_id) or target_group_id
      // For REMOVE_FROM_GROUP, prioritize from_group
      let groupId: string | null = null
      if (entry.action === 'REMOVE_FROM_GROUP' && entry.metadata?.from_group) {
        groupId = `#${entry.metadata.from_group}`
      } else if (entry.metadata?.ride_id) {
        groupId = `#${entry.metadata.ride_id}`
      } else if (entry.metadata?.to_group) {
        groupId = `#${entry.metadata.to_group}`
      } else if (entry.metadata?.from_group) {
        groupId = `#${entry.metadata.from_group}`
      } else if (entry.target_group_id) {
        groupId = `#${entry.target_group_id}`
      }

      // Format action based on type
      let actionText = ''
      switch (entry.action) {
        case 'ADD_TO_GROUP':
          const fromSource =
            entry.metadata?.from === 'unmatched' ? 'unmatched' : null
          if (personName && groupId) {
            actionText = `added user ${personName} to group ${groupId}${fromSource ? ` from ${fromSource}` : ''}`
          } else if (personName) {
            actionText = `added user ${personName} to a group${fromSource ? ` from ${fromSource}` : ''}`
          } else if (groupId) {
            actionText = `added a rider to group ${groupId}${fromSource ? ` from ${fromSource}` : ''}`
          } else {
            actionText = `added a rider to a group${fromSource ? ` from ${fromSource}` : ''}`
          }
          break
        case 'REMOVE_FROM_GROUP':
          // Check if this is actually an email confirmation (stored as REMOVE_FROM_GROUP with email_confirmed in metadata)
          if (
            entry.metadata?.email_confirmed === true ||
            entry.metadata?.email_confirmed === 'true'
          ) {
            // Individual email confirmation
            if (personName) {
              actionText = `confirmed email sent for unmatched individual ${personName}`
            } else {
              actionText = 'confirmed email sent for an unmatched individual'
            }
          } else if (entry.metadata?.to === 'corral') {
            if (personName && groupId) {
              actionText = `moved user ${personName} from group ${groupId} to corral`
            } else if (personName) {
              actionText = `moved user ${personName} to corral`
            } else {
              actionText = 'moved a rider to corral'
            }
          } else if (entry.metadata?.to === 'unmatched') {
            if (personName && groupId) {
              actionText = `removed user ${personName} from group ${groupId} and left them as unmatched`
            } else if (personName) {
              actionText = `removed user ${personName} from a group and left them as unmatched`
            } else {
              actionText =
                'removed a rider from a group and left them as unmatched'
            }
          } else {
            if (personName && groupId) {
              actionText = `removed user ${personName} from group ${groupId}`
            } else if (personName) {
              actionText = `removed user ${personName} from a group`
            } else {
              actionText = 'removed a rider from a group'
            }
          }
          break
        case 'CREATE_GROUP':
          if (groupId) {
            actionText = `created group ${groupId}`
          } else {
            actionText = 'created a new group'
          }
          break
        case 'DELETE_GROUP':
          if (groupId) {
            actionText = `deleted group ${groupId}`
          } else {
            actionText = 'deleted a group'
          }
          break
        case 'RUN_ALGORITHM':
          const target = entry.metadata?.target || 'all targets'
          const mode = entry.metadata?.mode || 'manual'
          actionText = `ran the matching algorithm for ${target} (${mode} mode)`
          break
        case 'IGNORE_ERROR':
          actionText = 'ignored an error'
          break
        case 'EMAIL_CONFIRMED':
          if (entry.metadata?.ride_id) {
            // Group email confirmation
            const riderCount = entry.metadata?.rider_count || 0
            const changeType = entry.metadata?.change_type || 'modified'
            actionText = `confirmed email sent for ${changeType} group ${groupId || `#${entry.metadata.ride_id}`} (${riderCount} rider${riderCount !== 1 ? 's' : ''})`
          } else if (personName) {
            // Individual email confirmation
            actionText = `confirmed email sent for unmatched individual ${personName}`
          } else {
            actionText = 'confirmed email sent'
          }
          break
        case 'UPDATE_GROUP_TIME':
          // Check if this is actually an email confirmation (stored as UPDATE_GROUP_TIME with email_confirmed in metadata)
          if (
            entry.metadata?.email_confirmed === true ||
            entry.metadata?.email_confirmed === 'true'
          ) {
            if (entry.metadata?.ride_id) {
              // Group email confirmation
              const riderCount = entry.metadata?.rider_count || 0
              const changeType = entry.metadata?.change_type || 'modified'
              actionText = `confirmed email sent for ${changeType} group ${groupId || `#${entry.metadata.ride_id}`} (${riderCount} rider${riderCount !== 1 ? 's' : ''})`
            } else {
              actionText = 'confirmed email sent for a group'
            }
          } else {
            // Regular time update
            if (groupId) {
              actionText = `updated time for group ${groupId}`
            } else {
              actionText = 'updated time for a group'
            }
          }
          break
        case 'UPDATE_VOUCHER':
          const voucher = entry.metadata?.voucher || ''
          const formattedVoucher = voucher ? formatVoucher(voucher) : ''
          if (groupId) {
            if (voucher) {
              actionText = `updated voucher for group ${groupId} to ${formattedVoucher}`
            } else {
              actionText = `removed voucher for group ${groupId}`
            }
          } else {
            if (voucher) {
              actionText = `updated voucher for a group to ${formattedVoucher}`
            } else {
              actionText = 'removed voucher for a group'
            }
          }
          break
      }

      return {
        role,
        actorName,
        actionText,
        personName,
        groupId,
        formattedDateTime,
      }
    },
    [unmatchedRiders, corralRiders, groups],
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
                key={`${rider.user_id}-${rider.flight_id}`}
                className="flex items-center justify-between rounded border border-gray-200 bg-gray-50 p-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {rider.name}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="inline-flex items-center justify-center rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-800">
                      {rider.to_airport ? 'TO' : 'FROM'} {rider.airport}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="group relative flex items-center gap-1">
                        <Luggage className="h-3 w-3 text-gray-600" />
                        <span className="text-xs text-gray-600">
                          {rider.checked_bags}
                        </span>
                        <div className="absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 transform whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white group-hover:block">
                          Checked Bags (2 Units Each)
                          <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                        </div>
                      </div>
                      <div className="group relative flex items-center gap-1">
                        <Briefcase className="h-3 w-3 text-gray-600" />
                        <span className="text-xs text-gray-600">
                          {rider.carry_on_bags}
                        </span>
                        <div className="absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 transform whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white group-hover:block">
                          Carry-On Bags (1 Unit Each)
                          <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{rider.date}</p>
                  <p className="text-xs text-gray-500">
                    {formatTimeRange(rider.time_range)}
                  </p>
                </div>
                <button
                  onClick={() =>
                    setSelectedRidersForNewGroup((prev) =>
                      prev.filter((r) => r.flight_id !== rider.flight_id),
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
        <div className="relative">
          <input
            type="date"
            value={newGroupDate}
            onChange={(e) => setNewGroupDate(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pr-10 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
            style={
              {
                WebkitAppearance: 'none',
              } as React.CSSProperties
            }
          />
          <button
            type="button"
            onClick={(e) => {
              const input = e.currentTarget
                .previousElementSibling as HTMLInputElement
              input?.showPicker?.()
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-teal-600"
            title="Open calendar"
          >
            <Calendar className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Time Input */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Time <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            type="time"
            value={newGroupTime}
            onChange={(e) => setNewGroupTime(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pr-10 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
            style={
              {
                WebkitAppearance: 'none',
              } as React.CSSProperties
            }
          />
          <button
            type="button"
            onClick={(e) => {
              const input = e.currentTarget
                .previousElementSibling as HTMLInputElement
              input?.showPicker?.()
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-teal-600"
            title="Open time picker"
          >
            <Clock className="h-4 w-4" />
          </button>
        </div>
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

      {/* Contingency Vouchers */}
      <div>
        <div className="mb-1 flex items-center gap-2">
          <label className="block text-sm font-medium text-gray-700">
            Contingency Vouchers (per rider)
          </label>
          <div className="group relative">
            <Info className="h-4 w-4 text-gray-400" />
            <div className="absolute bottom-full left-1/2 z-10 mb-2 hidden w-64 -translate-x-1/2 transform rounded bg-gray-900 px-3 py-2 text-xs text-white group-hover:block">
              Enter comma-separated vouchers (one per rider). Order should match
              selected riders. Example: &quot;VOUCHER1, VOUCHER2&quot;
              <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
            </div>
          </div>
        </div>
        <input
          type="text"
          value={newGroupContingencyVoucher}
          onChange={(e) => setNewGroupContingencyVoucher(e.target.value)}
          placeholder={`Optional (e.g., "VOUCHER1, VOUCHER2" for ${selectedRidersForNewGroup.length} riders)`}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
        />
        {selectedRidersForNewGroup.length > 0 && (
          <p className="mt-1 text-xs text-gray-500">
            {selectedRidersForNewGroup.length} rider
            {selectedRidersForNewGroup.length !== 1 ? 's' : ''} selected
          </p>
        )}
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
              <div className="relative w-full max-w-md">
                <input
                  type="text"
                  placeholder="Search by ride ID (#Num), name, flight, or voucher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 pr-20 text-sm text-gray-900 placeholder-gray-500 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
                <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-2">
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="flex items-center justify-center rounded p-0.5 text-red-500 transition-colors hover:bg-red-50 hover:text-red-600"
                      title="Clear search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  <div className="group">
                    <Info className="h-4 w-4 text-gray-400" />
                    <div className="absolute bottom-full right-0 mb-2 hidden w-64 rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-lg group-hover:block">
                      <p className="mb-1 font-semibold">Search Tips:</p>
                      <p className="mb-1">
                        • Use{' '}
                        <span className="font-mono font-semibold">
                          #[RideID Num]
                        </span>{' '}
                        to search by ride ID only
                      </p>
                      <p>
                        • Otherwise searches across names, flights, vouchers,
                        and ride IDs
                      </p>
                      <div className="absolute right-2 top-full h-0 w-0 border-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                </div>
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
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search by ride ID (#Num), name, flight, or voucher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 pr-20 text-sm text-gray-900 placeholder-gray-500 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
                <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-2">
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="flex items-center justify-center rounded p-0.5 text-red-500 transition-colors hover:bg-red-50 hover:text-red-600"
                      title="Clear search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  <div className="group">
                    <Info className="h-4 w-4 text-gray-400" />
                    <div className="absolute bottom-full right-0 mb-2 hidden w-64 rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-lg group-hover:block">
                      <p className="mb-1 font-semibold">Search Tips:</p>
                      <p className="mb-1">
                        • Use{' '}
                        <span className="font-mono font-semibold">
                          #[RideID Num]
                        </span>{' '}
                        to search by ride ID only
                      </p>
                      <p>
                        • Otherwise searches across names, flights, vouchers,
                        and ride IDs
                      </p>
                      <div className="absolute right-2 top-full h-0 w-0 border-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                </div>
              </div>
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
                  <div className="relative">
                    <input
                      type="date"
                      value={dateRangeStart}
                      onChange={(e) => setDateRangeStart(e.target.value)}
                      placeholder="Start date"
                      className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 pr-8 text-xs text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                      style={
                        {
                          WebkitAppearance: 'none',
                        } as React.CSSProperties
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
                  <div className="relative">
                    <input
                      type="date"
                      value={dateRangeEnd}
                      onChange={(e) => setDateRangeEnd(e.target.value)}
                      placeholder="End date"
                      className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 pr-8 text-xs text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                      style={
                        {
                          WebkitAppearance: 'none',
                        } as React.CSSProperties
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

              {/* Time Range */}
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
                        } as React.CSSProperties
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
                        } as React.CSSProperties
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

              {/* Bag Units */}
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
                  const totalBagUnits = calculateBagUnits(group.riders)
                  const riderCount = group.riders.length
                  const datePassed = isDatePassed(group.date)

                  return (
                    <div
                      key={group.ride_id}
                      className={`overflow-hidden rounded-lg bg-white shadow-md transition-colors ${
                        datePassed ? 'opacity-60' : ''
                      } ${
                        dragOverGroupId === group.ride_id &&
                        draggedRider &&
                        !datePassed
                          ? 'bg-teal-50 ring-2 ring-teal-500'
                          : ''
                      }`}
                      onDragOver={(e) => {
                        e.preventDefault()
                        if (draggedRider && !datePassed) {
                          e.dataTransfer.dropEffect = 'move'
                          setDragOverGroupId(group.ride_id)
                        } else {
                          e.dataTransfer.dropEffect = 'none'
                        }
                      }}
                      onDragLeave={(e) => {
                        // Only clear if we're leaving the group area (not just moving to a child element)
                        const rect = e.currentTarget.getBoundingClientRect()
                        const x = e.clientX
                        const y = e.clientY
                        if (
                          x < rect.left ||
                          x > rect.right ||
                          y < rect.top ||
                          y > rect.bottom
                        ) {
                          setDragOverGroupId(null)
                        }
                      }}
                      onDrop={async (e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setDragOverGroupId(null)
                        if (draggedRider && !datePassed) {
                          // Check if rider already exists in this group (by flight_id)
                          const riderAlreadyInGroup = group.riders.some(
                            (r) => r.flight_id === draggedRider.flight_id,
                          )

                          if (riderAlreadyInGroup) {
                            // Rider already in group, don't add duplicate
                            setDraggedRider(null)
                            return
                          }

                          // Check if rider is from corral (by flight_id)
                          const corralRider = corralRiders.find(
                            (r) => r.flight_id === draggedRider.flight_id,
                          )
                          const isFromCorral = !!corralRider
                          // Check if rider is from unmatched (by flight_id)
                          const isFromUnmatched = unmatchedRiders.some(
                            (r) => r.flight_id === draggedRider.flight_id,
                          )

                          // Check time/date compatibility before proceeding
                          const timeCompatible = validateTimeCompatibility(
                            group,
                            draggedRider,
                          )
                          if (!timeCompatible) {
                            // Show conflict modal with handler to proceed
                            setTimeConflictModal({
                              rider: draggedRider,
                              group,
                              onConfirm: async () => {
                                // Check if rider is from another group (direct drag)
                                const sourceGroup = groups.find((g) =>
                                  g.riders.some(
                                    (r) =>
                                      r.flight_id === draggedRider.flight_id,
                                  ),
                                )
                                const isFromGroup =
                                  !!sourceGroup &&
                                  sourceGroup.ride_id !== group.ride_id

                                if (isFromGroup) {
                                  // Direct drag from one group to another (bypassing validation)
                                  await handleSelectFromCorral(
                                    draggedRider,
                                    group,
                                    true, // Skip time validation
                                    sourceGroup.ride_id, // Pass source group ID
                                  )
                                } else if (isFromCorral) {
                                  // Check if this is the original group
                                  const isOriginalGroup =
                                    corralRider?.originGroupId ===
                                      group.ride_id &&
                                    corralRider?.originType === 'group'

                                  if (isOriginalGroup) {
                                    // Remove from corral and restore to group
                                    setCorralRiders((prev) =>
                                      prev.filter(
                                        (r) =>
                                          r.flight_id !==
                                          draggedRider.flight_id,
                                      ),
                                    )
                                    setDraggedRider(null)
                                    setTimeConflictModal(null)
                                    return
                                  } else {
                                    // Add to different group (bypassing validation)
                                    await handleSelectFromCorral(
                                      draggedRider,
                                      group,
                                      true, // Skip time validation
                                    )
                                  }
                                } else if (isFromUnmatched) {
                                  // Add unmatched rider directly to group (bypassing validation)
                                  await handleSelectFromCorral(
                                    draggedRider,
                                    group,
                                    true, // Skip time validation
                                  )
                                  // Remove from unmatched
                                  setUnmatchedRiders((prev) =>
                                    prev.filter(
                                      (r) =>
                                        r.flight_id !== draggedRider.flight_id,
                                    ),
                                  )
                                }
                                setDraggedRider(null)
                                setTimeConflictModal(null)
                              },
                            })
                            return
                          }

                          // Check if rider is from another group (direct drag)
                          const sourceGroup = groups.find((g) =>
                            g.riders.some(
                              (r) => r.flight_id === draggedRider.flight_id,
                            ),
                          )
                          const isFromGroup =
                            !!sourceGroup &&
                            sourceGroup.ride_id !== group.ride_id

                          if (isFromGroup) {
                            // Direct drag from one group to another
                            // Remove from source group and add to destination group
                            await handleSelectFromCorral(
                              draggedRider,
                              group,
                              false,
                              sourceGroup.ride_id, // Pass source group ID
                            )
                          } else if (isFromCorral) {
                            // Check if this is the original group
                            const isOriginalGroup =
                              corralRider?.originGroupId === group.ride_id &&
                              corralRider?.originType === 'group'

                            if (isOriginalGroup) {
                              // Remove from corral and restore to group (by flight_id)
                              setCorralRiders((prev) =>
                                prev.filter(
                                  (r) => r.flight_id !== draggedRider.flight_id,
                                ),
                              )
                              // Rider is already in the group, just remove from corral
                              setDraggedRider(null)
                              return
                            } else {
                              // Add to different group
                              await handleSelectFromCorral(draggedRider, group)
                            }
                          } else if (isFromUnmatched) {
                            // Add unmatched rider directly to group
                            await handleSelectFromCorral(draggedRider, group)
                            // Remove from unmatched (by flight_id)
                            setUnmatchedRiders((prev) =>
                              prev.filter(
                                (r) => r.flight_id !== draggedRider.flight_id,
                              ),
                            )
                          }
                          setDraggedRider(null)
                        }
                      }}
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
                              {datePassed && (
                                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                                  Past Date
                                </span>
                              )}
                            </div>
                            {/* Desktop: single line */}
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
                                formatTimeRange(
                                  calculateGroupTimeRange(group.riders),
                                )
                              )}
                            </p>
                            {/* Mobile: stacked lines */}
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
                                  formatTimeRange(
                                    calculateGroupTimeRange(group.riders),
                                  )
                                )}
                              </p>
                            </div>
                            {/* Uber Voucher - Below date/time */}
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
                                onClick={(e) => {
                                  e.stopPropagation() // Prevent group from expanding
                                  setEditVoucherModal({ group })
                                  // Show only the formatted voucher code (last part) in the input
                                  setEditVoucherValue(
                                    group.group_voucher
                                      ? formatVoucher(group.group_voucher)
                                      : '',
                                  )
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
                          {/* Desktop: horizontal badges */}
                          <div className="hidden items-center gap-2 md:flex">
                            {/* Riders Badge */}
                            <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-800">
                              {riderCount}{' '}
                              {riderCount === 1 ? 'rider' : 'riders'}
                            </span>

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
                                  TO {group.airport}
                                </>
                              ) : (
                                <>
                                  <PlaneLanding className="h-3 w-3" />
                                  FROM {group.airport}
                                </>
                              )}
                            </span>

                            {/* Subsidy Badge */}
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                isGroupSubsidized(group.airport, riderCount)
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {isGroupSubsidized(group.airport, riderCount)
                                ? 'Subsidized'
                                : 'Not Subsidized'}
                            </span>

                            {/* Uber Type Badge */}
                            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                              Uber {group.uber_type || getUberType(riderCount)}
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
                            {/* Subsidized and Uber Type stacked */}
                            <div className="flex flex-col gap-1">
                              <span
                                className={`w-fit rounded-full px-2 py-0.5 text-xs font-semibold ${
                                  isGroupSubsidized(group.airport, riderCount)
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}
                              >
                                {isGroupSubsidized(group.airport, riderCount)
                                  ? 'Subsidized'
                                  : 'Not Subsidized'}
                              </span>
                              <span className="w-fit rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">
                                Uber{' '}
                                {group.uber_type || getUberType(riderCount)}
                              </span>
                            </div>
                          </div>

                          {/* Edit Time Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              if (!datePassed) {
                                setEditTimeModal({ group })
                                setEditTimeValue(
                                  group.match_time
                                    ? group.match_time.substring(0, 5)
                                    : '',
                                )
                              }
                            }}
                            disabled={datePassed}
                            className={`rounded p-1.5 ${
                              datePassed
                                ? 'cursor-not-allowed text-gray-400'
                                : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                            }`}
                            title={
                              datePassed
                                ? 'Cannot edit past groups'
                                : 'Edit group time'
                            }
                          >
                            <Clock className="h-5 w-5" />
                          </button>

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
                            Bag Units: {totalBagUnits}/
                            {getMaxBagUnits(riderCount)}
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                          <div
                            className={`h-full ${getCapacityBarColor(totalBagUnits)} transition-all`}
                            style={{
                              width: `${Math.min((totalBagUnits / getMaxBagUnits(riderCount)) * 100, 100)}%`,
                            }}
                          ></div>
                        </div>
                      </div>

                      {/* Group Content (Expanded) */}
                      {isExpanded && (
                        <div
                          className={`p-4 transition-colors ${
                            dragOverGroupId === group.ride_id && draggedRider
                              ? 'bg-teal-50'
                              : ''
                          }`}
                          onDragOver={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            if (draggedRider && !datePassed) {
                              e.dataTransfer.dropEffect = 'move'
                              setDragOverGroupId(group.ride_id)
                            } else {
                              e.dataTransfer.dropEffect = 'none'
                            }
                          }}
                          onDragLeave={(e) => {
                            // Only clear if we're leaving the group area (not just moving to a child element)
                            const rect = e.currentTarget.getBoundingClientRect()
                            const x = e.clientX
                            const y = e.clientY
                            if (
                              x < rect.left ||
                              x > rect.right ||
                              y < rect.top ||
                              y > rect.bottom
                            ) {
                              setDragOverGroupId(null)
                            }
                          }}
                          onDrop={async (e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setDragOverGroupId(null)
                            if (draggedRider && !datePassed) {
                              // Check if rider already exists in this group (by flight_id)
                              const riderAlreadyInGroup = group.riders.some(
                                (r) => r.flight_id === draggedRider.flight_id,
                              )

                              if (riderAlreadyInGroup) {
                                // Rider already in group, don't add duplicate
                                setDraggedRider(null)
                                return
                              }

                              // Check if rider is from corral (by flight_id)
                              const corralRider = corralRiders.find(
                                (r) => r.flight_id === draggedRider.flight_id,
                              )
                              const isFromCorral = !!corralRider
                              // Check if rider is from unmatched (by flight_id)
                              const isFromUnmatched = unmatchedRiders.some(
                                (r) => r.flight_id === draggedRider.flight_id,
                              )

                              // Check time/date compatibility before proceeding
                              const timeCompatible = validateTimeCompatibility(
                                group,
                                draggedRider,
                              )
                              if (!timeCompatible) {
                                // Show conflict modal with handler to proceed
                                setTimeConflictModal({
                                  rider: draggedRider,
                                  group,
                                  onConfirm: async () => {
                                    // Check if rider is from another group (direct drag)
                                    const sourceGroup = groups.find((g) =>
                                      g.riders.some(
                                        (r) =>
                                          r.flight_id ===
                                          draggedRider.flight_id,
                                      ),
                                    )
                                    const isFromGroup =
                                      !!sourceGroup &&
                                      sourceGroup.ride_id !== group.ride_id

                                    if (isFromGroup) {
                                      // Direct drag from one group to another (bypassing validation)
                                      await handleSelectFromCorral(
                                        draggedRider,
                                        group,
                                        true, // Skip time validation
                                        sourceGroup.ride_id, // Pass source group ID
                                      )
                                    } else if (isFromCorral) {
                                      // Check if this is the original group
                                      const isOriginalGroup =
                                        corralRider?.originGroupId ===
                                          group.ride_id &&
                                        corralRider?.originType === 'group'

                                      if (isOriginalGroup) {
                                        // Remove from corral and restore to group
                                        setCorralRiders((prev) =>
                                          prev.filter(
                                            (r) =>
                                              r.flight_id !==
                                              draggedRider.flight_id,
                                          ),
                                        )
                                        setDraggedRider(null)
                                        setTimeConflictModal(null)
                                        return
                                      } else {
                                        // Add to different group (bypassing validation)
                                        await handleSelectFromCorral(
                                          draggedRider,
                                          group,
                                          true, // Skip time validation
                                        )
                                      }
                                    } else if (isFromUnmatched) {
                                      // Add unmatched rider directly to group (bypassing validation)
                                      await handleSelectFromCorral(
                                        draggedRider,
                                        group,
                                        true, // Skip time validation
                                      )
                                      // Remove from unmatched
                                      setUnmatchedRiders((prev) =>
                                        prev.filter(
                                          (r) =>
                                            r.flight_id !==
                                            draggedRider.flight_id,
                                        ),
                                      )
                                    }
                                    setDraggedRider(null)
                                    setTimeConflictModal(null)
                                  },
                                })
                                return
                              }

                              // Check if rider is from another group (direct drag)
                              const sourceGroup = groups.find((g) =>
                                g.riders.some(
                                  (r) => r.flight_id === draggedRider.flight_id,
                                ),
                              )
                              const isFromGroup =
                                !!sourceGroup &&
                                sourceGroup.ride_id !== group.ride_id

                              if (isFromGroup) {
                                // Direct drag from one group to another
                                // Remove from source group and add to destination group
                                await handleSelectFromCorral(
                                  draggedRider,
                                  group,
                                  false,
                                  sourceGroup.ride_id, // Pass source group ID
                                )
                              } else if (isFromCorral) {
                                // Check if this is the original group
                                const isOriginalGroup =
                                  corralRider?.originGroupId ===
                                    group.ride_id &&
                                  corralRider?.originType === 'group'

                                if (isOriginalGroup) {
                                  // Remove from corral and restore to group (by flight_id)
                                  setCorralRiders((prev) =>
                                    prev.filter(
                                      (r) =>
                                        r.flight_id !== draggedRider.flight_id,
                                    ),
                                  )
                                  // Rider is already in the group, just remove from corral
                                  setDraggedRider(null)
                                  return
                                } else {
                                  // Add to different group
                                  await handleSelectFromCorral(
                                    draggedRider,
                                    group,
                                  )
                                }
                              } else if (isFromUnmatched) {
                                // Add unmatched rider directly to group
                                await handleSelectFromCorral(
                                  draggedRider,
                                  group,
                                )
                                // Remove from unmatched (by flight_id)
                                setUnmatchedRiders((prev) =>
                                  prev.filter(
                                    (r) =>
                                      r.flight_id !== draggedRider.flight_id,
                                  ),
                                )
                              }
                              setDraggedRider(null)
                            }
                          }}
                        >
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
                          {(() => {
                            // Get riders currently in the group
                            const activeRiders = group.riders
                            // Get riders from corral that belong to this group
                            const corralRidersForGroup = corralRiders.filter(
                              (r) =>
                                r.originGroupId === group.ride_id &&
                                r.originType === 'group',
                            )
                            // Combine both lists
                            const allRiders = [
                              ...activeRiders,
                              ...corralRidersForGroup,
                            ]

                            if (allRiders.length === 0) {
                              return (
                                <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
                                  <p className="text-gray-500">
                                    Drop riders here
                                  </p>
                                </div>
                              )
                            }

                            return (
                              <div className="space-y-2">
                                {allRiders.map((rider) => {
                                  const isBeingDragged =
                                    draggedRider?.flight_id === rider.flight_id
                                  // Check if this exact rider (by flight_id) is in corral
                                  const isInCorral = corralRiders.some(
                                    (r) => r.flight_id === rider.flight_id,
                                  )
                                  return (
                                    <div
                                      key={`${rider.user_id}-${rider.flight_id}`}
                                      className={`flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 transition-all ${
                                        datePassed
                                          ? 'cursor-not-allowed opacity-50'
                                          : isBeingDragged
                                            ? 'bg-gray-100 opacity-30'
                                            : isInCorral
                                              ? 'cursor-not-allowed bg-gray-100 opacity-40'
                                              : 'hover:bg-gray-50'
                                      }`}
                                      draggable={!datePassed && !isInCorral}
                                      onDragStart={() => {
                                        if (!datePassed && !isInCorral) {
                                          setDraggedRider(rider)
                                        }
                                      }}
                                      onDragEnd={() => {
                                        // Only clear if this was the dragged rider
                                        if (
                                          draggedRider?.flight_id ===
                                          rider.flight_id
                                        ) {
                                          setDraggedRider(null)
                                        }
                                      }}
                                    >
                                      <div className="flex items-center gap-4">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-3">
                                            <p className="font-medium text-gray-900">
                                              {rider.name}
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
                                            {rider.airline_iata &&
                                              rider.flight_no && (
                                                <span className="flex items-center gap-1 text-xs font-medium text-gray-700">
                                                  <Plane className="h-3 w-3 text-gray-600" />
                                                  {rider.airline_iata}{' '}
                                                  {rider.flight_no}
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
                                          onClick={() => {
                                            if (!datePassed) {
                                              handleAddToCorral(
                                                rider,
                                                group.ride_id,
                                              )
                                            }
                                          }}
                                          disabled={datePassed}
                                          className={`rounded p-1 ${
                                            datePassed
                                              ? 'cursor-not-allowed text-gray-400'
                                              : 'text-teal-500 hover:bg-teal-50'
                                          }`}
                                          title={
                                            datePassed
                                              ? 'Cannot modify past groups'
                                              : 'Move to corral'
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
                                              d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                                            />
                                          </svg>
                                        </button>
                                        <button
                                          onClick={() => {
                                            if (!datePassed) {
                                              handleRemoveFromGroupToUnmatched(
                                                rider,
                                                group.ride_id,
                                              )
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
                                              : 'Remove from group and make unmatched'
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
                })
              )}
            </div>
          )}

          {/* Unmatched Tab */}
          {activeTab === 'unmatched' && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sortedUnmatchedRiders.length === 0 ? (
                <div className="col-span-full rounded-lg border-2 border-dashed border-gray-300 bg-white p-12 text-center">
                  <p className="text-gray-500">No unmatched riders</p>
                </div>
              ) : (
                sortedUnmatchedRiders.map((rider) => {
                  const riderDatePassed = isDatePassed(rider.date)
                  const isSelectedForNewGroup = selectedRidersForNewGroup.some(
                    (r) => r.flight_id === rider.flight_id,
                  )
                  const isRecentlyAdded = recentlyAddedToNewGroup.has(
                    String(rider.flight_id),
                  )
                  return (
                    <div
                      key={`${rider.user_id}-${rider.flight_id}`}
                      className={`relative rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-all duration-300 ${
                        riderDatePassed ? 'opacity-50' : ''
                      } ${
                        isSelectedForNewGroup || isRecentlyAdded
                          ? 'border-gray-300 bg-gray-100 opacity-60'
                          : ''
                      } ${isRecentlyAdded ? 'animate-pulse' : ''}`}
                      draggable={!riderDatePassed}
                      onDragStart={() => {
                        if (!riderDatePassed) {
                          setDraggedRider(rider)
                        }
                      }}
                      onDragEnd={() => {
                        setDraggedRider(null)
                        setDragOverGroupId(null)
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <p className="flex-1 font-medium text-gray-900">
                          {rider.name}
                        </p>
                        {riderDatePassed && (
                          <span className="inline-flex flex-shrink-0 items-center justify-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                            PAST DATE
                          </span>
                        )}
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
                      {/* Add to corral and new group links at bottom */}
                      <div className="mt-2 flex gap-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (!riderDatePassed) {
                              handleAddToCorral(rider)
                            }
                          }}
                          disabled={riderDatePassed}
                          className={`text-xs underline ${
                            riderDatePassed
                              ? 'cursor-not-allowed text-gray-400'
                              : 'text-teal-600 hover:text-teal-800'
                          }`}
                        >
                          Add to corral
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (!riderDatePassed) {
                              addRiderToNewGroup(rider)
                            }
                          }}
                          disabled={riderDatePassed}
                          className={`text-xs underline ${
                            riderDatePassed
                              ? 'cursor-not-allowed text-gray-400'
                              : 'text-purple-600 hover:text-purple-800'
                          }`}
                        >
                          Add to new group
                        </button>
                      </div>
                    </div>
                  )
                })
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
              {/* Tabs */}
              <div className="flex-shrink-0 border-b border-gray-200">
                <div className="flex">
                  <button
                    onClick={() => setCorralTab('riders')}
                    className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                      corralTab === 'riders'
                        ? 'border-b-2 border-teal-500 text-teal-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Riders ({corralRiders.length})
                  </button>
                  <button
                    onClick={() => setCorralTab('changes')}
                    className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                      corralTab === 'changes'
                        ? 'border-b-2 border-teal-500 text-teal-600'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Changes (
                    {changedGroups.length + unmatchedIndividuals.length})
                  </button>
                </div>
              </div>

              {/* Riders Tab */}
              {corralTab === 'riders' && (
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

                  <div
                    className={`flex-1 overflow-y-auto px-4 pb-4 transition-colors ${
                      isDraggingOverCorral ? 'bg-teal-50' : ''
                    }`}
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'move'
                      if (draggedRider) {
                        setIsDraggingOverCorral(true)
                      }
                    }}
                    onDragLeave={(e) => {
                      // Only clear if we're leaving the corral area (not just moving to a child element)
                      const rect = e.currentTarget.getBoundingClientRect()
                      const x = e.clientX
                      const y = e.clientY
                      if (
                        x < rect.left ||
                        x > rect.right ||
                        y < rect.top ||
                        y > rect.bottom
                      ) {
                        setIsDraggingOverCorral(false)
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      setIsDraggingOverCorral(false)
                      if (draggedRider) {
                        // Check if rider is not already in corral
                        const isAlreadyInCorral = corralRiders.some(
                          (r) => r.flight_id === draggedRider.flight_id,
                        )
                        if (!isAlreadyInCorral) {
                          handleAddToCorral(draggedRider)
                        }
                        setDraggedRider(null)
                      }
                    }}
                  >
                    <div className="space-y-2">
                      {sortedCorralRiders.length === 0 ? (
                        <p className="text-center text-sm text-gray-500">
                          Corral is empty
                        </p>
                      ) : (
                        sortedCorralRiders.map((rider, riderIndex) => {
                          const group = corralSelectionMode
                            ? groups.find(
                                (g) => g.ride_id === corralSelectionMode,
                              )
                            : null
                          const isSelectedForNewGroup =
                            selectedRidersForNewGroup.some(
                              (r) => r.flight_id === rider.flight_id,
                            )
                          const isRecentlyAdded = recentlyAddedToNewGroup.has(
                            String(rider.flight_id),
                          )
                          const errorKey = group
                            ? `${rider.user_id}-${group.ride_id}`
                            : null
                          const cardError = errorKey
                            ? corralCardErrors.get(errorKey)
                            : null

                          return (
                            <div
                              key={`corral-${rider.flight_id}-${riderIndex}`}
                              className="space-y-1"
                            >
                              {cardError && (
                                <p className="px-1 text-xs text-red-600">
                                  {cardError}
                                </p>
                              )}
                              <div
                                className={`rounded-lg border p-3 transition-all duration-300 ${
                                  isSelectedForNewGroup || isRecentlyAdded
                                    ? 'border-gray-300 bg-gray-100 opacity-60'
                                    : corralSelectionMode
                                      ? 'cursor-pointer border-teal-400 bg-teal-50 hover:bg-teal-100'
                                      : 'border-gray-200 bg-gray-50'
                                } ${isRecentlyAdded ? 'animate-pulse' : ''}`}
                                draggable={!corralSelectionMode}
                                onDragStart={() => {
                                  if (!corralSelectionMode) {
                                    setDraggedRider(rider)
                                  }
                                }}
                                onDragEnd={() => {
                                  setDraggedRider(null)
                                  setDragOverGroupId(null)
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
                                    <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                                      <div className="group relative flex items-center gap-1">
                                        <Luggage className="h-3 w-3" />
                                        <span>{rider.checked_bags}</span>
                                        <div className="absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 transform whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white group-hover:block">
                                          Checked Bags (2 Units Each)
                                          <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                                        </div>
                                      </div>
                                      <div className="group relative flex items-center gap-1">
                                        <Briefcase className="h-3 w-3" />
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
                                      {rider.date} •{' '}
                                      {formatTimeRange(rider.time_range)}
                                    </p>
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
                                        className="rounded p-1 text-blue-500 hover:bg-blue-50"
                                        title="Remove from corral (return to origin)"
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
                                            d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                                          />
                                        </svg>
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleRemoveFromCorralToUnmatched(
                                            rider,
                                          )
                                        }}
                                        className="rounded p-1 text-red-500 hover:bg-red-50"
                                        title="Remove from corral and make unmatched"
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

              {/* Changes Tab */}
              {corralTab === 'changes' && (
                <div className="flex flex-1 flex-col overflow-y-auto p-4">
                  <div className="space-y-4">
                    {/* Unconfirmed Changed Groups */}
                    {changedGroups.filter((cg) => !cg.emailsSent).length >
                      0 && (
                      <div>
                        <h3 className="mb-2 text-sm font-semibold text-gray-900">
                          Changed Groups (
                          {changedGroups.filter((cg) => !cg.emailsSent).length})
                        </h3>
                        <div className="space-y-2">
                          {changedGroups
                            .filter((cg) => !cg.emailsSent)
                            .map((changedGroup) => (
                              <ChangedGroupCard
                                key={changedGroup.group.ride_id}
                                changedGroup={changedGroup}
                                onConfirmEmail={async () => {
                                  console.log(
                                    '[onConfirmEmail] Starting confirmation for group:',
                                    {
                                      groupId: changedGroup.group.ride_id,
                                      changeLogId: changedGroup.changeLogId,
                                      changeType: changedGroup.changeType,
                                    },
                                  )

                                  // Find ALL unconfirmed ChangeLog entries related to this group
                                  // This includes entries where the group is the source (from_group) or destination (to_group/ride_id)
                                  const {
                                    data: relatedEntries,
                                    error: findError,
                                  } = await supabase
                                    .from('ChangeLog')
                                    .select('id, action, metadata')
                                    .eq('confirmed', false)
                                    .in('action', [
                                      'UPDATE_GROUP_TIME',
                                      'ADD_TO_GROUP',
                                      'REMOVE_FROM_GROUP',
                                      'CREATE_GROUP',
                                      'DELETE_GROUP',
                                    ])
                                    .or(
                                      `metadata->>ride_id.eq.${changedGroup.group.ride_id},metadata->>to_group.eq.${changedGroup.group.ride_id},metadata->>from_group.eq.${changedGroup.group.ride_id}`,
                                    )

                                  if (findError) {
                                    console.error(
                                      '[onConfirmEmail] Error finding related ChangeLog entries:',
                                      findError,
                                    )
                                  } else {
                                    console.log(
                                      '[onConfirmEmail] Found related ChangeLog entries:',
                                      relatedEntries?.length || 0,
                                      relatedEntries,
                                    )
                                  }

                                  // Update ALL related ChangeLog entries to confirmed = true
                                  if (
                                    relatedEntries &&
                                    relatedEntries.length > 0
                                  ) {
                                    const entryIds = relatedEntries.map(
                                      (e) => e.id,
                                    )
                                    console.log(
                                      '[onConfirmEmail] Updating ChangeLog entries to confirmed:',
                                      entryIds,
                                    )

                                    const { error: updateError } =
                                      await supabase
                                        .from('ChangeLog')
                                        .update({ confirmed: true })
                                        .in('id', entryIds)

                                    if (updateError) {
                                      console.error(
                                        '[onConfirmEmail] Error confirming changes:',
                                        updateError,
                                      )
                                      setErrorMessage(
                                        'Failed to confirm change',
                                      )
                                      setTimeout(
                                        () => setErrorMessage(null),
                                        3000,
                                      )
                                      return
                                    }
                                    console.log(
                                      '[onConfirmEmail] Successfully updated',
                                      entryIds.length,
                                      'ChangeLog entries to confirmed',
                                    )
                                  } else if (changedGroup.changeLogId) {
                                    // Fallback to single entry if no related entries found
                                    console.log(
                                      '[onConfirmEmail] No related entries found, updating single entry:',
                                      changedGroup.changeLogId,
                                    )
                                    const { error } = await supabase
                                      .from('ChangeLog')
                                      .update({ confirmed: true })
                                      .eq('id', changedGroup.changeLogId)

                                    if (error) {
                                      console.error(
                                        '[onConfirmEmail] Error confirming change:',
                                        error,
                                      )
                                      setErrorMessage(
                                        'Failed to confirm change',
                                      )
                                      setTimeout(
                                        () => setErrorMessage(null),
                                        3000,
                                      )
                                      return
                                    }
                                  }

                                  // Log email confirmation to ChangeLog
                                  // Note: EMAIL_CONFIRMED is not in the database constraint, so we use UPDATE_GROUP_TIME
                                  // with email_confirmed: true in metadata to track this
                                  console.log(
                                    '[onConfirmEmail] Creating email confirmation entry for group:',
                                    changedGroup.group.ride_id,
                                  )
                                  try {
                                    const emailConfirmedResult =
                                      await logToChangeLog(
                                        'UPDATE_GROUP_TIME', // Use allowed action type
                                        {
                                          email_confirmed: true, // Flag to indicate this is an email confirmation
                                          ride_id: changedGroup.group.ride_id, // Store as number in metadata
                                          change_type: changedGroup.changeType,
                                          rider_count:
                                            changedGroup.group.riders.length,
                                          rider_names:
                                            changedGroup.group.riders.map(
                                              (r) => r.name,
                                            ),
                                          rider_user_ids:
                                            changedGroup.group.riders.map(
                                              (r) => r.user_id,
                                            ),
                                        },
                                        undefined, // Don't set target_group_id if it's UUID type and we have a number
                                        undefined, // targetUserId
                                        true, // confirmed = true for email confirmations
                                      )
                                    console.log(
                                      '[onConfirmEmail] Email confirmation entry creation result:',
                                      emailConfirmedResult,
                                    )
                                  } catch (emailError) {
                                    console.error(
                                      '[onConfirmEmail] Error creating email confirmation entry:',
                                      emailError,
                                    )
                                    // Don't fail the whole operation if logging fails
                                  }

                                  // Update local state
                                  setChangedGroups((prev) =>
                                    prev.map((cg) =>
                                      cg.group.ride_id ===
                                      changedGroup.group.ride_id
                                        ? { ...cg, emailsSent: true }
                                        : cg,
                                    ),
                                  )

                                  // Refresh ChangeLog to show the new EMAIL_CONFIRMED entry
                                  await fetchChangeLog()

                                  // Reload unconfirmed changes after a delay to ensure DB commit
                                  // The loadUnconfirmedChanges will now check for EMAIL_CONFIRMED entries
                                  // and preserve the emailsSent state
                                  setTimeout(() => {
                                    loadUnconfirmedChanges()
                                  }, 500)
                                }}
                                supabase={supabase}
                              />
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Confirmed/Emailed Groups */}
                    {changedGroups.filter((cg) => cg.emailsSent).length > 0 && (
                      <div>
                        <h3 className="mb-2 text-sm font-semibold text-green-700">
                          Confirmed/Emailed Groups (
                          {changedGroups.filter((cg) => cg.emailsSent).length})
                        </h3>
                        <div className="space-y-2">
                          {changedGroups
                            .filter((cg) => cg.emailsSent)
                            .map((changedGroup) => (
                              <ChangedGroupCard
                                key={`confirmed-${changedGroup.group.ride_id}`}
                                changedGroup={changedGroup}
                                onConfirmEmail={async () => {
                                  // Already confirmed, do nothing
                                }}
                                supabase={supabase}
                              />
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Unconfirmed Unmatched Individuals */}
                    {unmatchedIndividuals.filter((ui) => !ui.emailSent).length >
                      0 && (
                      <div>
                        <h3 className="mb-2 text-sm font-semibold text-gray-900">
                          Unmatched Individuals (
                          {
                            unmatchedIndividuals.filter((ui) => !ui.emailSent)
                              .length
                          }
                          )
                        </h3>
                        <div className="space-y-2">
                          {unmatchedIndividuals
                            .filter((ui) => !ui.emailSent)
                            .map((item) => (
                              <UnmatchedIndividualCard
                                key={`${item.rider.user_id}-${item.rider.flight_id}`}
                                item={item}
                                onConfirmEmail={async () => {
                                  console.log(
                                    '[onConfirmEmail] Starting confirmation for unmatched individual:',
                                    {
                                      flightId: item.rider.flight_id,
                                      userId: item.rider.user_id,
                                      changeLogId: item.changeLogId,
                                    },
                                  )

                                  // Find ALL unconfirmed ChangeLog entries related to this flight/user
                                  // This includes REMOVE_FROM_GROUP entries where this flight was removed to unmatched
                                  const {
                                    data: relatedEntries,
                                    error: findError,
                                  } = await supabase
                                    .from('ChangeLog')
                                    .select('id, action, metadata')
                                    .eq('confirmed', false)
                                    .eq('action', 'REMOVE_FROM_GROUP')
                                    .eq('target_user_id', item.rider.user_id)
                                    .or(
                                      `metadata->>rider_flight_id.eq.${item.rider.flight_id},metadata->>flight_id.eq.${item.rider.flight_id}`,
                                    )

                                  if (findError) {
                                    console.error(
                                      '[onConfirmEmail] Error finding related ChangeLog entries:',
                                      findError,
                                    )
                                  } else {
                                    console.log(
                                      '[onConfirmEmail] Found related ChangeLog entries:',
                                      relatedEntries?.length || 0,
                                      relatedEntries,
                                    )
                                  }

                                  // Update ALL related ChangeLog entries to confirmed = true
                                  if (
                                    relatedEntries &&
                                    relatedEntries.length > 0
                                  ) {
                                    const entryIds = relatedEntries.map(
                                      (e) => e.id,
                                    )
                                    console.log(
                                      '[onConfirmEmail] Updating ChangeLog entries to confirmed:',
                                      entryIds,
                                    )

                                    const { error: updateError } =
                                      await supabase
                                        .from('ChangeLog')
                                        .update({ confirmed: true })
                                        .in('id', entryIds)

                                    if (updateError) {
                                      console.error(
                                        '[onConfirmEmail] Error confirming changes:',
                                        updateError,
                                      )
                                      setErrorMessage(
                                        'Failed to confirm change',
                                      )
                                      setTimeout(
                                        () => setErrorMessage(null),
                                        3000,
                                      )
                                      return
                                    }
                                    console.log(
                                      '[onConfirmEmail] Successfully updated',
                                      entryIds.length,
                                      'ChangeLog entries to confirmed',
                                    )
                                  } else if (item.changeLogId) {
                                    // Fallback to single entry if no related entries found
                                    console.log(
                                      '[onConfirmEmail] No related entries found, updating single entry:',
                                      item.changeLogId,
                                    )
                                    const { error } = await supabase
                                      .from('ChangeLog')
                                      .update({ confirmed: true })
                                      .eq('id', item.changeLogId)

                                    if (error) {
                                      console.error(
                                        '[onConfirmEmail] Error confirming change:',
                                        error,
                                      )
                                      setErrorMessage(
                                        'Failed to confirm change',
                                      )
                                      setTimeout(
                                        () => setErrorMessage(null),
                                        3000,
                                      )
                                      return
                                    }
                                  }

                                  // Log email confirmation to ChangeLog
                                  console.log(
                                    '[onConfirmEmail] Creating EMAIL_CONFIRMED entry for individual:',
                                    item.rider.flight_id,
                                  )
                                  const emailConfirmedResult =
                                    await logToChangeLog(
                                      'EMAIL_CONFIRMED',
                                      {
                                        rider_name: item.rider.name,
                                        rider_user_id: item.rider.user_id,
                                        rider_flight_id: item.rider.flight_id,
                                        date: item.rider.date,
                                      },
                                      undefined, // targetGroupId
                                      item.rider.user_id,
                                      true, // confirmed = true for email confirmations
                                    )
                                  console.log(
                                    '[onConfirmEmail] EMAIL_CONFIRMED entry creation result:',
                                    emailConfirmedResult,
                                  )

                                  // Update local state immediately
                                  setUnmatchedIndividuals((prev) =>
                                    prev.map((ui) =>
                                      ui.rider.flight_id ===
                                      item.rider.flight_id
                                        ? { ...ui, emailSent: true }
                                        : ui,
                                    ),
                                  )

                                  // Refresh ChangeLog to show the new EMAIL_CONFIRMED entry
                                  await fetchChangeLog()

                                  // Reload unconfirmed changes after a delay to ensure DB commit
                                  // But preserve entries that are already marked as emailSent
                                  setTimeout(async () => {
                                    await loadUnconfirmedChanges()
                                    // Re-apply emailSent status to prevent overwriting
                                    setUnmatchedIndividuals((prev) =>
                                      prev.map((ui) => {
                                        const wasEmailed =
                                          unmatchedIndividuals.find(
                                            (ui2) =>
                                              ui2.rider.flight_id ===
                                              ui.rider.flight_id,
                                          )?.emailSent
                                        if (wasEmailed) {
                                          return { ...ui, emailSent: true }
                                        }
                                        return ui
                                      }),
                                    )
                                  }, 500)
                                }}
                                supabase={supabase}
                              />
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Confirmed Unmatched Individuals */}
                    {unmatchedIndividuals.filter((ui) => ui.emailSent).length >
                      0 && (
                      <div>
                        <h3 className="mb-2 text-sm font-semibold text-green-700">
                          Confirmed/Emailed Unmatched Individuals (
                          {
                            unmatchedIndividuals.filter((ui) => ui.emailSent)
                              .length
                          }
                          )
                        </h3>
                        <div className="space-y-2">
                          {unmatchedIndividuals
                            .filter((ui) => ui.emailSent)
                            .map((item) => (
                              <UnmatchedIndividualCard
                                key={`confirmed-${item.rider.user_id}-${item.rider.flight_id}`}
                                item={item}
                                onConfirmEmail={async () => {
                                  // Already confirmed, do nothing
                                }}
                                supabase={supabase}
                              />
                            ))}
                        </div>
                      </div>
                    )}

                    {changedGroups.length === 0 &&
                      unmatchedIndividuals.length === 0 && (
                        <p className="text-center text-sm text-gray-500">
                          No changes to track
                        </p>
                      )}
                  </div>
                </div>
              )}
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
        className={`w-full border-t border-gray-200 bg-white ${changeLogExpanded ? 'fixed inset-0 z-50 h-screen md:relative md:z-auto md:h-auto' : ''}`}
      >
        {!changeLogExpanded && (
          <div className="flex w-full items-center justify-between px-4 py-4 md:px-6">
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
          <div
            className="flex h-full w-full flex-col overflow-hidden md:h-auto md:overflow-y-auto"
            style={
              {
                '--changelog-height': `${changeLogHeight}px`,
              } as React.CSSProperties
            }
          >
            {/* Header - Sticky on mobile */}
            <div className="sticky top-0 z-10 flex w-full items-center justify-between border-b border-gray-200 bg-white px-4 py-4 md:relative md:border-b-0 md:px-6">
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

            <div className="min-h-0 w-full flex-1 overflow-y-auto border-t border-gray-200 md:border-t-0">
              {changeLogOptionsExpanded && (
                <div className="space-y-4 border-b border-gray-200 bg-gray-50 px-4 py-4 md:px-6">
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
                        <div className="relative">
                          <input
                            type="date"
                            value={changeLogFilterDateFrom}
                            onChange={(e) =>
                              setChangeLogFilterDateFrom(e.target.value)
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
                              setChangeLogFilterDateTo(e.target.value)
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
                          { value: 'UPDATE_GROUP_TIME', label: 'Update Time' },
                          { value: 'UPDATE_VOUCHER', label: 'Update Voucher' },
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
                className="relative flex flex-1 flex-col md:flex-none"
                style={
                  typeof window !== 'undefined' && window.innerWidth >= 768
                    ? { height: `${changeLogHeight}px` }
                    : undefined
                }
              >
                {/* Resize Handle - More visible and functional - Hidden on mobile */}
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

                {/* Changelog Entries */}
                <div className="w-full flex-1 overflow-y-auto px-4 py-4 md:px-6">
                  <div className="space-y-2">
                    {sortedChangeLog.length === 0 ? (
                      <p className="text-center text-sm text-gray-500">
                        {changeLog.length === 0
                          ? 'No changes recorded'
                          : 'No entries match the filters'}
                      </p>
                    ) : (
                      sortedChangeLog.map((entry, entryIndex) => {
                        const formatted = formatChangeLogEntry(entry)

                        // Parse actionText to apply styling
                        let actionText = formatted.actionText

                        // Replace person name with styled version if it exists
                        if (formatted.personName) {
                          actionText = actionText.replace(
                            formatted.personName,
                            `__PERSON_NAME__${formatted.personName}__PERSON_NAME__`,
                          )
                        }

                        // Split by person name marker and style each part
                        const parts: (string | JSX.Element)[] = []
                        const segments = actionText.split('__PERSON_NAME__')

                        segments.forEach((segment, segmentIndex) => {
                          if (segmentIndex % 2 === 1) {
                            // This is the person name
                            parts.push(
                              <span
                                key={`person-${entryIndex}-${segmentIndex}`}
                                className="font-semibold text-gray-900"
                              >
                                {segment}
                              </span>,
                            )
                          } else {
                            // This is regular text - bold action words and "unmatched"
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
                            const words = segment.split(/(\s+)/)
                            words.forEach((word, wordIndex) => {
                              const cleanWord = word.trim().toLowerCase()
                              if (actionWords.includes(cleanWord)) {
                                parts.push(
                                  <span
                                    key={`word-${entryIndex}-${segmentIndex}-${wordIndex}`}
                                    className="font-bold"
                                  >
                                    {word}
                                  </span>,
                                )
                              } else if (cleanWord === 'unmatched') {
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
                        })

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

        {/* Delete Group Confirmation Modal */}
        {deleteGroupConfirmation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">
                Delete Group?
              </h3>
              <p className="mb-6 text-sm text-gray-600">
                By deleting the last person from the group, the group will be
                deleted.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteGroupConfirmation(null)}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    await deleteGroupConfirmation.callback()
                    setDeleteGroupConfirmation(null)
                  }}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                >
                  Okay
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Time Modal */}
        {editTimeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">
                Edit Group Time
              </h3>
              <p className="mb-4 text-sm text-gray-600">
                Group #{editTimeModal.group.ride_id} •{' '}
                {editTimeModal.group.riders.length} rider
                {editTimeModal.group.riders.length !== 1 ? 's' : ''}
              </p>
              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  New Time (HH:MM)
                </label>
                <div className="relative">
                  <input
                    type="time"
                    value={editTimeValue}
                    onChange={(e) => setEditTimeValue(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      const input = e.currentTarget
                        .previousElementSibling as HTMLInputElement
                      input?.showPicker?.()
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    title="Open time picker"
                  >
                    <Clock className="h-4 w-4" />
                  </button>
                </div>
                {editTimeModal.group.match_time && (
                  <p className="mt-2 text-xs text-gray-500">
                    Current time:{' '}
                    {editTimeModal.group.match_time.substring(0, 5)}
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setEditTimeModal(null)
                    setEditTimeValue('')
                  }}
                  disabled={isUpdatingTime}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (editTimeValue) {
                      await handleUpdateGroupTime(
                        editTimeModal.group.ride_id,
                        editTimeValue,
                      )
                    }
                  }}
                  disabled={isUpdatingTime || !editTimeValue}
                  className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:opacity-50"
                >
                  {isUpdatingTime ? 'Updating...' : 'Update Time'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Voucher Modal */}
        {editVoucherModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">
                Edit Uber Voucher
              </h3>
              <p className="mb-4 text-sm text-gray-600">
                Group #{editVoucherModal.group.ride_id} •{' '}
                {editVoucherModal.group.riders.length} rider
                {editVoucherModal.group.riders.length !== 1 ? 's' : ''}
              </p>
              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Voucher Code
                </label>
                <input
                  type="text"
                  value={editVoucherValue}
                  onChange={(e) => setEditVoucherValue(e.target.value)}
                  placeholder="Enter voucher code (e.g., VOUCHER123)"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
                {editVoucherModal.group.group_voucher && (
                  <p className="mt-2 text-xs text-gray-500">
                    Current voucher:{' '}
                    {formatVoucher(editVoucherModal.group.group_voucher)}
                  </p>
                )}
                <p className="mt-2 text-xs text-gray-500">
                  This will update the voucher for all{' '}
                  {editVoucherModal.group.riders.length} rider
                  {editVoucherModal.group.riders.length !== 1 ? 's' : ''} in
                  this group.
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setEditVoucherModal(null)
                    setEditVoucherValue('')
                  }}
                  disabled={isUpdatingVoucher}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    await handleUpdateGroupVoucher(
                      editVoucherModal.group.ride_id,
                      editVoucherValue,
                    )
                  }}
                  disabled={isUpdatingVoucher}
                  className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:opacity-50"
                >
                  {isUpdatingVoucher ? 'Updating...' : 'Update Voucher'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Validation Error Modal */}
        {validationErrorModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
              <h3 className="mb-4 text-lg font-semibold text-red-600">
                {validationErrorModal.issue === 'time'
                  ? 'No Time Overlap'
                  : 'Bag Capacity Exceeded'}
              </h3>
              <p className="mb-4 text-sm text-gray-700">
                {validationErrorModal.issue === 'time'
                  ? `The rider "${validationErrorModal.rider.name}" has no time overlap with group #${validationErrorModal.group.ride_id}.`
                  : `Adding this rider would exceed the bag capacity limit (10 bags) for groups with 4+ members.`}
              </p>
              <div className="mb-4 rounded-lg bg-gray-50 p-4">
                <p className="mb-2 text-xs font-semibold text-gray-600">
                  Group #{validationErrorModal.group.ride_id}:
                </p>
                <p className="text-sm text-gray-900">
                  Members: {validationErrorModal.group.riders.length + 1} (after
                  adding)
                </p>
                {validationErrorModal.issue === 'bags' &&
                  (() => {
                    const allRiders = [
                      ...validationErrorModal.group.riders,
                      validationErrorModal.rider,
                    ]
                    let numLargeBags = 0
                    let numNormalBags = 0
                    for (const r of allRiders) {
                      numLargeBags += r.checked_bags
                      numNormalBags += r.carry_on_bags
                    }
                    const bagUnits = numLargeBags * 2 + numNormalBags
                    return (
                      <p className="text-sm text-gray-900">
                        Bag Units: {bagUnits} (exceeds limit of 10)
                      </p>
                    )
                  })()}
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => validationErrorModal.onCancel()}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    try {
                      await validationErrorModal.onAcknowledge()
                    } catch (error) {
                      console.error(
                        'Error acknowledging validation error:',
                        error,
                      )
                      setErrorMessage('Failed to add rider to group')
                      setTimeout(() => setErrorMessage(null), 3000)
                    }
                  }}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
                >
                  Acknowledge & Continue
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Time Conflict Modal */}
        {timeConflictModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
              <h3 className="mb-4 text-lg font-semibold text-red-600">
                Time/Date Conflict
              </h3>
              <p className="mb-4 text-sm text-gray-700">
                You are trying to drag a user into a group where they have no
                overlap.
              </p>
              <div className="mb-4 space-y-3 rounded-lg bg-gray-50 p-4">
                <div>
                  <p className="mb-1 text-xs font-semibold text-gray-600">
                    Group #{timeConflictModal.group.ride_id}:
                  </p>
                  <p className="text-sm text-gray-900">
                    Date: {timeConflictModal.group.date}
                  </p>
                  <p className="text-sm text-gray-900">
                    Time:{' '}
                    {timeConflictModal.group.match_time
                      ? formatTime(timeConflictModal.group.match_time)
                      : formatTimeRange(
                          calculateGroupTimeRange(
                            timeConflictModal.group.riders,
                          ),
                        )}
                  </p>
                </div>
                <div className="border-t border-gray-300 pt-3">
                  <p className="mb-1 text-xs font-semibold text-gray-600">
                    User ({timeConflictModal.rider.name}):
                  </p>
                  <p className="text-sm text-gray-900">
                    Date: {timeConflictModal.rider.date}
                  </p>
                  <p className="text-sm text-gray-900">
                    Time: {formatTimeRange(timeConflictModal.rider.time_range)}
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setTimeConflictModal(null)
                    setDraggedRider(null)
                  }}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (timeConflictModal.onConfirm) {
                      await timeConflictModal.onConfirm()
                    }
                  }}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
