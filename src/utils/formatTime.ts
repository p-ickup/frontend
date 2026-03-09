/**
 * Convert 24-hour time (e.g. "14:30" or "14:30:00") to 12-hour format with AM/PM.
 */
export function formatTime12Hour(time24: string): string {
  if (!time24) return ''
  const parts = time24.split(':').map(Number)
  const hours = parts[0] ?? 0
  const minutes = parts[1] ?? 0
  const period = hours >= 12 ? 'PM' : 'AM'
  const hours12 = hours % 12 || 12
  return `${hours12}:${String(minutes).padStart(2, '0')} ${period}`
}
