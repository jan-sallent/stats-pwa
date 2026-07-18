import { getMatchEvents } from '../db/events'
import { getMatch, listMatchesNewestFirst } from '../db/matches'
import type {
  MatchEventRecord,
  MatchRecord,
  MatchStatus,
  Phase,
} from '../models/types'
import { downloadCsv, serializeCsv, type CsvColumn, type CsvValue } from './csv'

interface MatchCsvRow {
  partit_id: string
  registre_id: string
  ordre: CsvValue
  rival: string
  data_hora: string
  competicio: string
  jornada: string
  estat_partit: string
  tipus_registre: string
  part: CsvValue
  possessio: CsvValue
  fase: string
  accio_id: string
  accio: string
  dorsal: CsvValue
  finalitza_possessio: CsvValue
  data_registre: string
}

const columns: readonly CsvColumn<MatchCsvRow>[] = [
  { header: 'partit_id', value: (row) => row.partit_id },
  { header: 'registre_id', value: (row) => row.registre_id },
  { header: 'ordre', value: (row) => row.ordre },
  { header: 'rival', value: (row) => row.rival },
  { header: 'data_hora', value: (row) => row.data_hora },
  { header: 'competicio', value: (row) => row.competicio },
  { header: 'jornada', value: (row) => row.jornada },
  { header: 'estat_partit', value: (row) => row.estat_partit },
  { header: 'tipus_registre', value: (row) => row.tipus_registre },
  { header: 'part', value: (row) => row.part },
  { header: 'possessio', value: (row) => row.possessio },
  { header: 'fase', value: (row) => row.fase },
  { header: 'accio_id', value: (row) => row.accio_id },
  { header: 'accio', value: (row) => row.accio },
  { header: 'dorsal', value: (row) => row.dorsal },
  { header: 'finalitza_possessio', value: (row) => row.finalitza_possessio },
  { header: 'data_registre', value: (row) => row.data_registre },
]

export async function downloadMatchCsv(matchId: string): Promise<void> {
  const match = await getMatch(matchId)

  if (!match) {
    throw new Error('Match not found')
  }

  const events = await getMatchEvents(matchId)
  const rows = createMatchRows(match, events)
  downloadCsv(createMatchFilename(match), serializeCsv(rows, columns))
}

export async function downloadAllMatchesCsv(): Promise<void> {
  const matches = await listMatchesNewestFirst()
  const rows = (
    await Promise.all(
      matches.map(async (match) => createMatchRows(match, await getMatchEvents(match.id))),
    )
  ).flat()

  downloadCsv(`handbol_partits_${getDateStamp()}.csv`, serializeCsv(rows, columns))
}

function createMatchRows(
  match: MatchRecord,
  events: readonly MatchEventRecord[],
): MatchCsvRow[] {
  if (events.length === 0) {
    return [createEmptyMatchRow(match)]
  }

  return events.map((event) => createEventRow(match, event))
}

function createEventRow(match: MatchRecord, event: MatchEventRecord): MatchCsvRow {
  const common = createCommonFields(match)

  if (event.payload.kind === 'period-change') {
    return {
      ...common,
      registre_id: event.id,
      ordre: event.sequence,
      tipus_registre: 'canvi_part',
      part: 2,
      possessio: '',
      fase: translatePhase(event.payload.startingPhase),
      accio_id: '',
      accio: 'Inici 2a part',
      dorsal: '',
      finalitza_possessio: '',
      data_registre: event.createdAt,
    }
  }

  return {
    ...common,
    registre_id: event.id,
    ordre: event.sequence,
    tipus_registre: 'accio',
    part: event.payload.period,
    possessio: event.payload.possession,
    fase: translatePhase(event.payload.phase),
    accio_id: event.payload.actionId,
    accio: event.payload.actionLabel,
    dorsal: event.payload.playerNumber,
    finalitza_possessio: event.payload.endsPossession,
    data_registre: event.createdAt,
  }
}

function createEmptyMatchRow(match: MatchRecord): MatchCsvRow {
  return {
    ...createCommonFields(match),
    registre_id: '',
    ordre: '',
    tipus_registre: 'partit',
    part: '',
    possessio: '',
    fase: translatePhase(match.initialPhase),
    accio_id: '',
    accio: '',
    dorsal: '',
    finalitza_possessio: '',
    data_registre: match.createdAt,
  }
}

function createCommonFields(match: MatchRecord): Pick<
  MatchCsvRow,
  | 'partit_id'
  | 'rival'
  | 'data_hora'
  | 'competicio'
  | 'jornada'
  | 'estat_partit'
> {
  return {
    partit_id: match.id,
    rival: protectSpreadsheetText(match.opponent),
    data_hora: match.scheduledAt,
    competicio: protectSpreadsheetText(match.competition),
    jornada: protectSpreadsheetText(match.round),
    estat_partit: translateStatus(match.status),
  }
}

function translatePhase(phase: Phase): string {
  return phase === 'attack' ? 'atac' : 'defensa'
}

function translateStatus(status: MatchStatus): string {
  switch (status) {
    case 'draft':
      return 'esborrany'
    case 'in-progress':
      return 'en_curs'
    case 'finished':
      return 'finalitzat'
  }
}

function createMatchFilename(match: MatchRecord): string {
  const opponent = createFilenamePart(match.opponent || 'sense-rival')
  const date = match.scheduledAt.slice(0, 10) || getDateStamp()
  return `handbol_${opponent}_${date}.csv`
}

function createFilenamePart(value: string): string {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || 'partit'
}

function getDateStamp(): string {
  return new Date().toISOString().slice(0, 10)
}

function protectSpreadsheetText(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value
}
