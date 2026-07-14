import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: 'var(--color-text)',
        muted: 'var(--color-text-muted)',
        line: 'var(--color-border)',
        surface: 'var(--color-surface)',
        canvas: 'var(--color-bg)',
        primary: 'var(--color-primary)',
        danger: 'var(--color-danger)',
      },
      boxShadow: {
        panel: '0 1px 2px rgba(20, 24, 32, 0.06), 0 8px 28px rgba(20, 24, 32, 0.05)',
      },
    },
  },
  plugins: [],
} satisfies Config
