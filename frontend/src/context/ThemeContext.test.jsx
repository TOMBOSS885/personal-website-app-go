import { describe, expect, it } from 'vitest'
import {
  DEFAULT_THEME_KEY,
  getThemeBackgroundLayer,
  resolvePresetThemeKey,
} from './ThemeContext'

describe('resolvePresetThemeKey', () => {
  it('keeps a known preset', () => {
    expect(resolvePresetThemeKey('blue-cyan')).toBe('blue-cyan')
  })

  it('falls back when the backend returns an unknown preset', () => {
    expect(resolvePresetThemeKey('default')).toBe(DEFAULT_THEME_KEY)
    expect(resolvePresetThemeKey('')).toBe(DEFAULT_THEME_KEY)
  })
})

describe('getThemeBackgroundLayer', () => {
  it('returns every image layout value without waiting for image loading', () => {
    expect(getThemeBackgroundLayer({
      backgroundStyle: 'image',
      backgroundImage: '/uploads/background.webp',
      backgroundPosition: 'right bottom',
      backgroundSize: 'contain',
      backgroundRepeat: 'repeat',
    })).toEqual({
      image: 'url("/uploads/background.webp")',
      opacity: '1',
      position: 'right bottom',
      size: 'contain',
      repeat: 'repeat',
    })
  })

  it('removes the image immediately for a non-image background', () => {
    expect(getThemeBackgroundLayer({ backgroundStyle: 'solid' })).toMatchObject({
      image: 'none',
      opacity: '0',
    })
  })
})
