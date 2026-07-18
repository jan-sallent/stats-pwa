import { db } from '../db/database'
import { getPlayersByTeam, listTeams } from '../db/teams'
import type { PlayerRecord, TeamRecord } from '../models/types'

const transferFormat = 'raip-team-transfer'
const transferVersion = 1
const maximumFileSize = 5 * 1024 * 1024

interface TeamTransfer {
  format: typeof transferFormat
  version: typeof transferVersion
  exportedAt: string
  teams: TeamRecord[]
  players: PlayerRecord[]
}

export interface TeamImportResult {
  teams: number
  players: number
}

export async function exportTeams(): Promise<void> {
  const teams = await listTeams()
  const players = (await Promise.all(teams.map((team) => getPlayersByTeam(team.id)))).flat()
  const transfer: TeamTransfer = {
    format: transferFormat,
    version: transferVersion,
    exportedAt: new Date().toISOString(),
    teams,
    players,
  }
  const blob = new Blob([JSON.stringify(transfer, null, 2)], {
    type: 'application/json;charset=utf-8',
  })
  downloadBlob(`raip_plantilles_${new Date().toISOString().slice(0, 10)}.json`, blob)
}

export async function importTeams(file: File): Promise<TeamImportResult> {
  if (file.size > maximumFileSize) throw new Error('FILE_TOO_LARGE')
  const transfer = parseTransfer(JSON.parse(await file.text()))
  if (!transfer) throw new Error('INVALID_TEAM_TRANSFER')

  await db.transaction('rw', db.teams, db.players, async () => {
    await db.teams.bulkPut(transfer.teams)
    for (const team of transfer.teams) {
      await db.players.where('teamId').equals(team.id).delete()
    }
    await db.players.bulkPut(transfer.players)
  })

  return { teams: transfer.teams.length, players: transfer.players.length }
}

function parseTransfer(value: unknown): TeamTransfer | null {
  if (!isRecord(value)) return null
  if (value.format !== transferFormat || value.version !== transferVersion) return null
  if (typeof value.exportedAt !== 'string') return null
  if (!Array.isArray(value.teams) || !Array.isArray(value.players)) return null
  if (!value.teams.every(isTeam) || !value.players.every(isPlayer)) return null

  const teamIds = new Set(value.teams.map((team) => team.id))
  if (value.players.some((player) => !teamIds.has(player.teamId))) return null
  for (const team of value.teams) {
    const numbers = value.players
      .filter((player) => player.teamId === team.id)
      .map((player) => player.number)
    if (numbers.length === 0 || new Set(numbers).size !== numbers.length) return null
  }

  return {
    format: transferFormat,
    version: transferVersion,
    exportedAt: value.exportedAt,
    teams: value.teams,
    players: value.players,
  }
}

function isTeam(value: unknown): value is TeamRecord {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  )
}

function isPlayer(value: unknown): value is PlayerRecord {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.teamId === 'string' &&
    typeof value.firstName === 'string' &&
    typeof value.lastName === 'string' &&
    typeof value.nickname === 'string' &&
    Number.isInteger(value.number) &&
    (value.position === 'court' || value.position === 'goalkeeper') &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
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
