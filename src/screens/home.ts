import { listMatchesNewestFirst } from '../db/matches'
import { getStoragePersistenceStatus } from '../db/storage'
import type { Navigate } from '../navigation'

export async function createHomeScreen(navigate: Navigate): Promise<HTMLElement> {
  const [matches, persistence] = await Promise.all([
    listMatchesNewestFirst(),
    getStoragePersistenceStatus(),
  ])
  const resumableMatch = matches.find((match) => match.status !== 'finished')
  const persistenceLabel =
    persistence === 'persistent'
      ? 'Persistent'
      : persistence === 'best-effort'
        ? 'Est\u00e0ndard'
        : 'No disponible'
  const screen = document.createElement('main')
  screen.className = 'app-shell home-screen'
  screen.innerHTML = `
    <header class="app-header">
      <p class="eyebrow">Registre local de partits</p>
      <h1>Handbol Stats</h1>
      <p class="lead">Aplicaci&oacute; preparada per treballar des del m&ograve;bil i exportar les dades.</p>
    </header>

    <section class="card" aria-labelledby="start-title">
      <div>
        <p class="status-label">Emmagatzematge local</p>
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
              <p class="status-label">Desat al dispositiu</p>
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
        <p class="status-label">Partits del dispositiu</p>
        <h2 id="history-title">Historial</h2>
      </div>
      <button class="button button-ghost" data-action="history" type="button">
        Veure ${matches.length}
      </button>
    </section>

    <section class="status-panel" aria-label="Estat de la infraestructura">
      <div class="status-row"><span>Base de dades local</span><strong>Activa</strong></div>
      <div class="status-row"><span>Partits locals</span><strong>${matches.length}</strong></div>
      <div class="status-row"><span>Protecci&oacute; de dades</span><strong>${persistenceLabel}</strong></div>
    </section>

    <aside class="data-warning">
      <strong>Les dades es guarden en aquest dispositiu.</strong>
      <p>Descarrega peri&ograve;dicament una c&ograve;pia des de l'Historial. Esborrar les dades de Chrome tamb&eacute; elimina els partits locals.</p>
    </aside>
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

  return screen
}
