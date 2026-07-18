import { getActionsForPhase, type MatchActionDefinition } from '../config/actions'
import {
  addActionEvent,
  addPeriodChangeEvent,
  finishMatch,
  getMatchEvents,
  undoLastEvent,
} from '../db/events'
import { openMatch, startMatch } from '../db/matches'
import { getPlayersByTeam, getTeam } from '../db/teams'
import { deriveMatchState, oppositePhase } from '../domain/match-state'
import { downloadMatchCsv } from '../export/match-csv'
import type {
  ActionCategory,
  EntityId,
  MatchEventRecord,
  PlayerRecord,
  ShotPosition,
} from '../models/types'
import type { Navigate } from '../navigation'
import { escapeHtml } from '../ui/format'

export async function createMatchScreen(
  navigate: Navigate,
  matchId: EntityId,
): Promise<HTMLElement> {
  const match = await openMatch(matchId)
  const screen = document.createElement('main')
  screen.className = 'app-shell match-shell'

  if (!match) return createMissingMatchScreen(screen, navigate)
  if (match.initialPhase === null) {
    return createInitialPhaseScreen(screen, navigate, match.id, match.opponent)
  }
  const initialPhase = match.initialPhase

  const [events, team, teamPlayers] = await Promise.all([
    getMatchEvents(matchId),
    match.teamId ? getTeam(match.teamId) : Promise.resolve(undefined),
    match.teamId ? getPlayersByTeam(match.teamId) : Promise.resolve([]),
  ])
  const state = deriveMatchState(match, events)

  if (state.finished) {
    return createFinishedMatchScreen(screen, navigate, match.id, match.opponent, events)
  }

  screen.classList.add(state.phase === 'attack' ? 'phase-attack-shell' : 'phase-defense-shell')

  const summonedIds = new Set(match.selectedPlayerIds)
  const summonedPlayers = sortPlayers(
    summonedIds.size > 0
      ? teamPlayers.filter((player) => summonedIds.has(player.id))
      : teamPlayers,
  )
  const shotActions = getActionsForPhase(state.phase, 'shot')
  const nonShotActions = getActionsForPhase(state.phase, 'non-shot')
  const timeoutUsed = events.some(
    (event) =>
      event.payload.kind === 'action' &&
      event.payload.actionId === 'timeout' &&
      event.payload.period === state.period,
  )
  const timeoutAction: MatchActionDefinition = {
    id: 'timeout',
    label: 'Temps mort',
    phase: state.phase,
    category: 'special',
    playerSelection: 'none',
    endsPossession: false,
  }
  const twoMinuteAction: MatchActionDefinition = {
    id: 'two-minute',
    label: '2 minuts',
    phase: state.phase,
    category: 'non-shot',
    playerSelection: 'all',
    endsPossession: state.phase === 'attack',
  }
  const phaseLabel = state.phase === 'attack' ? 'ATAC' : 'DEFENSA'
  const phaseClass = state.phase === 'attack' ? 'is-attack' : 'is-defense'

  screen.innerHTML = `
    <header class="match-header ${phaseClass}">
      <div class="match-topline">
        <button class="button button-header" data-action="back" type="button">Sortir</button>
        <span>Part ${state.period} de 2</span>
      </div>
      <p class="match-opponent">${escapeHtml(team?.name ?? 'Equip no disponible')} &middot; ${escapeHtml(match.opponent || 'Partit sense rival')}</p>
      <div class="match-state-line">
        <strong>${phaseLabel}</strong>
        <span>Part ${state.period}</span>
      </div>
      <div class="possession-dashboard">
        <div>
          <span>Possessi&oacute; d'${state.phase === 'attack' ? 'atac' : 'defensa'}</span>
          <strong>${state.phasePossession}</strong>
        </div>
        <div>
          <span>Total de la part</span>
          <strong>${state.possession}</strong>
        </div>
      </div>
    </header>

    <section class="capture-panel" data-category-panel>
      <div class="section-heading">
        <div>
          <p class="eyebrow">Pas 1</p>
          <h1>Tipus d'acci&oacute;</h1>
        </div>
        <span class="save-indicator" role="status">Desat autom&agrave;tic</span>
      </div>
      <div class="action-category-grid">
        <button class="action-category-button is-shot" data-category="shot" type="button">
          Llan&ccedil;ament
        </button>
        <button class="action-category-button is-non-shot" data-category="non-shot" type="button">
          No llan&ccedil;ament
        </button>
      </div>
      <div class="special-action-grid">
        <button class="special-action-button is-two-minute" data-action="two-minute" type="button">
          2 minuts
        </button>
      </div>
      <aside class="timeout-action-box">
        <span>Acci&oacute; de partit</span>
        <button class="special-action-button is-timeout" data-action="timeout" type="button" ${timeoutUsed ? 'disabled' : ''}>
          ${timeoutUsed ? 'Temps mort utilitzat' : 'Marcar temps mort'}
        </button>
      </aside>
    </section>

    <section class="capture-panel detail-panel" data-detail-panel hidden>
      <div class="section-heading">
        <div>
          <p class="eyebrow">Pas 2</p>
          <h1 data-detail-title></h1>
        </div>
        <button class="button button-ghost compact-button" data-action="back-category" type="button">Enrere</button>
      </div>

      <div data-shot-details hidden>
        <fieldset class="shot-position-selector">
          <legend>Posici&oacute;</legend>
          <div class="shot-position-grid">
            ${(['6m', '7m', '9m'] as const)
              .map(
                (position) =>
                  `<button class="shot-position-button" data-shot-position="${position}" aria-pressed="false" type="button">${position}</button>`,
              )
              .join('')}
          </div>
        </fieldset>
        <div class="action-grid action-result-grid">
          ${shotActions.map(createActionButton).join('')}
        </div>
      </div>

      <div class="action-grid" data-non-shot-details hidden>
        ${nonShotActions.map(createActionButton).join('')}
      </div>
    </section>

    <section class="capture-panel player-panel" data-player-panel hidden>
      <div class="section-heading">
        <div>
          <p class="eyebrow">Pas 3</p>
          <h1>Quin jugador?</h1>
        </div>
        <button class="button button-ghost compact-button" data-action="cancel-player" type="button">Enrere</button>
      </div>
      <p class="selected-action" data-selected-action></p>
      <div class="roster-picker" data-roster-picker></div>
      <p class="data-warning" data-empty-roster hidden></p>
      <form data-player-form hidden>
        <label class="field dorsal-field">
          <span>N&uacute;mero del jugador</span>
          <input name="playerNumber" type="number" min="0" max="99" inputmode="numeric" required />
        </label>
        <button class="button button-primary full-width" type="submit">Desar acci&oacute;</button>
      </form>
    </section>

    <p class="error-message" data-event-error role="alert" hidden></p>

    <footer class="match-controls">
      <button class="button button-ghost" data-action="undo" type="button" ${events.length === 0 ? 'disabled' : ''}>Desfer</button>
      <button class="button button-secondary" data-action="event-history" type="button">Historial</button>
      <button class="button button-danger" data-action="period-or-finish" type="button">
        ${state.period === 1 ? 'Passar a 2a part' : 'Finalitzar partit'}
      </button>
    </footer>
  `

  let selectedCategory: ActionCategory | undefined
  let selectedAction: MatchActionDefinition | undefined
  let selectedShotPosition: ShotPosition | null = null
  let busy = false
  const categoryPanel = screen.querySelector<HTMLElement>('[data-category-panel]')
  const detailPanel = screen.querySelector<HTMLElement>('[data-detail-panel]')
  const playerPanel = screen.querySelector<HTMLElement>('[data-player-panel]')
  const shotDetails = screen.querySelector<HTMLElement>('[data-shot-details]')
  const nonShotDetails = screen.querySelector<HTMLElement>('[data-non-shot-details]')
  const detailTitle = screen.querySelector<HTMLElement>('[data-detail-title]')
  const rosterPicker = screen.querySelector<HTMLElement>('[data-roster-picker]')
  const emptyRoster = screen.querySelector<HTMLElement>('[data-empty-roster]')
  const playerForm = screen.querySelector<HTMLFormElement>('[data-player-form]')
  const playerInput = playerForm?.elements.namedItem('playerNumber') as HTMLInputElement | null
  const selectedActionLabel = screen.querySelector<HTMLElement>('[data-selected-action]')
  const eventError = screen.querySelector<HTMLElement>('[data-event-error]')
  const refresh = (): void => navigate({ screen: 'match', matchId })

  const showCategoryPanel = (): void => {
    selectedCategory = undefined
    selectedAction = undefined
    selectedShotPosition = null
    if (categoryPanel) categoryPanel.hidden = false
    if (detailPanel) detailPanel.hidden = true
    if (playerPanel) playerPanel.hidden = true
  }

  const showDetailPanel = (category: ActionCategory): void => {
    selectedCategory = category
    selectedAction = undefined
    selectedShotPosition = null
    if (categoryPanel) categoryPanel.hidden = true
    if (detailPanel) detailPanel.hidden = false
    if (playerPanel) playerPanel.hidden = true
    if (shotDetails) shotDetails.hidden = category !== 'shot'
    if (nonShotDetails) nonShotDetails.hidden = category !== 'non-shot'
    if (detailTitle) detailTitle.textContent = category === 'shot' ? 'Llançament' : 'No llançament'
    updateShotPositionButtons(screen, null)
  }

  const saveAction = async (
    player: PlayerRecord | null,
    manualPlayerNumber: number | null = null,
  ): Promise<void> => {
    if (busy || !selectedAction) return
    busy = true
    setButtonsDisabled(screen, true)

    try {
      await addActionEvent(matchId, {
        kind: 'action',
        period: state.period,
        possession: state.possession,
        phase: state.phase,
        actionId: selectedAction.id,
        actionLabel: selectedAction.label,
        actionCategory: selectedAction.category,
        shotPosition: selectedAction.category === 'shot' ? selectedShotPosition : null,
        playerId: player?.id ?? null,
        playerFirstName: player?.firstName ?? '',
        playerLastName: player?.lastName ?? '',
        playerNickname: player?.nickname ?? '',
        playerNumber: player?.number ?? manualPlayerNumber,
        playerPosition: player?.position ?? (manualPlayerNumber === null ? null : 'court'),
        endsPossession: selectedAction.endsPossession,
      })
      refresh()
    } catch (error) {
      console.error("No s'ha pogut desar l'acci\u00f3", error)
      busy = false
      setButtonsDisabled(screen, false)
      if (eventError) {
        eventError.textContent = "No s'ha pogut desar. Torna-ho a provar."
        eventError.hidden = false
      }
    }
  }

  const showPlayerPanel = (action: MatchActionDefinition): void => {
    selectedAction = action
    const eligiblePlayers =
      action.playerSelection === 'goalkeepers'
        ? summonedPlayers.filter((player) => player.position === 'goalkeeper')
        : summonedPlayers

    if (categoryPanel) categoryPanel.hidden = true
    if (detailPanel) detailPanel.hidden = true
    if (playerPanel) playerPanel.hidden = false
    if (selectedActionLabel) {
      selectedActionLabel.textContent = createSelectedActionLabel(action, selectedShotPosition)
    }
    if (rosterPicker) {
      const separateGoalkeepers =
        state.phase === 'defense' &&
        action.category === 'non-shot' &&
        action.playerSelection === 'all'
      rosterPicker.classList.toggle('is-separated', separateGoalkeepers)
      rosterPicker.hidden = eligiblePlayers.length === 0
      rosterPicker.innerHTML = separateGoalkeepers
        ? createSeparatedRoster(eligiblePlayers)
        : eligiblePlayers.map(createPlayerButton).join('')
      rosterPicker.querySelectorAll<HTMLButtonElement>('[data-player-id]').forEach((button) => {
        button.addEventListener('click', () => {
          const player = eligiblePlayers.find((candidate) => candidate.id === button.dataset.playerId)
          if (!player) return
          if (action.id === 'two-minute') {
            const playerName = player.nickname || `${player.firstName} ${player.lastName}`
            if (!window.confirm(`Confirmes 2 minuts per a ${playerName} (#${player.number})?`)) {
              return
            }
          }
          void saveAction(player)
        })
      })
    }

    const isLegacyMatch = match.teamId === null
    if (playerForm) playerForm.hidden = !isLegacyMatch
    if (emptyRoster) {
      emptyRoster.hidden = eligiblePlayers.length > 0 || isLegacyMatch
      emptyRoster.textContent =
        action.playerSelection === 'goalkeepers'
          ? 'No hi ha cap porter convocat per a aquest partit.'
          : 'No hi ha cap jugador convocat disponible.'
    }
    if (isLegacyMatch) playerInput?.focus()
  }

  screen.querySelector('[data-action="back"]')?.addEventListener('click', () => {
    navigate({ screen: 'home' })
  })
  screen.querySelector('[data-action="event-history"]')?.addEventListener('click', () => {
    navigate({ screen: 'match-events', matchId })
  })

  screen.querySelectorAll<HTMLButtonElement>('[data-category]').forEach((button) => {
    button.addEventListener('click', () => {
      const category = button.dataset.category
      if (category === 'shot' || category === 'non-shot') showDetailPanel(category)
    })
  })

  screen.querySelector('[data-action="timeout"]')?.addEventListener('click', () => {
    if (busy || timeoutUsed) return
    if (!window.confirm(`Confirmes el temps mort de la part ${state.period}?`)) return
    selectedAction = timeoutAction
    void saveAction(null)
  })

  screen.querySelector('[data-action="two-minute"]')?.addEventListener('click', () => {
    if (busy) return
    showPlayerPanel(twoMinuteAction)
  })

  screen.querySelectorAll<HTMLButtonElement>('[data-shot-position]').forEach((button) => {
    button.addEventListener('click', () => {
      const position = button.dataset.shotPosition as ShotPosition | undefined
      if (!position) return
      selectedShotPosition = selectedShotPosition === position ? null : position
      updateShotPositionButtons(screen, selectedShotPosition)
    })
  })

  screen.querySelectorAll<HTMLButtonElement>('[data-action-id]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!selectedCategory) return
      const actions = getActionsForPhase(state.phase, selectedCategory)
      const action = actions.find((candidate) => candidate.id === button.dataset.actionId)
      if (!action) return
      selectedAction = action
      if (action.playerSelection === 'none') void saveAction(null)
      else showPlayerPanel(action)
    })
  })

  screen
    .querySelector('[data-action="back-category"]')
    ?.addEventListener('click', showCategoryPanel)

  screen.querySelector('[data-action="cancel-player"]')?.addEventListener('click', () => {
    const returnToCategory =
      selectedAction?.category === 'special' || selectedAction?.id === 'two-minute'
    selectedAction = undefined
    playerForm?.reset()
    if (playerPanel) playerPanel.hidden = true
    if (returnToCategory) showCategoryPanel()
    else if (detailPanel) detailPanel.hidden = false
  })

  playerForm?.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (busy || !selectedAction || !playerInput) return
    const playerNumber = Number(playerInput.value)
    if (!Number.isInteger(playerNumber) || playerNumber < 0 || playerNumber > 99) {
      playerInput.setCustomValidity('Introdueix un dorsal entre 0 i 99')
      playerInput.reportValidity()
      return
    }
    playerInput.setCustomValidity('')
    await saveAction(null, playerNumber)
  })

  screen.querySelector('[data-action="undo"]')?.addEventListener('click', async () => {
    if (busy) return
    busy = true
    setButtonsDisabled(screen, true)
    await undoLastEvent(matchId)
    refresh()
  })

  screen.querySelector('[data-action="period-or-finish"]')?.addEventListener('click', async () => {
    if (busy) return
    if (state.period === 1) {
      const startingPhase = oppositePhase(initialPhase)
      const startingLabel = startingPhase === 'attack' ? 'atac' : 'defensa'
      if (!window.confirm(`Vols iniciar la segona part? Començarà en ${startingLabel}.`)) return
      busy = true
      setButtonsDisabled(screen, true)
      await addPeriodChangeEvent(matchId, {
        kind: 'period-change',
        period: 2,
        startingPhase,
      })
      refresh()
      return
    }
    if (!window.confirm('Vols finalitzar el partit?')) return
    busy = true
    setButtonsDisabled(screen, true)
    await finishMatch(matchId)
    navigate({ screen: 'home' })
  })

  return screen
}

