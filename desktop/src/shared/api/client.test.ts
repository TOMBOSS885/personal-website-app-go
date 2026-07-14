import { describe, expect, it } from 'vitest'
import { isSecureServerUrl, normalizeServerUrl, resolveServerUrl } from './client'

describe('normalizeServerUrl', () => {
  it('adds https and removes a trailing slash', () => {
    expect(normalizeServerUrl(' blog.example.com/ ')).toBe('https://blog.example.com')
  })

  it('keeps a deployment base path', () => {
    expect(normalizeServerUrl('https://example.com/site/')).toBe('https://example.com/site')
  })

  it('rejects credentials and unsupported schemes', () => {
    expect(() => normalizeServerUrl('ftp://example.com')).toThrow()
    expect(() => normalizeServerUrl('https://user:pass@example.com')).toThrow()
  })
})

describe('resolveServerUrl', () => {
  it('resolves server-relative media instead of the Tauri origin', () => {
    expect(resolveServerUrl('https://blog.example.com', '/uploads/cover.webp'))
      .toBe('https://blog.example.com/uploads/cover.webp')
  })

  it('preserves absolute media URLs', () => {
    expect(resolveServerUrl('https://blog.example.com', 'https://cdn.example.com/a.png'))
      .toBe('https://cdn.example.com/a.png')
  })
})

describe('isSecureServerUrl', () => {
  it('allows HTTPS and local development HTTP', () => {
    expect(isSecureServerUrl('https://blog.example.com')).toBe(true)
    expect(isSecureServerUrl('http://127.0.0.1:8080')).toBe(true)
    expect(isSecureServerUrl('http://example.com')).toBe(false)
  })
})
