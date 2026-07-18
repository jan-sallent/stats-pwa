/** Transformació del model relacional local al CSV d'anàlisi. */
import { getMatchEvents } from '../db/events'
import { getMatch, listMatchesNewestFirst } from '../db/matches'
import { getTeam } from '../db/teams'
import type {
  MatchEventRecord,
  MatchRecord,
  MatchStatus,
  Phase,
} from '../models/types'
import { downloadCsv, serializeCsv, type CsvColumn, type CsvValue } from './csv'

interface MatchCsvRow {
  partit_id: string
  equip_id: string
  equip: string
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
  categoria_accio: string
  accio_id: string
  accio: string
  posicio_llancament: CsvValue
  jugador_id: string
  jugador_nom: string
  jugador_cognoms: string
  jugador_sobrenom: string
  dorsal: CsvValue
  posicio: string
  data_registre: string
}

// L'ordre d'aquesta llista és l'ordre estable de les columnes del fitxer final.
const columns: readonly CsvColumn<MatchCsvRow>[] = [
  { header: 'partit_id', value: (row) => row.partit_id },
  { header: 'equip_id', value: (row) => row.equip_id },
  { header: 'equip', value: (row) => row.equip },
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
  { header: 'categoria_accio', value: (row) => row.categoria_accio },
  { header: 'accio_id', value: (row) => row.accio_id },
  { header: 'accio', value: (row) => row.accio },
  { header: 'posicio_llancament', value: (row) => row.posicio_llancament },
  { header: 'jugador_id', value: (row) => row.jugador_id },
  { header: 'jugador_nom', value: (row) => row.jugador_nom },
  { header: 'jugador_cognoms', value: (row) => row.jugador_cognoms },
  { header: 'jugador_sobrenom', value: (row) => row.jugador_sobrenom },
  { header: 'dorsal', value: (row) => row.dorsal },
  { header: 'posicio', value: (row) => row.posicio },
  { header: 'data_registre', value: (row) => row.data_registre },
]

export async function downloadMatchCsv(matchId: string): Promise<void> {
  const match = await getMatch(matchId)

  if (!match) {
    throw new Error('Match not found')
  }

  const [events, team] = await Promise.all([
    getMatchEvents(matchId),
    match.teamId ? getTeam(match.teamId) : Promise.resolve(undefined),
  ])
  const rows = createMatchRows(match, events, team?.name ?? '')
  downloadCsv(createMatchFilename(match, team?.name ?? ''), serializeCsv(rows, columns))
}

export async function downloadAllMatchesCsv(): Promise<void> {
  // Les files de tots els partits comparteixen exactament el mateix esquema.
  const matches = await listMatchesNewestFirst()
  const rows = (
    await Promise.all(
      matches.map(async (match) => {
        const [events, team] = await Promise.all([
          getMatchEvents(match.id),
          match.teamId ? getTeam(match.teamId) : Promise.resolve(undefined),
        ])
        return createMatchRows(match, events, team?.name ?? '')
      }),
    )
  ).flat()

  downloadCsv(`handbol_partits_${getDateStamp()}.csv`, serializeCsv(rows, columns))
}

function createMatchRows(
  match: MatchRecord,
  events: readonly MatchEventRecord[],
  teamName: string,
): MatchCsvRow[] {
  // Un partit sense accions conserva una fila perquè les seves metadades no es perdin.
  if (events.length === 0) {
    return [createEmptyMatchRow(match, teamName)]
  }

  return events.map((event) => createEventRow(match, event, teamName))
}

