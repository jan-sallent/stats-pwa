import './styles/main.css'
import { startApp } from './app'
import { registerPwa } from './pwa/register'

const root = document.querySelector<HTMLElement>('#app')

if (!root) {
  throw new Error("No s'ha trobat l'element arrel de l'aplicaci\u00f3")
}

startApp(root)
registerPwa()
