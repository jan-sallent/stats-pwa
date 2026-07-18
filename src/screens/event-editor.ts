import {
  getActionsForPhase,
  type MatchActionDefinition,
} from '../config/actions'
import { getMatchEvent, getMatchEvents, updateActionEvent } from '../db/events'
import { getMatch } from '../db/matches'
import { getPlayersByTeam } from '../db/teams'
import type {
  ActionEventPayload,
  EntityId,
  PlayerRecord,
  ShotPosition,
} from '../models/types'
import type { Navigate } from '../navigation'
import { escapeHtml } from '../ui/format'

export async function createEventEditorScreen(
  navigate: Navigate,
  matchId: EntityId,
  eventId: EntityId,
): Promise<HTMLElement> {
  const [match, event, events] = await Promise.all([
    getMatch(matchId),
    getMatchEvent(eventId),
    getMatchEvents(matchId),
  ])
  const screen = document.createElement('main')
  screen.className = 'app-shell'

  if (!match || !event || event.matchId !== matchId || event.payload.kind !== 'action') {
    screen.innerHTML = `<section class="empty-state"><h1>Acci&oacute; no trobada</h1></section>`
    return screen
  }
  const payload: ActionEventPayload = event.payload

  const teamPlayers = match.teamId ? await getPlayersByTeam(match.teamId) : []
  const selectedIds = new Set(match.selectedPlayerIds)
  const players = sortPlayers(
    selectedIds.size > 0
      ? teamPlayers.filter((player) => selectedIds.has(player.id))
      : teamPlayers,
  )
  const definitions = createEditorActions(payload.phase)
  if (!definitions.some((definition) => definition.id === payload.actionId)) {
    definitions.push({
      id: payload.actionId,
      label: payload.actionLabel,
      phase: payload.phase,
      category: payload.actionCategory ?? 'non-shot',
      playerSelection: payload.playerId === null ? 'none' : 'all',
      endsPossession: payload.endsPossession,
    })
  }

  screen.innerHTML = `
    <header class="screen-header compact-header">
      <button class="button button-ghost" data-action="back" type="button">Cancel&middot;lar</button>
      <div>
        <p class="eyebrow">Part ${payload.period} &middot; ${payload.phase === 'attack' ? 'Atac' : 'Defensa'}</p>
        <h1>Modificar acci&oacute;</h1>
      </div>
    </header>

    <form class="event-editor-form" data-editor-form>
      <label class="field">
        <span>Acci&oacute;</span>
        <select name="actionId" required>
          ${definitions
            .map(
              (definition) => `
                <option value="${escapeHtml(definition.id)}" ${definition.id === payload.actionId ? 'selected' : ''}>
                  ${escapeHtml(getCategoryLabel(definition))} — ${escapeHtml(definition.label)}
                </option>`,
            )
            .join('')}
        </select>
      </label>

      <label class="field" data-shot-position-field>
        <span>Posici&oacute; de llan&ccedil;ament</span>
        <select name="shotPosition">
          <option value="">Sense posici&oacute;</option>
          ${(['6m', '7m', '9m'] as const)
            .map(
              (position) =>
                `<option value="${position}" ${position === payload.shotPosition ? 'selected' : ''}>${position}</option>`,
            )
            .join('')}
        </select>
      </label>

      <label class="field" data-player-field>
        <span>Jugador</span>
        <select name="playerId">
          ${createPlayerOptions(players, payload.playerId)}
        </select>
      </label>

      <p class="error-message" data-editor-error role="alert" hidden></p>
      <button class="button button-primary full-width" type="submit">Desar modificaci&oacute;</button>
    </form>
  `

  const form = screen.querySelector<HTMLFormElement>('[data-editor-form]')
  const actionSelect = form?.elements.namedItem('actionId') as HTMLSelectElement | null
  const positionSelect = form?.elements.namedItem('shotPosition') as HTMLSelectElement | null
  const playerSelect = form?.elements.namedItem('playerId') as HTMLSelectElement | null
  const positionField = screen.querySelector<HTMLElement>('[data-shot-position-field]')
  const playerField = screen.querySelector<HTMLElement>('[data-player-field]')
  const errorMessage = screen.querySelector<HTMLElement>('[data-editor-error]')

  const updateFields = (): void => {
    const definition = definitions.find((candidate) => candidate.id === actionSelect?.value)
    if (!definition) return
    if (positionField) positionField.hidden = definition.category !== 'shot'
    if (positionSelect) positionSelect.disabled = definition.category !== 'shot'
    if (playerField) playerField.hidden = definition.playerSelection === 'none'
    if (playerSelect) {
      playerSelect.disabled = definition.playerSelection === 'none'
      playerSelect.required = definition.playerSelection !== 'none'
      const playerOptions = [...playerSelect.options]
      playerOptions.forEach((option) => {
        option.disabled =
          definition.playerSelection === 'goalkeepers' &&
          option.dataset.position !== 'goalkeeper'
      })
      const selectedOption = playerSelect.selectedOptions[0]
      if (selectedOption?.disabled) {
        const firstEligible = playerOptions.find((option) => !option.disabled)
        if (firstEligible) playerSelect.value = firstEligible.value
      }
    }
  }

  actionSelect?.addEventListener('change', updateFields)
  updateFields()

  screen.querySelector('[data-action="back"]')?.addEventListener('click', () => {
    navigate({ screen: 'match-events', matchId })
  })

  form?.addEventListener('submit', async (submitEvent) => {
    submitEvent.preventDefault()
    if (!actionSelect || !positionSelect || !playerSelect) return
    if (errorMessage) errorMessage.hidden = true
    const definition = definitions.find((candidate) => candidate.id === actionSelect.value)
    if (!definition) return
    const player =
      definition.playerSelection === 'none'
        ? undefined
        : players.find((candidate) => candidate.id === playerSelect.value)
    if (definition.playerSelection !== 'none' && !player) {
      if (errorMessage) {
        errorMessage.textContent = 'No hi ha cap jugador v\u00e0lid per a aquesta acci\u00f3.'
        errorMessage.hidden = false
      }
      return
    }
    if (
      definition.id === 'timeout' &&
      events.some(
        (candidate) =>
          candidate.id !== eventId &&
          candidate.payload.kind === 'action' &&
          candidate.payload.actionId === 'timeout' &&
          candidate.payload.period === payload.period,
      )
    ) {
      if (errorMessage) {
        errorMessage.textContent = 'Ja hi ha un temps mort registrat en aquesta part.'
        errorMessage.hidden = false
      }
      return
    }

    const submitButton = form.querySelector<HTMLButtonElement>('button[type="submit"]')
    if (submitButton) submitButton.disabled = true
    try {
      await updateActionEvent(matchId, eventId, {
        ...payload,
        actionId: definition.id,
        actionLabel: definition.label,
        actionCategory: definition.category,
        shotPosition:
          definition.category === 'shot'
            ? (positionSelect.value as ShotPosition) || null
            : null,
        playerId: player?.id ?? null,
        playerFirstName: player?.firstName ?? '',
        playerLastName: player?.lastName ?? '',
        playerNickname: player?.nickname ?? '',
        playerNumber: player?.number ?? null,
        playerPosition: player?.position ?? null,
        endsPossession: definition.endsPossession,
      })
      navigate({ screen: 'match-events', matchId })
    } catch (error) {
      console.error("No s'ha pogut modificar l'acci\u00f3", error)
      if (submitButton) submitButton.disabled = false
      if (errorMessage) {
        errorMessage.textContent = "No s'ha pogut modificar l'acci\u00f3."
        errorMessage.hidden = false
      }
    }
  })

  return screen
}

