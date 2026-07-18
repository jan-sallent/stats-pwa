import Dexie from 'dexie'
import type {
  ActionEventPayload,
  EntityId,
  MatchEventRecord,
  PeriodChangeEventPayload,
} from '../models/types'
import { createEntityId, db } from './database'

export function getMatchEvents(matchId: EntityId): Promise<MatchEventRecord[]> {
  return db.events.where('matchId').equals(matchId).sortBy('sequence')
}

export async function addActionEvent(
  matchId: EntityId,
  payload: ActionEventPayload,
): Promise<MatchEventRecord> {
  return addEvent(matchId, payload)
}

export async function addPeriodChangeEvent(
  matchId: EntityId,
  payload: PeriodChangeEventPayload,
): Promise<MatchEventRecord> {
  return addEvent(matchId, payload)
}

export async function undoLastEvent(matchId: EntityId): Promise<boolean> {
  return db.transaction('rw', db.matches, db.events, async () => {
    const event = await getLastEvent(matchId)

    if (!event) {
      return false
    }

    await db.events.delete(event.id)
    await db.matches.update(matchId, { updatedAt: new Date().toISOString() })
    return true
  })
}

export async function finishMatch(matchId: EntityId): Promise<void> {
  await db.matches.update(matchId, {
    status: 'finished',
    updatedAt: new Date().toISOString(),
  })
}

async function addEvent(
  matchId: EntityId,
  payload: MatchEventRecord['payload'],
): Promise<MatchEventRecord> {
  return db.transaction('rw', db.matches, db.events, async () => {
    const match = await db.matches.get(matchId)

    if (!match) {
      throw new Error('Match not found')
    }

    if (match.status === 'finished') {
      throw new Error('Finished matches cannot be modified')
    }

    const lastEvent = await getLastEvent(matchId)
    const now = new Date().toISOString()
    const event: MatchEventRecord = {
      id: createEntityId(),
      matchId,
      sequence: (lastEvent?.sequence ?? 0) + 1,
      payload,
      createdAt: now,
    }

    await db.events.add(event)
    await db.matches.update(matchId, { status: 'in-progress', updatedAt: now })
    return event
  })
}

function getLastEvent(matchId: EntityId): Promise<MatchEventRecord | undefined> {
  return db.events
    .where('[matchId+sequence]')
    .between([matchId, Dexie.minKey], [matchId, Dexie.maxKey])
    .last()
}
