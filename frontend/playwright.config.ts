import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.CATERINGHUB_E2E_URL ?? 'http://127.0.0.1:5173',
    viewport: { width: 1280, height: 900 },
    channel: process.env.PW_BROWSER_CHANNEL || undefined,
    trace: 'retain-on-failure',
  },
})
