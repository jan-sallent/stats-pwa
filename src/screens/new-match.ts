import { createMatchDraft } from '../db/matches'
import { requestPersistentStorage } from '../db/storage'
import type { Phase } from '../models/types'
import type { Navigate } from '../navigation'

export function createNewMatchScreen(navigate: Navigate): HTMLElement {
  const screen = document.createElement('main')
  screen.className = 'app-shell'
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

      <fieldset class="phase-choice">
        <legend>Com comen&ccedil;a el partit?</legend>
        <button class="button phase-button phase-attack" data-phase="attack" type="submit">
          Comen&ccedil;ar en atac
        </button>
        <button class="button phase-button phase-defense" data-phase="defense" type="submit">
          Comen&ccedil;ar en defensa
        </button>
      </fieldset>

      <p class="error-message" data-save-error role="alert" hidden></p>
    </form>
  `

  screen
    .querySelector('[data-action="back"]')
    ?.addEventListener('click', () => navigate({ screen: 'home' }))

  const form = screen.querySelector<HTMLFormElement>('[data-match-form]')
  const errorMessage = screen.querySelector<HTMLElement>('[data-save-error]')

  form?.addEventListener('submit', async (event) => {
    event.preventDefault()
    const submitter = (event as SubmitEvent).submitter as HTMLButtonElement | null
    const initialPhase = submitter?.dataset.phase as Phase | undefined

    if (!initialPhase) {
      return
    }

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
      const match = await createMatchDraft({
        opponent: getFormValue(data, 'opponent'),
        scheduledAt: getFormValue(data, 'scheduledAt'),
        competition: getFormValue(data, 'competition'),
        round: getFormValue(data, 'round'),
        initialPhase,
      })
      navigate({ screen: 'match', matchId: match.id })
    } catch (error) {
      console.error("No s'ha pogut crear el partit", error)
      submitButtons.forEach((button) => {
        button.disabled = false
      })

      if (errorMessage) {
        errorMessage.textContent = "No s'ha pogut desar. Torna-ho a provar."
        errorMessage.hidden = false
      }
    }
  })

  return screen
}

function getFormValue(data: FormData, field: string): string {
  return String(data.get(field) ?? '').trim()
}

function getDefaultDateTime(): string {
  const now = new Date()
  const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return localNow.toISOString().slice(0, 16)
}
