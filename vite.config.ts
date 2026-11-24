/// <reference types="vitest/config" />
import basicSsl from '@vitejs/plugin-basic-ssl'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const DAY = 24 * 60 * 60

// `npm run dev:https` usa el modo "https": certificado autofirmado para que el
// GPS funcione al probar desde el teléfono en la misma red wifi.
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    ...(mode === 'https' ? [basicSsl()] : []),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Lado Sombra',
        short_name: 'Lado Sombra',
        description: '¿De qué lado me siento en la micro? Te digo dónde no te va a pegar el sol.',
        lang: 'es-CL',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#d7262e',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // La app completa (incluido MapLibre y su worker) queda guardada para abrir sin conexión.
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,ico,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: 'index.html',
        // Rutas (OSRM) y búsquedas (Nominatim) no se guardan: siempre van a la red.
        runtimeCaching: [
          {
            // Estilos y metadatos del mapa: cambian cuando OpenFreeMap publica datos nuevos.
            urlPattern: ({ url }) =>
              url.origin === 'https://tiles.openfreemap.org' && (url.pathname.startsWith('/styles/') || url.pathname === '/planet'),
            handler: 'NetworkFirst',
            options: { cacheName: 'mapa-estilos', networkTimeoutSeconds: 5, expiration: { maxEntries: 10, maxAgeSeconds: 7 * DAY } },
          },
          {
            // Teselas, fuentes e íconos del mapa: sus URL cambian con cada versión.
            urlPattern: ({ url }) => url.origin === 'https://tiles.openfreemap.org',
            handler: 'CacheFirst',
            options: {
              cacheName: 'mapa-teselas',
              expiration: { maxEntries: 800, maxAgeSeconds: 7 * DAY, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  // MapLibre (~1,1 MB) va en su propio archivo y se carga después del panel.
  build: { chunkSizeWarningLimit: 1200 },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
  },
}))
