import { describe, expect, it } from 'vitest'
import { normalizeServerOrigin, resolveAssetUrl } from './client'

describe('normalizeServerOrigin', () => {
  it('normalizes an HTTPS origin', () => {
    expect(normalizeServerOrigin('https://example.com/')).toBe('https://example.com')
  })

  it('rejects paths and embedded credentials', () => {
    expect(() => normalizeServerOrigin('https://example.com/api')).toThrow()
    expect(() => normalizeServerOrigin('https://user:pass@example.com')).toThrow()
  })
})

describe('resolveAssetUrl', () => {
  it('resolves a same-origin relative upload URL', () => {
    expect(resolveAssetUrl('https://example.com', '/uploads/a.webp')).toBe('https://example.com/uploads/a.webp')
  })

  it('rejects cross-origin assets', () => {
    expect(() => resolveAssetUrl('https://example.com', 'https://evil.example/a.webp')).toThrow()
  })
})
