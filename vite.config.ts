import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined

          if (id.includes('react-router') || id.includes('@remix-run/router')) {
            return 'router-vendor'
          }

          if (id.includes('framer-motion') || id.includes('motion-dom')) {
            return 'motion-vendor'
          }

          if (id.includes('@tauri-apps')) {
            return 'tauri-vendor'
          }

          if (id.includes('@radix-ui')) {
            return 'radix-vendor'
          }

          if (id.includes('lucide-react') || id.includes('clsx') || id.includes('tailwind-merge') || id.includes('class-variance-authority')) {
            return 'ui-vendor'
          }

          if (
            id.includes('/react/') ||
            id.includes('react-dom') ||
            id.includes('scheduler') ||
            id.includes('react/jsx-runtime') ||
            id.includes('react/jsx-dev-runtime')
          ) {
            return 'react-vendor'
          }

          return undefined
        },
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/gen/**', '**/src-tauri/target/**'],
    },
  },
  clearScreen: false,
  envPrefix: ['VITE_', 'TAURI_'],
})
