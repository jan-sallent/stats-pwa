import { getMatchEvents } from '../db/events'
import { getMatch } from '../db/matches'
import type { MatchEventRecord } from '../models/types'
import type { Navigate } from '../navigation'
import { escapeHtml } from '../ui/format'

export async function createMatchEventsScreen(
  navigate: Navigate,
  matchId: string,
): Promise<HTMLElement> {
  const [match, events] = await Promise.all([getMatch(matchId), getMatchEvents(matchId)])
  const screen = document.createElement('main')
  screen.className = 'app-shell'

  if (!match) {
    screen.innerHTML = `<section class="empty-state"><h1>Partit no trobat</h1></section>`
    return screen
  }

  screen.innerHTML = `
    <header class="screen-header compact-header">
      <button class="button button-ghost" data-action="back" type="button">Enrere</button>
      <div>
        <p class="eyebrow">${match.status === 'finished' ? 'Partit finalitzat' : 'Partit en curs'}</p>
        <h1>Historial d'accions</h1>
        <p>${escapeHtml(match.opponent || 'Partit sense rival')}</p>
      </div>
    </header>

    <section class="event-history-list">
      ${
        events.length === 0
          ? `<div class="empty-state"><h2>Encara no hi ha accions</h2></div>`
          : [...events].reverse().map(createEventCard).join('')
      }
    </section>
  `

  screen.querySelector('[data-action="back"]')?.addEventListener('click', () => {
    navigate({ screen: 'match', matchId })
  })
  screen.querySelectorAll<HTMLButtonElement>('[data-edit-event-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const eventId = button.dataset.editEventId
      if (eventId) navigate({ screen: 'event-editor', matchId, eventId })
    })
  })
  return screen
}

function createEventCard(event: MatchEventRecord): string {
  if (event.payload.kind === 'period-change') {
    return `
      <article class="period-history-divider">
        <strong>Inici de la segona part</strong>
        <span>Comen&ccedil;a en ${event.payload.startingPhase === 'attack' ? 'atac' : 'defensa'}</span>
      </article>
    `
  }

  const playerName = event.payload.playerNickname || event.payload.playerFirstName
  const player =
    event.payload.teamSide === 'opponent'
      ? 'Equip rival'
      : event.payload.playerNumber === null
      ? 'Sense jugador'
      : `${escapeHtml(playerName || event.payload.playerLastName || 'Jugador')} (#${event.payload.playerNumber})`
  const position = event.payload.shotPosition ? ` &middot; ${event.payload.shotPosition}` : ''
  const phase = event.payload.phase === 'attack' ? 'Atac' : 'Defensa'
  return `
    <article class="event-history-card ${event.payload.phase === 'attack' ? 'is-attack-event' : 'is-defense-event'}">
      <div class="event-history-meta">
        <span>Part ${event.payload.period}</span>
        <span>${phase}</span>
        <span>Possessi&oacute; ${event.payload.possession}</span>
      </div>
      <div class="event-history-main">
        <div>
          <h2>${escapeHtml(event.payload.actionLabel)}${position}</h2>
          <p>${player}</p>
        </div>
        <button class="button button-secondary" data-edit-event-id="${escapeHtml(event.id)}" type="button">
          Modificar
        </button>
      </div>
    </article>
  `
}
