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
      backgroundImageOpacity: 42,
      backgroundBlur: 3.5,
    })).toEqual({
      image: 'url("/uploads/background.webp")',
      opacity: '0.42',
      blur: '3.5px',
      position: 'right bottom',
      size: 'contain',
      repeat: 'repeat',
    })
  })

  it('removes the image immediately for a non-image background', () => {
    expect(getThemeBackgroundLayer({ backgroundStyle: 'solid' })).toMatchObject({
      image: 'none',
      opacity: '0',
      blur: '0px',
    })
  })

  it('clamps unsafe visual settings while preserving zero blur', () => {
    expect(getThemeBackgroundLayer({
      backgroundStyle: 'image',
      backgroundImage: '/uploads/background.webp',
      backgroundImageOpacity: 120,
      backgroundBlur: 0,
    })).toMatchObject({
      opacity: '1',
      blur: '0px',
    })

    expect(getThemeBackgroundLayer({
      backgroundStyle: 'image',
      backgroundImage: '/uploads/background.webp',
      backgroundImageOpacity: -5,
      backgroundBlur: 80,
    })).toMatchObject({
      opacity: '0',
      blur: '24px',
    })
  })

  it('rejects scriptable background URLs and CSS injection tokens', () => {
    const layer = getThemeBackgroundLayer({
      backgroundStyle: 'image',
      backgroundImage: 'javascript:alert(1)',
      backgroundPosition: 'center; color:red',
      backgroundSize: 'cover; background:url(https://evil.example)',
      backgroundRepeat: 'repeat',
    })
    expect(layer.image).toBe('none')
    expect(layer.position).toBe('center')
    expect(layer.size).toBe('cover')
  })
})
