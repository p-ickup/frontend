/** @jest-environment node */

jest.mock('server-only', () => ({}))

import {
  createOwnFlight,
  deleteOwnFlight,
  updateOwnFlight,
} from '@/lib/server/studentCommands'

const completeProfile = {
  firstname: 'Taylor',
  lastname: 'Student',
  school: 'Pomona',
  email: 'taylor@example.com',
  phonenumber: '9095551234',
}

const completeFlightPayload = (date: string) => ({
  to_airport: true,
  airport: 'LAX',
  flight_no: 123,
  airline_iata: 'AA',
  date,
  bag_no_personal: 0,
  bag_no: 0,
  bag_no_large: 0,
  earliest_time: '08:00',
  latest_time: '09:00',
})

const profileQuery = () => {
  const maybeSingle = jest.fn().mockResolvedValue({
    data: completeProfile,
    error: null,
  })
  const eq = jest.fn(() => ({ maybeSingle }))
  return { select: jest.fn(() => ({ eq })) }
}

const flightLookup = (date: string) => {
  const maybeSingle = jest.fn().mockResolvedValue({
    data: { flight_id: 77, user_id: 'student-1', date },
    error: null,
  })
  const eq = jest.fn(() => ({ maybeSingle }))
  return { select: jest.fn(() => ({ eq })) }
}

const createClient = () => {
  const single = jest.fn().mockResolvedValue({
    data: { flight_id: 321 },
    error: null,
  })
  const select = jest.fn(() => ({ single }))
  const insert = jest.fn(() => ({ select }))
  const from = jest
    .fn()
    .mockReturnValueOnce(profileQuery())
    .mockReturnValueOnce({ insert })

  return { from, insert }
}

describe('student flight deadline enforcement at the server boundary', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('allows creation at the exact spring deadline instant', async () => {
    jest.setSystemTime(new Date('2026-03-06T23:59:59-08:00'))
    const { from, insert } = createClient()

    await expect(
      createOwnFlight({
        supabase: { from },
        userId: 'student-1',
        payload: completeFlightPayload('2026-03-13'),
      }),
    ).resolves.toEqual({ success: true, flightId: 321 })

    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({
        date: '2026-03-13',
        user_id: 'student-1',
        matching_status: 'submitted',
      }),
    ])
  })

  it('rejects creation immediately after the spring deadline', async () => {
    jest.setSystemTime(new Date('2026-03-07T00:00:00-08:00'))
    const from = jest.fn()

    await expect(
      createOwnFlight({
        supabase: { from },
        userId: 'student-1',
        payload: completeFlightPayload('2026-03-13'),
      }),
    ).rejects.toMatchObject({
      message: 'The submission deadline for this service period has passed.',
      status: 403,
    })

    expect(from).not.toHaveBeenCalled()
  })

  it('enforces the separate winter outbound deadline on updates', async () => {
    jest.setSystemTime(new Date('2025-12-04T00:00:00-08:00'))
    const from = jest.fn().mockReturnValueOnce(flightLookup('2025-12-10'))
    const rpc = jest.fn()

    await expect(
      updateOwnFlight({
        supabase: { from, rpc },
        userId: 'student-1',
        flightId: 77,
        payload: { airport: 'ONT' },
      }),
    ).rejects.toMatchObject({
      message: 'This flight can no longer be edited.',
      status: 403,
    })

    expect(rpc).not.toHaveBeenCalled()
  })

  it('rejects changing an editable flight to a period past its deadline', async () => {
    jest.setSystemTime(new Date('2026-05-07T00:00:00-07:00'))
    const from = jest
      .fn()
      .mockReturnValueOnce(flightLookup('2099-01-20'))
      .mockReturnValueOnce(profileQuery())
    const rpc = jest.fn()

    await expect(
      updateOwnFlight({
        supabase: { from, rpc },
        userId: 'student-1',
        flightId: 77,
        payload: { date: '2026-05-15' },
      }),
    ).rejects.toMatchObject({
      message:
        'The submission deadline for the updated service period has passed.',
      status: 403,
    })

    expect(from).toHaveBeenCalledTimes(2)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('allows an update at the exact summer PDT deadline instant', async () => {
    jest.setSystemTime(new Date('2026-05-06T23:59:59-07:00'))
    const rpc = jest.fn().mockResolvedValue({
      data: { success: true },
      error: null,
    })
    const from = jest
      .fn()
      .mockReturnValueOnce(flightLookup('2026-05-15'))
      .mockReturnValueOnce(profileQuery())

    await expect(
      updateOwnFlight({
        supabase: { from, rpc },
        userId: 'student-1',
        flightId: 77,
        payload: { date: '2026-05-16' },
      }),
    ).resolves.toEqual({ success: true })

    expect(rpc).toHaveBeenCalledWith('update_own_flight_tx', {
      p_flight_id: 77,
      p_fields: { date: '2026-05-16' },
    })
  })

  it('enforces the separate winter return deadline on deletion', async () => {
    jest.setSystemTime(new Date('2026-01-10T00:00:00-08:00'))
    const from = jest.fn().mockReturnValueOnce(flightLookup('2026-01-18'))
    const rpc = jest.fn()

    await expect(
      deleteOwnFlight({
        supabase: { from, rpc },
        userId: 'student-1',
        flightId: 77,
      }),
    ).rejects.toMatchObject({
      message: 'This flight can no longer be deleted.',
      status: 403,
    })

    expect(rpc).not.toHaveBeenCalled()
  })

  it('allows deletion before the winter return deadline', async () => {
    jest.setSystemTime(new Date('2026-01-09T23:59:58-08:00'))
    const from = jest.fn().mockReturnValueOnce(flightLookup('2026-01-18'))
    const rpc = jest.fn().mockResolvedValue({
      data: { success: true },
      error: null,
    })

    await expect(
      deleteOwnFlight({
        supabase: { from, rpc },
        userId: 'student-1',
        flightId: 77,
      }),
    ).resolves.toEqual({ success: true })

    expect(rpc).toHaveBeenCalledWith('delete_own_flight_tx', {
      p_flight_id: 77,
    })
  })

  it('does not invent a deadline for dates outside configured periods', async () => {
    jest.setSystemTime(new Date('2026-06-14T12:00:00-07:00'))
    const from = jest.fn().mockReturnValueOnce(flightLookup('2026-07-15'))
    const rpc = jest.fn().mockResolvedValue({
      data: { success: true },
      error: null,
    })

    await expect(
      deleteOwnFlight({
        supabase: { from, rpc },
        userId: 'student-1',
        flightId: 77,
      }),
    ).resolves.toEqual({ success: true })
  })
})
