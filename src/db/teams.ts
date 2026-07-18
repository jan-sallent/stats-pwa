import type {
  EntityId,
  PlayerPosition,
  PlayerRecord,
  TeamRecord,
} from '../models/types'
import { createEntityId, db } from './database'

export interface TeamPlayerInput {
  id?: EntityId
  firstName: string
  lastName: string
  nickname: string
  number: number
  position: PlayerPosition
}

export interface SaveTeamInput {
  id?: EntityId
  name: string
  players: TeamPlayerInput[]
}

export interface TeamWithPlayers {
  team: TeamRecord
  players: PlayerRecord[]
}

export function listTeams(): Promise<TeamRecord[]> {
  return db.teams.orderBy('name').toArray()
}

export function getTeam(id: EntityId): Promise<TeamRecord | undefined> {
  return db.teams.get(id)
}

export function getPlayersByTeam(teamId: EntityId): Promise<PlayerRecord[]> {
  return db.players.where('teamId').equals(teamId).sortBy('number')
}

export async function getTeamWithPlayers(id: EntityId): Promise<TeamWithPlayers | undefined> {
  const team = await getTeam(id)
  if (!team) return undefined
  return { team, players: await getPlayersByTeam(id) }
}

export async function saveTeam(input: SaveTeamInput): Promise<TeamWithPlayers> {
  const name = input.name.trim()
  if (!name) throw new Error('Team name is required')
  if (input.players.length === 0) throw new Error('At least one player is required')

  const numbers = input.players.map((player) => player.number)
  if (new Set(numbers).size !== numbers.length) {
    throw new Error('Player numbers must be unique inside a team')
  }

  return db.transaction('rw', db.teams, db.players, async () => {
    const existingTeam = input.id ? await db.teams.get(input.id) : undefined
    if (input.id && !existingTeam) throw new Error('Team not found')

    const teamId = existingTeam?.id ?? createEntityId()
    const now = new Date().toISOString()
    const existingPlayers = existingTeam
      ? await db.players.where('teamId').equals(teamId).toArray()
      : []
    const existingPlayersById = new Map(existingPlayers.map((player) => [player.id, player]))

    const team: TeamRecord = {
      id: teamId,
      name,
      createdAt: existingTeam?.createdAt ?? now,
      updatedAt: now,
    }

    const players: PlayerRecord[] = input.players.map((player) => {
      const existingPlayer = player.id ? existingPlayersById.get(player.id) : undefined
      return {
        id: existingPlayer?.id ?? createEntityId(),
        teamId,
        firstName: player.firstName.trim(),
        lastName: player.lastName.trim(),
        nickname: player.nickname.trim(),
        number: player.number,
        position: player.position,
        createdAt: existingPlayer?.createdAt ?? now,
        updatedAt: now,
      }
    })

    if (players.some((player) => !player.firstName || !player.lastName)) {
      throw new Error('Player name and surname are required')
    }

    await db.teams.put(team)
    await db.players.where('teamId').equals(teamId).delete()
    await db.players.bulkPut(players)
    return { team, players: players.sort((a, b) => a.number - b.number) }
  })
}

export async function deleteTeam(teamId: EntityId): Promise<void> {
  await db.transaction('rw', db.teams, db.players, db.matches, async () => {
    const linkedMatches = await db.matches.where('teamId').equals(teamId).count()
    if (linkedMatches > 0) throw new Error('TEAM_IN_USE')
    await db.players.where('teamId').equals(teamId).delete()
    await db.teams.delete(teamId)
  })
}
