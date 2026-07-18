/** Pantalla inicial i accessos als quatre fluxos principals de RAiP. */
import { listMatchesNewestFirst } from '../db/matches'
import { listTeams } from '../db/teams'
import type { Navigate } from '../navigation'

export async function createHomeScreen(navigate: Navigate): Promise<HTMLElement> {
  // Les consultes són independents i es resolen en paral·lel per reduir el temps de càrrega.
  const [matches, teams] = await Promise.all([
    listMatchesNewestFirst(),
    listTeams(),
  ])
  const resumableMatch = matches.find((match) => match.status !== 'finished')
  const screen = document.createElement('main')
  screen.className = 'app-shell home-screen'
  screen.innerHTML = `
    <header class="app-header">
      <h1>RAiP <span>(Recol&middot;lecci&oacute; d'Accions i Possessions)</span></h1>
    </header>

    <section class="card" aria-labelledby="start-title">
      <div>
        <h2 id="start-title">Comen&ccedil;a un registre</h2>
      </div>
      <button class="button button-primary" data-action="new-match" type="button">
        Nou partit
      </button>
    </section>

    ${
      resumableMatch
        ? `<section class="card" aria-labelledby="resume-title">
            <div>
              <h2 id="resume-title">Continuar l'&uacute;ltim partit</h2>
            </div>
            <button class="button button-secondary" data-action="resume" type="button">
              Continuar
            </button>
          </section>`
        : ''
    }

    <section class="card" aria-labelledby="history-title">
      <div>
        <h2 id="history-title">Historial</h2>
      </div>
      <button class="button button-ghost" data-action="history" type="button">
        Veure
      </button>
    </section>

    <section class="card" aria-labelledby="teams-title">
      <div>
        <p class="status-label">Plantilles</p>
        <h2 id="teams-title">Equips</h2>
        <p>${teams.length} ${teams.length === 1 ? 'plantilla desada' : 'plantilles desades'}</p>
      </div>
      <button class="button button-ghost" data-action="teams" type="button">
        Gestionar
      </button>
    </section>

    <section class="status-panel" aria-label="Partits guardats">
      <div class="status-row"><span>Partits guardats</span><strong>${matches.length}</strong></div>
    </section>
  `

  screen.querySelector('[data-action="new-match"]')?.addEventListener('click', () => {
    navigate({ screen: 'new-match' })
  })

  screen.querySelector('[data-action="resume"]')?.addEventListener('click', () => {
    if (resumableMatch) {
      navigate({ screen: 'match', matchId: resumableMatch.id })
    }
  })

  screen.querySelector('[data-action="history"]')?.addEventListener('click', () => {
    navigate({ screen: 'history' })
  })

  screen.querySelector('[data-action="teams"]')?.addEventListener('click', () => {
    navigate({ screen: 'teams' })
  })

  return screen
}
