import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#d7262e' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#d7262e' } },
  },
  images: ['public/favicon.svg'],
})
