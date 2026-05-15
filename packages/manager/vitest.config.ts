import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 300000, // 5 minutes for integration tests
    hookTimeout: 120000, // 2 minutes for setup/teardown
  },
});
