import { describe, expect, it } from 'vitest'
import { classifyApiRequest, getSharedHostTransport } from './adminFetch'

describe('getSharedHostTransport', () => {
  it('tunnels admin DELETE requests through POST', () => {
    expect(getSharedHostTransport('DELETE', true)).toEqual({
      method: 'POST',
      override: 'DELETE',
    })
  })

  it('keeps other requests unchanged', () => {
    expect(getSharedHostTransport('PUT', true)).toEqual({ method: 'PUT', override: '' })
    expect(getSharedHostTransport('DELETE', false)).toEqual({ method: 'DELETE', override: '' })
  })
})

describe('classifyApiRequest', () => {
  const origin = 'https://blog.example.com'

  it('recognizes only exact same-origin admin and authentication API paths', () => {
    expect(classifyApiRequest('/api/admin/articles', origin).isAdminRequest).toBe(true)
    expect(classifyApiRequest('https://blog.example.com/api/auth/logout', origin)).toEqual({
      isAdminRequest: false,
      isAdminAuth: true,
      isAuthMutation: true,
    })
    expect(classifyApiRequest('/api/public/search?q=/api/admin/', origin).isAdminRequest).toBe(false)
  })

  it('never classifies cross-origin lookalike URLs as privileged requests', () => {
    expect(classifyApiRequest('https://evil.example/api/admin/articles', origin)).toEqual({
      isAdminRequest: false,
      isAdminAuth: false,
      isAuthMutation: false,
    })
    expect(classifyApiRequest('//evil.example/api/auth/logout', origin).isAdminAuth).toBe(false)
  })
})
