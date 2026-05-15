import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

const workspaceRoot = path.resolve(__dirname, '../../..')
const sharedRoot = path.resolve(__dirname, '../shared')

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // Enable polyfills for specific globals and modules
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      // Enable polyfills for specific Node.js built-in modules
      protocolImports: true,
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    dedupe: ['react', 'react-dom'],
    preserveSymlinks: true,
  },
  server: {
    fs: {
      allow: [workspaceRoot, sharedRoot],
    },
    watch: {
      // Watch for changes in the UI package
      ignored: ['!**/node_modules/@payin/wallet-ui/**'],
    },
  },
  optimizeDeps: {
    exclude: ['@payin/wallet-ui'],
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
})
