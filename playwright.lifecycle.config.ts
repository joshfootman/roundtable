import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './benchmarks',
  testMatch: ['sustained.spec.ts', 'repeated-imports.spec.ts'],
  timeout: 150_000,
  workers: 1,
  retries: 0,
  reporter: 'list',
  outputDir: 'test-results/lifecycle',
  use: { baseURL: 'http://127.0.0.1:4188', headless: true, viewport: { width: 1440, height: 900 } },
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4188 --strictPort',
    url: 'http://127.0.0.1:4188',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
