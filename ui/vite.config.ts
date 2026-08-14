import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// `/api` is proxied to the FastAPI dev server, so the browser only ever talks to one
// origin — no CORS config, and no API base URL to set in the frontend.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: process.env.VITE_API_TARGET ?? 'http://127.0.0.1:8000', changeOrigin: true },
    },
  },
})
