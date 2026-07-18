/** Persistència del cicle de vida d'un partit. */
import type { EntityId, MatchRecord, Phase } from '../models/types'
import { createEntityId, db } from './database'

export interface CreateMatchInput {
  teamId: EntityId
  selectedPlayerIds: EntityId[]
  opponent: string
  scheduledAt: string
  competition: string
  round: string
}

export async function createMatchDraft(input: CreateMatchInput): Promise<MatchRecord> {
  // El Set elimina seleccions repetides abans de validar-les contra la plantilla.
  const selectedPlayerIds = [...new Set(input.selectedPlayerIds)]
  if (selectedPlayerIds.length === 0) throw new Error('At least one selected player is required')

  const selectedPlayers = await db.players.bulkGet(selectedPlayerIds)
  if (
    selectedPlayers.some((player) => !player || player.teamId !== input.teamId)
  ) {
    throw new Error('Invalid selected players')
  }

  const now = new Date().toISOString()
  const match: MatchRecord = {
    id: createEntityId(),
    teamId: input.teamId,
    selectedPlayerIds,
    status: 'draft',
    opponent: input.opponent.trim(),
    scheduledAt: input.scheduledAt,
    competition: input.competition.trim(),
    round: input.round.trim(),
    initialPhase: null,
    createdAt: now,
    updatedAt: now,
  }

  await db.matches.add(match)
  return match
}

export async function openMatch(id: EntityId): Promise<MatchRecord | undefined> {
  const match = await db.matches.get(id)

  if (!match) {
    return undefined
  }

  // Un esborrany amb fase inicial ja definida és, per compatibilitat, un partit en curs.
  const updatedMatch: MatchRecord = {
    ...match,
    status:
      match.status === 'draft' && match.initialPhase !== null
        ? 'in-progress'
        : match.status,
    updatedAt: new Date().toISOString(),
  }

  await db.matches.put(updatedMatch)
  return updatedMatch
}

export async function startMatch(id: EntityId, initialPhase: Phase): Promise<void> {
  const match = await db.matches.get(id)
  if (!match) throw new Error('Match not found')
  if (match.initialPhase !== null) return
  await db.matches.update(id, {
    initialPhase,
    status: 'in-progress',
    updatedAt: new Date().toISOString(),
  })
}

export function listMatchesNewestFirst(): Promise<MatchRecord[]> {
  return db.matches.orderBy('updatedAt').reverse().toArray()
}

export function getMatch(id: EntityId): Promise<MatchRecord | undefined> {
  return db.matches.get(id)
}

export async function deleteMatchAndEvents(id: EntityId): Promise<void> {
  // La transacció impedeix deixar esdeveniments orfes si alguna operació falla.
  await db.transaction('rw', db.matches, db.events, async () => {
    await db.events.where('matchId').equals(id).delete()
    await db.matches.delete(id)
  })
}
