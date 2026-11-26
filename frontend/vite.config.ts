import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/orders': process.env.CATERINGHUB_ORDERS_ORIGIN ?? 'http://127.0.0.1:8001',
      '/api/inventory': process.env.CATERINGHUB_INVENTORY_ORIGIN ?? 'http://127.0.0.1:8002',
      '/api/fulfillment': process.env.CATERINGHUB_FULFILLMENT_ORIGIN ?? 'http://127.0.0.1:8003',
    },
  },
})
