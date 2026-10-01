import { defineConfig, mergeConfig } from 'vite'
import application from './vite.config.ts'

export default mergeConfig(
  application,
  defineConfig({
    build: {
      outDir: 'dist-cache',
      manifest: true,
      rollupOptions: {
        preserveEntrySignatures: 'strict',
        input: { application: 'index.html', cache: 'benchmarks/cache-harness.ts' },
      },
    },
  }),
)