function createEditorActions(phase: 'attack' | 'defense'): MatchActionDefinition[] {
  return [
    ...getActionsForPhase(phase, 'shot'),
    ...getActionsForPhase(phase, 'non-shot'),
    {
      id: 'two-minute',
      label: '2 minuts',
      phase,
      category: 'non-shot',
      playerSelection: 'all',
      endsPossession: phase === 'attack',
    },
    {
      id: 'timeout',
      label: 'Temps mort',
      phase,
      category: 'special',
      playerSelection: 'none',
      endsPossession: false,
    },
  ]
}

function getCategoryLabel(definition: MatchActionDefinition): string {
  if (definition.id === 'two-minute' || definition.id === 'timeout') return 'Partit'
  return definition.category === 'shot' ? 'Llançament' : 'No llançament'
}

function createPlayerOptions(players: readonly PlayerRecord[], selectedId: string | null): string {
  const courtPlayers = players.filter((player) => player.position === 'court')
  const goalkeepers = players.filter((player) => player.position === 'goalkeeper')
  return `
    <optgroup label="Jugadors de camp">
      ${courtPlayers.map((player) => createPlayerOption(player, selectedId)).join('')}
    </optgroup>
    <optgroup label="Porters">
      ${goalkeepers.map((player) => createPlayerOption(player, selectedId)).join('')}
    </optgroup>
  `
}

function createPlayerOption(player: PlayerRecord, selectedId: string | null): string {
  const name = player.nickname || `${player.firstName} ${player.lastName}`
  return `<option value="${escapeHtml(player.id)}" data-position="${player.position}" ${player.id === selectedId ? 'selected' : ''}>#${player.number} ${escapeHtml(name)}</option>`
}

function sortPlayers(players: readonly PlayerRecord[]): PlayerRecord[] {
  return [...players].sort((a, b) => {
    if (a.position !== b.position) return a.position === 'goalkeeper' ? 1 : -1
    const aName = a.nickname || `${a.firstName} ${a.lastName}`
    const bName = b.nickname || `${b.firstName} ${b.lastName}`
    return aName.localeCompare(bName, 'ca', { sensitivity: 'base' })
  })
}
