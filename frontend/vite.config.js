import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replace(/\\/g, '/')
          if (normalized.includes('/l2d-widget/')) {
            return 'vendor-live2d'
          }
          if (!normalized.includes('/node_modules/')) return undefined
          if (/\/node_modules\/(react|react-dom|scheduler|react-router|react-router-dom)\//.test(normalized)) {
            return 'vendor-react'
          }
          if (normalized.includes('/node_modules/framer-motion/')) {
            return 'vendor-motion'
          }
          if (/\/node_modules\/(react-markdown|remark-|rehype-|micromark|unified|mdast-|hast-|unist-|vfile|decode-named-character-reference|devlop|comma-separated-tokens|property-information|space-separated-tokens|trim-lines|zwitch|bail|is-plain-obj|trough)\//.test(normalized)) {
            return 'vendor-markdown'
          }
          if (normalized.includes('/node_modules/lucide-react/')) {
            return 'vendor-icons'
          }
          return undefined
        }
      }
    }
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  }
})
