import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Unit tests must not depend on local .env; avoids Vitest startup reading ignored files.
  envDir: false,
  test: {
    include: ['src/__tests__/**/*.test.ts'],
    environment: 'node',
    globals: false,
    setupFiles: ['src/__tests__/test-setup.ts'],
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    testTimeout: 15_000,
    teardownTimeout: 5_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/__tests__/**', 'src/**/*.d.ts'],
    },
  },
})
