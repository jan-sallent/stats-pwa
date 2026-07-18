export type EntityId = string
export type IsoDateTime = string
export type MatchStatus = 'draft' | 'in-progress' | 'finished'
export type Phase = 'attack' | 'defense'
export type MatchPeriod = 1 | 2

export interface MatchRecord {
  id: EntityId
  status: MatchStatus
  opponent: string
  scheduledAt: IsoDateTime
  competition: string
  round: string
  initialPhase: Phase
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
  playerNumber: number
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
