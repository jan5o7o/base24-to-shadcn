import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/astryx/',
  build: {
    outDir: '../docs/astryx',
  },
})
