import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './benchmarks',
  testMatch: ['loading.spec.ts', 'first-round.spec.ts'],
  timeout: 600_000,
  workers: 1,
  retries: 0,
  reporter: 'list',
  outputDir: 'test-results/loading',
  use: { baseURL: 'http://127.0.0.1:4176', headless: true },
  webServer: [
    {
      command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4176 --strictPort',
      url: 'http://127.0.0.1:4176',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'node --experimental-transform-types scripts/benchmark-fixture-server.ts',
      url: 'http://127.0.0.1:4177/health',
      reuseExistingServer: false,
    },
  ],
})
