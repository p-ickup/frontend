import type { ChangeLogEntry, Group, Rider } from '../types'

export interface FormattedChangeLogEntry {
  role: string
  actorName: string
  actionText: string
  personName: string | null
  groupId: string | null
  formattedDateTime: string
}

export const getChangeDescription = (action: string): string => {
  switch (action) {
    case 'ADD_TO_GROUP':
      return 'Added member'
    case 'REMOVE_FROM_GROUP':
      return 'Removed member'
    case 'UPDATE_GROUP_TIME':
      return 'Updated time'
    case 'UPDATE_VOUCHER':
      return 'Updated voucher'
    case 'UPDATE_RIDER_DETAILS':
      return 'Updated rider details'
    case 'CREATE_GROUP':
      return 'Group created'
    case 'DELETE_GROUP':
      return 'Group deleted'
    case 'ADD_FLIGHT':
      return 'Added flight'
    case 'ASPC_DELAY':
      return 'ASPC delay (rider)'
    default:
      return 'Modified'
  }
}

export const consolidateChangeDescriptions = (
  descriptions: string[],
): string[] => {
  const hasAddMember = descriptions.includes('Added member')
  const hasRemoveMember = descriptions.includes('Removed member')
  const otherChanges = descriptions.filter(
    (description) =>
      description !== 'Added member' && description !== 'Removed member',
  )

  const consolidated: string[] = []

  if (hasAddMember && hasRemoveMember) {
    consolidated.push('Updated group members')
  } else if (hasAddMember) {
    consolidated.push('Added member')
  } else if (hasRemoveMember) {
    consolidated.push('Removed member')
  }

  consolidated.push(...otherChanges)
  return consolidated
}

export const formatVoucher = (voucher: string | undefined): string => {
  if (!voucher) return ''
  const parts = voucher.split('/')
  return parts[parts.length - 1] || voucher
}

