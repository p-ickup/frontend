import {
  toAdminGroupRowDto,
  toAdminGroupsSnapshotResponseDto,
  toAdminSummaryDto,
  toOwnUnmatchedFlightDto,
  toProfileCompletenessDto,
  toResultMatchDto,
  toResultsResponseDto,
  toUnmatchedFlightDto,
  toUnmatchedOptionsResponseDto,
} from '@/contracts/readModels'

describe('read-model response contracts', () => {
  it('returns only the declared Results fields', () => {
    const result = toResultMatchDto({
      ride_id: 7,
      user_id: 'user-1',
      date: '2026-06-20',
      time: '08:00:00',
      voucher: 'voucher',
      contingency_voucher: null,
      uber_type: 'X',
      ready_for_pickup_at: '2026-06-20T14:00:00Z',
      reported_missing_user_ids: [],
      group_ready_at: null,
      internal_note: 'must not escape',
      Flights: {
        airport: 'LAX',
        date: '2026-06-20',
        to_airport: true,
        terminal: '4',
      },
      Users: {
        user_id: 'user-1',
        firstname: 'Taylor',
        lastname: 'Student',
        phonenumber: '9095551234',
        photo_url: '/profile.webp',
        email: 'taylor@example.com',
        role: 'admin',
      },
    })

    expect(Object.keys(result)).toEqual([
      'ride_id',
      'user_id',
      'date',
      'time',
      'voucher',
      'contingency_voucher',
      'uber_type',
      'ready_for_pickup_at',
      'reported_missing_user_ids',
      'group_ready_at',
      'Flights',
      'Users',
    ])
    expect(Object.keys(result.Flights)).toEqual([
      'airport',
      'date',
      'to_airport',
    ])
    expect(Object.keys(result.Users)).toEqual([
      'user_id',
      'firstname',
      'lastname',
      'phonenumber',
      'photo_url',
      'email',
    ])
    expect(
      Object.keys(
        toResultsResponseDto({
          success: true,
          matches: [result],
          debug: 'must not escape',
        }),
      ),
    ).toEqual(['success', 'matches'])
  })

  it('returns only the declared Unmatched and profile-completeness fields', () => {
    const flight = toUnmatchedFlightDto({
      flight_id: 11,
      user_id: 'user-2',
      airport: 'SNA',
      date: '2026-06-21',
      earliest_time: '09:00:00',
      latest_time: '10:00:00',
      to_airport: false,
      opt_in: true,
      matching_status: 'unmatched',
      Users: {
        firstname: 'Jordan',
        lastname: 'Student',
        email: 'jordan@example.com',
        phonenumber: 'hidden',
      },
    })
    const ownFlight = toOwnUnmatchedFlightDto({
      ...flight,
      user_id: 'must not escape',
    })
    const profile = toProfileCompletenessDto({
      firstname: 'Jordan',
      lastname: 'Student',
      school: 'Pomona',
      email: 'jordan@example.com',
      phonenumber: '9095559876',
      role: 'must not escape',
    })

    expect(Object.keys(flight)).toEqual([
      'flight_id',
      'user_id',
      'airport',
      'date',
      'earliest_time',
      'latest_time',
      'to_airport',
      'opt_in',
      'Users',
    ])
    expect(Object.keys(flight.Users || {})).toEqual([
      'firstname',
      'lastname',
      'email',
    ])
    expect(Object.keys(ownFlight)).toEqual([
      'flight_id',
      'airport',
      'date',
      'earliest_time',
      'latest_time',
    ])
    expect(Object.keys(profile)).toEqual([
      'firstname',
      'lastname',
      'school',
      'email',
      'phonenumber',
    ])
    expect(
      Object.keys(
        toUnmatchedOptionsResponseDto({
          success: true,
          flights: [flight],
          groups: [],
          myFlights: [ownFlight],
          userEligible: true,
          debug: 'must not escape',
        }),
      ),
    ).toEqual(['success', 'flights', 'groups', 'myFlights', 'userEligible'])
  })

  it('returns only declared admin summary and group-row fields', () => {
    const summary = toAdminSummaryDto({
      school: 'Pomona',
      matchRate: 75,
      matchedRiders: 3,
      totalRiders: 4,
      unmatchedFlightsCount: 6,
      algorithmLastRan: 'Jun 13',
      lastRunStatus: 'Completed',
      nextScheduledRunDate: 'Jun 20',
      nextScheduledRunTarget: 'ASPC',
      internal: 'must not escape',
    } as any)
    const group = toAdminGroupRowDto({
      ride_id: 9,
      airport: 'LAX',
      date: '2026-06-20',
      time_range: '08:00 - 09:00',
      to_airport: true,
      riders: [
        {
          user_id: 'user-1',
          flight_id: 22,
          name: 'Taylor Student',
          phone: '9095551234',
          checked_bags: 1,
          carry_on_bags: 1,
          time_range: '08:00 - 09:00',
          airport: 'LAX',
          to_airport: true,
          date: '2026-06-20',
          internal: 'must not escape',
        } as any,
      ],
      internal: 'must not escape',
    } as any)

    expect(Object.keys(summary)).toEqual([
      'school',
      'matchRate',
      'matchedRiders',
      'totalRiders',
      'unmatchedFlightsCount',
      'algorithmLastRan',
      'lastRunStatus',
      'nextScheduledRunDate',
      'nextScheduledRunTarget',
    ])
    expect(Object.keys(group)).toEqual([
      'ride_id',
      'airport',
      'date',
      'time_range',
      'to_airport',
      'riders',
    ])
    expect(Object.keys(group.riders[0])).toEqual([
      'user_id',
      'flight_id',
      'name',
      'phone',
      'checked_bags',
      'carry_on_bags',
      'time_range',
      'airport',
      'to_airport',
      'date',
    ])
  })

  it('returns only declared Admin Groups snapshot fields', () => {
    const snapshot = toAdminGroupsSnapshotResponseDto({
      adminScope: 'Pomona',
      availableAirports: ['LAX'],
      groups: [
        {
          ride_id: 9,
          airport: 'LAX',
          date: '2026-06-20',
          time_range: '08:00 - 09:00',
          to_airport: true,
          riders: [],
          internal: 'must not escape',
        } as any,
      ],
      unmatchedRiders: [
        {
          user_id: 'user-1',
          flight_id: 22,
          name: 'Taylor Student',
          phone: '9095551234',
          checked_bags: 1,
          carry_on_bags: 1,
          time_range: '08:00 - 09:00',
          airport: 'LAX',
          to_airport: true,
          date: '2026-06-20',
          internal: 'must not escape',
        } as any,
      ],
      pagination: {
        page: 1,
        pageSize: 200,
        totalRecords: 1,
        totalPages: 1,
        internal: 'must not escape',
      } as any,
      dateRangeStart: '2026-06-01',
      dateRangeEnd: '2026-06-30',
      lastAlgorithmRunDate: '2026-06-10',
      internal: 'must not escape',
    } as any)

    expect(Object.keys(snapshot)).toEqual([
      'adminScope',
      'availableAirports',
      'groups',
      'unmatchedRiders',
      'pagination',
      'dateRangeStart',
      'dateRangeEnd',
      'lastAlgorithmRunDate',
    ])
    expect(Object.keys(snapshot.groups[0])).not.toContain('internal')
    expect(Object.keys(snapshot.unmatchedRiders[0])).not.toContain('internal')
    expect(Object.keys(snapshot.pagination)).toEqual([
      'page',
      'pageSize',
      'totalRecords',
      'totalPages',
    ])
  })
})
