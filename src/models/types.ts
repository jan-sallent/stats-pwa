export type EntityId = string
export type IsoDateTime = string
export type MatchStatus = 'draft' | 'in-progress' | 'finished'
export type Phase = 'attack' | 'defense'
export type MatchPeriod = 1 | 2
export type PlayerPosition = 'court' | 'goalkeeper'
export type ActionCategory = 'shot' | 'non-shot' | 'special'
export type ShotPosition = '6m' | '7m' | '9m'
export type TeamSide = 'own' | 'opponent'

export interface TeamRecord {
  id: EntityId
  name: string
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

export interface PlayerRecord {
  id: EntityId
  teamId: EntityId
  firstName: string
  lastName: string
  nickname: string
  number: number
  position: PlayerPosition
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

export interface MatchRecord {
  id: EntityId
  teamId: EntityId | null
  selectedPlayerIds: EntityId[]
  status: MatchStatus
  opponent: string
  scheduledAt: IsoDateTime
  competition: string
  round: string
  initialPhase: Phase | null
  createdAt: IsoDateTime
  updatedAt: IsoDateTime
}

export interface ActionEventPayload {
  kind: 'action'
  period: MatchPeriod
  possession: number
  phase: Phase
  actionId: string
  actionLabel: string
  actionCategory: ActionCategory | null
  shotPosition: ShotPosition | null
  teamSide: TeamSide | null
  playerId: EntityId | null
  playerFirstName: string
  playerLastName: string
  playerNickname: string
  playerNumber: number | null
  playerPosition: PlayerPosition | null
  endsPossession: boolean
}

export interface PeriodChangeEventPayload {
  kind: 'period-change'
  period: 2
  startingPhase: Phase
}

export type MatchEventPayload = ActionEventPayload | PeriodChangeEventPayload

export interface MatchEventRecord {
  id: EntityId
  matchId: EntityId
  sequence: number
  payload: MatchEventPayload
  createdAt: IsoDateTime
}
