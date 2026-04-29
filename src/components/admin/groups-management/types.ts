import type { User } from '@supabase/supabase-js'

import type { NoShowRiderInfo } from '@/utils/adminMatchNoShows'

export interface AdminDashboardProps {
  user: User
}

export interface Rider {
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
  originGroupId?: number
  originType?: 'unmatched' | 'group'
  school?: string
  original_unmatched?: boolean
  no_show?: NoShowRiderInfo
}

export interface Group {
  ride_id: number
  airport: string
  date: string
  time_range: string
  match_time?: string
  to_airport: boolean
  riders: Rider[]
  recommended_time?: string
  group_voucher?: string
  uber_type?: string | null
  is_subsidized?: boolean | null
  subsidized_override?: boolean
  uber_type_override?: boolean
}

export interface ChangeLogEntry {
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
    | 'UPDATE_RIDER_DETAILS'
    | 'EMAIL_CONFIRMED'
    | 'ADD_FLIGHT'
    | 'ASPC_DELAY'
  algorithm_run_id?: string | null
  change_batch_id?: string | null
  target_group_id?: string | null
  target_user_id?: string | null
  ignored_error: boolean
  confirmed?: boolean
  metadata?: any
  created_at: string
  actor_name?: string
}

export type ActiveTab = 'matched' | 'unmatched'
export type CorralTab = 'riders' | 'changes'
export type LeftSidebarTab = 'filters' | 'createGroup'
export type ChangeLogSortBy = 'date' | 'actor' | 'action'
export type ChangeLogSortDirection = 'asc' | 'desc'
export type OverrideSubsidized = 'auto' | 'yes' | 'no'
export type OverrideUberType = 'auto' | 'X' | 'XL' | 'XXL' | 'Connect'

export interface SortingRule {
  field: 'bag_size' | 'group_size' | 'date' | 'time' | 'ride_id'
  direction: 'asc' | 'desc'
}

export interface ChangedGroup {
  group: Group
  changeType: 'modified' | 'deleted'
  changedAt: string
  emailsSent: boolean
  changeLogId?: string
  changeLogIds?: string[]
  changeDescriptions?: string[]
}

export interface UnmatchedIndividual {
  rider: Rider
  becameUnmatchedAt: string
  emailSent: boolean
  changeLogId?: string
  changeLogIds?: string[]
}

export interface EditRiderForm {
  flight_no: string
  airline_iata: string
  airport: string
  to_airport: boolean
  date: string
  time_range: string
}

export interface TimeConflictModalState {
  rider: Rider
  group: Group
  onConfirm: () => Promise<void>
}

export interface ValidationErrorModalState {
  rider: Rider
  group: Group
  issue: 'time' | 'bags'
  onAcknowledge: () => Promise<void>
  onCancel: () => void
}
