import type { Navigate, Route } from './navigation'
import { createHistoryScreen } from './screens/history'
import { createHomeScreen } from './screens/home'
import { createMatchScreen } from './screens/match'
import { createMatchEventsScreen } from './screens/match-events'
import { createNewMatchScreen } from './screens/new-match'
import { createEventEditorScreen } from './screens/event-editor'
import { createTeamEditorScreen } from './screens/team-editor'
import { createTeamsScreen } from './screens/teams'

export function startApp(root: HTMLElement): void {
  let currentRoute: Route = { screen: 'home' }
  let renderRequest = 0

  const navigate: Navigate = (route) => {
    currentRoute = route
    void render()
  }

  const render = async (): Promise<void> => {
    const request = ++renderRequest
    root.setAttribute('aria-busy', 'true')

    try {
      const screen = await createScreen(currentRoute, navigate)

      if (request === renderRequest) {
        root.replaceChildren(screen)
      }
    } catch (error) {
      console.error("No s'ha pogut renderitzar l'aplicaci\u00f3", error)

      if (request === renderRequest) {
        root.replaceChildren(createErrorScreen(navigate))
      }
    } finally {
      if (request === renderRequest) {
        root.removeAttribute('aria-busy')
      }
    }
  }

  void render()
}

async function createScreen(route: Route, navigate: Navigate): Promise<HTMLElement> {
  switch (route.screen) {
    case 'new-match':
      return createNewMatchScreen(navigate)
    case 'history':
      return createHistoryScreen(navigate)
    case 'teams':
      return createTeamsScreen(navigate)
    case 'team-editor':
      return createTeamEditorScreen(navigate, route.teamId)
    case 'match':
      return createMatchScreen(navigate, route.matchId)
    case 'match-events':
      return createMatchEventsScreen(navigate, route.matchId)
    case 'event-editor':
      return createEventEditorScreen(navigate, route.matchId, route.eventId)
    case 'home':
      return createHomeScreen(navigate)
  }
}

function createErrorScreen(navigate: Navigate): HTMLElement {
  const screen = document.createElement('main')
  screen.className = 'app-shell home-screen'
  screen.innerHTML = `
    <section class="card card-stack" role="alert">
      <h1>No s'ha pogut carregar</h1>
      <p>Reintenta-ho. Les dades locals no s'han eliminat.</p>
      <button class="button button-primary" type="button">Tornar a l'inici</button>
    </section>
  `
  screen.querySelector('button')?.addEventListener('click', () => navigate({ screen: 'home' }))
  return screen
}
