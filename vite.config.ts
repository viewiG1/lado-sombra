/// <reference types="vitest/config" />
import basicSsl from '@vitejs/plugin-basic-ssl'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// `npm run dev:https` usa el modo "https": certificado autofirmado para que el
// GPS funcione al probar desde el teléfono en la misma red wifi.
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), ...(mode === 'https' ? [basicSsl()] : [])],
  // MapLibre (~1,1 MB) va en su propio archivo y se carga después del panel.
  build: { chunkSizeWarningLimit: 1200 },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
  },
}))
