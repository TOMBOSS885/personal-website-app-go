import { describe, expect, it } from 'vitest'
import { calculateContainedSize, isSupportedImageType } from './imageCompression'

describe('calculateContainedSize', () => {
  it('keeps images already within the limit', () => {
    expect(calculateContainedSize(1280, 720)).toEqual({ width: 1280, height: 720 })
  })

  it('scales large images without changing their aspect ratio', () => {
    expect(calculateContainedSize(4000, 2000)).toEqual({ width: 1920, height: 960 })
    expect(calculateContainedSize(2000, 4000)).toEqual({ width: 960, height: 1920 })
  })
})

describe('isSupportedImageType', () => {
  it('accepts raster upload formats and rejects SVG or scriptable image types', () => {
    expect(isSupportedImageType('image/jpeg')).toBe(true)
    expect(isSupportedImageType('image/webp')).toBe(true)
    expect(isSupportedImageType('image/svg+xml')).toBe(false)
    expect(isSupportedImageType('text/html')).toBe(false)
  })
})
