/** Serialitzador CSV genèric i descàrrega de fitxers al navegador. */
export type CsvValue = string | number | boolean | null | undefined

export interface CsvColumn<Row> {
  header: string
  value: (row: Row) => CsvValue
}

export function serializeCsv<Row>(
  rows: readonly Row[],
  columns: readonly CsvColumn<Row>[],
  delimiter = ';',
): string {
  // El BOM UTF-8 i CRLF milloren la compatibilitat amb Excel a Windows.
  const header = columns.map((column) => encodeCell(column.header, delimiter)).join(delimiter)
  const body = rows.map((row) =>
    columns.map((column) => encodeCell(column.value(row), delimiter)).join(delimiter),
  )

  return `\uFEFF${[header, ...body].join('\r\n')}\r\n`
}

export function downloadCsv(filename: string, content: string): void {
  const normalizedFilename = filename.toLowerCase().endsWith('.csv')
    ? filename
    : `${filename}.csv`
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  // L'URL temporal permet iniciar una descàrrega sense servidor.
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = normalizedFilename
  link.hidden = true
  document.body.append(link)
  link.click()
  link.remove()

  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function encodeCell(value: CsvValue, delimiter: string): string {
  if (value === null || value === undefined) {
    return ''
  }

  const text = String(value)
  // RFC 4180: els delimitadors, salts de línia i cometes obliguen a citar la cel·la.
  const mustQuote = text.includes(delimiter) || /["\r\n]/.test(text)

  return mustQuote ? `"${text.replaceAll('"', '""')}"` : text
}
