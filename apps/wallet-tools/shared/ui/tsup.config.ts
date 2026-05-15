import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.tsx', 'src/components/**/*.ts', 'src/components/**/*.tsx'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom', '@payin/wallet-core'],
  treeshake: true,
  splitting: false,
  target: 'es2022',
});
