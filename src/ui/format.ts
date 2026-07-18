export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export function formatMatchDate(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Data no disponible'
  }

  return new Intl.DateTimeFormat('ca-ES', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}
