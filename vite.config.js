import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // relative paths so the app works at https://<user>.github.io/KalAI/
  base: './',
  plugins: [react()],
})
