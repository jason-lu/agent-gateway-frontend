import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

// Built assets are emitted into the Spring Boot classpath static folder so the
// gateway serves the UI from the same origin as /api/v1 (no CORS needed).
const webStatic = resolve(__dirname, '../agent/web/src/main/resources/static')

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: webStatic,
    emptyOutDir: true,
    assetsDir: 'assets',
    // Mermaid (lazy via import('mermaid')) ships vendor chunks well over the 500 kB
    // default — the biggest, elk, is ~1.5 MB. They load only when a diagram renders,
    // so the limit is raised to keep the signal meaningful for real app chunks.
    chunkSizeWarningLimit: 2000,
  },
})
