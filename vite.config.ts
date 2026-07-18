import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const base = process.env.PWA_BASE_PATH ?? '/'

export default defineConfig({
  base,
  plugins: [
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'logo.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: "RAiP - Recol·lecció d'Accions i Possessions",
        short_name: 'RAiP',
        description: "Aplicaci\u00f3 local per registrar i exportar dades de partits d'handbol",
        lang: 'ca',
        theme_color: '#ed6a00',
        background_color: '#f3f1ee',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '.',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
      },
    }),
  ],
})
