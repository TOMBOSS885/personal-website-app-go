import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  define: {
    __VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    lib: {
      name: 'L2D_WIDGET',
      entry: 'src/index.ts',
      formats: ['es', 'iife'],
      fileName: format => `index.${format === 'iife' ? 'min.js' : 'js'}`,
    },
  },
  plugins: [
    dts(),
  ],
});
