import { db } from '../db/database'
import { getMatchEvents } from '../db/events'
import { listMatchesNewestFirst } from '../db/matches'
import type {
  ActionEventPayload,
  MatchEventPayload,
  MatchEventRecord,
  MatchRecord,
  PeriodChangeEventPayload,
} from '../models/types'

const backupFormat = 'handbol-stats-backup'
const backupVersion = 1
const maximumBackupSize = 25 * 1024 * 1024

interface AppBackup {
  format: typeof backupFormat
  version: typeof backupVersion
  exportedAt: string
  matches: MatchRecord[]
  events: MatchEventRecord[]
}

export interface RestoreResult {
  matches: number
  events: number
}

export async function downloadJsonBackup(): Promise<void> {
  const matches = await listMatchesNewestFirst()
  const events = (await Promise.all(matches.map((match) => getMatchEvents(match.id)))).flat()
  const backup: AppBackup = {
    format: backupFormat,
    version: backupVersion,
    exportedAt: new Date().toISOString(),
    matches,
    events,
  }
  const content = JSON.stringify(backup, null, 2)
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' })
  downloadBlob(`handbol_backup_${getDateStamp()}.json`, blob)
}

export async function restoreJsonBackup(file: File): Promise<RestoreResult> {
  if (file.size > maximumBackupSize) {
    throw new Error('Backup file is too large')
  }

  const parsed: unknown = JSON.parse(await file.text())

  if (!isAppBackup(parsed)) {
    throw new Error('Invalid backup format')
  }

  await db.transaction('rw', db.matches, db.events, async () => {
    await db.matches.bulkPut(parsed.matches)
    await db.events.bulkPut(parsed.events)
  })

  return { matches: parsed.matches.length, events: parsed.events.length }
}

function isAppBackup(value: unknown): value is AppBackup {
  if (!isRecord(value)) return false
  if (value.format !== backupFormat || value.version !== backupVersion) return false
  if (typeof value.exportedAt !== 'string') return false
  if (!Array.isArray(value.matches) || !value.matches.every(isMatchRecord)) return false
  if (!Array.isArray(value.events) || !value.events.every(isMatchEventRecord)) return false

  const matchIds = new Set(value.matches.map((match) => match.id))
  return value.events.every((event) => matchIds.has(event.matchId))
}

function isMatchRecord(value: unknown): value is MatchRecord {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    (value.status === 'draft' || value.status === 'in-progress' || value.status === 'finished') &&
    typeof value.opponent === 'string' &&
    typeof value.scheduledAt === 'string' &&
    typeof value.competition === 'string' &&
    typeof value.round === 'string' &&
    (value.initialPhase === 'attack' || value.initialPhase === 'defense') &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  )
}

function isMatchEventRecord(value: unknown): value is MatchEventRecord {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.matchId === 'string' &&
    Number.isInteger(value.sequence) &&
    typeof value.createdAt === 'string' &&
    isMatchEventPayload(value.payload)
  )
}

function isMatchEventPayload(value: unknown): value is MatchEventPayload {
  if (!isRecord(value)) return false
  if (value.kind === 'action') return isActionEventPayload(value)
  if (value.kind === 'period-change') return isPeriodChangeEventPayload(value)
  return false
}

function isActionEventPayload(value: unknown): value is ActionEventPayload {
  if (!isRecord(value)) return false

  return (
    value.kind === 'action' &&
    (value.period === 1 || value.period === 2) &&
    Number.isInteger(value.possession) &&
    (value.phase === 'attack' || value.phase === 'defense') &&
    typeof value.actionId === 'string' &&
    typeof value.actionLabel === 'string' &&
    Number.isInteger(value.playerNumber) &&
    typeof value.endsPossession === 'boolean'
  )
}

function isPeriodChangeEventPayload(
  value: unknown,
): value is PeriodChangeEventPayload {
  if (!isRecord(value)) return false

  return (
    value.kind === 'period-change' &&
    value.period === 2 &&
    (value.startingPhase === 'attack' || value.startingPhase === 'defense')
  )
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
