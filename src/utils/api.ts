export class ApiRouteError extends Error {
  status: number
  details?: unknown

  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.name = 'ApiRouteError'
    this.status = status
    this.details = details
  }
}

export async function requestJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  })

  let payload: any = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok) {
    const message =
      payload?.error || payload?.message || 'Request failed unexpectedly'
    throw new ApiRouteError(message, response.status, payload)
  }

  return payload as T
}

export async function postJson<T>(
  input: RequestInfo | URL,
  body?: unknown,
): Promise<T> {
  return requestJson<T>(input, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export async function patchJson<T>(
  input: RequestInfo | URL,
  body?: unknown,
): Promise<T> {
  return requestJson<T>(input, {
    method: 'PATCH',
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export async function deleteJson<T>(
  input: RequestInfo | URL,
  body?: unknown,
): Promise<T> {
  return requestJson<T>(input, {
    method: 'DELETE',
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}
