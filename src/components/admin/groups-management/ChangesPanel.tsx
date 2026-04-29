'use client'

import { Copy, Flag, Mail, Phone } from 'lucide-react'
import { useState } from 'react'

import {
  confirmChangeLogEntries,
  findPendingUnmatchedChangeLogIds,
  findRelatedGroupChangeLogIds,
  sendAllMatchEmailsBatch,
} from './services/groupsWriteService'
import {
  useGroupsActionsContext,
  useGroupsDataContext,
  useGroupsUiContext,
} from './context'
import type { ChangedGroup, UnmatchedIndividual } from './types'

function ChangedGroupCard({
  changedGroup,
  onConfirmEmail,
  onEmailGroup,
  supabase,
  isConfirming = false,
}: {
  changedGroup: ChangedGroup
  onConfirmEmail: () => Promise<void>
  onEmailGroup?: (rideId: number) => Promise<void>
  supabase: any
  isConfirming?: boolean
}) {
  const [showContactInfo, setShowContactInfo] = useState(false)
  const [contactView, setContactView] = useState<'emails' | 'phones'>('emails')
  const [memberEmails, setMemberEmails] = useState<string[]>([])
  const [memberPhones, setMemberPhones] = useState<string[]>([])
  const [loadingEmails, setLoadingEmails] = useState(false)
  const [loadingPhones, setLoadingPhones] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)

  const fetchMemberEmails = async () => {
    if (memberEmails.length > 0) {
      if (contactView === 'emails' && showContactInfo) {
        setShowContactInfo(false)
      } else {
        setContactView('emails')
        setShowContactInfo(true)
      }
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
      setContactView('emails')
      setShowContactInfo(true)
    } catch (error) {
      console.error('Error fetching emails:', error)
    } finally {
      setLoadingEmails(false)
    }
  }

  const fetchMemberPhones = async () => {
    if (memberPhones.length > 0) {
      if (contactView === 'phones' && showContactInfo) {
        setShowContactInfo(false)
      } else {
        setContactView('phones')
        setShowContactInfo(true)
      }
      return
    }

    setLoadingPhones(true)
    try {
      const userIds = changedGroup.group.riders.map((r) => r.user_id)
      const { data: users, error } = await supabase
        .from('Users')
        .select('phonenumber')
        .in('user_id', userIds)

      if (error) {
        console.error('Error fetching phone numbers:', error)
        setLoadingPhones(false)
        return
      }

      const phones = users?.map((u: any) => u.phonenumber).filter(Boolean) || []
      setMemberPhones(phones)
      setContactView('phones')
      setShowContactInfo(true)
    } catch (error) {
      console.error('Error fetching phone numbers:', error)
    } finally {
      setLoadingPhones(false)
    }
  }

  const copyToClipboard = async () => {
    const textToCopy =
      contactView === 'emails'
        ? memberEmails.join('\n')
        : memberPhones.join('\n')

    if (textToCopy.length === 0) return

    try {
      await navigator.clipboard.writeText(textToCopy)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
    }
  }

  return (
    <div
      className={`rounded-lg border ${
        changedGroup.emailsSent
          ? 'border-gray-200 bg-gray-50'
          : 'border-yellow-300 bg-yellow-50'
      } ${showContactInfo ? 'p-0' : 'p-3'}`}
    >
      <div
        className={`flex items-start justify-between ${showContactInfo ? 'p-3 pb-0' : ''}`}
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
          {changedGroup.changeDescriptions &&
            changedGroup.changeDescriptions.length > 0 && (
              <div className="mt-1 space-y-0.5">
                {changedGroup.changeDescriptions.map((description, index) => (
                  <p key={index} className="text-xs text-gray-700">
                    {description}
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
          <div className="flex gap-0.5">
            <button
              onClick={fetchMemberEmails}
              disabled={loadingEmails}
              className={`rounded p-0.5 text-gray-600 hover:bg-gray-200 ${
                showContactInfo && contactView === 'emails' ? 'bg-gray-200' : ''
              }`}
              title="View member emails"
            >
              <Mail className="h-4 w-4" />
            </button>
            <button
              onClick={fetchMemberPhones}
              disabled={loadingPhones}
              className={`rounded p-0.5 text-gray-600 hover:bg-gray-200 ${
                showContactInfo && contactView === 'phones' ? 'bg-gray-200' : ''
              }`}
              title="View member phone numbers"
            >
              <Phone className="h-4 w-4" />
            </button>
          </div>
          {!changedGroup.emailsSent && (
            <div className="flex flex-col gap-1">
              {onEmailGroup && (
                <button
                  onClick={() => setShowEmailModal(true)}
                  disabled={isConfirming}
                  className={`rounded px-2 py-1 text-xs font-medium transition-all ${
                    isConfirming
                      ? 'cursor-not-allowed bg-gray-400 text-gray-200'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isConfirming ? 'Sending...' : 'Email group'}
                </button>
              )}
              <button
                onClick={onConfirmEmail}
                disabled={isConfirming}
                className={`rounded px-2 py-1 text-xs font-medium transition-all ${
                  isConfirming
                    ? 'cursor-not-allowed bg-gray-400 text-gray-200'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {isConfirming ? 'Confirming...' : 'Confirm'}
              </button>
            </div>
          )}
        </div>
      </div>

      {showEmailModal && onEmailGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-w-sm rounded-lg bg-white p-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">
              Send match emails
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              Send match notification emails to all{' '}
              {changedGroup.group.riders.length} rider
              {changedGroup.group.riders.length !== 1 ? 's' : ''} in Group #
              {changedGroup.group.ride_id}?
            </p>
            {emailError && (
              <p className="mt-2 text-sm text-red-600">{emailError}</p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowEmailModal(false)
                  setEmailError(null)
                }}
                disabled={isConfirming}
                className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setEmailError(null)
                  try {
                    await onEmailGroup(changedGroup.group.ride_id)
                    setShowEmailModal(false)
                  } catch (error) {
                    setEmailError(
                      error instanceof Error
                        ? error.message
                        : 'Failed to send emails',
                    )
                  }
                }}
                disabled={isConfirming}
                className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isConfirming ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showContactInfo && (
        <div className="mt-3 w-full rounded-b-lg bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-700">
              {contactView === 'emails'
                ? 'Member Emails:'
                : 'Member Phone Numbers:'}
            </p>
            {(contactView === 'emails'
              ? memberEmails.length > 0
              : memberPhones.length > 0) && (
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
                title={`Copy ${contactView === 'emails' ? 'emails' : 'phone numbers'} to clipboard`}
              >
                <Copy className="h-3 w-3" />
                {copied ? 'Copied!' : 'Copy'}
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {contactView === 'emails' ? (
              memberEmails.length > 0 ? (
                <div className="space-y-1">
                  {memberEmails.map((email, index) => (
                    <p
                      key={index}
                      className="break-words text-xs text-gray-600"
                    >
                      {email}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500">No emails found</p>
              )
            ) : memberPhones.length > 0 ? (
              <div className="space-y-1">
                {memberPhones.map((phone, index) => (
                  <p key={index} className="break-words text-xs text-gray-600">
                    {phone}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500">No phone numbers found</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function UnmatchedIndividualCard({
  item,
  onConfirmEmail,
  supabase,
  isConfirming = false,
}: {
  item: UnmatchedIndividual
  onConfirmEmail: () => Promise<void>
  supabase: any
  isConfirming?: boolean
}) {
  const [showContactInfo, setShowContactInfo] = useState(false)
  const [contactView, setContactView] = useState<'emails' | 'phones'>('emails')
  const [email, setEmail] = useState<string>('')
  const [phone, setPhone] = useState<string>('')
  const [loadingEmail, setLoadingEmail] = useState(false)
  const [loadingPhone, setLoadingPhone] = useState(false)
  const [copied, setCopied] = useState(false)

  const fetchEmail = async () => {
    if (email) {
      if (contactView === 'emails' && showContactInfo) {
        setShowContactInfo(false)
      } else {
        setContactView('emails')
        setShowContactInfo(true)
      }
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
      setContactView('emails')
      setShowContactInfo(true)
    } catch (error) {
      console.error('Error fetching email:', error)
    } finally {
      setLoadingEmail(false)
    }
  }

  const fetchPhone = async () => {
    if (phone) {
      if (contactView === 'phones' && showContactInfo) {
        setShowContactInfo(false)
      } else {
        setContactView('phones')
        setShowContactInfo(true)
      }
      return
    }

    setLoadingPhone(true)
    try {
      const { data: user, error } = await supabase
        .from('Users')
        .select('phonenumber')
        .eq('user_id', item.rider.user_id)
        .single()

      if (error) {
        console.error('Error fetching phone number:', error)
        setLoadingPhone(false)
        return
      }

      setPhone(user?.phonenumber || 'No phone number found')
      setContactView('phones')
      setShowContactInfo(true)
    } catch (error) {
      console.error('Error fetching phone number:', error)
    } finally {
      setLoadingPhone(false)
    }
  }

  const copyToClipboard = async () => {
    const textToCopy = contactView === 'emails' ? email : phone
    if (
      !textToCopy ||
      textToCopy === 'No email found' ||
      textToCopy === 'No phone number found'
    ) {
      return
    }

    try {
      await navigator.clipboard.writeText(textToCopy)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
    }
  }

  return (
    <div
      className={`rounded-lg border ${
        item.emailSent
          ? 'border-gray-200 bg-gray-50'
          : 'border-orange-300 bg-orange-50'
      } ${showContactInfo ? 'p-0' : 'p-3'}`}
    >
      <div
        className={`flex items-start justify-between ${showContactInfo ? 'p-3 pb-0' : ''}`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="flex items-center gap-1.5 font-semibold text-gray-900">
              {item.rider.name}
              {item.rider.original_unmatched && (
                <span title="Originally unmatched">
                  <Flag className="h-3 w-3 flex-shrink-0 text-amber-500" />
                </span>
              )}
            </p>
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
        </div>
        <div className="ml-4 flex flex-shrink-0 flex-col gap-1">
          <div className="flex gap-0.5">
            <button
              onClick={fetchEmail}
              disabled={loadingEmail}
              className={`rounded p-0.5 text-gray-600 hover:bg-gray-200 ${
                showContactInfo && contactView === 'emails' ? 'bg-gray-200' : ''
              }`}
              title="View email"
            >
              <Mail className="h-4 w-4" />
            </button>
            <button
              onClick={fetchPhone}
              disabled={loadingPhone}
              className={`rounded p-0.5 text-gray-600 hover:bg-gray-200 ${
                showContactInfo && contactView === 'phones' ? 'bg-gray-200' : ''
              }`}
              title="View phone number"
            >
              <Phone className="h-4 w-4" />
            </button>
          </div>
          {!item.emailSent && (
            <button
              onClick={onConfirmEmail}
              disabled={isConfirming}
              className={`rounded px-2 py-1 text-xs font-medium transition-all ${
                isConfirming
                  ? 'cursor-not-allowed bg-gray-400 text-gray-200'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {isConfirming ? 'Confirming...' : 'Confirm'}
            </button>
          )}
        </div>
      </div>
      {showContactInfo && (
        <div className="mt-3 w-full rounded-b-lg bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-700">
              {contactView === 'emails' ? 'Email:' : 'Phone Number:'}
            </p>
            {((contactView === 'emails' &&
              email &&
              email !== 'No email found') ||
              (contactView === 'phones' &&
                phone &&
                phone !== 'No phone number found')) && (
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
                title={`Copy ${contactView === 'emails' ? 'email' : 'phone number'} to clipboard`}
              >
                <Copy className="h-3 w-3" />
                {copied ? 'Copied!' : 'Copy'}
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            <p className="break-words text-xs text-gray-600">
              {contactView === 'emails' ? email : phone}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ChangesPanel() {
  const {
    fetchChangeLog,
    loadUnconfirmedChanges,
    logToChangeLog,
    setChangedGroups,
    setUnmatchedIndividuals,
    supabase,
  } = useGroupsActionsContext()
  const { changedGroups, unmatchedIndividuals } = useGroupsDataContext()
  const {
    confirmingGroups,
    confirmingIndividuals,
    setConfirmingGroups,
    setConfirmingIndividuals,
    setErrorMessage,
  } = useGroupsUiContext()

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-4">
      <div className="space-y-4">
        {changedGroups.filter(
          (changedGroup: ChangedGroup) => !changedGroup.emailsSent,
        ).length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-900">
              Changed Groups (
              {
                changedGroups.filter(
                  (changedGroup: ChangedGroup) => !changedGroup.emailsSent,
                ).length
              }
              )
            </h3>
            <div className="space-y-2">
              {changedGroups
                .filter(
                  (changedGroup: ChangedGroup) => !changedGroup.emailsSent,
                )
                .map((changedGroup: ChangedGroup) => {
                  const runConfirmFlow = async () => {
                    setConfirmingGroups((prev: Set<number>) =>
                      new Set(prev).add(changedGroup.group.ride_id),
                    )
                    try {
                      const relatedChangeLogIds =
                        await findRelatedGroupChangeLogIds({
                          supabase,
                          rideId: changedGroup.group.ride_id,
                        })
                      const changeLogIds =
                        relatedChangeLogIds.length > 0
                          ? relatedChangeLogIds
                          : changedGroup.changeLogId
                            ? [changedGroup.changeLogId]
                            : []

                      if (changeLogIds.length > 0) {
                        await confirmChangeLogEntries({
                          supabase,
                          changeLogIds,
                        })
                      }

                      try {
                        await logToChangeLog(
                          'UPDATE_GROUP_TIME',
                          {
                            email_confirmed: true,
                            ride_id: changedGroup.group.ride_id,
                            change_type: changedGroup.changeType,
                            rider_count: changedGroup.group.riders.length,
                            rider_names: changedGroup.group.riders.map(
                              (rider: any) => rider.name,
                            ),
                            rider_user_ids: changedGroup.group.riders.map(
                              (rider: any) => rider.user_id,
                            ),
                          },
                          undefined,
                          undefined,
                          true,
                        )
                      } catch (error) {
                        console.error(
                          '[onConfirmEmail] Error creating email confirmation entry:',
                          error,
                        )
                      }

                      setChangedGroups((prev: ChangedGroup[]) =>
                        prev.map((currentGroup) =>
                          currentGroup.group.ride_id ===
                          changedGroup.group.ride_id
                            ? { ...currentGroup, emailsSent: true }
                            : currentGroup,
                        ),
                      )

                      await fetchChangeLog()

                      setTimeout(() => {
                        loadUnconfirmedChanges()
                      }, 500)
                    } catch (confirmError) {
                      const error =
                        confirmError instanceof Error
                          ? confirmError
                          : new Error(String(confirmError))
                      console.error(
                        '[runConfirmFlow] Confirmation error:',
                        error,
                      )
                      setErrorMessage(
                        'Confirmation sync failed. Refresh the page to see the latest state.',
                      )
                      setTimeout(() => setErrorMessage(null), 5000)
                    } finally {
                      setConfirmingGroups((prev: Set<number>) => {
                        const next = new Set(prev)
                        next.delete(changedGroup.group.ride_id)
                        return next
                      })
                    }
                  }

                  const onEmailGroup = async () => {
                    setConfirmingGroups((prev: Set<number>) =>
                      new Set(prev).add(changedGroup.group.ride_id),
                    )
                    try {
                      await sendAllMatchEmailsBatch(changedGroup.group.ride_id)
                      await runConfirmFlow()
                    } catch (error) {
                      const message =
                        error instanceof Error
                          ? error.message
                          : 'Failed to send emails'
                      setErrorMessage(message)
                      setTimeout(() => setErrorMessage(null), 5000)
                      throw error
                    } finally {
                      setConfirmingGroups((prev: Set<number>) => {
                        const next = new Set(prev)
                        next.delete(changedGroup.group.ride_id)
                        return next
                      })
                    }
                  }

                  return (
                    <ChangedGroupCard
                      key={changedGroup.group.ride_id}
                      changedGroup={changedGroup}
                      isConfirming={confirmingGroups.has(
                        changedGroup.group.ride_id,
                      )}
                      onConfirmEmail={runConfirmFlow}
                      onEmailGroup={onEmailGroup}
                      supabase={supabase}
                    />
                  )
                })}
            </div>
          </div>
        )}

        {changedGroups.filter(
          (changedGroup: ChangedGroup) => changedGroup.emailsSent,
        ).length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-green-700">
              Confirmed/Emailed Groups (
              {
                changedGroups.filter(
                  (changedGroup: ChangedGroup) => changedGroup.emailsSent,
                ).length
              }
              )
            </h3>
            <div className="space-y-2">
              {changedGroups
                .filter((changedGroup: ChangedGroup) => changedGroup.emailsSent)
                .map((changedGroup: ChangedGroup) => (
                  <ChangedGroupCard
                    key={`confirmed-${changedGroup.group.ride_id}`}
                    changedGroup={changedGroup}
                    onConfirmEmail={async () => {}}
                    supabase={supabase}
                  />
                ))}
            </div>
          </div>
        )}

        {unmatchedIndividuals.filter(
          (item: UnmatchedIndividual) => !item.emailSent,
        ).length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-900">
              Unmatched Individuals (
              {
                unmatchedIndividuals.filter(
                  (item: UnmatchedIndividual) => !item.emailSent,
                ).length
              }
              )
            </h3>
            <div className="space-y-2">
              {unmatchedIndividuals
                .filter((item: UnmatchedIndividual) => !item.emailSent)
                .map((item: UnmatchedIndividual) => (
                  <UnmatchedIndividualCard
                    key={`${item.rider.user_id}-${item.rider.flight_id}`}
                    item={item}
                    isConfirming={confirmingIndividuals.has(
                      `${item.rider.user_id}-${item.rider.flight_id}`,
                    )}
                    onConfirmEmail={async () => {
                      const individualKey = `${item.rider.user_id}-${item.rider.flight_id}`
                      setConfirmingIndividuals((prev: Set<string>) =>
                        new Set(prev).add(individualKey),
                      )

                      try {
                        const relatedChangeLogIds =
                          await findPendingUnmatchedChangeLogIds({
                            supabase,
                            userId: item.rider.user_id,
                            flightId: item.rider.flight_id,
                          })

                        const changeLogIds =
                          relatedChangeLogIds.length > 0
                            ? relatedChangeLogIds
                            : item.changeLogId
                              ? [item.changeLogId]
                              : []

                        if (changeLogIds.length > 0) {
                          await confirmChangeLogEntries({
                            supabase,
                            changeLogIds,
                          })
                        }

                        await logToChangeLog(
                          'EMAIL_CONFIRMED',
                          {
                            rider_name: item.rider.name,
                            rider_user_id: item.rider.user_id,
                            rider_flight_id: item.rider.flight_id,
                            date: item.rider.date,
                          },
                          undefined,
                          item.rider.user_id,
                          true,
                        )

                        setUnmatchedIndividuals((prev: UnmatchedIndividual[]) =>
                          prev.map((currentItem) =>
                            currentItem.rider.flight_id === item.rider.flight_id
                              ? { ...currentItem, emailSent: true }
                              : currentItem,
                          ),
                        )

                        await fetchChangeLog()

                        setTimeout(async () => {
                          await loadUnconfirmedChanges()
                          setUnmatchedIndividuals(
                            (prev: UnmatchedIndividual[]) =>
                              prev.map((currentItem) => {
                                const wasEmailed = unmatchedIndividuals.find(
                                  (candidate: UnmatchedIndividual) =>
                                    candidate.rider.flight_id ===
                                    currentItem.rider.flight_id,
                                )?.emailSent

                                if (wasEmailed) {
                                  return { ...currentItem, emailSent: true }
                                }

                                return currentItem
                              }),
                          )
                        }, 500)
                      } finally {
                        setConfirmingIndividuals((prev: Set<string>) => {
                          const next = new Set(prev)
                          next.delete(individualKey)
                          return next
                        })
                      }
                    }}
                    supabase={supabase}
                  />
                ))}
            </div>
          </div>
        )}

        {unmatchedIndividuals.filter(
          (item: UnmatchedIndividual) => item.emailSent,
        ).length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold text-green-700">
              Confirmed/Emailed Unmatched Individuals (
              {
                unmatchedIndividuals.filter(
                  (item: UnmatchedIndividual) => item.emailSent,
                ).length
              }
              )
            </h3>
            <div className="space-y-2">
              {unmatchedIndividuals
                .filter((item: UnmatchedIndividual) => item.emailSent)
                .map((item: UnmatchedIndividual) => (
                  <UnmatchedIndividualCard
                    key={`confirmed-${item.rider.user_id}-${item.rider.flight_id}`}
                    item={item}
                    onConfirmEmail={async () => {}}
                    supabase={supabase}
                  />
                ))}
            </div>
          </div>
        )}

        {changedGroups.length === 0 && unmatchedIndividuals.length === 0 && (
          <p className="text-center text-sm text-gray-500">
            No changes to track
          </p>
        )}
      </div>
    </div>
  )
}