function createEventRow(
  match: MatchRecord,
  event: MatchEventRecord,
  teamName: string,
): MatchCsvRow {
  const common = createCommonFields(match, teamName)

  if (event.payload.kind === 'period-change') {
    // Els canvis de part són registres tècnics: no pertanyen a cap fase ni possessió.
    return {
      ...common,
      registre_id: event.id,
      ordre: event.sequence,
      tipus_registre: 'canvi_part',
      part: 2,
      possessio: '',
      fase: '',
      categoria_accio: '',
      accio_id: '',
      accio: 'Inici 2a part',
      posicio_llancament: null,
      jugador_id: '',
      jugador_nom: '',
      jugador_cognoms: '',
      jugador_sobrenom: '',
      dorsal: '',
      posicio: '',
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
    categoria_accio: translateActionCategory(event.payload.actionCategory),
    accio_id: event.payload.actionId,
    accio: event.payload.actionLabel,
    posicio_llancament: event.payload.shotPosition,
    jugador_id: event.payload.playerId ?? '',
    jugador_nom: protectSpreadsheetText(event.payload.playerFirstName),
    jugador_cognoms: protectSpreadsheetText(event.payload.playerLastName),
    jugador_sobrenom: protectSpreadsheetText(event.payload.playerNickname),
    dorsal: event.payload.playerNumber,
    posicio: translatePlayerPosition(event.payload.playerPosition),
    data_registre: event.createdAt,
  }
}

function createEmptyMatchRow(match: MatchRecord, teamName: string): MatchCsvRow {
  return {
    ...createCommonFields(match, teamName),
    registre_id: '',
    ordre: '',
    tipus_registre: 'partit',
    part: '',
    possessio: '',
    fase: translatePhase(match.initialPhase),
    categoria_accio: '',
    accio_id: '',
    accio: '',
    posicio_llancament: null,
    jugador_id: '',
    jugador_nom: '',
    jugador_cognoms: '',
    jugador_sobrenom: '',
    dorsal: '',
    posicio: '',
    data_registre: match.createdAt,
  }
}

function createCommonFields(match: MatchRecord, teamName: string): Pick<
  MatchCsvRow,
  | 'partit_id'
  | 'equip_id'
  | 'equip'
  | 'rival'
  | 'data_hora'
  | 'competicio'
  | 'jornada'
  | 'estat_partit'
> {
  return {
    partit_id: match.id,
    equip_id: match.teamId ?? '',
    equip: protectSpreadsheetText(teamName),
    rival: protectSpreadsheetText(match.opponent),
    data_hora: match.scheduledAt,
    competicio: protectSpreadsheetText(match.competition),
    jornada: protectSpreadsheetText(match.round),
    estat_partit: translateStatus(match.status),
  }
}

function translatePhase(phase: Phase | null): string {
  if (phase === null) return ''
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

function translateActionCategory(category: 'shot' | 'non-shot' | 'special' | null): string {
  if (category === null) return ''
  if (category === 'shot') return 'llancament'
  if (category === 'non-shot') return 'no_llancament'
  return 'especial'
}

function translatePlayerPosition(position: 'court' | 'goalkeeper' | null): string {
  if (position === null) return ''
  return position === 'goalkeeper' ? 'porter' : 'jugador_camp'
}

function createMatchFilename(match: MatchRecord, teamName: string): string {
  // Les barres de data/hora se substitueixen per guions perquè siguin vàlides al sistema de fitxers.
  const team = createFilenamePart(teamName || 'equip')
  const opponent = createFilenamePart(match.opponent || 'sense-rival')
  const dateAndTime = createFilenameDateTime(match.scheduledAt)
  return `${team}_${opponent}_${dateAndTime}.csv`
}

function createFilenameDateTime(value: string): string {
  // datetime-local arriba normalment com AAAA-MM-DDTHH:MM.
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value)
  if (match) {
    const [, year, month, day, hour, minute] = match
    return `${day}-${month}-${year}_${hour}-${minute}`
  }

  const now = new Date()
  const day = String(now.getDate()).padStart(2, '0')
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const year = now.getFullYear()
  const hour = String(now.getHours()).padStart(2, '0')
  const minute = String(now.getMinutes()).padStart(2, '0')
  return `${day}-${month}-${year}_${hour}-${minute}`
}

function createFilenamePart(value: string): string {
  // Normalitza accents, espais i símbols per obtenir un nom portable entre sistemes operatius.
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
  // Evita que Excel interpreti text introduït per l'usuari com una fórmula executable.
  return /^[=+\-@]/.test(value) ? `'${value}` : value
}
