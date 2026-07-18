import type { Phase } from '../models/types'

export interface MatchActionDefinition {
  id: string
  label: string
  phase: Phase
  endsPossession: boolean
}

export const matchActions: readonly MatchActionDefinition[] = [
  { id: 'attack-out', label: 'Fora', phase: 'attack', endsPossession: true },
  { id: 'attack-goalkeeper', label: 'Porteria', phase: 'attack', endsPossession: true },
  { id: 'attack-goal', label: 'Gol', phase: 'attack', endsPossession: true },
  { id: 'attack-pass', label: 'Passada', phase: 'attack', endsPossession: false },
  { id: 'attack-reception', label: 'Recepci\u00f3', phase: 'attack', endsPossession: false },
  { id: 'defense-out', label: 'Fora', phase: 'defense', endsPossession: true },
  { id: 'defense-goalkeeper', label: 'Porteria', phase: 'defense', endsPossession: true },
  { id: 'defense-goal', label: 'Gol', phase: 'defense', endsPossession: true },
  {
    id: 'defense-recovery',
    label: 'Recuperaci\u00f3 defensiva',
    phase: 'defense',
    endsPossession: true,
  },
  { id: 'defense-opponent-error', label: 'Error rival', phase: 'defense', endsPossession: true },
]

export function getActionsForPhase(phase: Phase): MatchActionDefinition[] {
  return matchActions.filter((action) => action.phase === phase)
}
