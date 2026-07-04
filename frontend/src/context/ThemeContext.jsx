import { createContext, useContext, useEffect, useState } from 'react'
import { preloadImage } from '../utils/assets'
import { fetchWithTimeout } from '../utils/network'

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

function getHexLuminance(hex) {
  const normalizedHex = String(hex || '').replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(normalizedHex)) return 1
  const values = [0, 2, 4].map(index => {
    const channel = parseInt(normalizedHex.substring(index, index + 2), 16) / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2]
}

function isDarkSolid(background) {
  return String(background || '').startsWith('#') && getHexLuminance(background) < 0.45
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
    backgroundSize: theme.backgroundSize || 'cover',
    backgroundPosition: theme.backgroundPosition || 'center',
    backgroundRepeat: theme.backgroundRepeat || 'no-repeat',
    background: theme.background || `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`,
    cardBg: theme.cardBg || 'rgba(255, 255, 255, 0.1)',
  }
}

function cssUrl(url) {
  return `url("${String(url).replace(/"/g, '\\"')}")`
}

function getResponsiveBackgroundImage(url) {
  if (!url || !url.match(/@desktop\.(webp|jpg)$/) || typeof window === 'undefined') {
    return url
  }

  if (window.innerWidth <= 768) {
    return url.replace(/@desktop\.(webp|jpg)$/, '@mobile.$1')
  }
  if (window.innerWidth <= 1200) {
    return url.replace(/@desktop\.(webp|jpg)$/, '@tablet.$1')
  }
  return url
}

export function getThemeBackground(theme) {
  const normalized = normalizeTheme(theme)
  if (!normalized) return '#ffffff'

  if (normalized.backgroundStyle === 'image' && normalized.backgroundImage) {
    return `${cssUrl(getResponsiveBackgroundImage(normalized.backgroundImage))} ${normalized.backgroundPosition} / ${normalized.backgroundSize} ${normalized.backgroundRepeat}`
  }

  if (normalized.backgroundStyle === 'solid') {
    return normalized.background || '#ffffff'
  }

  return normalized.background || `linear-gradient(135deg, ${normalized.primary}, ${normalized.secondary})`
}

function getThemeFallbackBackground(theme) {
  const normalized = normalizeTheme(theme)
  if (!normalized) return '#ffffff'
  if (normalized.backgroundStyle === 'solid') {
    return normalized.background || '#ffffff'
  }
  return normalized.background || `linear-gradient(135deg, ${normalized.primary}, ${normalized.secondary})`
}

function getModeTokens(theme, colorMode) {
  const normalized = normalizeTheme(theme)
  const isDark = colorMode === 'dark'
  const fallbackBackground = getThemeFallbackBackground(normalized)

  if (!isDark) {
    return {
      fallbackBackground,
      imageOverlay: normalized.backgroundStyle === 'image'
        ? 'linear-gradient(rgba(255,255,255,0.08), rgba(255,255,255,0.14))'
        : 'transparent',
      textPrimary: normalized.textPrimary || '#1F2937',
      textSecondary: normalized.textSecondary || '#6B7280',
      cardBg: normalized.cardBg || 'rgba(255, 255, 255, 0.1)',
      surface: 'rgba(255,255,255,0.88)',
      surfaceSoft: 'rgba(249,250,251,0.82)',
      border: 'rgba(255,255,255,0.58)',
    }
  }

  const darkFallback = normalized.backgroundStyle === 'solid'
    ? (isDarkSolid(normalized.background) ? normalized.background : '#0f172a')
    : fallbackBackground

  return {
    fallbackBackground: darkFallback,
    imageOverlay: normalized.backgroundStyle === 'image'
      ? 'linear-gradient(rgba(2,6,23,0.46), rgba(2,6,23,0.72))'
      : normalized.backgroundStyle === 'gradient'
        ? 'linear-gradient(rgba(2,6,23,0.18), rgba(2,6,23,0.34))'
        : 'transparent',
    textPrimary: '#F8FAFC',
    textSecondary: '#CBD5E1',
    cardBg: 'rgba(15, 23, 42, 0.74)',
    surface: 'rgba(15,23,42,0.86)',
    surfaceSoft: 'rgba(30,41,59,0.76)',
    border: 'rgba(148,163,184,0.24)',
  }
}