function createActionButton(action: MatchActionDefinition): string {
  return `<button class="action-button" data-action-id="${escapeHtml(action.id)}" type="button">${escapeHtml(action.label)}</button>`
}

function updateShotPositionButtons(
  screen: HTMLElement,
  selectedPosition: ShotPosition | null,
): void {
  screen.querySelectorAll<HTMLButtonElement>('[data-shot-position]').forEach((button) => {
    const selected = button.dataset.shotPosition === selectedPosition
    button.classList.toggle('is-selected', selected)
    button.setAttribute('aria-pressed', String(selected))
  })
}

function createSelectedActionLabel(
  action: MatchActionDefinition,
  shotPosition: ShotPosition | null,
): string {
  return shotPosition ? `${action.label} · ${shotPosition}` : action.label
}

function sortPlayers(players: readonly PlayerRecord[]): PlayerRecord[] {
  return [...players].sort((a, b) => {
    if (a.position !== b.position) return a.position === 'goalkeeper' ? 1 : -1
    const aName = a.nickname || `${a.firstName} ${a.lastName}`
    const bName = b.nickname || `${b.firstName} ${b.lastName}`
    return aName.localeCompare(bName, 'ca', { sensitivity: 'base' })
  })
}

function createPlayerButton(player: PlayerRecord): string {
  const displayName = player.nickname || `${player.firstName} ${player.lastName}`
  const position = player.position === 'goalkeeper' ? 'Porter' : 'Jugador de camp'
  return `
    <button class="roster-player-button" data-player-id="${escapeHtml(player.id)}" type="button">
      <strong>#${player.number}</strong>
      <span>${escapeHtml(displayName)}</span>
      <small>${position}</small>
    </button>
  `
}

