/** Lectura i escriptura de l'historial immutable —excepte edició explícita— d'un partit. */
import Dexie from 'dexie'
import type {
  ActionEventPayload,
  EntityId,
  MatchEventRecord,
  PeriodChangeEventPayload,
} from '../models/types'
import { oppositePhase } from '../domain/match-state'
import { createEntityId, db } from './database'

export function getMatchEvents(matchId: EntityId): Promise<MatchEventRecord[]> {
  return db.events.where('matchId').equals(matchId).sortBy('sequence')
}

export function getMatchEvent(eventId: EntityId): Promise<MatchEventRecord | undefined> {
  return db.events.get(eventId)
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
  // Desfer elimina únicament l'esdeveniment amb la seqüència més alta.
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

export async function updateActionEvent(
  matchId: EntityId,
  eventId: EntityId,
  payload: ActionEventPayload,
): Promise<void> {
  // Editar una acció pot canviar totes les possessions posteriors; per això es recalculen.
  await db.transaction('rw', db.matches, db.events, async () => {
    const [match, event] = await Promise.all([
      db.matches.get(matchId),
      db.events.get(eventId),
    ])
    if (!match || match.initialPhase === null) throw new Error('Match not found')
    if (!event || event.matchId !== matchId || event.payload.kind !== 'action') {
      throw new Error('Action event not found')
    }

    await db.events.update(eventId, { payload })
    const events = await getMatchEvents(matchId)
    let period: 1 | 2 = 1
    let possession = 1
    let phase = match.initialPhase

    for (const currentEvent of events) {
      if (currentEvent.payload.kind === 'period-change') {
        period = 2
        possession = 1
        phase = currentEvent.payload.startingPhase
        continue
      }

      const normalizedPayload: ActionEventPayload = {
        ...currentEvent.payload,
        period,
        possession,
        phase,
      }
      await db.events.update(currentEvent.id, { payload: normalizedPayload })
      if (normalizedPayload.endsPossession) {
        possession += 1
        phase = oppositePhase(phase)
      }
    }

    await db.matches.update(matchId, { updatedAt: new Date().toISOString() })
  })
}

async function addEvent(
  matchId: EntityId,
  payload: MatchEventRecord['payload'],
): Promise<MatchEventRecord> {
  // Calcular i inserir la seqüència dins la mateixa transacció evita duplicats locals.
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
  // L'índex compost permet cercar l'últim registre sense carregar tot el partit.
  return db.events
    .where('[matchId+sequence]')
    .between([matchId, Dexie.minKey], [matchId, Dexie.maxKey])
    .last()
}
