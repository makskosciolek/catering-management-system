import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/orders': 'http://127.0.0.1:8001',
      '/api/inventory': 'http://127.0.0.1:8002',
    },
  },
})