function createSeparatedRoster(players: readonly PlayerRecord[]): string {
  const courtPlayers = players.filter((player) => player.position === 'court')
  const goalkeepers = players.filter((player) => player.position === 'goalkeeper')
  return `
    ${
      courtPlayers.length > 0
        ? `<section class="roster-section">
            <h2>Jugadors de camp</h2>
            <div class="roster-subgrid">${courtPlayers.map(createPlayerButton).join('')}</div>
          </section>`
        : ''
    }
    ${
      goalkeepers.length > 0
        ? `<section class="roster-section goalkeeper-section">
            <h2>Porters</h2>
            <div class="roster-subgrid">${goalkeepers.map(createPlayerButton).join('')}</div>
          </section>`
        : ''
    }
  `
}

function createMissingMatchScreen(screen: HTMLElement, navigate: Navigate): HTMLElement {
  screen.innerHTML = `
    <section class="card card-stack" role="alert">
      <h1>Partit no trobat</h1>
      <p>El registre sol&middot;licitat no existeix en aquest dispositiu.</p>
      <button class="button button-primary" type="button">Tornar a l'inici</button>
    </section>
  `
  screen.querySelector('button')?.addEventListener('click', () => navigate({ screen: 'home' }))
  return screen
}

function createInitialPhaseScreen(
  screen: HTMLElement,
  navigate: Navigate,
  matchId: EntityId,
  opponent: string,
): HTMLElement {
  screen.className = 'app-shell initial-phase-screen'
  screen.innerHTML = `
    <header class="screen-header compact-header">
      <button class="button button-ghost" data-action="back" type="button">Sortir</button>
      <div>
        <p class="eyebrow">Partit preparat</p>
        <h1>${escapeHtml(opponent || 'Nou partit')}</h1>
      </div>
    </header>
    <section class="initial-phase-card">
      <p class="eyebrow">Primera pregunta</p>
      <h2>Com comen&ccedil;a el partit?</h2>
      <div class="phase-choice">
        <button class="button phase-button phase-attack" data-initial-phase="attack" type="button">Atac</button>
        <button class="button phase-button phase-defense" data-initial-phase="defense" type="button">Defensa</button>
      </div>
    </section>
  `
  screen.querySelector('[data-action="back"]')?.addEventListener('click', () => {
    navigate({ screen: 'home' })
  })
  screen.querySelectorAll<HTMLButtonElement>('[data-initial-phase]').forEach((button) => {
    button.addEventListener('click', async () => {
      const phase = button.dataset.initialPhase
      if (phase !== 'attack' && phase !== 'defense') return
      setButtonsDisabled(screen, true)
      await startMatch(matchId, phase)
      navigate({ screen: 'match', matchId })
    })
  })
  return screen
}

