import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const releasePrefix = String(process.env.VITE_ASSET_RELEASE_PREFIX || '')
  .trim()
  .replace(/[^a-z0-9_-]/gi, '')
const releaseName = releasePrefix ? `${releasePrefix}-` : ''

export default defineConfig({
  plugins: [react(), modernKatexFonts()],
  build: {
    rollupOptions: {
      output: {
        entryFileNames: `assets/${releaseName}[name]-[hash].js`,
        chunkFileNames: `assets/${releaseName}[name]-[hash].js`,
        assetFileNames: `assets/${releaseName}[name]-[hash][extname]`,
        manualChunks(id) {
          if (id.includes('/node_modules/lucide-react/')) return 'icons'
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

function modernKatexFonts() {
  return {
    name: 'modern-katex-fonts',
    generateBundle(_options, bundle) {
      for (const [fileName, output] of Object.entries(bundle)) {
        if (output.type === 'asset' && fileName.endsWith('.css')) {
          output.source = String(output.source).replace(
            /,url\(([^)]*\.woff)\)format\("woff"\),url\(([^)]*\.ttf)\)format\("truetype"\)/g,
            '',
          )
        }

        if (/^assets\/(?:[^/]+-)?KaTeX_.*\.(?:woff|ttf)$/.test(fileName)) {
          delete bundle[fileName]
        }
      }
    },
  }
}
