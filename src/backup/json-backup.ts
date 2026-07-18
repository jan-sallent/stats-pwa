import { db } from '../db/database'
import { getMatchEvents } from '../db/events'
import { listMatchesNewestFirst } from '../db/matches'
import { getPlayersByTeam, listTeams } from '../db/teams'
import type {
  ActionEventPayload,
  MatchEventPayload,
  MatchEventRecord,
  MatchRecord,
  PeriodChangeEventPayload,
  PlayerRecord,
  TeamRecord,
} from '../models/types'

const backupFormat = 'handbol-stats-backup'
const backupVersion = 3
const maximumBackupSize = 25 * 1024 * 1024

interface AppBackup {
  format: typeof backupFormat
  version: typeof backupVersion
  exportedAt: string
  teams: TeamRecord[]
  players: PlayerRecord[]
  matches: MatchRecord[]
  events: MatchEventRecord[]
}

export interface RestoreResult {
  teams: number
  players: number
  matches: number
  events: number
}

export async function downloadJsonBackup(): Promise<void> {
  const [teams, matches] = await Promise.all([listTeams(), listMatchesNewestFirst()])
  const [playerLists, eventLists] = await Promise.all([
    Promise.all(teams.map((team) => getPlayersByTeam(team.id))),
    Promise.all(matches.map((match) => getMatchEvents(match.id))),
  ])
  const backup: AppBackup = {
    format: backupFormat,
    version: backupVersion,
    exportedAt: new Date().toISOString(),
    teams,
    players: playerLists.flat(),
    matches,
    events: eventLists.flat(),
  }
  const content = JSON.stringify(backup, null, 2)
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' })
  downloadBlob(`handbol_backup_${getDateStamp()}.json`, blob)
}

export async function restoreJsonBackup(file: File): Promise<RestoreResult> {
  if (file.size > maximumBackupSize) {
    throw new Error('Backup file is too large')
  }

  const backup = normalizeBackup(JSON.parse(await file.text()))
  if (!backup) throw new Error('Invalid backup format')

  await db.transaction('rw', db.teams, db.players, db.matches, db.events, async () => {
    await db.teams.bulkPut(backup.teams)
    for (const team of backup.teams) {
      await db.players.where('teamId').equals(team.id).delete()
    }
    await db.players.bulkPut(backup.players)
    await db.matches.bulkPut(backup.matches)
    await db.events.bulkPut(backup.events)
  })

  return {
    teams: backup.teams.length,
    players: backup.players.length,
    matches: backup.matches.length,
    events: backup.events.length,
  }
}

function normalizeBackup(value: unknown): AppBackup | null {
  if (!isRecord(value)) return null
  if (
    value.format !== backupFormat ||
    (value.version !== 1 && value.version !== 2 && value.version !== backupVersion)
  ) {
    return null
  }
  if (typeof value.exportedAt !== 'string') return null
  if (!Array.isArray(value.matches) || !Array.isArray(value.events)) return null

  const teamsSource = value.version === 1 && value.teams === undefined ? [] : value.teams
  const playersSource = value.version === 1 && value.players === undefined ? [] : value.players
  if (!Array.isArray(teamsSource) || !Array.isArray(playersSource)) return null

  const teams = collectNormalized(teamsSource, normalizeTeamRecord)
  const players = collectNormalized(playersSource, normalizePlayerRecord)
  const matches = collectNormalized(value.matches, normalizeMatchRecord)
  const events = collectNormalized(value.events, normalizeMatchEventRecord)
  if (!teams || !players || !matches || !events) return null

  const teamIds = new Set(teams.map((team) => team.id))
  const playersById = new Map(players.map((player) => [player.id, player]))
  const matchIds = new Set(matches.map((match) => match.id))
  if (players.some((player) => !teamIds.has(player.teamId))) return null
  if (matches.some((match) => match.teamId !== null && !teamIds.has(match.teamId))) return null
  if (
    matches.some((match) =>
      match.selectedPlayerIds.some((playerId) => {
        const player = playersById.get(playerId)
        return !player || player.teamId !== match.teamId
      }),
    )
  ) {
    return null
  }
  if (events.some((event) => !matchIds.has(event.matchId))) return null

  return {
    format: backupFormat,
    version: backupVersion,
    exportedAt: value.exportedAt,
    teams,
    players,
    matches,
    events,
  }
}

function collectNormalized<T>(
  values: unknown[],
  normalize: (value: unknown) => T | null,
): T[] | null {
  const result: T[] = []
  for (const value of values) {
    const normalized = normalize(value)
    if (!normalized) return null
    result.push(normalized)
  }
  return result
}

function normalizeTeamRecord(value: unknown): TeamRecord | null {
  if (!isRecord(value)) return null
  if (
    typeof value.id !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  ) {
    return null
  }
  return {
    id: value.id,
    name: value.name,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  }
}

