export const normalizeDateToYYYYMMDD = (
  value: string | null | undefined,
): string => {
  if (value == null || value === '') return ''

  const trimmed = String(value).trim()
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : trimmed
}

export const getTodayInPST = (): string => {
  return new Date().toLocaleDateString('en-CA', {
    timeZone: 'America/Los_Angeles',
  })
}

export const getDateInPST = (dateString: string): string => {
  if (!dateString) return ''

  const trimmed = dateString.trim()
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/)
  if (match) return match[1]

  const date = new Date(trimmed)
  if (isNaN(date.getTime())) {
    console.warn('Invalid date string:', dateString)
    return trimmed
  }

  return date.toLocaleDateString('en-CA', {
    timeZone: 'America/Los_Angeles',
  })
}

export const isDatePassed = (dateString: string): boolean => {
  return getDateInPST(dateString) < getTodayInPST()
}
