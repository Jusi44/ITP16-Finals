import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
    },
    globalSetup: ['./src/testing/global-setup.ts'],
    fileParallelism: false,
    maxWorkers: 1,
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
