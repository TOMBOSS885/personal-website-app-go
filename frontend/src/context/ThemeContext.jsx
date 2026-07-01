import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext(null)
const API_BASE = ''

function adjustBrightness(hex, percent) {
  const normalizedHex = String(hex || '#000000').replace('#', '')
  const r = parseInt(normalizedHex.substring(0, 2), 16)
  const g = parseInt(normalizedHex.substring(2, 4), 16)
  const b = parseInt(normalizedHex.substring(4, 6), 16)

  const nextR = Math.min(255, Math.max(0, Math.floor(r * (1 + percent / 100))))
  const nextG = Math.min(255, Math.max(0, Math.floor(g * (1 + percent / 100))))
  const nextB = Math.min(255, Math.max(0, Math.floor(b * (1 + percent / 100))))

  return `#${nextR.toString(16).padStart(2, '0')}${nextG.toString(16).padStart(2, '0')}${nextB.toString(16).padStart(2, '0')}`
}

const PRESET_THEMES = {
  'purple-pink': {
    name: '紫粉渐变',
    primary: '#8B5CF6',
    secondary: '#EC4899',
    accent: '#F59E0B',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    backgroundStyle: 'gradient',
    backgroundImage: '',
    cardBg: 'rgba(255, 255, 255, 0.1)',
    textPrimary: '#1F2937',
    textSecondary: '#6B7280',
  },
  'blue-cyan': {
    name: '蓝青清新',
    primary: '#3B82F6',
    secondary: '#06B6D4',
    accent: '#10B981',
    background: 'linear-gradient(135deg, #1e3a8a 0%, #0e7490 100%)',
    backgroundStyle: 'gradient',
    backgroundImage: '',
    cardBg: 'rgba(255, 255, 255, 0.1)',
    textPrimary: '#1F2937',
    textSecondary: '#6B7280',
  },
  'green-teal': {
    name: '绿松自然',
    primary: '#10B981',
    secondary: '#14B8A6',
    accent: '#F59E0B',
    background: 'linear-gradient(135deg, #047857 0%, #0d9488 100%)',
    backgroundStyle: 'gradient',
    backgroundImage: '',
    cardBg: 'rgba(255, 255, 255, 0.1)',
    textPrimary: '#1F2937',
    textSecondary: '#6B7280',
  },
  'orange-red': {
    name: '橙红热情',
    primary: '#F97316',
    secondary: '#EF4444',
    accent: '#FBBF24',
    background: 'linear-gradient(135deg, #c2410c 0%, #dc2626 100%)',
    backgroundStyle: 'gradient',
    backgroundImage: '',
    cardBg: 'rgba(255, 255, 255, 0.1)',
    textPrimary: '#1F2937',
    textSecondary: '#6B7280',
  },
  'dark-purple': {
    name: '暗黑紫夜',
    primary: '#8B5CF6',
    secondary: '#A855F7',
    accent: '#FBBF24',
    background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
    backgroundStyle: 'gradient',
    backgroundImage: '',
    cardBg: 'rgba(255, 255, 255, 0.05)',
    textPrimary: '#F9FAFB',
    textSecondary: '#D1D5DB',
  },
  minimal: {
    name: '极简白',
    primary: '#3B82F6',
    secondary: '#6366F1',
    accent: '#F59E0B',
    background: '#FFFFFF',
    backgroundStyle: 'solid',
    backgroundImage: '',
    cardBg: 'rgba(0, 0, 0, 0.02)',
    textPrimary: '#111827',
    textSecondary: '#6B7280',
  },
}

function normalizeTheme(theme) {
  if (!theme) return theme
  return {
    ...theme,
    backgroundStyle: theme.backgroundStyle || (theme.backgroundImage ? 'image' : 'gradient'),
    backgroundImage: theme.backgroundImage || '',
    background: theme.background || `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`,
    cardBg: theme.cardBg || 'rgba(255, 255, 255, 0.1)',
  }
}

function cssUrl(url) {
  return `url("${String(url).replace(/"/g, '\\"')}")`
}