function createFinishedMatchScreen(
  screen: HTMLElement,
  navigate: Navigate,
  matchId: EntityId,
  opponent: string,
  events: readonly MatchEventRecord[],
): HTMLElement {
  screen.innerHTML = `
    <header class="screen-header">
      <button class="button button-ghost" data-action="back" type="button">Tornar</button>
      <div><p class="eyebrow">Partit finalitzat</p><h1>${escapeHtml(opponent || 'Partit')}</h1></div>
    </header>
    <section class="status-panel">
      <div class="status-row"><span>Registres desats</span><strong>${events.length}</strong></div>
      <div class="status-row"><span>Estat</span><strong>Finalitzat</strong></div>
    </section>
    <div class="finished-match-actions">
      <button class="button button-secondary" data-action="event-history" type="button">Historial d'accions</button>
      <button class="button button-primary" data-action="export" type="button">Exportar CSV</button>
    </div>
    <p class="export-feedback" data-export-feedback aria-live="polite"></p>
  `
  screen.querySelector('[data-action="back"]')?.addEventListener('click', () => navigate({ screen: 'home' }))
  screen.querySelector('[data-action="event-history"]')?.addEventListener('click', () => {
    navigate({ screen: 'match-events', matchId })
  })
  const exportButton = screen.querySelector<HTMLButtonElement>('[data-action="export"]')
  const feedback = screen.querySelector<HTMLElement>('[data-export-feedback]')
  exportButton?.addEventListener('click', async () => {
    exportButton.disabled = true
    try {
      await downloadMatchCsv(matchId)
      if (feedback) feedback.textContent = 'CSV descarregat al dispositiu.'
    } catch (error) {
      console.error("No s'ha pogut exportar el CSV", error)
      if (feedback) feedback.textContent = "No s'ha pogut exportar. Torna-ho a provar."
    } finally {
      exportButton.disabled = false
    }
  })
  return screen
}

function setButtonsDisabled(container: HTMLElement, disabled: boolean): void {
  container.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
    button.disabled = disabled
  })
}
