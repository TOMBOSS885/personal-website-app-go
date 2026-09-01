import { describe, expect, it } from 'vitest'
import { resolveRouteMetadata } from './RouteMetadata'

describe('route metadata', () => {
  it.each([
    ['/archive', '文章归档'],
    ['/series', '专题系列'],
    ['/library', '阅读清单'],
  ])('recognizes the discovery route %s', (pathname, title) => {
    const metadata = resolveRouteMetadata(pathname, { nickname: '测试博客' }, 'zh')

    expect(metadata.title).toBe(`${title} - 测试博客`)
    expect(metadata.title).not.toContain('页面不存在')
  })

  it('keeps the device-local reading list out of search indexes', () => {
    expect(resolveRouteMetadata('/library', null, 'en')).toMatchObject({
      title: 'Reading List - tombossking',
      robots: 'noindex, follow',
    })
  })

  it('still marks unknown routes as missing pages', () => {
    expect(resolveRouteMetadata('/missing', null, 'zh').title).toBe('页面不存在 - tombossking')
  })
})
