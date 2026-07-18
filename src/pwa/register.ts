import { registerSW } from 'virtual:pwa-register'

export function registerPwa(): void {
  const updateServiceWorker = registerSW({
    onNeedRefresh() {
      const shouldUpdate = window.confirm(
        'Hi ha una nova versi\u00f3 disponible. Vols actualitzar ara?',
      )

      if (shouldUpdate) {
        void updateServiceWorker(true)
      }
    },

    onOfflineReady() {
      console.info("L'aplicaci\u00f3 est\u00e0 preparada per funcionar sense connexi\u00f3")
    },

    onRegisterError(error) {
      console.error("No s'ha pogut registrar el service worker", error)
    },
  })
}
