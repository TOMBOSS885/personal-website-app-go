import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchPublicHomeData, getCachedPublicHomeData, invalidatePublicHomeData } from './publicHomeData'

afterEach(() => {
  invalidatePublicHomeData()
  vi.unstubAllGlobals()
})

describe('public home data cache', () => {
  it('shares one in-flight request between homepage consumers', async () => {
    const payload = { profile: { nickname: 'Test' }, articles: [] }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(payload) })
    vi.stubGlobal('fetch', fetchMock)

    const [first, second] = await Promise.all([
      fetchPublicHomeData('zh'),
      fetchPublicHomeData('zh'),
    ])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/public/home?lang=zh')
    expect(first).toBe(payload)
    expect(second).toBe(payload)
  })

  it('invalidates cached data after profile changes', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ profile: {} }) })
    vi.stubGlobal('fetch', fetchMock)

    await fetchPublicHomeData('en')
    invalidatePublicHomeData()
    await fetchPublicHomeData('en')

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('persists successful home data for a full page reload', async () => {
    const values = new Map()
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(key => values.get(key) || null),
      setItem: vi.fn((key, value) => values.set(key, value)),
      removeItem: vi.fn(key => values.delete(key)),
    })
    const payload = { profile: { nickname: 'tombossking' }, articles: [{ id: 1 }] }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(payload) }))

    await fetchPublicHomeData('zh')

    expect(getCachedPublicHomeData('zh')).toEqual(payload)
    expect(localStorage.setItem).toHaveBeenCalledTimes(1)
  })
})
