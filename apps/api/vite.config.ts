import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig(({ mode }) => ({
  plugins: [
    react()
  ],

  // Only set base path in production build
  base: mode === 'production' ? '/dist/' : '/',

  // Disable public directory to avoid conflict with outDir being inside public/
  publicDir: false,

  build: {
    outDir: 'public/dist',
    emptyOutDir: true,
    manifest: true,
    cssCodeSplit: false,
    rollupOptions: {
      input: {
        'order-payment': path.resolve(__dirname, 'client/order-payment.tsx'),
        'deposit-payment': path.resolve(__dirname, 'client/deposit-payment.tsx'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
    sourcemap: true,
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '@/client': path.resolve(__dirname, 'client'),
    },
  },

  server: {
    port: 5173,
    strictPort: false,
    cors: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/pay': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
}));
