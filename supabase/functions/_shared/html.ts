export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/** Turns admin-written plain text into email-safe HTML, keeping its line breaks. */
export function plainTextToHtml(text: string): string {
  return escapeHtml(text).replaceAll(/\r?\n/g, '<br>')
}
