import { describe, expect, it } from 'vitest'
import { filterCoverImages, validateStaticSiteZipSelection } from './ArticleManager'

describe('static frontend ZIP selection', () => {
  it('accepts one ZIP file regardless of extension casing', () => {
    const file = { name: 'campus-site.ZIP' }
    expect(validateStaticSiteZipSelection([file])).toEqual({ file, error: '' })
  })

  it('rejects empty, multiple, and non-ZIP selections', () => {
    expect(validateStaticSiteZipSelection([]).error).toBe('请选择 ZIP 文件')
    expect(validateStaticSiteZipSelection([{ name: 'a.zip' }, { name: 'b.zip' }]).error).toBe('一次只能上传一个 ZIP 文件')
    expect(validateStaticSiteZipSelection([{ name: 'index.html' }]).error).toBe('静态前端必须使用 .zip 压缩包')
  })
})

describe('uploaded cover image filtering', () => {
  const images = [
    { name: 'Summer-Cover.webp', url: '/uploads/articles/2026/09/summer.webp' },
    { name: 'architecture.png', url: '/uploads/articles/2026/08/system-design.png' },
    { name: 'invalid-without-url.png' },
    null,
  ]

  it('keeps valid uploaded images and searches names case-insensitively', () => {
    expect(filterCoverImages(images, '')).toHaveLength(2)
    expect(filterCoverImages(images, 'summer')).toEqual([images[0]])
    expect(filterCoverImages(images, 'ARCHITECTURE')).toEqual([images[1]])
  })

  it('also matches the stored upload URL and handles invalid input', () => {
    expect(filterCoverImages(images, 'system-design')).toEqual([images[1]])
    expect(filterCoverImages(null, 'cover')).toEqual([])
  })
})
