/** Utilitats de presentació compartides per les pantalles. */

/** Escapa text extern abans d'inserir-lo en plantilles HTML construïdes com a text. */
export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export function formatMatchDate(value: string): string {
  // Intl respecta el format català i la zona horària del dispositiu.
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Data no disponible'
  }

  return new Intl.DateTimeFormat('ca-ES', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}
