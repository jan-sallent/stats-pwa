/**
 * Punt d'entrada del navegador.
 * Carrega els estils globals, inicia el renderitzat de l'aplicació i registra la PWA.
 */
import './styles/main.css'
import { startApp } from './app'
import { registerPwa } from './pwa/register'

const root = document.querySelector<HTMLElement>('#app')

// Sense aquest contenidor l'aplicació no pot muntar cap pantalla.
if (!root) {
  throw new Error("No s'ha trobat l'element arrel de l'aplicaci\u00f3")
}

startApp(root)
registerPwa()