function normalizePlayerRecord(value: unknown): PlayerRecord | null {
  if (!isRecord(value)) return null
  if (
    typeof value.id !== 'string' ||
    typeof value.teamId !== 'string' ||
    typeof value.firstName !== 'string' ||
    typeof value.lastName !== 'string' ||
    typeof value.nickname !== 'string' ||
    !Number.isInteger(value.number) ||
    (value.position !== 'court' && value.position !== 'goalkeeper') ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  ) {
    return null
  }
  return {
    id: value.id,
    teamId: value.teamId,
    firstName: value.firstName,
    lastName: value.lastName,
    nickname: value.nickname,
    number: value.number as number,
    position: value.position,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  }
}

function normalizeMatchRecord(value: unknown): MatchRecord | null {
  if (!isRecord(value)) return null
  if (
    typeof value.id !== 'string' ||
    (value.status !== 'draft' && value.status !== 'in-progress' && value.status !== 'finished') ||
    typeof value.opponent !== 'string' ||
    typeof value.scheduledAt !== 'string' ||
    typeof value.competition !== 'string' ||
    typeof value.round !== 'string' ||
    (value.initialPhase !== null &&
      value.initialPhase !== 'attack' &&
      value.initialPhase !== 'defense') ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  ) {
    return null
  }
  if (value.teamId !== undefined && value.teamId !== null && typeof value.teamId !== 'string') {
    return null
  }
  const selectedPlayerIds = value.selectedPlayerIds ?? []
  if (!Array.isArray(selectedPlayerIds) || !selectedPlayerIds.every((id) => typeof id === 'string')) {
    return null
  }
  return {
    id: value.id,
    teamId: typeof value.teamId === 'string' ? value.teamId : null,
    selectedPlayerIds,
    status: value.status,
    opponent: value.opponent,
    scheduledAt: value.scheduledAt,
    competition: value.competition,
    round: value.round,
    initialPhase: value.initialPhase,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  }
}

function normalizeMatchEventRecord(value: unknown): MatchEventRecord | null {
  if (!isRecord(value)) return null
  if (
    typeof value.id !== 'string' ||
    typeof value.matchId !== 'string' ||
    !Number.isInteger(value.sequence) ||
    typeof value.createdAt !== 'string'
  ) {
    return null
  }
  const payload = normalizeMatchEventPayload(value.payload)
  if (!payload) return null
  return {
    id: value.id,
    matchId: value.matchId,
    sequence: value.sequence as number,
    payload,
    createdAt: value.createdAt,
  }
}

function normalizeMatchEventPayload(value: unknown): MatchEventPayload | null {
  if (!isRecord(value)) return null
  if (value.kind === 'action') return normalizeActionEventPayload(value)
  if (value.kind === 'period-change') return normalizePeriodChangeEventPayload(value)
  return null
}

function normalizeActionEventPayload(value: Record<string, unknown>): ActionEventPayload | null {
  if (
    (value.period !== 1 && value.period !== 2) ||
    !Number.isInteger(value.possession) ||
    (value.phase !== 'attack' && value.phase !== 'defense') ||
    typeof value.actionId !== 'string' ||
    typeof value.actionLabel !== 'string' ||
    typeof value.endsPossession !== 'boolean'
  ) {
    return null
  }
  if (value.playerId !== undefined && value.playerId !== null && typeof value.playerId !== 'string') {
    return null
  }
  const playerNumber = value.playerNumber === undefined ? null : value.playerNumber
  if (playerNumber !== null && !Number.isInteger(playerNumber)) return null

  const playerPosition =
    value.playerPosition === undefined
      ? playerNumber === null
        ? null
        : 'court'
      : value.playerPosition
  if (
    playerPosition !== null &&
    playerPosition !== 'court' &&
    playerPosition !== 'goalkeeper'
  ) {
    return null
  }

  const actionCategory = value.actionCategory ?? null
  if (
    actionCategory !== null &&
    actionCategory !== 'shot' &&
    actionCategory !== 'non-shot' &&
    actionCategory !== 'special'
  ) {
    return null
  }
  const shotPosition = value.shotPosition ?? null
  if (shotPosition !== null && shotPosition !== '6m' && shotPosition !== '7m' && shotPosition !== '9m') {
    return null
  }

  const playerFirstName = value.playerFirstName ?? ''
  const playerLastName = value.playerLastName ?? ''
  const playerNickname = value.playerNickname ?? ''
  if (
    typeof playerFirstName !== 'string' ||
    typeof playerLastName !== 'string' ||
    typeof playerNickname !== 'string'
  ) {
    return null
  }

  return {
    kind: 'action',
    period: value.period,
    possession: value.possession as number,
    phase: value.phase,
    actionId: value.actionId,
    actionLabel: value.actionLabel,
    actionCategory,
    shotPosition,
    playerId: typeof value.playerId === 'string' ? value.playerId : null,
    playerFirstName,
    playerLastName,
    playerNickname,
    playerNumber: playerNumber as number | null,
    playerPosition,
    endsPossession: value.endsPossession,
  }
}

function normalizePeriodChangeEventPayload(
  value: Record<string, unknown>,
): PeriodChangeEventPayload | null {
  if (
    value.period !== 2 ||
    (value.startingPhase !== 'attack' && value.startingPhase !== 'defense')
  ) {
    return null
  }
  return { kind: 'period-change', period: 2, startingPhase: value.startingPhase }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.hidden = true
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function getDateStamp(): string {
  return new Date().toISOString().slice(0, 10)
}