export function getThemeBackground(theme) {
  const normalized = normalizeTheme(theme)
  if (!normalized) return '#ffffff'

  if (normalized.backgroundStyle === 'image' && normalized.backgroundImage) {
    return `${cssUrl(normalized.backgroundImage)} center / cover fixed no-repeat`
  }

  if (normalized.backgroundStyle === 'solid') {
    return normalized.background || '#ffffff'
  }

  return normalized.background || `linear-gradient(135deg, ${normalized.primary}, ${normalized.secondary})`
}

export function ThemeProvider({ children }) {
  const [currentTheme, setCurrentTheme] = useState('purple-pink')
  const [customTheme, setCustomTheme] = useState(null)

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = localStorage.getItem('website-theme')
        if (savedTheme) {
          const parsed = JSON.parse(savedTheme)
          if (parsed.preset) {
            setCurrentTheme(parsed.preset)
            setCustomTheme(null)
          } else if (parsed.custom) {
            setCustomTheme(normalizeTheme(parsed.custom))
          }
        }

        const res = await fetch(`${API_BASE}/api/public/theme`)
        if (res.ok) {
          const data = await res.json()
          if (data.preset) {
            setCurrentTheme(data.preset)
            setCustomTheme(null)
          } else if (data.custom) {
            data.custom = normalizeTheme(data.custom)
            setCustomTheme(data.custom)
          }
          localStorage.setItem('website-theme', JSON.stringify(data))
        }
      } catch (e) {
        console.error('Failed to load theme from backend:', e)
      }
    }

    loadTheme()
  }, [])

  useEffect(() => {
    const theme = normalizeTheme(customTheme || PRESET_THEMES[currentTheme])
    if (!theme) return

    const pageBackground = getThemeBackground(theme)
    const root = document.documentElement

    root.style.setProperty('--theme-primary', theme.primary)
    root.style.setProperty('--theme-secondary', theme.secondary)
    root.style.setProperty('--theme-accent', theme.accent)
    root.style.setProperty('--theme-text-primary', theme.textPrimary)
    root.style.setProperty('--theme-text-secondary', theme.textSecondary)
    root.style.setProperty('--theme-bg', pageBackground)
    root.style.setProperty('--theme-page-bg', pageBackground)
    root.style.setProperty('--theme-bg-image', theme.backgroundImage ? cssUrl(theme.backgroundImage) : 'none')
    root.style.setProperty('--theme-card-bg', theme.cardBg)
    root.style.setProperty('--theme-gradient', `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`)
    root.style.setProperty('--theme-gradient-text', `linear-gradient(90deg, ${theme.primary}, ${theme.secondary}, ${theme.accent})`)
    root.style.setProperty('--theme-gradient-hover', `linear-gradient(135deg, ${adjustBrightness(theme.primary, -15)}, ${adjustBrightness(theme.secondary, -15)})`)
    root.style.setProperty('--theme-shadow', `0 10px 30px -10px ${theme.primary}40`)
    root.style.setProperty('--theme-shadow-lg', `0 20px 50px -15px ${theme.primary}50`)
    root.setAttribute('data-theme', currentTheme)

    if (customTheme) {
      root.setAttribute('data-custom-theme', 'true')
    } else {
      root.removeAttribute('data-custom-theme')
    }

    document.body.style.background = pageBackground
  }, [currentTheme, customTheme])

  const setTheme = (themeKey) => {
    setCurrentTheme(themeKey)
    setCustomTheme(null)
    localStorage.setItem('website-theme', JSON.stringify({ preset: themeKey }))
  }

  const setCustomThemeConfig = (theme) => {
    const normalized = normalizeTheme(theme)
    setCustomTheme(normalized)
    localStorage.setItem('website-theme', JSON.stringify({ custom: normalized }))
  }

  const getActiveTheme = () => normalizeTheme(customTheme || PRESET_THEMES[currentTheme])

  return (
    <ThemeContext.Provider
      value={{
        currentTheme,
        customTheme,
        presetThemes: PRESET_THEMES,
        setTheme,
        setCustomTheme: setCustomThemeConfig,
        getActiveTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
