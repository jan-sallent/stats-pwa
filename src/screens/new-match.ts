import { createMatchDraft } from '../db/matches'
import { requestPersistentStorage } from '../db/storage'
import { getPlayersByTeam, listTeams } from '../db/teams'
import type { PlayerRecord } from '../models/types'
import type { Navigate } from '../navigation'
import { escapeHtml } from '../ui/format'

export async function createNewMatchScreen(navigate: Navigate): Promise<HTMLElement> {
  const teams = await listTeams()
  const playersByTeam = new Map(
    await Promise.all(
      teams.map(async (team) => [team.id, await getPlayersByTeam(team.id)] as const),
    ),
  )
  const screen = document.createElement('main')
  screen.className = 'app-shell'

  if (teams.length === 0) {
    screen.innerHTML = `
      <header class="screen-header compact-header">
        <button class="button button-ghost" data-action="back" type="button">Enrere</button>
        <div>
          <p class="eyebrow">Configuraci&oacute;</p>
          <h1>Nou partit</h1>
        </div>
      </header>
      <section class="card card-stack">
        <div>
          <h2>Primer crea el teu equip</h2>
          <p>Necessites almenys un equip amb un jugador abans de comen&ccedil;ar un partit.</p>
        </div>
        <button class="button button-primary" data-action="create-team" type="button">Crear un equip</button>
      </section>
    `
    screen
      .querySelector('[data-action="back"]')
      ?.addEventListener('click', () => navigate({ screen: 'home' }))
    screen
      .querySelector('[data-action="create-team"]')
      ?.addEventListener('click', () => navigate({ screen: 'team-editor' }))
    return screen
  }

  screen.innerHTML = `
    <header class="screen-header compact-header">
      <button class="button button-ghost" data-action="back" type="button">Enrere</button>
      <div>
        <p class="eyebrow">Configuraci&oacute;</p>
        <h1>Nou partit</h1>
      </div>
    </header>

    <form class="match-form" data-match-form>
      <label class="field">
        <span>Equip</span>
        <select name="teamId" required>
          ${teams
            .map(
              (team) =>
                `<option value="${escapeHtml(team.id)}">${escapeHtml(team.name)}</option>`,
            )
            .join('')}
        </select>
      </label>

      <button class="button button-ghost" data-action="manage-teams" type="button">Gestionar equips</button>

      <fieldset class="squad-selector">
        <legend>Jugadors convocats</legend>
        <p>Selecciona els jugadors disponibles per a aquest partit.</p>
        <div class="squad-grid" data-squad-grid></div>
      </fieldset>

      <label class="field">
        <span>Rival</span>
        <input name="opponent" type="text" maxlength="80" autocomplete="off" required />
      </label>

      <label class="field">
        <span>Data i hora</span>
        <input name="scheduledAt" type="datetime-local" value="${getDefaultDateTime()}" required />
      </label>

      <label class="field">
        <span>Competici&oacute;</span>
        <input name="competition" type="text" maxlength="80" autocomplete="off" required />
      </label>

      <label class="field">
        <span>Jornada</span>
        <input name="round" type="text" maxlength="30" inputmode="numeric" autocomplete="off" required />
      </label>

      <button class="button button-primary full-width" type="submit">Iniciar partit</button>

      <p class="error-message" data-save-error role="alert" hidden></p>
    </form>
  `

  screen
    .querySelector('[data-action="back"]')
    ?.addEventListener('click', () => navigate({ screen: 'home' }))
  screen
    .querySelector('[data-action="manage-teams"]')
    ?.addEventListener('click', () => navigate({ screen: 'teams' }))

  const form = screen.querySelector<HTMLFormElement>('[data-match-form]')
  const errorMessage = screen.querySelector<HTMLElement>('[data-save-error]')
  const teamSelect = form?.elements.namedItem('teamId') as HTMLSelectElement | null
  const squadGrid = screen.querySelector<HTMLElement>('[data-squad-grid]')

  const renderSquad = (): void => {
    if (!teamSelect || !squadGrid) return
    const players = sortPlayers(playersByTeam.get(teamSelect.value) ?? [])
    squadGrid.innerHTML = players
      .map(
        (player) => `
          <label class="squad-player">
            <input name="selectedPlayerIds" type="checkbox" value="${escapeHtml(player.id)}" checked />
            <span>
              <strong>#${player.number} ${escapeHtml(player.nickname || player.firstName)}</strong>
              <small>${player.position === 'goalkeeper' ? 'Porter' : 'Jugador de camp'}</small>
            </span>
          </label>
        `,
      )
      .join('')
  }

  teamSelect?.addEventListener('change', renderSquad)
  renderSquad()

  form?.addEventListener('submit', async (event) => {
    event.preventDefault()
    const submitButtons = form.querySelectorAll<HTMLButtonElement>('button[type="submit"]')
    submitButtons.forEach((button) => {
      button.disabled = true
    })
    if (errorMessage) {
      errorMessage.hidden = true
    }

    void requestPersistentStorage()

    try {
      const data = new FormData(form)
      const selectedPlayerIds = data
        .getAll('selectedPlayerIds')
        .map((value) => String(value))
      if (selectedPlayerIds.length === 0) {
        throw new Error('At least one selected player is required')
      }
      const match = await createMatchDraft({
        teamId: getFormValue(data, 'teamId'),
        selectedPlayerIds,
        opponent: getFormValue(data, 'opponent'),
        scheduledAt: getFormValue(data, 'scheduledAt'),
        competition: getFormValue(data, 'competition'),
        round: getFormValue(data, 'round'),
      })
      navigate({ screen: 'match', matchId: match.id })
    } catch (error) {
      console.error("No s'ha pogut crear el partit", error)
      submitButtons.forEach((button) => {
        button.disabled = false
      })

      if (errorMessage) {
        errorMessage.textContent =
          error instanceof Error && error.message.includes('selected player')
            ? 'Selecciona com a m\u00ednim un jugador convocat.'
            : "No s'ha pogut desar. Torna-ho a provar."
        errorMessage.hidden = false
      }
    }
  })

  return screen
}

function sortPlayers(players: readonly PlayerRecord[]): PlayerRecord[] {
  return [...players].sort((a, b) => {
    if (a.position !== b.position) return a.position === 'goalkeeper' ? 1 : -1
    const aName = a.nickname || `${a.firstName} ${a.lastName}`
    const bName = b.nickname || `${b.firstName} ${b.lastName}`
    return aName.localeCompare(bName, 'ca', { sensitivity: 'base' })
  })
}

function getFormValue(data: FormData, field: string): string {
  return String(data.get(field) ?? '').trim()
}

function getDefaultDateTime(): string {
  const now = new Date()
  const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return localNow.toISOString().slice(0, 16)
}
