import type { EntityId, MatchRecord, Phase } from '../models/types'
import { createEntityId, db } from './database'

export interface CreateMatchInput {
  opponent: string
  scheduledAt: string
  competition: string
  round: string
  initialPhase: Phase
}

export async function createMatchDraft(input: CreateMatchInput): Promise<MatchRecord> {
  const now = new Date().toISOString()
  const match: MatchRecord = {
    id: createEntityId(),
    status: 'draft',
    opponent: input.opponent.trim(),
    scheduledAt: input.scheduledAt,
    competition: input.competition.trim(),
    round: input.round.trim(),
    initialPhase: input.initialPhase,
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

  const updatedMatch: MatchRecord = {
    ...match,
    status: match.status === 'draft' ? 'in-progress' : match.status,
    updatedAt: new Date().toISOString(),
  }

  await db.matches.put(updatedMatch)
  return updatedMatch
}

export function listMatchesNewestFirst(): Promise<MatchRecord[]> {
  return db.matches.orderBy('updatedAt').reverse().toArray()
}

export function getMatch(id: EntityId): Promise<MatchRecord | undefined> {
  return db.matches.get(id)
}

export async function deleteMatchAndEvents(id: EntityId): Promise<void> {
  await db.transaction('rw', db.matches, db.events, async () => {
    await db.events.where('matchId').equals(id).delete()
    await db.matches.delete(id)
  })
}
