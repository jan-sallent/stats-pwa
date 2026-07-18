import { downloadJsonBackup, restoreJsonBackup } from '../backup/json-backup'
import { getMatchEvents } from '../db/events'
import { deleteMatchAndEvents, listMatchesNewestFirst } from '../db/matches'
import { downloadAllMatchesCsv, downloadMatchCsv } from '../export/match-csv'
import type { MatchRecord } from '../models/types'
import type { Navigate } from '../navigation'
import { escapeHtml, formatMatchDate } from '../ui/format'

export async function createHistoryScreen(navigate: Navigate): Promise<HTMLElement> {
  const matches = await listMatchesNewestFirst()
  const eventCounts = new Map<string, number>()

  await Promise.all(
    matches.map(async (match) => {
      const events = await getMatchEvents(match.id)
      eventCounts.set(match.id, events.length)
    }),
  )

  const screen = document.createElement('main')
  screen.className = 'app-shell'
  screen.innerHTML = `
    <header class="screen-header compact-header">
      <button class="button button-ghost" data-action="back" type="button">Enrere</button>
      <div>
        <p class="eyebrow">Dades locals</p>
        <h1>Historial</h1>
      </div>
    </header>

    <section class="export-toolbar">
      <div>
        <h2>Exportaci&oacute; CSV</h2>
        <p>Una fila per registre, preparada per a Excel o an&agrave;lisi de dades.</p>
      </div>
      <button class="button button-secondary" data-action="export-all" type="button" ${matches.length === 0 ? 'disabled' : ''}>
        Exportar tots
      </button>
    </section>

    <p class="export-feedback" data-export-feedback aria-live="polite"></p>

    <section class="backup-toolbar">
      <div>
        <h2>C&ograve;pia de seguretat</h2>
        <p>Permet restaurar tots els partits i registres dins de l'aplicaci&oacute;.</p>
      </div>
      <div class="backup-actions">
        <button class="button button-secondary" data-action="backup" type="button">
          Descarregar c&ograve;pia
        </button>
        <button class="button button-ghost" data-action="restore" type="button">
          Restaurar c&ograve;pia
        </button>
        <input data-backup-file type="file" accept="application/json,.json" hidden />
      </div>
    </section>

    <p class="export-feedback" data-backup-feedback aria-live="polite"></p>

    <section class="history-list">
      ${
        matches.length === 0
          ? `<div class="empty-state">
              <h2>Encara no hi ha partits</h2>
              <p>Els partits desats apareixeran aqu&iacute;.</p>
            </div>`
          : matches.map((match) => createMatchCard(match, eventCounts.get(match.id) ?? 0)).join('')
      }
    </section>
  `

  screen
    .querySelector('[data-action="back"]')
    ?.addEventListener('click', () => navigate({ screen: 'home' }))

  screen.querySelectorAll<HTMLButtonElement>('[data-match-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const matchId = button.dataset.matchId
      if (matchId) navigate({ screen: 'match', matchId })
    })
  })

  const feedback = screen.querySelector<HTMLElement>('[data-export-feedback]')
  const exportAllButton = screen.querySelector<HTMLButtonElement>('[data-action="export-all"]')

  exportAllButton?.addEventListener('click', async () => {
    await runExport(exportAllButton, feedback, downloadAllMatchesCsv)
  })

  screen.querySelectorAll<HTMLButtonElement>('[data-export-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      const matchId = button.dataset.exportId
      if (!matchId) return
      await runExport(button, feedback, () => downloadMatchCsv(matchId))
    })
  })

  const backupFeedback = screen.querySelector<HTMLElement>('[data-backup-feedback]')
  const backupButton = screen.querySelector<HTMLButtonElement>('[data-action="backup"]')
  const restoreButton = screen.querySelector<HTMLButtonElement>('[data-action="restore"]')
  const backupInput = screen.querySelector<HTMLInputElement>('[data-backup-file]')

  backupButton?.addEventListener('click', async () => {
    await runExport(
      backupButton,
      backupFeedback,
      downloadJsonBackup,
      'C\u00f2pia de seguretat descarregada.',
    )
  })

  restoreButton?.addEventListener('click', () => {
    backupInput?.click()
  })

  backupInput?.addEventListener('change', async () => {
    const file = backupInput.files?.[0]
    if (!file || !restoreButton) return

    restoreButton.disabled = true
    if (backupFeedback) backupFeedback.textContent = 'Restaurant la c\u00f2pia...'

    try {
      const result = await restoreJsonBackup(file)
      window.alert(
        `C\u00f2pia restaurada: ${result.matches} partits i ${result.events} registres.`,
      )
      navigate({ screen: 'history' })
    } catch (error) {
      console.error("No s'ha pogut restaurar la c\u00f2pia", error)
      if (backupFeedback) {
        backupFeedback.textContent = 'El fitxer no \u00e9s una c\u00f2pia v\u00e0lida.'
      }
      restoreButton.disabled = false
      backupInput.value = ''
    }
  })

  screen.querySelectorAll<HTMLButtonElement>('[data-delete-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      const matchId = button.dataset.deleteId
      const match = matches.find((candidate) => candidate.id === matchId)
      if (!matchId || !match) return

      const confirmed = window.confirm(
        `Eliminar el partit contra ${match.opponent || 'rival desconegut'} i totes les seves accions? Aquesta operaci\u00f3 no es pot desfer.`,
      )
      if (!confirmed) return

      button.disabled = true
      try {
        await deleteMatchAndEvents(matchId)
        navigate({ screen: 'history' })
      } catch (error) {
        console.error("No s'ha pogut eliminar el partit", error)
        button.disabled = false
        if (backupFeedback) backupFeedback.textContent = "No s'ha pogut eliminar el partit."
      }
    })
  })

  return screen
}

function createMatchCard(match: MatchRecord, eventCount: number): string {
  const statusLabel = match.status === 'finished' ? 'Finalitzat' : 'En curs'
  const actionLabel = match.status === 'finished' ? 'Veure resum' : 'Continuar'

  return `
    <article class="history-card">
      <div class="history-card-main">
        <span class="history-status ${match.status === 'finished' ? 'is-finished' : ''}">
          ${statusLabel}
        </span>
        <h2>${escapeHtml(match.opponent || 'Partit sense dades')}</h2>
        <p>${escapeHtml(match.competition || 'Sense competici\u00f3')} &middot; Jornada ${escapeHtml(match.round || '-')}</p>
        <p>${formatMatchDate(match.scheduledAt)} &middot; ${eventCount} registres</p>
      </div>
      <div class="history-actions">
        <button class="button button-secondary" data-export-id="${match.id}" type="button">
          Exportar CSV
        </button>
        <button class="button button-ghost" data-match-id="${match.id}" type="button">
          ${actionLabel}
        </button>
        <button class="button button-delete" data-delete-id="${match.id}" type="button">
          Eliminar
        </button>
      </div>
    </article>
  `
}

async function runExport(
  button: HTMLButtonElement,
  feedback: HTMLElement | null,
  exportAction: () => Promise<void>,
  successMessage = 'CSV descarregat al dispositiu.',
): Promise<void> {
  const originalLabel = button.textContent
  button.disabled = true
  button.textContent = 'Preparant...'

  try {
    await exportAction()
    if (feedback) feedback.textContent = successMessage
  } catch (error) {
    console.error("No s'ha pogut exportar el CSV", error)
    if (feedback) feedback.textContent = "No s'ha pogut exportar. Torna-ho a provar."
  } finally {
    button.disabled = false
    button.textContent = originalLabel
  }
}
