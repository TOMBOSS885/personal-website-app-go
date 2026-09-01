import { describe, expect, it } from 'vitest'
import { safeDownloadHref, safeExternalHref, safeStaticSiteSrc } from './safeUrl'

describe('safeExternalHref', () => {
  it('allows http, https, and mailto URLs', () => {
    expect(safeExternalHref('https://example.com/path')).toBe('https://example.com/path')
    expect(safeExternalHref('mailto:test@example.com')).toBe('mailto:test@example.com')
  })

  it('blocks scriptable URLs', () => {
    expect(safeExternalHref('javascript:alert(1)')).toBe('')
    expect(safeExternalHref('data:text/html,<script>alert(1)</script>')).toBe('')
  })
})

describe('safeDownloadHref', () => {
  it('allows only HTTP and HTTPS download targets', () => {
    expect(safeDownloadHref('https://example.com/client.exe')).toBe('https://example.com/client.exe')
    expect(safeDownloadHref('http://example.com/client.dmg')).toBe('http://example.com/client.dmg')
    expect(safeDownloadHref('mailto:test@example.com')).toBe('')
    expect(safeDownloadHref('javascript:alert(1)')).toBe('')
  })
})

describe('safeStaticSiteSrc', () => {
  const origin = 'https://blog.example.com'
  const signedPath = '/api/public/article-sites/42/01234567-89ab-cdef-0123-456789abcdef/3/1780000000/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/index.html'

  it('allows only same-origin signed article-site routes', () => {
    expect(safeStaticSiteSrc(signedPath, origin)).toBe(signedPath)
    expect(safeStaticSiteSrc(`${origin}${signedPath}?preview=1`, origin)).toBe(`${signedPath}?preview=1`)
  })

  it('blocks scriptable, cross-origin, and unsigned frame sources', () => {
    expect(safeStaticSiteSrc('javascript:alert(1)', origin)).toBe('')
    expect(safeStaticSiteSrc(`https://evil.example${signedPath}`, origin)).toBe('')
    expect(safeStaticSiteSrc('/uploads/article-sites/42/index.html', origin)).toBe('')
  })
})
