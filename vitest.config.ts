import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    // Custom plugin to resolve .js imports to .ts files for Vitest
    {
      name: 'resolve-js-to-ts',
      enforce: 'pre',
      resolveId(source, importer) {
        // Only handle relative imports ending with .js
        if (source.endsWith('.js') && source.startsWith('.')) {
          // Try to resolve as .ts instead
          const tsSource = source.replace(/\.js$/, '.ts');
          try {
            const resolved = this.resolve(tsSource, importer, { skipSelf: true });
            if (resolved) {
              return resolved;
            }
          } catch (error) {
            // Fall back to original .js import if .ts resolution fails
          }
        }
        return null;
      }
    }
  ],
  test: {
    threads: false, // Disable parallelism to ensure test isolation
    globals: true,
    environment: 'node',
    include: [
      'packages/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'apps/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.{idea,git,cache,output,temp}/**'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'coverage/**',
        'dist/**',
        'packages/**/dist/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/node_modules/**',
        'tests/**',
        '**/__tests__/**',
        '**/*.test.*',
        '**/*.spec.*'
      ],
      thresholds: {
        global: {
          statements: 80,
          branches: 75,
          functions: 90,
          lines: 80
        }
      }
    },
    // setupFiles: ['./tests/setup.ts'],
    testTimeout: 300000,  // 5 minutes for blockchain operations
    hookTimeout: 60000,   // 1 minute for setup/teardown
    teardownTimeout: 60000,
  },
  resolve: {
    alias: {
      '@payin/shared': resolve(__dirname, './packages/shared/src'),
      '@payin/processor': resolve(__dirname, './packages/processor/src'),
      '@payin/monitor': resolve(__dirname, './packages/monitor/src'),
      '@payin/core': resolve(__dirname, './packages/core/src'),
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.mjs']
  },
  esbuild: {
    target: 'node18'
  }
});
