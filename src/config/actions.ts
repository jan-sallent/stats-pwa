import type { ActionCategory, Phase } from '../models/types'

export type PlayerSelection = 'all' | 'goalkeepers' | 'none'

export interface MatchActionDefinition {
  id: string
  label: string
  phase: Phase
  category: ActionCategory
  playerSelection: PlayerSelection
  endsPossession: boolean
}

export const matchActions: readonly MatchActionDefinition[] = [
  { id: 'attack-shot-out', label: 'Fora', phase: 'attack', category: 'shot', playerSelection: 'all', endsPossession: true },
  { id: 'attack-shot-save', label: 'Parada', phase: 'attack', category: 'shot', playerSelection: 'all', endsPossession: true },
  { id: 'attack-shot-goal', label: 'Gol', phase: 'attack', category: 'shot', playerSelection: 'all', endsPossession: true },
  { id: 'attack-pass', label: 'Passada', phase: 'attack', category: 'non-shot', playerSelection: 'all', endsPossession: true },
  { id: 'attack-reception', label: 'Recepci\u00f3', phase: 'attack', category: 'non-shot', playerSelection: 'all', endsPossession: true },
  { id: 'attack-steps', label: 'Passos', phase: 'attack', category: 'non-shot', playerSelection: 'all', endsPossession: true },
  { id: 'attack-double-dribble', label: 'Dobles', phase: 'attack', category: 'non-shot', playerSelection: 'all', endsPossession: true },
  { id: 'attack-area', label: '\u00c0rea', phase: 'attack', category: 'non-shot', playerSelection: 'all', endsPossession: true },
  { id: 'attack-passive', label: 'Passiu', phase: 'attack', category: 'non-shot', playerSelection: 'all', endsPossession: true },
  { id: 'attack-offensive-foul', label: 'Falta en atac', phase: 'attack', category: 'non-shot', playerSelection: 'all', endsPossession: true },
  { id: 'defense-shot-out', label: 'Fora', phase: 'defense', category: 'shot', playerSelection: 'goalkeepers', endsPossession: true },
  { id: 'defense-shot-save', label: 'Parada', phase: 'defense', category: 'shot', playerSelection: 'goalkeepers', endsPossession: true },
  { id: 'defense-shot-goal', label: 'Gol', phase: 'defense', category: 'shot', playerSelection: 'goalkeepers', endsPossession: true },
  { id: 'defense-recovery', label: 'Recuperaci\u00f3 defensiva', phase: 'defense', category: 'non-shot', playerSelection: 'all', endsPossession: true },
  { id: 'defense-opponent-error', label: 'Error rival', phase: 'defense', category: 'non-shot', playerSelection: 'none', endsPossession: true },
]

export function getActionsForPhase(
  phase: Phase,
  category: ActionCategory,
): MatchActionDefinition[] {
  return matchActions.filter(
    (action) => action.phase === phase && action.category === category,
  )
}
