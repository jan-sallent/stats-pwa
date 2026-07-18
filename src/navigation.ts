import type { EntityId } from './models/types'

export type Route =
  | { screen: 'home' }
  | { screen: 'new-match' }
  | { screen: 'history' }
  | { screen: 'match'; matchId: EntityId }

export type Navigate = (route: Route) => void
