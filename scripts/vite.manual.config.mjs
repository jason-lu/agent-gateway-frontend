// Throwaway vite config for user-manual screenshots: dev server on :5174,
// /api proxied to the isolated manual backend on :8081. Does not touch the
// production vite.config.ts (which points at :8080).
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const frontend = resolve(here, '..')

export default defineConfig({
  root: frontend,
  plugins: [react()],
  base: './',
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8081',
        changeOrigin: true,
      },
    },
  },
})
