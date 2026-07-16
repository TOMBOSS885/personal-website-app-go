// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, publicApi, userApi } from './client'

afterEach(() => vi.restoreAllMocks())

describe('desktop user API', () => {
  it('uses the desktop login contract without cookies', async () => {
    const fetchMock = vi.spyOn(window, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      accessToken: 'header.payload.signature',
      tokenType: 'Bearer',
      expiresAt: '2026-07-15T00:00:00Z',
      expiresIn: 86400,
      user: { id: 7, username: 'reader', email: 'reader@example.com', status: 'active', passwordConfigured: true, createdAt: '2026-07-14T00:00:00Z' },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))

    await userApi.desktopLogin('https://blog.example.com', 'reader', 'password123')

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://blog.example.com/api/user-auth/desktop/login')
    expect(init?.method).toBe('POST')
    expect(init?.credentials).toBeUndefined()
    expect(init?.body).toBe(JSON.stringify({ identifier: 'reader', password: 'password123' }))
  })

  it('adds bearer authorization to account requests', async () => {
    const fetchMock = vi.spyOn(window, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      id: 7, username: 'reader', email: 'reader@example.com', status: 'active', passwordConfigured: true, createdAt: '2026-07-14T00:00:00Z',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))

    await userApi.me('https://blog.example.com', 'header.payload.signature')

    const [, init] = fetchMock.mock.calls[0]
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer header.payload.signature')
  })

  it('reports a missing desktop endpoint as an API error', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue(new Response(JSON.stringify({ message: 'not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    }))

    await expect(userApi.desktopLogin('https://blog.example.com', 'reader', 'password123'))
      .rejects.toEqual(expect.objectContaining<ApiError>({ status: 404, message: 'not found' }))
  })
})

describe('protected article API', () => {
  it('adds bearer authorization to article, unlock, and comment requests', async () => {
    const fetchMock = vi.spyOn(window, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      id: 3,
      title: 'Protected',
      summary: '',
      content: '',
      createdAt: '2026-07-16T00:00:00Z',
      comments: [],
      total: 0,
      totalThreads: 0,
      page: 0,
      size: 20,
      hasMore: false,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))

    const token = 'user.header.payload'
    await publicApi.article('https://blog.example.com', 3, token)
    await publicApi.unlockArticle('https://blog.example.com', 3, 'article-password', token)
    await publicApi.comments('https://blog.example.com', 3, 0, token)

    expect(fetchMock).toHaveBeenCalledTimes(3)
    for (const [, init] of fetchMock.mock.calls) {
      expect(new Headers(init?.headers).get('Authorization')).toBe(`Bearer ${token}`)
    }
    expect(fetchMock.mock.calls[1][1]?.body).toBe(JSON.stringify({ password: 'article-password' }))
  })
})
