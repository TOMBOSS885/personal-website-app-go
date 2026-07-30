import { describe, expect, it } from 'vitest'
import { DEFAULT_THEME_KEY, resolvePresetThemeKey } from './ThemeContext'

describe('resolvePresetThemeKey', () => {
  it('keeps a known preset', () => {
    expect(resolvePresetThemeKey('blue-cyan')).toBe('blue-cyan')
  })

  it('falls back when the backend returns an unknown preset', () => {
    expect(resolvePresetThemeKey('default')).toBe(DEFAULT_THEME_KEY)
    expect(resolvePresetThemeKey('')).toBe(DEFAULT_THEME_KEY)
  })
})
