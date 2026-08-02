import { describe, expect, it } from 'vitest'
import { parseResponsiveImage, responsiveImageSourceSet, responsiveImageUrlForWidth } from './responsiveImages'

describe('responsive image URLs', () => {
  const source = '/uploads/articles/2026/08/example@responsive-320-640-1280.webp'

  it('parses generated responsive source markers', () => {
    expect(parseResponsiveImage(source)).toMatchObject({ widths: [320, 640, 1280], extension: 'webp' })
  })

  it('creates a browser srcset without including the oversized source', () => {
    expect(responsiveImageSourceSet(source)).toBe([
      '/uploads/articles/2026/08/example@320w.webp 320w',
      '/uploads/articles/2026/08/example@640w.webp 640w',
      '/uploads/articles/2026/08/example@1280w.webp 1280w',
    ].join(', '))
  })

  it('selects the smallest suitable CSS background and preserves legacy URLs', () => {
    expect(responsiveImageUrlForWidth(source, 500)).toBe('/uploads/articles/2026/08/example@640w.webp')
    expect(responsiveImageUrlForWidth(source, 1600)).toBe(source)
    expect(responsiveImageUrlForWidth('/uploads/articles/legacy.webp', 500)).toBe('/uploads/articles/legacy.webp')
  })
})
