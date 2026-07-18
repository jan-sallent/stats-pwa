/**
 * Definició d'IndexedDB mitjançant Dexie.
 * Cada versió conserva compatibilitat amb dades creades per versions anteriors de RAiP.
 */
import Dexie, { type EntityTable } from 'dexie'
import type {
  MatchEventRecord,
  MatchRecord,
  PlayerRecord,
  TeamRecord,
} from '../models/types'

class HandbolDatabase extends Dexie {
  // EntityTable aporta tipatge tant al registre com a la seva clau primària.
  matches!: EntityTable<MatchRecord, 'id'>
  events!: EntityTable<MatchEventRecord, 'id'>
  teams!: EntityTable<TeamRecord, 'id'>
  players!: EntityTable<PlayerRecord, 'id'>

  constructor() {
    super('handbol-stats')

    // Versió inicial: partits i esdeveniments sense plantilles.
    this.version(1).stores({
      matches: 'id, status, createdAt, updatedAt',
      events: 'id, matchId, [matchId+sequence], createdAt',
    })

    // Afegeix els camps de planificació del partit i completa registres antics.
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

    // Introdueix equips i jugadors, i enllaça els partits amb una plantilla.
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

    // Desa la convocatòria i la classificació detallada de les accions.
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

    // Identifica si una acció correspon al CHSA o a l'equip rival.
    this.version(5)
      .stores({
        matches: 'id, teamId, status, scheduledAt, updatedAt',
        events: 'id, matchId, [matchId+sequence], createdAt',
        teams: 'id, name, updatedAt',
        players: 'id, teamId, &[teamId+number], position, updatedAt',
      })
      .upgrade((transaction) =>
        transaction
          .table<MatchEventRecord>('events')
          .toCollection()
          .modify((event) => {
            if (event.payload.kind !== 'action') return
            event.payload.teamSide ??=
              event.payload.actionId === 'defense-opponent-error'
                ? 'opponent'
                : event.payload.playerId
                  ? 'own'
                  : null
          }),
      )
  }
}

export const db = new HandbolDatabase()

export function createEntityId(): string {
  // UUID evita col·lisions també quan s'importen dades entre dispositius.
  return crypto.randomUUID()
}