export const formatChangeLogEntry = (
  entry: ChangeLogEntry,
  options: {
    groups: Group[]
    unmatchedRiders: Rider[]
    corralRiders: Rider[]
  },
): FormattedChangeLogEntry => {
  const { groups, unmatchedRiders, corralRiders } = options
  const actorName = entry.actor_name || 'Unknown'
  const role =
    entry.action === 'ASPC_DELAY' ? 'Rider' : entry.actor_role || 'Admin'

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

  let personName: string | null = null
  if (entry.metadata?.rider_name) {
    personName = entry.metadata.rider_name
  } else if (entry.target_user_id) {
    const allRiders = [...unmatchedRiders, ...corralRiders]
    const groupRiders = groups.flatMap((group) => group.riders)
    const foundRider = [...allRiders, ...groupRiders].find(
      (rider) => rider.user_id === entry.target_user_id,
    )
    personName = foundRider?.name || null
  }

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

  let actionText = ''
  switch (entry.action) {
    case 'ADD_TO_GROUP': {
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
    }
    case 'REMOVE_FROM_GROUP':
      if (
        entry.metadata?.email_confirmed === true ||
        entry.metadata?.email_confirmed === 'true'
      ) {
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
        if (
          entry.metadata?.source === 'manual_add' ||
          entry.metadata?.action_description
        ) {
          if (entry.metadata?.action_description) {
            actionText = entry.metadata.action_description
          } else {
            const flightInfo = entry.metadata?.flight_no
              ? entry.metadata?.airline_iata
                ? `${entry.metadata.airline_iata} ${entry.metadata.flight_no}`
                : `Flight ${entry.metadata.flight_no}`
              : 'a flight'
            const dateInfo = entry.metadata?.date || ''
            if (personName) {
              actionText = `added new unmatched rider ${personName} with ${flightInfo} on ${dateInfo}`
            } else {
              actionText = `added new unmatched rider with ${flightInfo} on ${dateInfo}`
            }
          }
        } else if (personName && groupId) {
          actionText = `removed user ${personName} from group ${groupId} and left them as unmatched`
        } else if (personName) {
          actionText = `removed user ${personName} from a group and left them as unmatched`
        } else {
          actionText = 'removed a rider from a group and left them as unmatched'
        }
      } else if (personName && groupId) {
        actionText = `removed user ${personName} from group ${groupId}`
      } else if (personName) {
        actionText = `removed user ${personName} from a group`
      } else {
        actionText = 'removed a rider from a group'
      }
      break
    case 'CREATE_GROUP':
      actionText = groupId ? `created group ${groupId}` : 'created a new group'
      break
    case 'DELETE_GROUP':
      actionText = groupId ? `deleted group ${groupId}` : 'deleted a group'
      break
    case 'RUN_ALGORITHM': {
      const target = entry.metadata?.target || 'all targets'
      const mode = entry.metadata?.mode || 'manual'
      actionText = `ran the matching algorithm for ${target} (${mode} mode)`
      break
    }
    case 'IGNORE_ERROR':
      actionText = 'ignored an error'
      break
    case 'EMAIL_CONFIRMED':
      if (entry.metadata?.ride_id) {
        const riderCount = entry.metadata?.rider_count || 0
        const changeType = entry.metadata?.change_type || 'modified'
        actionText = `confirmed email sent for ${changeType} group ${groupId || `#${entry.metadata.ride_id}`} (${riderCount} rider${riderCount !== 1 ? 's' : ''})`
      } else if (personName) {
        actionText = `confirmed email sent for unmatched individual ${personName}`
      } else {
        actionText = 'confirmed email sent'
      }
      break
    case 'UPDATE_GROUP_TIME':
      if (
        entry.metadata?.email_confirmed === true ||
        entry.metadata?.email_confirmed === 'true'
      ) {
        if (entry.metadata?.ride_id) {
          const riderCount = entry.metadata?.rider_count || 0
          const changeType = entry.metadata?.change_type || 'modified'
          actionText = `confirmed email sent for ${changeType} group ${groupId || `#${entry.metadata.ride_id}`} (${riderCount} rider${riderCount !== 1 ? 's' : ''})`
        } else {
          actionText = 'confirmed email sent for a group'
        }
      } else {
        actionText = groupId
          ? `updated time for group ${groupId}`
          : 'updated time for a group'
      }
      break
    case 'UPDATE_VOUCHER': {
      const voucher = entry.metadata?.voucher || ''
      const formattedVoucher = voucher ? formatVoucher(voucher) : ''
      if (groupId) {
        actionText = voucher
          ? `updated voucher for group ${groupId} to ${formattedVoucher}`
          : `removed voucher for group ${groupId}`
      } else {
        actionText = voucher
          ? `updated voucher for a group to ${formattedVoucher}`
          : 'removed voucher for a group'
      }
      break
    }
    case 'UPDATE_RIDER_DETAILS': {
      const riderName = entry.metadata?.rider_name || personName || 'a rider'
      const changes: string[] = []

      if (
        entry.metadata?.old_flight_no !== undefined &&
        entry.metadata?.old_flight_no !== entry.metadata?.new_flight_no
      ) {
        changes.push(
          `flight number: ${entry.metadata.old_flight_no} → ${entry.metadata.new_flight_no}`,
        )
      }
      if (
        entry.metadata?.old_airline_iata !== undefined &&
        entry.metadata?.old_airline_iata !== entry.metadata?.new_airline_iata
      ) {
        changes.push(
          `airline: ${entry.metadata.old_airline_iata} → ${entry.metadata.new_airline_iata}`,
        )
      }
      if (
        entry.metadata?.old_airport !== undefined &&
        entry.metadata?.old_airport !== entry.metadata?.new_airport
      ) {
        changes.push(
          `airport: ${entry.metadata.old_airport} → ${entry.metadata.new_airport}`,
        )
      }
      if (
        entry.metadata?.old_to_airport !== undefined &&
        entry.metadata?.old_to_airport !== entry.metadata?.new_to_airport
      ) {
        const oldDir = entry.metadata.old_to_airport ? 'to' : 'from'
        const newDir = entry.metadata.new_to_airport ? 'to' : 'from'
        changes.push(`direction: ${oldDir} → ${newDir}`)
      }
      if (
        entry.metadata?.old_date !== undefined &&
        entry.metadata?.old_date !== entry.metadata?.new_date
      ) {
        changes.push(
          `date: ${entry.metadata.old_date} → ${entry.metadata.new_date}`,
        )
      }
      if (
        entry.metadata?.old_time_range !== undefined &&
        entry.metadata?.old_time_range !== entry.metadata?.new_time_range
      ) {
        changes.push(
          `time: ${entry.metadata.old_time_range} → ${entry.metadata.new_time_range}`,
        )
      }

      if (changes.length > 0) {
        actionText = groupId
          ? `updated ${riderName}'s details in group ${groupId} (${changes.join(', ')})`
          : `updated ${riderName}'s details (${changes.join(', ')})`
      } else {
        actionText = groupId
          ? `updated ${riderName}'s details in group ${groupId}`
          : `updated ${riderName}'s details`
      }
      break
    }
    case 'ASPC_DELAY': {
      const metadata = entry.metadata || {}
      const reason = (metadata.reason_for_delay as string) || 'delay reported'
      const oldFlightDate = metadata.old_flight_date as string | undefined
      const newDate = (metadata.new_eta_date as string) || ''
      const newTime =
        (metadata.new_eta_time_earliest as string) &&
        (metadata.new_eta_time_latest as string)
          ? `${metadata.new_eta_time_earliest}–${metadata.new_eta_time_latest}`
          : (metadata.new_eta_time as string) || ''
      let outcome: string

      if (metadata.outcome === 'kept_original_group_eta_earlier') {
        outcome =
          'kept on original group (new pickup time is before original group — not treated as a delay)'
      } else if (metadata.outcome === 'delay_no_group_unmatched') {
        outcome =
          'removed from group — unmatched (no alternate group, no contingency voucher)'
      } else if (metadata.outcome === 'solo_ride_created') {
        if (metadata.skipped_contingency_new_eta_before_original === true) {
          outcome = `moved to new solo group #${metadata.new_ride_id ?? '?'} (contingency not applied — new ETA before original group)`
        } else if (metadata.contingency_voucher_assigned === true) {
          outcome = `moved to new solo group #${metadata.new_ride_id ?? '?'} (contingency voucher applied)`
        } else if (metadata.contingency_voucher_assigned === false) {
          outcome = 'unmatched'
        } else {
          outcome = `moved to new solo group #${metadata.new_ride_id ?? '?'}`
        }
      } else {
        outcome = 'searched for alternate groups to join'
      }

      if (metadata.new_flight_no) {
        actionText = `reported delay (${reason}): new flight ${metadata.new_flight_airport ?? ''} ${metadata.new_flight_no} on ${metadata.new_flight_date}; ${outcome}`
      } else {
        actionText = `reported delay (${reason}): flight date ${oldFlightDate ?? '—'} → new ETA ${newDate} ${newTime}; ${outcome}`
      }
      break
    }
    case 'ADD_FLIGHT': {
      const addFlightIdentifier =
        entry.metadata?.airline_iata && entry.metadata?.flight_no
          ? `${entry.metadata.airline_iata} ${entry.metadata.flight_no}`
          : entry.metadata?.flight_no
            ? `Flight ${entry.metadata.flight_no}`
            : 'a flight'
      const addFlightDate = entry.metadata?.date || ''
      const addFlightRiderName =
        entry.metadata?.rider_name || personName || 'a rider'

      if (entry.metadata?.action_description) {
        actionText = entry.metadata.action_description
      } else {
        actionText = `added new flight ${addFlightIdentifier} for ${addFlightRiderName} on ${addFlightDate}`
      }
      break
    }
  }

  return {
    role,
    actorName,
    actionText,
    personName,
    groupId,
    formattedDateTime,
  }
}
