/** Comprovació mínima del format CSV sense necessitar cap framework de proves. */
import { serializeCsv } from '../src/export/csv.ts'

const csv = serializeCsv(
  [{ text: 'Granollers; Nord', quote: 'A"B', number: 7 }],
  [
    { header: 'text', value: (row) => row.text },
    { header: 'quote', value: (row) => row.quote },
    { header: 'number', value: (row) => row.number },
  ],
)

const checks = [
  // BOM, delimitador citat, cometes escapades i final de línia CRLF.
  csv.startsWith('\uFEFF'),
  csv.includes('"Granollers; Nord"'),
  csv.includes('"A""B"'),
  csv.endsWith('\r\n'),
]

if (checks.some((check) => !check)) {
  throw new Error('CSV serializer check failed')
}

console.info('CSV serializer OK')
