import type { MatchEventRecord, MatchPeriod, MatchRecord, Phase } from '../models/types'

export interface MatchSessionState {
  period: MatchPeriod
  possession: number
  phasePossession: number
  phase: Phase
  eventCount: number
  finished: boolean
}

export function deriveMatchState(
  match: MatchRecord,
  events: readonly MatchEventRecord[],
): MatchSessionState {
  if (match.initialPhase === null) throw new Error('Match has not started')
  const initialPhase = match.initialPhase
  let period: MatchPeriod = 1
  let possession = 1
  let phase = initialPhase
  let phasePossessions: Record<Phase, number> = {
    attack: initialPhase === 'attack' ? 1 : 0,
    defense: initialPhase === 'defense' ? 1 : 0,
  }

  for (const event of events) {
    if (event.payload.kind === 'period-change') {
      period = 2
      phase = event.payload.startingPhase
      possession = 1
      phasePossessions = {
        attack: phase === 'attack' ? 1 : 0,
        defense: phase === 'defense' ? 1 : 0,
      }
      continue
    }

    if (event.payload.endsPossession) {
      possession += 1
      phase = oppositePhase(event.payload.phase)
      phasePossessions[phase] += 1
    } else {
      phase = event.payload.phase
    }
  }

  return {
    period,
    possession,
    phasePossession: phasePossessions[phase],
    phase,
    eventCount: events.length,
    finished: match.status === 'finished',
  }
}

export function oppositePhase(phase: Phase): Phase {
  return phase === 'attack' ? 'defense' : 'attack'
}
