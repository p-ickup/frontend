import {
  badRequestJson,
  routeErrorJson,
  withAdminRoute,
} from '@/lib/server/auth'
import {
  assertAdminScopeForChangeLogIds,
  assertAdminScopeForChangeLogPayload,
  assertAdminScopeForFlight,
  assertAdminScopeForFlights,
  assertAdminScopeForRide,
  assertAdminScopeForUser,
  assertAdminScopeForUserFlightPair,
  assertAdminScopeForUsers,
} from '@/lib/server/adminScope'
import { createServiceRoleClient } from '@/lib/server/serviceRole'
import {
  addUnmatchedFlight,
  confirmChangeLogEntries,
  createGroupRecords,
  deleteGroupRecords,
  logChangeLogEntry,
  moveRiderToGroup,
  moveRiderToCorral,
  removeRiderToUnmatched,
  setMatchingStatus,
  removeGroupMatch,
  saveGroupOverrideRecords,
  updateFlightRecord,
  updateGroupMatchesMetadata,
  updateGroupTimeRecords,
  updateGroupVoucherRecords,
} from '@/lib/server/adminGroupsCommands'
import { NextResponse } from 'next/server'

export const POST = withAdminRoute(async (request, auth) => {
  try {
    const body = await request.json()
    const action = String(body?.action || '')
    const payload = body?.payload || {}
    const adminSupabase = createServiceRoleClient()
    const actorName =
      `${auth.profile.firstname || ''} ${auth.profile.lastname || ''}`.trim() ||
      undefined

    switch (action) {
      case 'log_change_log_entry': {
        await assertAdminScopeForChangeLogPayload({
          supabase: adminSupabase,
          profile: auth.profile,
          metadata: payload.metadata,
          targetGroupId: Number.isFinite(Number(payload.targetGroupId))
            ? Number(payload.targetGroupId)
            : null,
          targetUserId:
            typeof payload.targetUserId === 'string'
              ? payload.targetUserId
              : null,
        })

        const entry = await logChangeLogEntry({
          supabase: adminSupabase,
          actorUserId: auth.user.id,
          actorRole: auth.profile.role,
          actorName,
          action: payload.action,
          metadata: payload.metadata,
          targetGroupId: payload.targetGroupId,
          targetUserId: payload.targetUserId,
          changeBatchId:
            typeof payload.changeBatchId === 'string'
              ? payload.changeBatchId
              : undefined,
          confirmed: payload.confirmed,
        })
        return NextResponse.json({ success: true, entry })
      }

      case 'update_group_time': {
        await assertAdminScopeForRide({
          supabase: adminSupabase,
          profile: auth.profile,
          rideId: Number(payload.groupId),
        })

        const result = await updateGroupTimeRecords({
          supabase: adminSupabase,
          groupId: payload.groupId,
          newTime: payload.newTime,
          newDate: payload.newDate,
        })
        return NextResponse.json(result)
      }

      case 'update_group_voucher': {
        await assertAdminScopeForRide({
          supabase: adminSupabase,
          profile: auth.profile,
          rideId: Number(payload.groupId),
        })

        const result = await updateGroupVoucherRecords({
          supabase: adminSupabase,
          groupId: payload.groupId,
          newVoucher: payload.newVoucher,
        })
        return NextResponse.json(result)
      }

      case 'update_flight_record': {
        await assertAdminScopeForFlight({
          supabase: adminSupabase,
          profile: auth.profile,
          flightId: Number(payload.flightId),
        })

        await updateFlightRecord({
          supabase: adminSupabase,
          flightId: payload.flightId,
          updates: payload.updates,
        })
        return NextResponse.json({ success: true })
      }

      case 'remove_group_match': {
        await Promise.all([
          assertAdminScopeForRide({
            supabase: adminSupabase,
            profile: auth.profile,
            rideId: Number(payload.groupId),
          }),
          assertAdminScopeForUser({
            supabase: adminSupabase,
            profile: auth.profile,
            userId: String(payload.userId),
          }),
          assertAdminScopeForFlight({
            supabase: adminSupabase,
            profile: auth.profile,
            flightId: Number(payload.flightId),
          }),
        ])

        await removeGroupMatch({
          supabase: adminSupabase,
          groupId: payload.groupId,
          userId: payload.userId,
          flightId: payload.flightId,
        })
        return NextResponse.json({ success: true })
      }

      case 'remove_rider_to_unmatched': {
        const requestedUpdates = payload.remainingGroupUpdates
        const remainingGroupUpdates =
          requestedUpdates && typeof requestedUpdates === 'object'
            ? {
                ...(typeof requestedUpdates.uber_type === 'string' ||
                requestedUpdates.uber_type === null
                  ? { uber_type: requestedUpdates.uber_type }
                  : {}),
                ...(typeof requestedUpdates.is_subsidized === 'boolean' ||
                requestedUpdates.is_subsidized === null
                  ? { is_subsidized: requestedUpdates.is_subsidized }
                  : {}),
                ...(typeof requestedUpdates.is_verified === 'boolean'
                  ? { is_verified: requestedUpdates.is_verified }
                  : {}),
              }
            : undefined

        await Promise.all([
          assertAdminScopeForRide({
            supabase: adminSupabase,
            profile: auth.profile,
            rideId: Number(payload.groupId),
          }),
          assertAdminScopeForUserFlightPair({
            supabase: adminSupabase,
            profile: auth.profile,
            userId: String(payload.userId),
            flightId: Number(payload.flightId),
          }),
        ])

        const result = await removeRiderToUnmatched({
          supabase: adminSupabase,
          actorUserId: auth.user.id,
          actorRole: auth.profile.role,
          actorName,
          groupId: Number(payload.groupId),
          userId: String(payload.userId),
          flightId: Number(payload.flightId),
          remainingGroupUpdates,
          changeMetadata: payload.changeMetadata || {},
        })
        return NextResponse.json({ success: true, ...result })
      }

      case 'move_rider_to_corral': {
        await Promise.all([
          assertAdminScopeForRide({
            supabase: adminSupabase,
            profile: auth.profile,
            rideId: Number(payload.groupId),
          }),
          assertAdminScopeForUserFlightPair({
            supabase: adminSupabase,
            profile: auth.profile,
            userId: String(payload.userId),
            flightId: Number(payload.flightId),
          }),
        ])
        const result = await moveRiderToCorral({
          supabase: adminSupabase,
          actorUserId: auth.user.id,
          actorRole: auth.profile.role,
          actorName,
          groupId: Number(payload.groupId),
          userId: String(payload.userId),
          flightId: Number(payload.flightId),
          remainingGroupUpdates: payload.remainingGroupUpdates,
          changeMetadata: payload.changeMetadata || {},
        })
        return NextResponse.json({ success: true, ...result })
      }

      case 'move_rider_to_group': {
        const destinationGroupId = Number(payload.destinationGroupId)
        const sourceGroupId = Number.isFinite(Number(payload.sourceGroupId))
          ? Number(payload.sourceGroupId)
          : undefined
        const changeLogIds = Array.isArray(payload.changeLogIds)
          ? payload.changeLogIds.map(String)
          : []

        await Promise.all([
          assertAdminScopeForRide({
            supabase: adminSupabase,
            profile: auth.profile,
            rideId: destinationGroupId,
          }),
          sourceGroupId
            ? assertAdminScopeForRide({
                supabase: adminSupabase,
                profile: auth.profile,
                rideId: sourceGroupId,
              })
            : Promise.resolve(),
          assertAdminScopeForUserFlightPair({
            supabase: adminSupabase,
            profile: auth.profile,
            userId: String(payload.userId),
            flightId: Number(payload.flightId),
          }),
          changeLogIds.length
            ? assertAdminScopeForChangeLogIds({
                supabase: adminSupabase,
                profile: auth.profile,
                changeLogIds,
              })
            : Promise.resolve(),
        ])

        const result = await moveRiderToGroup({
          supabase: adminSupabase,
          actorUserId: auth.user.id,
          actorRole: auth.profile.role,
          actorName,
          destinationGroupId,
          sourceGroupId,
          userId: String(payload.userId),
          flightId: Number(payload.flightId),
          date: String(payload.date),
          time: String(payload.time),
          voucher: String(payload.voucher || ''),
          isSubsidized: Boolean(payload.isSubsidized),
          uberType: String(payload.uberType),
          destinationGroupUpdates: payload.destinationGroupUpdates || {},
          sourceGroupUpdates: payload.sourceGroupUpdates,
          changeLogIds,
          sourceMetadata: payload.sourceMetadata,
          destinationMetadata: payload.destinationMetadata || {},
          changeBatchId: String(payload.changeBatchId),
        })
        return NextResponse.json({ success: true, ...result })
      }

      case 'update_group_matches_metadata': {
        await assertAdminScopeForRide({
          supabase: adminSupabase,
          profile: auth.profile,
          rideId: Number(payload.groupId),
        })

        await updateGroupMatchesMetadata({
          supabase: adminSupabase,
          groupId: payload.groupId,
          updates: payload.updates,
        })
        return NextResponse.json({ success: true })
      }

      case 'mark_flights_matched_state': {
        await assertAdminScopeForFlights({
          supabase: adminSupabase,
          profile: auth.profile,
          flightIds: Array.isArray(payload.flightIds)
            ? payload.flightIds.map(Number)
            : [Number(payload.flightIds)],
        })

        await setMatchingStatus({
          supabase: adminSupabase,
          flightIds: payload.flightIds,
          status: payload.matchingStatus,
        })
        return NextResponse.json({ success: true })
      }

      case 'delete_group_records': {
        await assertAdminScopeForRide({
          supabase: adminSupabase,
          profile: auth.profile,
          rideId: Number(payload.groupId),
        })

        if (Array.isArray(payload.flightIds) && payload.flightIds.length > 0) {
          await assertAdminScopeForFlights({
            supabase: adminSupabase,
            profile: auth.profile,
            flightIds: payload.flightIds.map(Number),
          })
        }

        await deleteGroupRecords({
          supabase: adminSupabase,
          groupId: payload.groupId,
          flightIds: payload.flightIds,
          markFlightsUnmatched: payload.markFlightsUnmatched,
        })
        return NextResponse.json({ success: true })
      }

      case 'save_group_override_records': {
        await assertAdminScopeForRide({
          supabase: adminSupabase,
          profile: auth.profile,
          rideId: Number(payload.groupId),
        })

        await saveGroupOverrideRecords({
          supabase: adminSupabase,
          groupId: payload.groupId,
          isSubsidized: payload.isSubsidized,
          uberType: payload.uberType,
          subsidizedOverride: payload.subsidizedOverride,
          uberTypeOverride: payload.uberTypeOverride,
        })
        return NextResponse.json({ success: true })
      }

      case 'confirm_change_log_entries': {
        await assertAdminScopeForChangeLogIds({
          supabase: adminSupabase,
          profile: auth.profile,
          changeLogIds: Array.isArray(payload.changeLogIds)
            ? payload.changeLogIds.map(String)
            : [],
        })

        await confirmChangeLogEntries({
          supabase: adminSupabase,
          changeLogIds: payload.changeLogIds,
        })
        return NextResponse.json({ success: true })
      }

      case 'create_group_records': {
        await Promise.all([
          assertAdminScopeForUsers({
            supabase: adminSupabase,
            profile: auth.profile,
            userIds: Array.isArray(payload.riders)
              ? payload.riders.map((rider: any) => String(rider.user_id))
              : [],
          }),
          assertAdminScopeForFlights({
            supabase: adminSupabase,
            profile: auth.profile,
            flightIds: Array.isArray(payload.riders)
              ? payload.riders.map((rider: any) => Number(rider.flight_id))
              : [],
          }),
        ])

        const result = await createGroupRecords({
          supabase: adminSupabase,
          rideDate: payload.rideDate,
          riders: payload.riders,
          formattedTime: payload.formattedTime,
          voucher: payload.voucher,
          contingencyVoucher: payload.contingencyVoucher,
          assignVoucher: payload.assignVoucher,
          uberType: payload.uberType,
          isSubsidized: payload.isSubsidized,
        })
        return NextResponse.json(result)
      }

      case 'add_unmatched_flight': {
        await assertAdminScopeForUser({
          supabase: adminSupabase,
          profile: auth.profile,
          userId: String(payload.flight?.user_id || ''),
        })

        const result = await addUnmatchedFlight({
          supabase: adminSupabase,
          payload: payload.flight,
        })
        return NextResponse.json(result)
      }

      default:
        return badRequestJson('Unsupported admin groups action.')
    }
  } catch (error: any) {
    return routeErrorJson(error, 'Failed to process admin group command.')
  }
})
