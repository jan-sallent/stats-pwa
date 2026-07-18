import Dexie, { type EntityTable } from 'dexie'
import type { MatchEventRecord, MatchRecord } from '../models/types'

class HandbolDatabase extends Dexie {
  matches!: EntityTable<MatchRecord, 'id'>
  events!: EntityTable<MatchEventRecord, 'id'>

  constructor() {
    super('handbol-stats')

    this.version(1).stores({
      matches: 'id, status, createdAt, updatedAt',
      events: 'id, matchId, [matchId+sequence], createdAt',
    })

    this.version(2)
      .stores({
        matches: 'id, status, scheduledAt, updatedAt',
        events: 'id, matchId, [matchId+sequence], createdAt',
      })
      .upgrade((transaction) =>
        transaction
          .table<MatchRecord>('matches')
          .toCollection()
          .modify((match) => {
            match.opponent ??= ''
            match.scheduledAt ??= match.createdAt
            match.competition ??= ''
            match.round ??= ''
            match.initialPhase ??= 'attack'
          }),
      )
  }
}

export const db = new HandbolDatabase()

export function createEntityId(): string {
  return crypto.randomUUID()
}
