import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { fetchWithTimeout } from '../utils/network'
import { responsiveImageUrlForWidth } from '../utils/responsiveImages'

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

function numberInRange(value, fallback, min, max) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback
}

function safeThemeColor(value, fallback) {
  const text = String(value || '').trim()
  if (/^#[0-9a-f]{3,8}$/i.test(text)) return text
  if (/^rgba?\(\s*[\d.]+(?:%?)\s*,\s*[\d.]+(?:%?)\s*,\s*[\d.]+(?:%?)(?:\s*,\s*[\d.]+(?:%?)\s*)?\)$/i.test(text)) return text
  return fallback
}

function safeThemeToken(value, fallback, pattern) {
  const text = String(value || '').trim()
  return pattern.test(text) ? text : fallback
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

export const DEFAULT_THEME_KEY = 'purple-pink'

export function resolvePresetThemeKey(themeKey) {
  return Object.prototype.hasOwnProperty.call(PRESET_THEMES, themeKey)
    ? themeKey
    : DEFAULT_THEME_KEY
}

function normalizeTheme(theme) {
  if (!theme) return theme
  const primary = safeThemeColor(theme.primary, '#6366f1')
  const secondary = safeThemeColor(theme.secondary, '#8b5cf6')
  const accent = safeThemeColor(theme.accent, '#f59e0b')
  const backgroundStyle = ['gradient', 'solid', 'image'].includes(theme.backgroundStyle)
    ? theme.backgroundStyle
    : (theme.backgroundImage ? 'image' : 'gradient')
  return {
    ...theme,
    primary,
    secondary,
    accent,
    backgroundStyle,
    backgroundImage: theme.backgroundImage || '',
    backgroundSize: safeThemeToken(theme.backgroundSize, 'cover', /^(?:cover|contain|auto|\d+(?:\.\d+)?(?:px|%|vw|vh))(?:\s+\d+(?:\.\d+)?(?:px|%|vw|vh))?$/i),
    backgroundPosition: safeThemeToken(theme.backgroundPosition, 'center', /^(?:center|top|right|bottom|left)(?:\s+(?:center|top|right|bottom|left))?$/i),
    backgroundRepeat: safeThemeToken(theme.backgroundRepeat, 'no-repeat', /^(?:repeat|repeat-x|repeat-y|no-repeat|space|round)(?:\s+(?:repeat|repeat-x|repeat-y|no-repeat|space|round))?$/i),
    backgroundImageOpacity: numberInRange(theme.backgroundImageOpacity, 100, 0, 100),
    backgroundBlur: numberInRange(theme.backgroundBlur, 12, 0, 24),
    cardOpacity: numberInRange(theme.cardOpacity, 78, 20, 100),
    background: backgroundStyle === 'solid'
      ? safeThemeColor(theme.background, '#ffffff')
      : `linear-gradient(135deg, ${primary}, ${secondary})`,
    cardBg: safeThemeColor(theme.cardBg, 'rgba(255, 255, 255, 0.1)'),
    textPrimary: safeThemeColor(theme.textPrimary, '#1f2937'),
    textSecondary: safeThemeColor(theme.textSecondary, '#6b7280'),
  }
}

function cssUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return 'none'
  const value = url.trim()
  try {
    const parsed = new URL(value, typeof window === 'undefined' ? 'http://localhost' : window.location.origin)
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return 'none'
  } catch {
    return 'none'
  }
  return `url("${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}")`
}

function getStoredTheme() {
  if (typeof window === 'undefined') return null

  try {
    const savedTheme = localStorage.getItem('website-theme')
    return savedTheme ? JSON.parse(savedTheme) : null
  } catch {
    return null
  }
}

function getStoredVisualSettings(fallbackTheme) {
  if (typeof window === 'undefined') return {}

  try {
    const saved = localStorage.getItem('website-visual-settings')
    if (saved) return JSON.parse(saved)
  } catch {
    // Ignore invalid or unavailable browser storage.
  }

  if (!fallbackTheme) return {}
  return {
    backgroundImageOpacity: fallbackTheme.backgroundImageOpacity,
    backgroundBlur: fallbackTheme.backgroundBlur,
    cardOpacity: fallbackTheme.cardOpacity,
  }
}

function getResponsiveBackgroundImage(url) {
  if (url?.includes('@responsive-') && typeof window !== 'undefined') {
    const pixelRatio = Math.min(Math.max(window.devicePixelRatio || 1, 1), 2)
    return responsiveImageUrlForWidth(url, window.innerWidth * pixelRatio)
  }
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

export function getThemeBackgroundLayer(theme) {
  const normalized = normalizeTheme(theme)
  const hasImage = normalized?.backgroundStyle === 'image' && normalized.backgroundImage

  return {
    image: hasImage ? cssUrl(getResponsiveBackgroundImage(normalized.backgroundImage)) : 'none',
    opacity: hasImage ? String(normalized.backgroundImageOpacity / 100) : '0',
    blur: hasImage ? `${normalized.backgroundBlur}px` : '0px',
    position: normalized?.backgroundPosition || 'center',
    size: normalized?.backgroundSize || 'cover',
    repeat: normalized?.backgroundRepeat || 'no-repeat',
  }
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
  const surfaceOpacity = normalized.backgroundStyle === 'image'
    ? normalized.cardOpacity / 100
    : null

  if (!isDark) {
    return {
      fallbackBackground,
      imageOverlay: normalized.backgroundStyle === 'image'
        ? 'linear-gradient(rgba(255,255,255,0.08), rgba(255,255,255,0.14))'
        : 'transparent',
      textPrimary: normalized.textPrimary || '#1F2937',
      textSecondary: normalized.textSecondary || '#6B7280',
      cardBg: normalized.cardBg || 'rgba(255, 255, 255, 0.1)',
      surface: surfaceOpacity === null ? 'rgba(255,255,255,0.88)' : `rgba(255,255,255,${surfaceOpacity})`,
      surfaceSoft: surfaceOpacity === null ? 'rgba(249,250,251,0.82)' : `rgba(249,250,251,${Math.min(1, surfaceOpacity + 0.06)})`,
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
    surface: surfaceOpacity === null ? 'rgba(15,23,42,0.86)' : `rgba(15,23,42,${surfaceOpacity})`,
    surfaceSoft: surfaceOpacity === null ? 'rgba(30,41,59,0.76)' : `rgba(30,41,59,${Math.min(1, surfaceOpacity + 0.06)})`,
    border: 'rgba(148,163,184,0.24)',
  }
}

export function ThemeProvider({ children }) {
  const [initialTheme] = useState(getStoredTheme)
  const localThemeRevisionRef = useRef(0)
  const visualSettingsRef = useRef(getStoredVisualSettings(initialTheme?.custom))
  const [currentTheme, setCurrentTheme] = useState(() => {
    const preset = initialTheme?.preset
    return preset ? resolvePresetThemeKey(preset) : DEFAULT_THEME_KEY
  })
  const [customTheme, setCustomTheme] = useState(() => {
    const custom = initialTheme?.custom
    return custom ? normalizeTheme({ ...custom, ...visualSettingsRef.current }) : null
  })
  const [colorMode, setColorModeState] = useState(() => {
    if (typeof window === 'undefined') return 'light'
    return localStorage.getItem('website-color-mode') || 'light'
  })
  const [surfaceMode, setSurfaceModeState] = useState(() => {
    if (typeof window === 'undefined') return 'glass'
    return localStorage.getItem('website-surface-mode') === 'transparent' ? 'transparent' : 'glass'
  })

  useEffect(() => {
    const loadTheme = async () => {
      try {
        if (localThemeRevisionRef.current !== 0) return
        const requestRevision = localThemeRevisionRef.current
        const res = await fetchWithTimeout(`${API_BASE}/api/public/theme`, {}, 7000)
        if (res.ok && localThemeRevisionRef.current === requestRevision) {
          const data = await res.json()
          if (localThemeRevisionRef.current !== requestRevision) return
          if (data.preset) {
            const preset = resolvePresetThemeKey(data.preset)
            setCurrentTheme(preset)
            setCustomTheme(null)
            localStorage.setItem('website-theme', JSON.stringify({ preset }))
          } else if (data.custom) {
            data.custom = normalizeTheme({ ...data.custom, ...visualSettingsRef.current })
            setCustomTheme(data.custom)
            localStorage.setItem('website-theme', JSON.stringify(data))
          }
        }
      } catch (e) {
        console.error('Failed to load theme from backend:', e)
      }
    }

    // The cached theme is already available on the first render. The remote
    // refresh stays deferred and cannot replace a newer local interaction.
    const timer = window.setTimeout(loadTheme, 2500)
    return () => window.clearTimeout(timer)
  }, [])

  useLayoutEffect(() => {
    const root = document.documentElement
    root.classList.toggle('surfaces-transparent', surfaceMode === 'transparent')
    root.setAttribute('data-surface-mode', surfaceMode)
  }, [surfaceMode])

  useLayoutEffect(() => {
    const theme = normalizeTheme(customTheme || PRESET_THEMES[resolvePresetThemeKey(currentTheme)])
    if (!theme) return

    const modeTokens = getModeTokens(theme, colorMode)
    const backgroundLayer = getThemeBackgroundLayer(theme)
    const fallbackBackground = modeTokens.fallbackBackground
    const root = document.documentElement

    root.style.setProperty('--theme-primary', theme.primary)
    root.style.setProperty('--theme-secondary', theme.secondary)
    root.style.setProperty('--theme-accent', theme.accent)
    root.style.setProperty('--theme-text-primary', modeTokens.textPrimary)
    root.style.setProperty('--theme-text-secondary', modeTokens.textSecondary)
    root.style.setProperty('--theme-bg', fallbackBackground)
    root.style.setProperty('--theme-page-bg', fallbackBackground)
    root.style.setProperty('--theme-bg-image', backgroundLayer.image)
    root.style.setProperty('--theme-bg-image-opacity', backgroundLayer.opacity)
    root.style.setProperty('--theme-bg-image-blur', backgroundLayer.blur)
    root.style.setProperty('--theme-bg-position', backgroundLayer.position)
    root.style.setProperty('--theme-bg-size', backgroundLayer.size)
    root.style.setProperty('--theme-bg-repeat', backgroundLayer.repeat)
    root.style.setProperty('--theme-bg-overlay', modeTokens.imageOverlay)
    root.style.setProperty('--theme-card-bg', modeTokens.cardBg)
    root.style.setProperty('--theme-surface', modeTokens.surface)
    root.style.setProperty('--theme-surface-soft', modeTokens.surfaceSoft)
    root.style.setProperty('--theme-border', modeTokens.border)
    root.style.setProperty('--theme-glass-blur', '12px')
    const useLightTransparentText = colorMode === 'dark'
      || theme.backgroundStyle === 'image'
      || theme.backgroundStyle === 'gradient'
      || isDarkSolid(theme.background)
    root.style.setProperty('--theme-transparent-text', useLightTransparentText ? '#f8fafc' : '#111827')
    root.style.setProperty('--theme-transparent-muted', useLightTransparentText ? '#e2e8f0' : '#374151')
    root.style.setProperty('--theme-transparent-border', useLightTransparentText ? 'rgba(255,255,255,0.48)' : 'rgba(17,24,39,0.28)')
    root.style.setProperty('--theme-transparent-shadow', useLightTransparentText ? '0 1px 3px rgba(0,0,0,0.92)' : '0 1px 2px rgba(255,255,255,0.9)')
    root.style.setProperty('--theme-gradient', `linear-gradient(135deg, ${theme.primary}, ${theme.secondary})`)
    root.style.setProperty('--theme-gradient-text', `linear-gradient(90deg, ${theme.primary}, ${theme.secondary}, ${theme.accent})`)
    root.style.setProperty('--theme-gradient-hover', `linear-gradient(135deg, ${adjustBrightness(theme.primary, -15)}, ${adjustBrightness(theme.secondary, -15)})`)
    root.style.setProperty('--theme-shadow', `0 10px 30px -10px ${theme.primary}40`)
    root.style.setProperty('--theme-shadow-lg', `0 20px 50px -15px ${theme.primary}50`)
    root.setAttribute('data-theme', currentTheme)
    root.setAttribute('data-color-mode', colorMode)
    root.classList.toggle('dark', colorMode === 'dark')
    root.classList.toggle('theme-dark', colorMode === 'dark')
    root.classList.toggle('theme-has-image', theme.backgroundStyle === 'image' && Boolean(theme.backgroundImage))

    if (customTheme) {
      root.setAttribute('data-custom-theme', 'true')
    } else {
      root.removeAttribute('data-custom-theme')
    }

    document.body.style.background = fallbackBackground

  }, [currentTheme, customTheme, colorMode])

  const setTheme = (themeKey) => {
    localThemeRevisionRef.current += 1
    const preset = resolvePresetThemeKey(themeKey)
    setCurrentTheme(preset)
    setCustomTheme(null)
    localStorage.setItem('website-theme', JSON.stringify({ preset }))
  }

  const setCustomThemeConfig = (theme) => {
    localThemeRevisionRef.current += 1
    const normalized = normalizeTheme(theme)
    visualSettingsRef.current = {
      backgroundImageOpacity: normalized.backgroundImageOpacity,
      backgroundBlur: normalized.backgroundBlur,
      cardOpacity: normalized.cardOpacity,
    }
    setCustomTheme(normalized)
    localStorage.setItem('website-theme', JSON.stringify({ custom: normalized }))
    localStorage.setItem('website-visual-settings', JSON.stringify(visualSettingsRef.current))
  }

  const setColorMode = (mode) => {
    const nextMode = mode === 'dark' ? 'dark' : 'light'
    setColorModeState(nextMode)
    localStorage.setItem('website-color-mode', nextMode)
  }

  const toggleColorMode = () => {
    setColorMode(colorMode === 'dark' ? 'light' : 'dark')
  }

  const setSurfaceMode = (mode) => {
    const nextMode = mode === 'transparent' ? 'transparent' : 'glass'
    setSurfaceModeState(nextMode)
    localStorage.setItem('website-surface-mode', nextMode)
  }

  const toggleSurfaceMode = () => {
    setSurfaceMode(surfaceMode === 'transparent' ? 'glass' : 'transparent')
  }

  const getActiveTheme = () => normalizeTheme(customTheme || PRESET_THEMES[resolvePresetThemeKey(currentTheme)])

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
        surfaceMode,
        setSurfaceMode,
        toggleSurfaceMode,
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
