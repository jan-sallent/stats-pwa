/**
 * Contracte de navegació intern.
 * Cada variant conté exactament els identificadors que necessita la seva pantalla.
 */
import type { EntityId } from './models/types'

export type Route =
  | { screen: 'home' }
  | { screen: 'new-match' }
  | { screen: 'history' }
  | { screen: 'teams' }
  | { screen: 'team-editor'; teamId?: EntityId }
  | { screen: 'match'; matchId: EntityId }
  | { screen: 'match-events'; matchId: EntityId }
  | { screen: 'event-editor'; matchId: EntityId; eventId: EntityId }

export type Navigate = (route: Route) => void
