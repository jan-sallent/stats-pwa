import { getTeamWithPlayers, saveTeam } from '../db/teams'
import type { EntityId, PlayerRecord } from '../models/types'
import type { Navigate } from '../navigation'
import { escapeHtml } from '../ui/format'

export async function createTeamEditorScreen(
  navigate: Navigate,
  teamId?: EntityId,
): Promise<HTMLElement> {
  const existing = teamId ? await getTeamWithPlayers(teamId) : undefined
  const screen = document.createElement('main')
  screen.className = 'app-shell'
  screen.innerHTML = `
    <header class="screen-header compact-header">
      <button class="button button-ghost" data-action="back" type="button">Enrere</button>
      <div>
        <p class="eyebrow">${existing ? 'Editar plantilla' : 'Nova plantilla'}</p>
        <h1>${existing ? escapeHtml(existing.team.name) : 'Crear equip'}</h1>
      </div>
    </header>

    <form class="team-form" data-team-form>
      <label class="field">
        <span>Nom de l'equip</span>
        <input name="teamName" type="text" maxlength="80" value="${escapeHtml(existing?.team.name ?? '')}" required />
      </label>

      <div class="roster-heading">
        <div>
          <p class="eyebrow">Plantilla</p>
          <h2>Jugadors i porters</h2>
        </div>
        <button class="button button-secondary" data-action="add-player" type="button">
          Afegir jugador
        </button>
      </div>

      <section class="player-editor-list" data-player-list></section>

      <p class="error-message" data-team-error role="alert" hidden></p>
      <button class="button button-primary full-width" type="submit">Desar equip</button>
    </form>
  `

  const form = screen.querySelector<HTMLFormElement>('[data-team-form]')
  const playerList = screen.querySelector<HTMLElement>('[data-player-list]')
  const errorMessage = screen.querySelector<HTMLElement>('[data-team-error]')

  const addPlayerCard = (player?: PlayerRecord): void => {
    if (!playerList) return
    playerList.insertAdjacentHTML('beforeend', createPlayerEditor(player))
    const card = playerList.lastElementChild
    card?.querySelector('[data-action="remove-player"]')?.addEventListener('click', () => card.remove())
    if (!player) card?.querySelector<HTMLInputElement>('[name="firstName"]')?.focus()
  }

  if (existing?.players.length) {
    existing.players.forEach(addPlayerCard)
  } else {
    addPlayerCard()
  }

  screen
    .querySelector('[data-action="back"]')
    ?.addEventListener('click', () => navigate({ screen: 'teams' }))
  screen
    .querySelector('[data-action="add-player"]')
    ?.addEventListener('click', () => addPlayerCard())

  form?.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (errorMessage) errorMessage.hidden = true

    const cards = [...form.querySelectorAll<HTMLElement>('[data-player-card]')]
    const players = cards.map((card) => ({
      id: getInputValue(card, 'playerId') || undefined,
      firstName: getInputValue(card, 'firstName'),
      lastName: getInputValue(card, 'lastName'),
      nickname: getInputValue(card, 'nickname'),
      number: Number(getInputValue(card, 'number')),
      position: getInputValue(card, 'position') === 'goalkeeper' ? 'goalkeeper' as const : 'court' as const,
    }))

    if (players.some((player) => !Number.isInteger(player.number) || player.number < 0 || player.number > 99)) {
      if (errorMessage) {
        errorMessage.textContent = 'Tots els dorsals han de ser enters entre 0 i 99.'
        errorMessage.hidden = false
      }
      return
    }

    const submitButton = form.querySelector<HTMLButtonElement>('button[type="submit"]')
    if (submitButton) submitButton.disabled = true

    try {
      await saveTeam({
        id: teamId,
        name: getInputValue(form, 'teamName'),
        players,
      })
      navigate({ screen: 'teams' })
    } catch (error) {
      console.error("No s'ha pogut desar l'equip", error)
      if (submitButton) submitButton.disabled = false
      if (errorMessage) {
        errorMessage.textContent = getTeamErrorMessage(error)
        errorMessage.hidden = false
      }
    }
  })

  return screen
}

function createPlayerEditor(player?: PlayerRecord): string {
  return `
    <article class="player-editor" data-player-card>
      <input name="playerId" type="hidden" value="${escapeHtml(player?.id ?? '')}" />
      <div class="player-editor-header">
        <strong>Jugador</strong>
        <button class="button button-delete compact-button" data-action="remove-player" type="button">Treure</button>
      </div>
      <div class="player-fields">
        <label class="field">
          <span>Nom</span>
          <input name="firstName" type="text" maxlength="60" value="${escapeHtml(player?.firstName ?? '')}" required />
        </label>
        <label class="field">
          <span>Cognoms</span>
          <input name="lastName" type="text" maxlength="100" value="${escapeHtml(player?.lastName ?? '')}" required />
        </label>
        <label class="field">
          <span>Sobrenom</span>
          <input name="nickname" type="text" maxlength="60" value="${escapeHtml(player?.nickname ?? '')}" />
        </label>
        <label class="field">
          <span>Dorsal</span>
          <input name="number" type="number" min="0" max="99" inputmode="numeric" value="${player?.number ?? ''}" required />
        </label>
        <label class="field player-position-field">
          <span>Posici&oacute;</span>
          <select name="position" required>
            <option value="court" ${player?.position !== 'goalkeeper' ? 'selected' : ''}>Jugador de camp</option>
            <option value="goalkeeper" ${player?.position === 'goalkeeper' ? 'selected' : ''}>Porter</option>
          </select>
        </label>
      </div>
    </article>
  `
}

function getInputValue(container: ParentNode, name: string): string {
  return container.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`)?.value.trim() ?? ''
}

function getTeamErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return "No s'ha pogut desar l'equip."
  if (error.message.includes('unique')) return 'No es poden repetir dorsals dins del mateix equip.'
  if (error.message.includes('At least one')) return 'Afegeix com a m\u00ednim un jugador.'
  if (error.message.includes('Player name')) return 'Tots els jugadors necessiten nom i cognoms.'
  return "No s'ha pogut desar l'equip. Revisa les dades."
}
