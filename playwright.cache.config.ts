import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './benchmarks',
  testMatch: 'cache.bench.ts',
  timeout: 180_000,
  workers: 1,
  reporter: 'list',
  outputDir: 'test-results/cache',
  use: { baseURL: 'http://127.0.0.1:4181', viewport: { width: 1440, height: 900 } },
  webServer: {
    command:
      'vite build --config vite.cache.config.ts && vite preview --outDir dist-cache --host 127.0.0.1 --port 4181 --strictPort',
    url: 'http://127.0.0.1:4181',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
