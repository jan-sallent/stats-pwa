import Dexie, { type EntityTable } from 'dexie'
import type {
  MatchEventRecord,
  MatchRecord,
  PlayerRecord,
  TeamRecord,
} from '../models/types'

class HandbolDatabase extends Dexie {
  matches!: EntityTable<MatchRecord, 'id'>
  events!: EntityTable<MatchEventRecord, 'id'>
  teams!: EntityTable<TeamRecord, 'id'>
  players!: EntityTable<PlayerRecord, 'id'>

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

    this.version(3)
      .stores({
        matches: 'id, teamId, status, scheduledAt, updatedAt',
        events: 'id, matchId, [matchId+sequence], createdAt',
        teams: 'id, name, updatedAt',
        players: 'id, teamId, &[teamId+number], position, updatedAt',
      })
      .upgrade(async (transaction) => {
        await transaction
          .table<MatchRecord>('matches')
          .toCollection()
          .modify((match) => {
            match.teamId ??= null
          })

        await transaction
          .table<MatchEventRecord>('events')
          .toCollection()
          .modify((event) => {
            if (event.payload.kind !== 'action') return
            event.payload.playerId ??= null
            event.payload.playerFirstName ??= ''
            event.payload.playerLastName ??= ''
            event.payload.playerNickname ??= ''
            event.payload.playerPosition ??= 'court'
          })
      })

    this.version(4)
      .stores({
        matches: 'id, teamId, status, scheduledAt, updatedAt',
        events: 'id, matchId, [matchId+sequence], createdAt',
        teams: 'id, name, updatedAt',
        players: 'id, teamId, &[teamId+number], position, updatedAt',
      })
      .upgrade(async (transaction) => {
        await transaction
          .table<MatchRecord>('matches')
          .toCollection()
          .modify((match) => {
            match.selectedPlayerIds ??= []
          })

        await transaction
          .table<MatchEventRecord>('events')
          .toCollection()
          .modify((event) => {
            if (event.payload.kind !== 'action') return
            event.payload.actionCategory ??= null
            event.payload.shotPosition ??= null
          })
      })
  }
}

export const db = new HandbolDatabase()

export function createEntityId(): string {
  return crypto.randomUUID()
}
