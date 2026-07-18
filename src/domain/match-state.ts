import type { MatchEventRecord, MatchPeriod, MatchRecord, Phase } from '../models/types'

export interface MatchSessionState {
  period: MatchPeriod
  possession: number
  phase: Phase
  eventCount: number
  finished: boolean
}

export function deriveMatchState(
  match: MatchRecord,
  events: readonly MatchEventRecord[],
): MatchSessionState {
  let period: MatchPeriod = 1
  let possession = 1
  let phase = match.initialPhase

  for (const event of events) {
    if (event.payload.kind === 'period-change') {
      period = 2
      phase = event.payload.startingPhase
      continue
    }

    if (event.payload.endsPossession) {
      possession += 1
      phase = oppositePhase(event.payload.phase)
    } else {
      phase = event.payload.phase
    }
  }

  return {
    period,
    possession,
    phase,
    eventCount: events.length,
    finished: match.status === 'finished',
  }
}

export function oppositePhase(phase: Phase): Phase {
  return phase === 'attack' ? 'defense' : 'attack'
}
