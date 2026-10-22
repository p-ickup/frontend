'use client'

import { postJson } from '@/utils/api'
import { useEffect, useId, useState } from 'react'

type EmailPreview = {
  would_send: number
  preview?: Array<{ to: string | string[]; subject: string }>
}

type EmailSendResult = {
  sent: number
  failed: number
  total: number
}

type EmailComposerModalProps = {
  title: string
  /** Who receives the email, e.g. "matched riders from 2026-10-22, all airports" */
  audience: string
  /** Placeholders the edge function fills in per recipient */
  placeholders: string[]
  endpoint: string
  /** Recipient filters merged into every request */
  filters: Record<string, unknown>
  /** Returns an error message when the filters are incomplete */
  validate?: () => string | null
  onClose: () => void
}

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown error'

const pluralize = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? '' : 's'}`

export default function EmailComposerModal({
  title,
  audience,
  placeholders,
  endpoint,
  filters,
  validate,
  onClose,
}: EmailComposerModalProps) {
  const titleId = useId()
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [pending, setPending] = useState<'preview' | 'send' | null>(null)
  const [preview, setPreview] = useState<EmailPreview | null>(null)
  const [result, setResult] = useState<EmailSendResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [pending, onClose])

  const request = async <T,>(dryRun: boolean) =>
    postJson<T & { success?: boolean; message?: string }>(endpoint, {
      ...filters,
      dry_run: dryRun,
      custom_subject: subject,
      custom_body: body,
    })

  const run = async (kind: 'preview' | 'send') => {
    const validationError = validate?.() ?? null
    if (validationError) {
      setError(validationError)
      return
    }
    if (
      kind === 'send' &&
      !window.confirm(
        `Send this email to all ${audience}? This can't be undone.`,
      )
    ) {
      return
    }

    setPending(kind)
    setError(null)
    setPreview(null)
    setResult(null)
    try {
      if (kind === 'preview') {
        setPreview(await request<EmailPreview>(true))
      } else {
        setResult(await request<EmailSendResult>(false))
      }
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setPending(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={pending ? undefined : onClose}
      />

      <div className="relative flex max-h-full w-full max-w-3xl flex-col overflow-y-auto rounded-xl border border-gray-200 bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4 border-b pb-3">
          <div>
            <h2
              id={titleId}
              className="text-2xl font-semibold tracking-tight text-gray-800"
            >
              {title}
            </h2>
            <p className="mt-1 text-sm text-gray-600">To: {audience}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending !== null}
            aria-label="Close"
            className="rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        <label
          htmlFor={`${titleId}-subject`}
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Subject
        </label>
        <input
          id={`${titleId}-subject`}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="mb-5 w-full rounded-md border border-gray-300 p-2 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="Email subject..."
          autoFocus
        />

        <label
          htmlFor={`${titleId}-body`}
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Body
        </label>
        <textarea
          id={`${titleId}-body`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="h-40 w-full rounded-md border border-gray-300 p-3 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
          placeholder="Write your email here..."
        />
        <p className="mt-2 text-xs text-gray-500">
          Leave a field empty to use the standard subject or email. Plain text
          only. Placeholders, filled in for each recipient:{' '}
          {placeholders.map((placeholder, index) => (
            <span key={placeholder}>
              {index > 0 && ', '}
              <code className="rounded bg-gray-100 px-1">{placeholder}</code>
            </span>
          ))}
        </p>

        <div className="mt-6 border-t pt-5">
          <h3 className="mb-3 text-lg font-semibold text-gray-800">Preview</h3>
          <div className="whitespace-pre-wrap rounded-md border border-gray-200 bg-gray-50 p-4">
            <div className="mb-2 font-medium text-gray-900">
              {subject || '(Standard subject)'}
            </div>
            <div className="leading-relaxed text-gray-700">
              {body || '(Standard email)'}
            </div>
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-900"
          >
            {error}
          </p>
        )}

        {preview && (
          <div className="mt-4 rounded-lg border border-purple-200 bg-purple-50 p-4">
            <p className="text-sm font-medium text-purple-900">
              Preview: would send {pluralize(preview.would_send, 'email')}
            </p>
            {preview.preview && preview.preview.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-purple-800">
                {preview.preview.map((email, index) => (
                  <li key={index}>
                    {[email.to].flat().join(', ')}: {email.subject}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {result && (
          <p
            className={`mt-4 rounded-lg border p-4 text-sm font-medium ${
              result.failed > 0
                ? 'border-red-200 bg-red-50 text-red-900'
                : 'border-green-200 bg-green-50 text-green-900'
            }`}
          >
            Sent {result.sent} of {pluralize(result.total, 'email')}
            {result.failed > 0 && ` (${result.failed} failed)`}
          </p>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-3 border-t pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={pending !== null}
            className="rounded-md bg-gray-200 px-4 py-2 font-medium text-gray-700 hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => run('preview')}
            disabled={pending !== null}
            className="rounded-md bg-purple-600 px-4 py-2 font-medium text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending === 'preview' ? 'Checking...' : 'Preview Email'}
          </button>
          <button
            type="button"
            onClick={() => run('send')}
            disabled={pending !== null}
            className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending === 'send' ? 'Sending...' : 'Send Email'}
          </button>
        </div>
      </div>
    </div>
  )
}