export function ThemeProvider({ children }) {
  const [currentTheme, setCurrentTheme] = useState('purple-pink')
  const [customTheme, setCustomTheme] = useState(null)
  const [colorMode, setColorModeState] = useState(() => {
    if (typeof window === 'undefined') return 'light'
    return localStorage.getItem('website-color-mode') || 'light'
  })

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

        const res = await fetchWithTimeout(`${API_BASE}/api/public/theme`, {}, 7000)
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
    let cancelled = false

    const modeTokens = getModeTokens(theme, colorMode)
    const fallbackBackground = modeTokens.fallbackBackground
    const root = document.documentElement

    root.style.setProperty('--theme-primary', theme.primary)
    root.style.setProperty('--theme-secondary', theme.secondary)
    root.style.setProperty('--theme-accent', theme.accent)
    root.style.setProperty('--theme-text-primary', modeTokens.textPrimary)
    root.style.setProperty('--theme-text-secondary', modeTokens.textSecondary)
    root.style.setProperty('--theme-bg', fallbackBackground)
    root.style.setProperty('--theme-page-bg', fallbackBackground)
    root.style.setProperty('--theme-bg-image', 'none')
    root.style.setProperty('--theme-bg-image-opacity', '0')
    root.style.setProperty('--theme-bg-position', theme.backgroundPosition)
    root.style.setProperty('--theme-bg-size', theme.backgroundSize)
    root.style.setProperty('--theme-bg-repeat', theme.backgroundRepeat)
    root.style.setProperty('--theme-bg-overlay', modeTokens.imageOverlay)
    root.style.setProperty('--theme-card-bg', modeTokens.cardBg)
    root.style.setProperty('--theme-surface', modeTokens.surface)
    root.style.setProperty('--theme-surface-soft', modeTokens.surfaceSoft)
    root.style.setProperty('--theme-border', modeTokens.border)
    root.style.setProperty('--theme-gradient', `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`)
    root.style.setProperty('--theme-gradient-text', `linear-gradient(90deg, ${theme.primary}, ${theme.secondary}, ${theme.accent})`)
    root.style.setProperty('--theme-gradient-hover', `linear-gradient(135deg, ${adjustBrightness(theme.primary, -15)}, ${adjustBrightness(theme.secondary, -15)})`)
    root.style.setProperty('--theme-shadow', `0 10px 30px -10px ${theme.primary}40`)
    root.style.setProperty('--theme-shadow-lg', `0 20px 50px -15px ${theme.primary}50`)
    root.setAttribute('data-theme', currentTheme)
    root.setAttribute('data-color-mode', colorMode)
    root.classList.toggle('dark', colorMode === 'dark')
    root.classList.toggle('theme-dark', colorMode === 'dark')

    if (customTheme) {
      root.setAttribute('data-custom-theme', 'true')
    } else {
      root.removeAttribute('data-custom-theme')
    }

    document.body.style.background = fallbackBackground

    if (theme.backgroundStyle === 'image' && theme.backgroundImage) {
      const backgroundImage = getResponsiveBackgroundImage(theme.backgroundImage)
      preloadImage(backgroundImage, { timeout: 10000 }).then((loaded) => {
        if (cancelled || !loaded) return
        root.style.setProperty('--theme-bg-image', cssUrl(backgroundImage))
        root.style.setProperty('--theme-bg-image-opacity', '1')
      })
    }

    return () => {
      cancelled = true
    }
  }, [currentTheme, customTheme, colorMode])

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

  const setColorMode = (mode) => {
    const nextMode = mode === 'dark' ? 'dark' : 'light'
    setColorModeState(nextMode)
    localStorage.setItem('website-color-mode', nextMode)
  }

  const toggleColorMode = () => {
    setColorMode(colorMode === 'dark' ? 'light' : 'dark')
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
        colorMode,
        setColorMode,
        toggleColorMode,
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
