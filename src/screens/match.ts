import { getActionsForPhase, type MatchActionDefinition } from '../config/actions'
import {
  addActionEvent,
  addPeriodChangeEvent,
  finishMatch,
  getMatchEvents,
  undoLastEvent,
} from '../db/events'
import { openMatch } from '../db/matches'
import { deriveMatchState } from '../domain/match-state'
import { downloadMatchCsv } from '../export/match-csv'
import type { EntityId, MatchEventRecord, Phase } from '../models/types'
import type { Navigate } from '../navigation'
import { escapeHtml } from '../ui/format'

export async function createMatchScreen(
  navigate: Navigate,
  matchId: EntityId,
): Promise<HTMLElement> {
  const match = await openMatch(matchId)
  const screen = document.createElement('main')
  screen.className = 'app-shell match-shell'

  if (!match) {
    return createMissingMatchScreen(screen, navigate)
  }

  const events = await getMatchEvents(matchId)
  const state = deriveMatchState(match, events)

  if (state.finished) {
    return createFinishedMatchScreen(screen, navigate, match.id, match.opponent, events)
  }

  const actions = getActionsForPhase(state.phase)
  const lastEvent = events.at(-1)
  const phaseLabel = state.phase === 'attack' ? 'ATAC' : 'DEFENSA'
  const phaseClass = state.phase === 'attack' ? 'is-attack' : 'is-defense'

  screen.innerHTML = `
    <header class="match-header ${phaseClass}">
      <div class="match-topline">
        <button class="button button-header" data-action="back" type="button">Sortir</button>
        <span>Part ${state.period} de 2</span>
      </div>
      <p class="match-opponent">${escapeHtml(match.opponent || 'Partit sense rival')}</p>
      <div class="match-state-line">
        <strong>${phaseLabel}</strong>
        <span>Possessi&oacute; ${state.possession}</span>
      </div>
    </header>

    <section class="capture-panel" data-action-panel>
      <div class="section-heading">
        <div>
          <p class="eyebrow">Pas 1</p>
          <h1>Quina acci&oacute;?</h1>
        </div>
        <span class="save-indicator" role="status">Desat autom&agrave;tic</span>
      </div>
      <div class="action-grid">
        ${actions
          .map(
            (action) => `
              <button class="action-button" data-action-id="${action.id}" type="button">
                ${escapeHtml(action.label)}
              </button>`,
          )
          .join('')}
      </div>
    </section>

    <section class="capture-panel player-panel" data-player-panel hidden>
      <p class="eyebrow">Pas 2</p>
      <h1>Dorsal</h1>
      <p class="selected-action" data-selected-action></p>
      <form data-player-form>
        <label class="field dorsal-field">
          <span>N&uacute;mero del jugador</span>
          <input name="playerNumber" type="number" min="0" max="99" inputmode="numeric" required />
        </label>
        <div class="inline-actions">
          <button class="button button-ghost" data-action="cancel-player" type="button">Cancel&middot;lar</button>
          <button class="button button-primary" type="submit">Desar acci&oacute;</button>
        </div>
      </form>
      <p class="error-message" data-event-error role="alert" hidden></p>
    </section>

    <section class="capture-panel period-panel" data-period-panel hidden>
      <p class="eyebrow">Inici de la segona part</p>
      <h1>Com comen&ccedil;a?</h1>
      <div class="phase-choice phase-choice-inline">
        <button class="button phase-button phase-attack" data-start-phase="attack" type="button">Atac</button>
        <button class="button phase-button phase-defense" data-start-phase="defense" type="button">Defensa</button>
      </div>
      <button class="button button-ghost" data-action="cancel-period" type="button">Cancel&middot;lar</button>
    </section>

    <section class="last-event" aria-live="polite">
      <span>&Uacute;ltim registre</span>
      <strong>${getEventLabel(lastEvent)}</strong>
    </section>

    <footer class="match-controls">
      <button class="button button-ghost" data-action="undo" type="button" ${events.length === 0 ? 'disabled' : ''}>
        Desfer
      </button>
      <button class="button button-danger" data-action="period-or-finish" type="button">
        ${state.period === 1 ? 'Passar a 2a part' : 'Finalitzar partit'}
      </button>
    </footer>
  `

  let selectedAction: MatchActionDefinition | undefined
  let busy = false
  const actionPanel = screen.querySelector<HTMLElement>('[data-action-panel]')
  const playerPanel = screen.querySelector<HTMLElement>('[data-player-panel]')
  const periodPanel = screen.querySelector<HTMLElement>('[data-period-panel]')
  const playerForm = screen.querySelector<HTMLFormElement>('[data-player-form]')
  const playerInput = playerForm?.elements.namedItem('playerNumber') as HTMLInputElement | null
  const selectedActionLabel = screen.querySelector<HTMLElement>('[data-selected-action]')
  const eventError = screen.querySelector<HTMLElement>('[data-event-error]')

  const refresh = (): void => navigate({ screen: 'match', matchId })

  screen.querySelector('[data-action="back"]')?.addEventListener('click', () => {
    navigate({ screen: 'home' })
  })

  screen.querySelectorAll<HTMLButtonElement>('[data-action-id]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedAction = actions.find((action) => action.id === button.dataset.actionId)

      if (!selectedAction || !actionPanel || !playerPanel) {
        return
      }

      actionPanel.hidden = true
      playerPanel.hidden = false
      if (selectedActionLabel) {
        selectedActionLabel.textContent = selectedAction.label
      }
      playerInput?.focus()
    })
  })

  screen.querySelector('[data-action="cancel-player"]')?.addEventListener('click', () => {
    selectedAction = undefined
    playerForm?.reset()
    if (playerPanel) playerPanel.hidden = true
    if (actionPanel) actionPanel.hidden = false
  })

  playerForm?.addEventListener('submit', async (event) => {
    event.preventDefault()

    if (busy || !selectedAction || !playerInput) {
      return
    }

    const playerNumber = Number(playerInput.value)
    if (!Number.isInteger(playerNumber) || playerNumber < 0 || playerNumber > 99) {
      playerInput.setCustomValidity('Introdueix un dorsal entre 0 i 99')
      playerInput.reportValidity()
      return
    }

    playerInput.setCustomValidity('')
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
        playerNumber,
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
      if (actionPanel) actionPanel.hidden = true
      if (playerPanel) playerPanel.hidden = true
      if (periodPanel) periodPanel.hidden = false
      return
    }

    const confirmed = window.confirm('Vols finalitzar el partit?')
    if (!confirmed) return

    busy = true
    setButtonsDisabled(screen, true)
    await finishMatch(matchId)
    navigate({ screen: 'home' })
  })

  screen.querySelector('[data-action="cancel-period"]')?.addEventListener('click', () => {
    if (periodPanel) periodPanel.hidden = true
    if (actionPanel) actionPanel.hidden = false
  })

  screen.querySelectorAll<HTMLButtonElement>('[data-start-phase]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (busy) return
      const startingPhase = button.dataset.startPhase as Phase | undefined
      if (!startingPhase) return

      busy = true
      setButtonsDisabled(screen, true)
      await addPeriodChangeEvent(matchId, {
        kind: 'period-change',
        period: 2,
        startingPhase,
      })
      refresh()
    })
  })

  return screen
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
      <div>
        <p class="eyebrow">Partit finalitzat</p>
        <h1>${escapeHtml(opponent || 'Partit')}</h1>
      </div>
    </header>
    <section class="status-panel">
      <div class="status-row"><span>Registres desats</span><strong>${events.length}</strong></div>
      <div class="status-row"><span>Estat</span><strong>Finalitzat</strong></div>
    </section>
    <button class="button button-primary" data-action="export" type="button">Exportar CSV</button>
    <p class="export-feedback" data-export-feedback aria-live="polite"></p>
  `
  screen
    .querySelector('[data-action="back"]')
    ?.addEventListener('click', () => navigate({ screen: 'home' }))

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

function getEventLabel(event: MatchEventRecord | undefined): string {
  if (!event) return 'Cap'
  if (event.payload.kind === 'period-change') return 'Inici de la 2a part'
  return `${escapeHtml(event.payload.actionLabel)} &middot; dorsal ${event.payload.playerNumber}`
}

function setButtonsDisabled(container: HTMLElement, disabled: boolean): void {
  container.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
    button.disabled = disabled
  })
}
