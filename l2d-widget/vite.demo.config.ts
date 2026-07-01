import { resolve } from 'node:path';
import process from 'node:process';
import { defineConfig } from 'vite';

export default defineConfig({
  root: '__tests__',
  resolve: {
    alias: {
      'l2d-widget': resolve(process.cwd(), 'src/index.ts'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
