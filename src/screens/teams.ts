/** Llistat, transferència i eliminació de plantilles locals. */
import { exportTeams, importTeams } from '../backup/team-transfer'
import { deleteTeam, getPlayersByTeam, listTeams } from '../db/teams'
import type { Navigate } from '../navigation'
import { escapeHtml } from '../ui/format'

export async function createTeamsScreen(navigate: Navigate): Promise<HTMLElement> {
  // Es precalculen les plantilles completes per poder mostrar els dos comptadors.
  const teams = await listTeams()
  const playerLists = new Map(
    await Promise.all(
      teams.map(async (team) => [team.id, await getPlayersByTeam(team.id)] as const),
    ),
  )
  const screen = document.createElement('main')
  screen.className = 'app-shell'
  screen.innerHTML = `
    <header class="screen-header compact-header">
      <button class="button button-ghost" data-action="back" type="button">Enrere</button>
      <div>
        <p class="eyebrow">Plantilles</p>
        <h1>Equips</h1>
      </div>
    </header>

    <button class="button button-primary full-width" data-action="new-team" type="button">
      Crear un equip
    </button>

    <section class="team-transfer-toolbar">
      <button class="button button-secondary" data-action="export-teams" type="button" ${teams.length === 0 ? 'disabled' : ''}>
        Exportar plantilles
      </button>
      <button class="button button-ghost" data-action="import-teams" type="button">
        Importar plantilles
      </button>
      <input data-team-file type="file" accept="application/json,.json" hidden />
    </section>
    <p class="export-feedback" data-team-feedback aria-live="polite"></p>

    <p class="local-data-note">Els equips i jugadors es guarden localment en aquest dispositiu.</p>

    <section class="team-list">
      ${
        teams.length === 0
          ? `<div class="empty-state">
              <h2>Encara no hi ha cap equip</h2>
              <p>Crea una plantilla abans de comen&ccedil;ar un partit.</p>
            </div>`
          : teams
              .map((team) => {
                const players = playerLists.get(team.id) ?? []
                const courtPlayers = players.filter((player) => player.position === 'court').length
                const goalkeepers = players.filter((player) => player.position === 'goalkeeper').length
                return `
                  <article class="team-card">
                    <div>
                      <h2>${escapeHtml(team.name)}</h2>
                      <p>${courtPlayers} jugadors de camp &middot; ${goalkeepers} porters</p>
                    </div>
                    <div class="team-card-actions">
                      <button class="button button-secondary" data-edit-team-id="${team.id}" type="button">
                        Editar
                      </button>
                      <button class="button button-delete" data-delete-team-id="${team.id}" type="button">
                        Eliminar
                      </button>
                    </div>
                  </article>
                `
              })
              .join('')
      }
    </section>
  `

  screen
    .querySelector('[data-action="back"]')
    ?.addEventListener('click', () => navigate({ screen: 'home' }))
  screen
    .querySelector('[data-action="new-team"]')
    ?.addEventListener('click', () => navigate({ screen: 'team-editor' }))
  screen.querySelectorAll<HTMLButtonElement>('[data-edit-team-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const teamId = button.dataset.editTeamId
      if (teamId) navigate({ screen: 'team-editor', teamId })
    })
  })

  const feedback = screen.querySelector<HTMLElement>('[data-team-feedback]')
  const exportButton = screen.querySelector<HTMLButtonElement>('[data-action="export-teams"]')
  const importButton = screen.querySelector<HTMLButtonElement>('[data-action="import-teams"]')
  const fileInput = screen.querySelector<HTMLInputElement>('[data-team-file]')

  exportButton?.addEventListener('click', async () => {
    exportButton.disabled = true
    try {
      await exportTeams()
      if (feedback) feedback.textContent = 'Fitxer de plantilles descarregat.'
    } catch (error) {
      console.error("No s'han pogut exportar les plantilles", error)
      if (feedback) feedback.textContent = "No s'han pogut exportar les plantilles."
    } finally {
      exportButton.disabled = false
    }
  })

  importButton?.addEventListener('click', () => fileInput?.click())
  fileInput?.addEventListener('change', async () => {
    // L'input queda ocult: el botó visible conserva un disseny coherent i accessible.
    const file = fileInput.files?.[0]
    if (!file || !importButton) return
    importButton.disabled = true
    try {
      const result = await importTeams(file)
      window.alert(
        `Importaci\u00f3 completada: ${result.teams} equips i ${result.players} jugadors.`,
      )
      navigate({ screen: 'teams' })
    } catch (error) {
      console.error("No s'han pogut importar les plantilles", error)
      if (feedback) feedback.textContent = 'El fitxer de plantilles no \u00e9s v\u00e0lid.'
      importButton.disabled = false
      fileInput.value = ''
    }
  })

  screen.querySelectorAll<HTMLButtonElement>('[data-delete-team-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      const teamId = button.dataset.deleteTeamId
      const team = teams.find((candidate) => candidate.id === teamId)
      if (!teamId || !team) return
      // La base de dades farà una segona validació per impedir eliminar equips en ús.
      if (!window.confirm(`Vols eliminar la plantilla ${team.name}?`)) return
      button.disabled = true
      try {
        await deleteTeam(teamId)
        navigate({ screen: 'teams' })
      } catch (error) {
        console.error("No s'ha pogut eliminar la plantilla", error)
        button.disabled = false
        if (feedback) {
          feedback.textContent =
            error instanceof Error && error.message === 'TEAM_IN_USE'
              ? 'No es pot eliminar: aquesta plantilla est\u00e0 vinculada a un partit.'
              : "No s'ha pogut eliminar la plantilla."
        }
      }
    })
  })

  return screen
}
