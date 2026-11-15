import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Built assets go to frontend/dist and are deployed to nginx as static files.
// nginx serves the UI and proxies /api/v1 to the gateway, so the two sides
// stay independently deployable (no CORS: same origin in production).
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
        // The streaming ASR endpoint is a WebSocket under /api/v1.
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsDir: 'assets',
    // Mermaid (lazy via import('mermaid')) ships vendor chunks well over the 500 kB
    // default — the biggest, elk, is ~1.5 MB. They load only when a diagram renders,
    // so the limit is raised to keep the signal meaningful for real app chunks.
    chunkSizeWarningLimit: 2000,
  },
})
